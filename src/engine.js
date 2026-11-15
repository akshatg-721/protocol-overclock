import { DEFAULT_BINDINGS, normalizeKey, actionHeld, actionKeys, keyLabel } from './controls.js';
import { sound, setOverclockAudio, setMusicIntensity } from './audio.js';
import { LEVELS, WEAPON_DAMAGE, ENEMY_HP, ENERGY_CAPACITY, RELAY_SHARDS, SECTOR_CLEAR_SHARDS, enemyShardDrops } from './levels.js';

const W = 1200, H = 760;
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min, max) => min + Math.random() * (max - min);

export function createEngine(canvas, options) {
  const ctx = canvas.getContext('2d');
  const level = LEVELS[options.level - 1];
  const run = structuredClone(options.run);
  const upgrades = run.upgrades;
  const player = { x: 600, y: 450, hp: Math.min(options.run.health ?? 100, 100 + upgrades.hull * 40), maxHp: 100 + upgrades.hull * 40, energy: ENERGY_CAPACITY[upgrades.energy], maxEnergy: ENERGY_CAPACITY[upgrades.energy], angle: -.8, invuln: 0 };
  const keys = new Set();
  const bindings = () => options.getBindings?.() || DEFAULT_BINDINGS;
  const held = action => actionHeld(keys,bindings(),action);
  const badge = action => keyLabel(bindings()[action]);
  const pointer = { x: 840, y: 260, down: false, inside: false };
  let clock = 0, shotTimer = 0, spawnTimer = 1.5, empCooldown = 0, combo = 1, comboTimer = 0, chain = 0;
  let shake = 0, hitStop = 0, lastFrame = 0, frame, hudTime = 0, done = false, overclockWasOn = false;
  let overclockExhausted = false, dashCooldown = 0, dashTime = 0, dashAngle = 0, muzzle = 0;
  const ghosts = [];
  let empOrigin=null, empReached=0;
  let shieldCharge = run.perk === "shield" ? 1 : 0;
  let destroyed = 0, bossPhase = false, laserHit = 0, empRing = 0;
  const enemies = [], bullets = [], particles = [], numbers = [], shards = [], rings = [];
  const active = options.active;
  const covers = level.cover.map(([x,y,w,h])=>({x,y,w,h,hp:100,maxHp:100}));
  const relays = level.positions.map(([x,y],i)=>({x,y,id:i,hp:level.hp,maxHp:level.hp,radius:30,hack:0,broken:false}));
  const boss = {x:600,y:220,hp:6400,maxHp:6400,radius:65,timer:2.5,phase:1,beam:0,charge:0,target:null,phaseFlash:0,phaseTime:0,phaseLock:0};
  const barrels = level.id===1 ? relays.map(r=>({x:r.x+(r.x<600?90:-90),y:r.y+65,hp:140,relay:r})) : [];
  const zones=[], wreckage=[];
  let worldTime=0, hazardTimer=4, lastVelocity={x:0,y:0}, lastPlayer={x:600,y:450}, shieldTimer=0;
  let shotSerial=0, spawnSerial=0;
  let finale=null, scoredKills=0, lastHint=-10;
  const sectorShardStart=run.totalShards||0;let pickupPending=0,pickupLast=-1,collectSoundLast=-1;const trailerEvents=new Set();
  const touch = { id: null, startX: 0, startY: 0, x: 0, y: 0 };
  let touchAim = null;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  function coords(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    return { x: (event.clientX - rect.left - (rect.width - W * scale) / 2) / scale, y: (event.clientY - rect.top - (rect.height - H * scale) / 2) / scale };
  }
  function keydown(e) {
    if (options.trailer || !active || done || finale || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if(options.isPaused()&&e.code!=='Escape')return;
    const code=normalizeKey(e.code);
    const action=Object.keys(DEFAULT_BINDINGS).find(id=>actionKeys(bindings(),id).includes(code));
    if(action || code==='Space' || code.startsWith('Arrow')) e.preventDefault();
    if(e.metaKey)return;
    keys.add(code);
    if(action==='dash'&&!e.repeat)dash();
    if(action==='emp'&&!e.repeat)emp();
    if(code==='Escape'&&!e.repeat&&options.handleEscape!==false)options.onPause();
  }
  function keyup(e) { keys.delete(normalizeKey(e.code)); }
  function pointermove(e) {
    if (e.pointerType === 'touch' && touch.id === e.pointerId) {
      touch.x = clamp((e.clientX - touch.startX) / 42, -1, 1); touch.y = clamp((e.clientY - touch.startY) / 42, -1, 1);
    } else { Object.assign(pointer, coords(e)); pointer.inside = true; }
  }
  function pointerdown(e) {
    if (options.trailer || !active || finale) return;
    canvas.focus();
    if (e.button === 2) { e.preventDefault(); dash(); return; }
    if (e.pointerType === 'touch' && coords(e).x < W / 2) {
      touch.id = e.pointerId; touch.startX = e.clientX; touch.startY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    } else { Object.assign(pointer, coords(e)); pointer.down = true; if (e.pointerType === 'touch') touchAim = e.pointerId; }
    options.onInteract?.();
  }
  function pointerup(e) {
    if (touch.id === e.pointerId) { touch.id = null; touch.x = 0; touch.y = 0; }
    else { pointer.down = false; if (touchAim === e.pointerId) touchAim = null; }
  }
  function blur() { keys.clear(); pointer.down = false; touch.x = 0; touch.y = 0; touch.id = null; if (active && !done) options.onBlur?.(); }
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('pointerup', pointerup); window.addEventListener('blur', blur);
  canvas.addEventListener('pointermove', pointermove); canvas.addEventListener('pointerdown', pointerdown); canvas.addEventListener('pointercancel', pointerup);
  const contextmenu = e => e.preventDefault(); canvas.addEventListener('contextmenu', contextmenu);
  canvas.addEventListener('pointerleave', leave);
  function leave() { pointer.inside = false; }

  function burst(x, y, color, count = 16, direction = null) {
    for (let i = 0; i < count; i++) {
      const a = direction === null ? rand(0, TAU) : direction + rand(-1.15, 1.15);
      const speed = rand(50, 250);
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.2, .6), max: .6, color, size: rand(1, 3) });
    }
  }
  function number(x, y, text, color = '#c2f66e') { numbers.push({ x, y, text, color, life: 1 }); }
  function toast(id, title, detail) {
    if (run.achievements.includes(id)) return;
    run.achievements.push(id); options.onAchievement({ title, detail });
  }
  function award(points, multiply=true) { const earned = Math.round(points * (multiply?combo:1)); run.score += earned; run.bank += earned; return earned; }
  function kill(enemy) {
    if (enemy.dead) return;
    enemy.dead = true; run.kills++; chain++; comboTimer = 4;
    combo = Math.min(8, 1 + Math.floor(chain / 2)); const earned=scoredKills++<24?award(enemy.type==='gunner'?180:120):0;
    burst(enemy.x, enemy.y, enemy.color, 36, Math.atan2(enemy.y - player.y, enemy.x - player.x));
    number(enemy.x, enemy.y - 18, earned?`+${earned}`:'SECTOR SCORE CAP');
    for(const value of enemyShardDrops(enemy.type))shards.push({x:enemy.x+rand(-15,15),y:enemy.y+rand(-15,15),age:0,value}); wreckage.push({x:enemy.x,y:enemy.y,r:20,color:enemy.color});
    if(overclockWasOn) number(enemy.x,enemy.y-45,`OVERCLOCK x${combo}!`,'#79d9f4');
    shake = Math.max(shake, 4); hitStop = .035; sound('explode');
    if (run.kills === 1) toast('first', 'FIRST CONTACT', 'First hostile eliminated. Welcome to the network.');
    if (combo >= 4) toast('combo', 'CHAIN REACTION', 'Combo multiplier reached 4×. Keep it going.');
    if (combo === 8) toast('eight', 'SYSTEM OVERLOAD', 'Maximum 8× multiplier achieved.');
  }
  function hurt(amount, cause = 'Hostile contact') {
    if (options.isGod() || player.invuln > 0 || done || finale) return;
    if (shieldCharge) { shieldCharge = 0; shieldTimer=12; player.invuln = 1; number(player.x, player.y - 30, "NANOSHIELD", "#79d9f4"); return; }
    const actualDamage=Math.min(player.hp,amount);player.hp = Math.max(0, player.hp - amount); player.invuln = .5; run.damageTaken += actualDamage;
    shake = 7; burst(player.x, player.y, '#f48d9c', 12); sound('playerHit'); number(player.x, player.y - 25, `−${amount}`, '#f48d9c');
    if (player.hp <= 0) {run.fatalThreat=cause; finish(false);}
  }
  function finish(won) {
    if(done || finale) return;
    if(won){run.shards+=SECTOR_CLEAR_SHARDS;run.totalShards+=SECTOR_CLEAR_SHARDS;finale={time:0,nextBurst:0};keys.clear();pointer.down=false;run.cleared=[...new Set([...(run.cleared||[]),level.id])];setOverclockAudio(false);sound('victory');return;}
    deliver(false);
  }
  function deliver(won) {
    if (done) return;
    done = true; keys.clear(); pointer.down = false;
    if (won) {
      if(level.id===3){burst(boss.x,boss.y,'#f3a0ac',100);shake=22;hitStop=.16;sound('explode');}
      award(level.id === 3 ? 2000 : 1000, false); sound('victory');
      toast(`level-${level.id}`, level.id === 3 ? 'PROTOCOL TERMINATED' : 'SECTOR SECURED', level.id === 3 ? 'The mainframe is yours.' : `${level.name} cleared. +1,000 base score.`);
    }
    options.onHud(snapshot());
    run.lastSectorShards=run.totalShards-sectorShardStart;run.health=player.hp; run.termination=won?'AETHER core destroyed after all shield links severed':run.fatalThreat;
    options.onEnd({ won, run, health: player.hp });
  }
  function dash() {
    if (!active || done || finale || options.isPaused() || dashCooldown > 0) return;
    dashCooldown = run.perk === 'dash' ? 1.7 : 3; dashTime = .19; player.invuln = run.perk==='dash'?.5:.32;
    const dx = Number(held('right')) - Number(held('left')) + touch.x, dy = Number(held('down')) - Number(held('up'))+touch.y;
    dashAngle = dx || dy ? Math.atan2(dy, dx) : player.angle;
    sound('dash'); burst(player.x, player.y, '#79d9f4', 28, dashAngle + Math.PI);
  }
  function emp() {
    if (!active || done || finale || empCooldown > 0 || options.isPaused()) return;
    empCooldown = 12; empRing = .65; shake = 9; sound('emp');
    for (const enemy of enemies) if (!enemy.dead && dist(player, enemy) < 270) { enemy.hp -= 105+upgrades.damage*20; if (enemy.hp <= 0) kill(enemy); }
    for (const relay of relays) if (relay.hp > 0 && dist(player, relay) < 270) damageRelay(relay, 95);
    if (level.id === 3 && bossPhase && boss.phaseLock<=0 && dist(player, boss) < 320) { boss.hp = Math.max(0, boss.hp - 160); if (boss.hp === 0) finish(true); }
    empOrigin={x:player.x,y:player.y}; empReached=0;
    toast('emp', 'ELECTROMAGNETIC PERSONALITY', 'Local 290-unit shockwave deployed. Nearby projectiles erased.');
  }
  function damageRelay(relay, damage) {
    if(dist(player,relay)>(relay.broken?350:level.range)||(!relay.broken&&relay.hack<level.hackTime)){
      if(clock-lastHint>1.2){number(relay.x,relay.y-60,relay.broken?'ARMOR BROKEN / ADVANCE WITHIN 350':dist(player,relay)>level.range?'ENTER GOLD RING':'DECRYPTING SHIELD','#ffc76d');lastHint=clock;}return;
    }
    relay.hp -= damage; burst(relay.x, relay.y, level.color, 5); number(relay.x + rand(-12, 12), relay.y - 30, Math.round(damage), '#e2e9d9');
    if (relay.hp <= 0) {
      destroyed++; award(650,false); for(let i=0;i<RELAY_SHARDS;i++)shards.push({x:relay.x+rand(-35,35),y:relay.y+rand(-35,35),age:0,value:1}); wreckage.push({x:relay.x,y:relay.y,r:45,color:level.color});
      burst(relay.x, relay.y, level.color, 36); rings.push({ x: relay.x, y: relay.y, life: .5, color: level.color });
      sound('explode'); shake = 8; hitStop = .055;
      if (destroyed === level.target) {
        if (level.id === 3) { bossPhase = true; hitStop = .12; shake = 18; sound('explode'); burst(boss.x, boss.y, '#79d9f4', 70); number(boss.x, boss.y - 80, 'SHIELD OFFLINE', '#f3a0ac'); }
        else finish(true);
      }
    }
  }
  function spawn() {
    if (enemies.filter(e => !e.dead).length >= 16) return;
    const side = Math.floor(rand(0, 4));
    let x = side === 0 ? 65 : side === 1 ? 1135 : rand(100, 1100);
    let y = side === 2 ? 65 : side === 3 ? 695 : rand(100, 660);
    if (dist({ x, y }, player) < 210) { x = player.x < 600 ? 1080 : 120; y = player.y < 380 ? 650 : 100; }
    const roster=level.id===1?['drone','drone','gunner','charger','mortar']:level.id===2?['gunner','mortar','drone','charger']:['mortar','charger','gunner','drone'];const type=roster[spawnSerial++%roster.length];
    if(level.id===2&&['gunner','mortar'].includes(type)){const nodes=relays.filter(r=>r.hp>0&&dist(player,r)>230);if(nodes.length){const node=nodes[spawnSerial%nodes.length];x=clamp(node.x+rand(-90,90),65,1135);y=clamp(node.y+rand(-70,70),65,695);}}
    enemies.push({ x, y, hp: ENEMY_HP[type], radius: type === 'gunner' ? 17 : 13, type, windup:0, charge:0, aim:0, color:type==='mortar'?'#ffac61':'#ff657e', shot: rand(1.2, 2.6), dead: false });
  }
  function fire(x, y, angle, enemy = false, speed = 650, damage = 20, cause='Predictive gunner plasma') {
    bullets.push({ id:++shotSerial, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, enemy, damage, cause, trail: [], life: 2.6 });
  }
  function solid(x, y, r) {
    return covers.some(c => c.hp > 0 && x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h);
  }
  function snapshot() {
    return { hp: player.hp, maxHp: player.maxHp, energy: player.energy, maxEnergy: player.maxEnergy, score: run.score, bank: run.bank, combo, comboTime: comboTimer / 4, shards: run.shards, kills: run.kills, elapsed: run.elapsed, destroyed, target: level.target, empCooldown, dashCooldown, demo:run.demo, finale:!!finale, shieldCharge, shieldTimer, bossStage:boss.phase, playerX:player.x, playerY:player.y, worldTime, activeLasers:relays.filter(r=>r.hp>0).length, overclock: overclockWasOn, bossX:boss.x,bossY:boss.y,shotsFired:shotSerial,bossHp: boss.hp, bossMax: boss.maxHp, bossPhase, achievements: run.achievements.length };
  }
  function update(dt) {
    if(!active){clock+=dt;worldTime+=dt;return;}
    if(done||options.isPaused())return;
    if(finale){
      finale.time+=dt;clock+=dt*.25;worldTime+=dt*.25;
      for(const e of enemies)if(!e.dead){const a=Math.atan2(player.y-e.y,player.x-e.x);e.x+=Math.cos(a)*65*dt*.25;e.y+=Math.sin(a)*65*dt*.25;}
      for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.trail.push({x:b.x,y:b.y});if(b.trail.length>7)b.trail.shift();b.x+=b.vx*dt*.25;b.y+=b.vy*dt*.25;b.life-=dt*.25;if(b.life<=0)bullets.splice(i,1);}
      if(finale.time>=finale.nextBurst){finale.nextBurst+=.18;const x=level.id===3?boss.x+rand(-100,100):rand(200,1000),y=level.id===3?boss.y+rand(-90,90):rand(150,640);burst(x,y,level.id===3?'#ff8b66':level.color,35);rings.push({x,y,life:.5,color:level.color});wreckage.push({x,y,r:rand(15,50),color:level.color});shake=12;sound('explode');}
      for(let i=shards.length-1;i>=0;i--){const shard=shards[i];shard.x+=(player.x-shard.x)*Math.min(1,dt*10);shard.y+=(player.y-shard.y)*Math.min(1,dt*10);if(dist(shard,player)<25||finale.time>2){collectShard(shard);shards.splice(i,1);}}
      if(finale.time>=2.2)deliver(true);return;
    }
    clock+=dt;
    if (options.isGod()) run.demo = true;
    run.elapsed += dt;
    dashCooldown = Math.max(0, dashCooldown - dt); muzzle = Math.max(0, muzzle - dt);
    for(let i=ghosts.length-1;i>=0;i--){ghosts[i].life-=dt;if(ghosts[i].life<=0)ghosts.splice(i,1);}
    if(dashTime>0){dashTime-=dt;ghosts.push({x:player.x,y:player.y,angle:dashAngle,life:.32});const x=clamp(player.x+Math.cos(dashAngle)*1050*dt,57,W-57),y=clamp(player.y+Math.sin(dashAngle)*1050*dt,57,H-57);if(!solid(x,player.y,12))player.x=x;if(!solid(player.x,y,12))player.y=y;}
    player.invuln -= dt; shotTimer -= dt; empCooldown = Math.max(0, empCooldown - dt); laserHit = Math.max(0, laserHit - dt);
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer === 0) { combo = 1; chain = 0; }
    const overclockRequested = held('overclock') || !!options.isTouchOverclock?.();
    if (!overclockRequested) overclockExhausted = false;
    if (player.energy <= 1) overclockExhausted = true;
    const overclock = overclockRequested && !overclockExhausted && player.energy > 1;
    if (overclock && !overclockWasOn) sound('overclock');
    overclockWasOn = overclock; setOverclockAudio(overclock);
    const hazardScale=overclock?.4:1; worldTime+=dt*hazardScale;
    if(run.perk==='shield'&&!shieldCharge){shieldTimer=Math.max(0,shieldTimer-dt);if(shieldTimer===0){shieldCharge=1;number(player.x,player.y-40,'NANOSHIELD READY','#79d9f4');}}
    for(const r of relays)if(r.hp>0&&dist(player,r)<level.range){if(overclock||dashTime>0)r.phaseAccess=true;if(level.id!==2||r.phaseAccess)r.hack=Math.min(level.hackTime,r.hack+dt);}
    player.energy = clamp(player.energy + (overclock ? -29 : 14 + upgrades.energy * 3) * dt, 0, player.maxEnergy);
    const enemyDt = dt * (overclock ? .4 : 1);
    let dx = Number(held('right')) - Number(held('left')) + touch.x;
    let dy = Number(held('down')) - Number(held('up')) + touch.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    const nx = clamp(player.x + dx * 245 * dt, 57, W - 57), ny = clamp(player.y + dy * 245 * dt, 57, H - 57);
    if (!solid(nx, player.y, 12)) player.x = nx;
    if (!solid(player.x, ny, 12)) player.y = ny;
    player.angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);
    if (pointer.down && shotTimer <= 0) {
      shotTimer = .19 / ((1 + upgrades.rate * .35) * (overclock ? 2 : 1) * (run.perk==='spread'?.85:1));
      fire(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, player.angle, false, 850, WEAPON_DAMAGE[upgrades.damage]);
      const pairs=upgrades.damage+(run.perk==='spread'?1:0);for(let pair=1;pair<=pairs;pair++)for(const sign of [-1,1])fire(player.x,player.y,player.angle+sign*.09*pair,false,850,WEAPON_DAMAGE[upgrades.damage]*.5);
      muzzle = .07;
      sound('shoot'); burst(player.x + Math.cos(player.angle) * 25, player.y + Math.sin(player.angle) * 25, '#d4ff9d', 3, player.angle);
    }
    lastVelocity={x:(player.x-lastPlayer.x)/dt,y:(player.y-lastPlayer.y)/dt};lastPlayer={x:player.x,y:player.y};
    hazardTimer-=enemyDt;if(hazardTimer<=0){zones.push({x:player.x,y:player.y,r:82,timer:1.5,max:1.5,cause:'AETHER orbital mortar lock'});hazardTimer=level.id===3?4.5:5.5;}
    for(let i=zones.length-1;i>=0;i--){const z=zones[i];z.timer-=enemyDt;if(z.timer<=0){burst(z.x,z.y,'#ff7663',35);wreckage.push({x:z.x,y:z.y,r:z.r,color:'#ff7663'});if(dist(player,z)<z.r+12)hurt(z.damage||30,z.cause);zones.splice(i,1);sound('explode');}}
    spawnTimer -= enemyDt;
    if (spawnTimer <= 0) { spawn(); spawnTimer = Math.max(.55, 2.3 - level.id * .3 - clock * .007); }
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const d = dist(player, enemy);
      let speed = ['gunner','mortar'].includes(enemy.type) ? (d > 330 ? 60 : d < 210 ? -45 : 0) : 65 + level.id * 12;
      const flank=enemy.type==='drone'?Math.sin(worldTime+enemy.x*.01)*.6:0;
      if(enemy.type==='charger'){enemy.shot-=enemyDt;if(enemy.windup>0){enemy.windup-=enemyDt;speed=0;if(enemy.windup<=0)enemy.charge=.4;}else if(enemy.charge>0){enemy.charge-=enemyDt;speed=650;enemy.x+=Math.cos(enemy.aim)*speed*enemyDt;enemy.y+=Math.sin(enemy.aim)*speed*enemyDt;speed=0;}else if(enemy.shot<=0){enemy.windup=1;enemy.aim=angle;enemy.shot=4;}}
      if(enemy.type==='mortar'){enemy.shot-=enemyDt;if(enemy.shot<.8)enemy.windup=enemy.shot;if(enemy.shot<=0){zones.push({x:player.x+lastVelocity.x*.2,y:player.y+lastVelocity.y*.2,r:75,timer:1.5,max:1.5,cause:'Mortar Lobber artillery'});enemy.shot=4.5;enemy.windup=0;}}
      const ex = enemy.x + Math.cos(angle+flank) * speed * enemyDt, ey = enemy.y + Math.sin(angle+flank) * speed * enemyDt;
      if (!solid(ex, enemy.y, enemy.radius)) enemy.x = ex; else enemy.y += Math.cos(worldTime * 2 + enemy.x) * 80 * enemyDt;
      if (!solid(enemy.x, ey, enemy.radius)) enemy.y = ey; else enemy.x += Math.sin(worldTime * 2 + enemy.y) * 80 * enemyDt;
      if (d < 30) hurt(enemy.type==='charger'?24:12,enemy.type==='charger'?'Breacher Charger impact':'Drone collision');
      if (enemy.type === 'gunner') {
        enemy.shot -= enemyDt;
        if (enemy.shot <= 0) { fire(enemy.x, enemy.y, Math.atan2(player.y+lastVelocity.y*.4-enemy.y,player.x+lastVelocity.x*.4-enemy.x), true, 245+level.id*20, 13); enemy.shot = 2.3; }
      }
    }
    if (level.id === 3) updateBoss(enemyDt);
    if (level.id === 2) for(const r of relays)if(r.hp>0){const a=laserAngle(r),em=emitter(r);const distance=segmentDistance(player,em,{x:em.x+Math.cos(a)*600,y:em.y+Math.sin(a)*600});if(worldTime%5>1.4 && distance<20)hurt(18,`Cryo emitter ${r.id+1} sweeping beam`);}
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; const time = b.enemy ? enemyDt : dt;
      b.trail.push({x:b.x,y:b.y}); if(b.trail.length>7)b.trail.shift();
      b.x += b.vx * time; b.y += b.vy * time; b.life -= time;
      let consumed = b.life <= 0 || b.x < 30 || b.x > W - 30 || b.y < 30 || b.y > H - 30;
      if (!consumed) for (const c of covers) {
        if (c.hp > 0 && b.x > c.x - 3 && b.x < c.x + c.w + 3 && b.y > c.y - 3 && b.y < c.y + c.h + 3) {
          c.hp -= b.damage; consumed = true; burst(b.x, b.y, '#9aa9a3', c.hp <= 0 ? 20 : 5);
          if (c.hp <= 0) { shake = 3; sound('explode'); if (!b.enemy) award(50); }
          break;
        }
      }
      if (!consumed && b.enemy && dist(b, player) < 15) { hurt(b.damage,b.cause); consumed = true; }
      if (!consumed && !b.enemy) {
        for (const enemy of enemies) if (!enemy.dead && dist(b, enemy) < enemy.radius + 4) {
          const critical = overclock && dist(player,enemy)<150; const damage = b.damage * (critical ? 1.65 : 1); enemy.hp -= damage; if(critical) number(enemy.x,enemy.y-35,'CRIT!','#fff6b3'); sound('hit'); consumed = true; burst(b.x, b.y, enemy.color, 10, Math.atan2(b.vy, b.vx)); number(enemy.x, enemy.y - 15, Math.round(damage), '#e7e9e2');
          if (enemy.hp <= 0) kill(enemy);
          break;
        }
        if(!consumed)for(const barrel of barrels)if(barrel.hp>0&&dist(b,barrel)<23){barrel.hp-=b.damage;consumed=true;if(barrel.hp<=0){barrel.relay.broken=true;burst(barrel.x,barrel.y,'#ffb15e',55);rings.push({x:barrel.x,y:barrel.y,life:.5,color:'#ffb15e'});wreckage.push({x:barrel.x,y:barrel.y,r:65,color:'#ffb15e'});damageRelay(barrel.relay,100);for(const e of enemies)if(!e.dead&&dist(e,barrel)<160){e.hp-=160;if(e.hp<=0)kill(e);}shake=12;sound('explode');}break;}
        if (!consumed) for (const relay of relays) if (relay.hp > 0 && dist(b, relay) < 30) { damageRelay(relay, b.damage); consumed = true; break; }
        if (!consumed && level.id === 3 && dist(b, boss) < 57) {
          consumed = true;
          if (bossPhase&&boss.phaseLock<=0) { boss.hp = Math.max(0, boss.hp - b.damage); burst(b.x, b.y, '#f3a0ac', 5); number(b.x, b.y - 30, Math.round(b.damage)); if (boss.hp <= 0) finish(true); }
          else { burst(b.x, b.y, '#79d9f4', 4); number(b.x, b.y - 25, 'SHIELDED', '#79d9f4'); }
        }
      }
      if (consumed) bullets.splice(i, 1);
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const shard = shards[i]; shard.age += dt; const d = dist(player, shard);
      if (d < 200) { shard.x += (player.x - shard.x) * dt * 6; shard.y += (player.y - shard.y) * dt * 6; }
      if (d < 20) {shards.splice(i,1);collectShard(shard);}
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
  }

  function collectShard(shard){const value=shard?.value??1;run.shards+=value;run.totalShards=(run.totalShards||0)+value;player.energy=Math.min(player.maxEnergy,player.energy+Math.min(12,value*.2));player.hp=Math.min(player.maxHp,player.hp+value*.02);pickupPending+=value;if(clock-pickupLast>.12){number(player.x,player.y-35,`+${pickupPending} SHARDS`,'#79d9f4');pickupPending=0;pickupLast=clock;}if(clock-collectSoundLast>.08){sound('collect');collectSoundLast=clock;}if(run.totalShards>=100)toast('shards','DATA LIBERATOR','100 recovered shards. Your armory is funded.');}
  function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  function emitter(r){return {x:r.x<600?65:1135,y:r.y};}
  function laserAngle(r){const e=emitter(r);return Math.atan2(380-e.y,600-e.x)+Math.sin(worldTime*.7+r.id)*.65;}
  function updateBoss(dt){
    setMusicIntensity(boss.phase);
    const next=boss.hp/boss.maxHp>.67?1:boss.hp/boss.maxHp>.34?2:3;
    if(next!==boss.phase){boss.phase=next;boss.phaseFlash=2;boss.phaseLock=3;boss.phaseTime=0;boss.timer=.2;hitStop=.12;shake=18;burst(boss.x,boss.y,'#ff946d',55);sound('bossPhase');}
    boss.phaseTime+=dt;boss.phaseLock=Math.max(0,boss.phaseLock-dt);boss.phaseFlash=Math.max(0,boss.phaseFlash-dt);boss.beam+=dt*.43;
    if(boss.charge>0){boss.charge-=dt;if(boss.charge<=0&&boss.target){boss.x=boss.target.x;boss.y=boss.target.y;zones.push({x:boss.x,y:boss.y,r:125,timer:.12,max:.12,cause:'AETHER overdrive charge slam',damage:38});boss.target=null;}}
    else {boss.x+=(600+Math.sin(worldTime*.35)*180-boss.x)*dt*.9;boss.y+=(220-boss.y)*dt*.8;}
    boss.timer-=dt;
    if(boss.timer<=0){
      if(boss.phase===1){for(let i=-2;i<=2;i++)fire(boss.x,boss.y,Math.atan2(player.y+lastVelocity.y*.4-boss.y,player.x+lastVelocity.x*.4-boss.x)+i*.13,true,220,16,'AETHER aimed plasma barrage');if(enemies.length<12)spawn();boss.timer=2.5;}
      if(boss.phase===2){for(let i=0;i<12;i++)fire(boss.x,boss.y,i*TAU/12+worldTime,true,160,16,'AETHER rotating beam crossfire');boss.timer=2.7;}
      if(boss.phase===3){const pocket=Math.atan2(player.y-boss.y,player.x-boss.x)+.4;for(let i=0;i<28;i++){const a=i*TAU/28+worldTime;let delta=Math.atan2(Math.sin(a-pocket),Math.cos(a-pocket));if(Math.abs(delta)>.3)fire(boss.x,boss.y,a,true,190,18,'AETHER siege ring');}boss.charge=1.5;boss.target={x:player.x,y:player.y};boss.timer=3.6;}
    }
    if(bossPhase&&boss.phase===2&&boss.phaseTime%4>1){const end={x:boss.x+Math.cos(boss.beam)*1250,y:boss.y+Math.sin(boss.beam)*1250};if(segmentDistance(player,boss,end)<23)hurt(24,'AETHER rotating death beam');}
    if(dist(player,boss)<75)hurt(20,'AETHER mechanical hull collision');
  }
  function choreograph(){
    const t=options.trailerTime?.()??clock,cut=options.trailerCut;
    const once=(id,at,action)=>{if(t>=at&&!trailerEvents.has(id)){trailerEvents.add(id);action();}};
    if(cut===0){
      once('setup',0,()=>{worldTime=1.6;spawnTimer=20;hazardTimer=20;enemies.length=0;player.x=430;player.y=365;});
      if(t<1.1){const p=t/1.1;player.x=430-210*p;player.y=365-150*p;}
      pointer.x=relays[0].x;pointer.y=relays[0].y;
      once('dash',.5,()=>{player.angle=Math.atan2(pointer.y-player.y,pointer.x-player.x);dash();});
      if(t>1.15){player.x=235+Math.sin(t)*12;player.y=220;relays[0].phaseAccess=true;relays[0].hack=Math.min(level.hackTime,t*1.4);}
      pointer.down=t>1.9;
      once('breach',3.1,()=>{relays[0].hack=level.hackTime;relays[0].broken=true;damageRelay(relays[0],1000);burst(relays[0].x,relays[0].y,'#ffc76d',95);});
    }else if(cut===1){
      once('swarm',0,()=>{spawnTimer=20;hazardTimer=20;enemies.length=0;for(let i=0;i<12;i++){const a=i*TAU/12;enemies.push({x:600+Math.cos(a)*240,y:380+Math.sin(a)*240,hp:ENEMY_HP.drone,radius:14,type:'drone',color:'#ff657e',shot:4,windup:0,charge:0,dead:false});}for(let i=0;i<32;i++)fire(600,380,i*TAU/32,true,190,12,'Trailer plasma ring');});
      keys.add('Space');player.x=600+Math.sin(t*1.5)*65;player.y=400+Math.cos(t*1.3)*45;pointer.x=740;pointer.y=400;pointer.down=t<2.3;
      once('emp',2.5,()=>{emp();number(player.x,player.y-85,'+500 COMBO x6!','#79d9f4');});
    }else{
      once('core',0,()=>{spawnTimer=20;hazardTimer=20;player.x=600;player.y=540;boss.timer=1.2;});
      player.x=600+Math.sin(t*1.1)*100;player.y=540+Math.sin(t*2)*30;
      for(const at of [.4,1.7,3])once(`ring${at}`,at,()=>{for(let i=0;i<28;i++)fire(boss.x,boss.y,i*TAU/28+t,true,170,16,'AETHER siege preview');});
      for(const at of [1,2.8])once(`mortar${at}`,at,()=>zones.push({x:player.x,y:player.y,r:100,timer:1.5,max:1.5,cause:'AETHER mortar preview'}));
    }
  }
  function path(points, close = false) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (close) ctx.closePath();
  }
  function glow(color, amount = 12) { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = amount; }
  function label(text, x, y, color = '#73847e', size = 9, align = 'center') { ctx.shadowBlur = 0; ctx.fillStyle = color; const fit=Math.min(canvas.clientWidth/W,canvas.clientHeight/H);const legible=size>=17?Math.max(size,12/fit):size>=11?Math.max(size,9/fit):size;ctx.font = `${legible}px "SFMono-Regular", Consolas, monospace`; ctx.textAlign = align; ctx.fillText(text, x, y); }
  function draw() {
    const width = canvas.width, height = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0d1718'; ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / W, height / H);
    ctx.translate((width - W * scale) / 2, (height - H * scale) / 2); ctx.scale(scale, scale);
    ctx.save();
    if(options.trailer){const t=options.trailerTime?.()??0,cut=options.trailerCut;const zoom=cut===2?1.1+t*.055:1.08+Math.sin(t*.9)*.035;const focus=cut===0?{x:420-t*24,y:320}:cut===1?{x:600+Math.sin(t*.7)*30,y:380}:{x:600+Math.sin(t*.4)*65,y:330};ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-focus.x,-focus.y);}
    if (shake > .1 && active) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= .89; }
    const gradient = ctx.createRadialGradient(600, 380, 50, 600, 380, 700);
    gradient.addColorStop(0, '#192a2d'); gradient.addColorStop(.6, '#132024'); gradient.addColorStop(1, '#0c1516');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    if(finale){ctx.translate(600,380);ctx.scale(1+Math.min(.08,finale.time*.035),1+Math.min(.08,finale.time*.035));ctx.translate(-600,-380);}
    ctx.lineWidth = .65;
    for (let x = 0; x < W; x += 40) { path([[x, 0], [x, H]]); ctx.strokeStyle = '#9dc8bd0a'; ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { path([[0, y], [W, y]]); ctx.strokeStyle = '#9dc8bd0a'; ctx.stroke(); }
    // Circuit traces and industrial perimeter are drawn entirely in Canvas.
    ctx.lineWidth = 2;
    const wall = [[38, 108], [108, 38], [1092, 38], [1162, 108], [1162, 652], [1092, 722], [108, 722], [38, 652]];
    path(wall, true); ctx.fillStyle = '#17252870'; ctx.fill(); ctx.strokeStyle = '#45615a55'; ctx.stroke();
    for (let i = 0; i < 13; i++) {
      const x = 130 + i * 76;
      path([[x, 38], [x, 55], [x + 14, 69], [x + 14, 100]]); ctx.strokeStyle = '#5e7d6c28'; ctx.stroke();
      path([[x, 722], [x, 702], [x - 14, 688], [x - 14, 655]]); ctx.stroke();
      ctx.fillStyle = i % 3 === 0 ? '#b6e77a80' : '#52686055'; ctx.fillRect(x - 8, 36, 16, 3); ctx.fillRect(x - 8, 721, 16, 3);
    }
    for (const [x, y] of [[100, 140], [1100, 140], [100, 620], [1100, 620]]) {
      ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#6f958043'; ctx.lineWidth = 1;
      for (let r = 16; r <= 38; r += 11) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#769a6633'; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
    ctx.strokeStyle = '#597b6518'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(600, 380, 150, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(600, 380, 158, 0, TAU); ctx.stroke();
    path([[565, 380], [635, 380]]); ctx.stroke(); path([[600, 345], [600, 415]]); ctx.stroke();
    label(`SECTOR 0${level.id} / ${level.name.toUpperCase()}`, 80, 92, '#81988b65', 10, 'left');
    label('RESTRICTED ACCESS // NEURAL LINK ACTIVE', 600, 690, '#70897c55', 9);
    // Floor markings and cable runs.
    ctx.setLineDash([5, 7]); ctx.strokeStyle = '#b9d69713'; ctx.strokeRect(180, 130, 840, 500); ctx.setLineDash([]);
    drawWorldFeatures();
    for (const relay of relays) {
      path([[relay.x, relay.y], [relay.x, 380], [600, 380]]); ctx.lineWidth = 1; ctx.strokeStyle = relay.hp > 0 ? `${level.color}18` : '#748b7920'; ctx.stroke();
      if (relay.hp <= 0) { label('OFFLINE', relay.x, relay.y + 5, '#627769', 9); ctx.strokeStyle = '#485b5044'; ctx.strokeRect(relay.x - 22, relay.y - 22, 44, 44); continue; }
      ctx.save(); ctx.translate(relay.x, relay.y);
      ctx.strokeStyle = '#64756666'; ctx.fillStyle = '#1e3130'; ctx.lineWidth = 2;
      path([[-30, -18], [-18, -30], [18, -30], [30, -18], [30, 18], [18, 30], [-18, 30], [-30, 18]], true); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.rotate(clock * .45); glow(level.color, 13); ctx.lineWidth = 1.4; ctx.strokeRect(-16, -16, 32, 32); ctx.restore();
      glow(level.color, 16); ctx.fillRect(-6, -11, 12, 22); ctx.shadowBlur = 0;
      ctx.fillStyle = '#35463b'; ctx.fillRect(-25, -44, 50, 3); ctx.fillStyle = level.color; ctx.fillRect(-25, -44, 50 * relay.hp / relay.maxHp, 3);
      label(level.id === 3 ? 'SHIELD EMITTER' : options.trailerCut===0&&relay.id===0?'ARMORED RELAY':level.id === 2 ? 'CRYO NODE' : 'SECURITY RELAY', 0, 59, `${level.color}a0`, 8);
      ctx.restore();
    }
    for (const cover of covers) {
      if (cover.hp <= 0) { ctx.fillStyle = '#72817a12'; ctx.fillRect(cover.x, cover.y, cover.w, cover.h); continue; }
      ctx.fillStyle = '#0e1b1d'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10; ctx.fillRect(cover.x + 5, cover.y + 8, cover.w, cover.h);
      ctx.shadowBlur = 0; ctx.fillStyle = '#2b3e40'; ctx.strokeStyle = '#587069'; ctx.lineWidth = 1; ctx.fillRect(cover.x, cover.y, cover.w, cover.h); ctx.strokeRect(cover.x, cover.y, cover.w, cover.h);
      ctx.strokeStyle = '#76918765'; path([[cover.x + 6, cover.y + 6], [cover.x + cover.w - 6, cover.y + 6], [cover.x + cover.w - 6, cover.y + cover.h - 6]]); ctx.stroke();
      ctx.fillStyle = '#b7da8022'; ctx.fillRect(cover.x + 5, cover.y + cover.h - 4, (cover.w - 10) * cover.hp / cover.maxHp, 2);
      for (let k = 12; k < cover.w - 6; k += 10) { ctx.fillStyle = '#0e1e20'; ctx.fillRect(cover.x + k, cover.y + 13, 3, cover.h - 25); }
    }
    if(level.id===2)for(const r of relays)if(r.hp>0){const a=laserAngle(r),em=emitter(r),firing=worldTime%5>1.4;glow(firing?'#ff657e':'#ffb965',firing?20:5);ctx.lineWidth=firing?5:2;ctx.setLineDash(firing?[]:[8,10]);path([[em.x,em.y],[em.x+Math.cos(a)*600,em.y+Math.sin(a)*600]]);ctx.stroke();ctx.setLineDash([]);label(`EMITTER ${r.id+1} / ${firing?'LIVE':'CHARGING'}`,r.x,r.y-65,'#ffad70',10);}
    if(level.id===3){
      for(const r of relays)if(r.hp>0){glow('#ffc76d',12);ctx.lineWidth=2;path([[r.x,r.y],[boss.x,boss.y]]);ctx.stroke();}
      ctx.save();ctx.translate(boss.x,boss.y);
      for(let i=0;i<6;i++){const a=i*TAU/6+worldTime*.08;ctx.save();ctx.rotate(a);ctx.strokeStyle='#6d7580';ctx.lineWidth=8;path([[40,0],[76,12],[101,-13]]);ctx.stroke();ctx.fillStyle='#26363a';ctx.strokeStyle='#ff8968';ctx.lineWidth=2;ctx.fillRect(68,-18,36,30);ctx.strokeRect(68,-18,36,30);glow('#ff697b',15);ctx.fillRect(96,-9,15,8);ctx.restore();}
      glow(bossPhase?'#ff697b':'#ffc76d',25);ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6;const x=Math.cos(a)*62,y=Math.sin(a)*62;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle='#17262c';ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,35+Math.sin(worldTime*5)*4,0,TAU);ctx.stroke();ctx.fillStyle='#ff657e';ctx.fillRect(-16,-16,32,32);ctx.restore();
      label(`AETHER // PHASE ${boss.phase} / ${['','PLASMA BARRAGE','ROTATING DEATH BEAM','OVERDRIVE SIEGE'][boss.phase]}`,boss.x,Math.min(H-100,boss.y+130),'#ffad70',12);
      if(bossPhase&&boss.phase===2){const firing=boss.phaseTime%4>1;glow(firing?'#ff5678':'#ffc76d',25);ctx.lineWidth=firing?13:2;path([[boss.x,boss.y],[boss.x+Math.cos(boss.beam)*1250,boss.y+Math.sin(boss.beam)*1250]]);ctx.stroke();}
      if(boss.target){glow('#ff657e',20);ctx.setLineDash([10,8]);ctx.lineWidth=3;path([[boss.x,boss.y],[boss.target.x,boss.target.y]]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(boss.target.x,boss.target.y,125,0,TAU);ctx.stroke();label('CHARGE SLAM / DASH OUT',boss.target.x,boss.target.y-140,'#ffad70',13);}
      if(boss.phaseFlash>0)label(`AETHER ESCALATION // PHASE ${boss.phase}`,600,180,'#ffd98d',20);
    }
    const drawnEnemies = active ? enemies : [
      { x: 410 + Math.sin(clock * .4) * 25, y: 170, type: 'drone', color: '#f58c9e' },
      { x: 850, y: 460 + Math.cos(clock * .5) * 30, type: 'drone', color: '#f58c9e' },
      { x: 180, y: 440, type: 'gunner', color: '#e0a879' },
      { x: 1000, y: 340, type: 'gunner', color: '#e0a879' },
    ];
    for (const enemy of drawnEnemies) {
      if (enemy.dead) continue;
      ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x));
      glow(enemy.color, 11); ctx.lineWidth = 1.5;
      if(enemy.type==='charger'){path([[24,0],[-16,-17],[-7,0],[-16,17]],true);ctx.fillStyle='#5d2630';ctx.fill();ctx.stroke();ctx.strokeRect(-16,-7,12,14);}
      else if(enemy.type==='mortar'){ctx.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6;i?ctx.lineTo(Math.cos(a)*21,Math.sin(a)*21):ctx.moveTo(21,0);}ctx.closePath();ctx.fillStyle='#3c2d22';ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,8+(enemy.windup||0)*9,0,TAU);ctx.stroke();}
      else if (enemy.type === 'gunner') { ctx.strokeRect(-12, -12, 24, 24); ctx.fillStyle = '#281f25'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = enemy.color; ctx.fillRect(3, -3, 18, 6); }
      else { path([[16, 0], [-10, -11], [-5, 0], [-10, 11]], true); ctx.fillStyle = '#3b2430'; ctx.fill(); ctx.stroke(); }
      ctx.restore();
      if(enemy.type==='charger'&&enemy.windup>0){glow('#ff657e',15);ctx.lineWidth=2;ctx.setLineDash([8,6]);path([[enemy.x,enemy.y],[enemy.x+Math.cos(enemy.aim)*350,enemy.y+Math.sin(enemy.aim)*350]]);ctx.stroke();ctx.setLineDash([]);label('BREACHER / EVADE',enemy.x,enemy.y-40,'#ff9c79',10);}
      const max = ENEMY_HP[enemy.type];
      if(enemy.hp < max){ctx.shadowBlur=0;ctx.fillStyle='#321e29';ctx.fillRect(enemy.x-16,enemy.y-25,32,3);ctx.fillStyle=enemy.color;ctx.fillRect(enemy.x-16,enemy.y-25,32*Math.max(0,enemy.hp)/max,3);}
    }
    if (!active) for (const [x, y] of [[460, 500], [725, 150], [1000, 580]]) drawShard(x, y);
    for (const shard of shards) drawShard(shard.x, shard.y);
    for (const b of bullets) {
      if(b.trail.length>1){ctx.beginPath();ctx.moveTo(b.trail[0].x,b.trail[0].y);for(const p of b.trail)ctx.lineTo(p.x,p.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=b.enemy?'#f6a1a944':'#caff9366';ctx.lineWidth=b.enemy?2:4;ctx.shadowBlur=14;ctx.shadowColor=b.enemy?'#f6a1a9':'#caff93';ctx.stroke();}
      glow(b.enemy ? '#f6a1a9' : '#d0ff92', b.enemy ? 9 : 13); ctx.lineWidth = b.enemy ? 3 : 2;
      path([[b.x, b.y], [b.x - b.vx * .018, b.y - b.vy * .018]]); ctx.stroke();
    }
    // The operative has an angular chassis, independent aim, and an actual laser sight.
    const px = active ? player.x : 600, py = active ? player.y : 450;
    const angle = active ? player.angle : -.75 + Math.sin(clock * .4) * .13;
    if (overclockWasOn) {
      const warp=ctx.createRadialGradient(px,py,50,px,py,650);warp.addColorStop(0,'#8ad1ea00');warp.addColorStop(1,'#55dce04d');ctx.fillStyle=warp;ctx.fillRect(0,0,W,H);
      for(let i=0;i<32;i++){const a=i*TAU/32,r=220+(clock*430+i*43)%480;path([[px+Math.cos(a)*r,py+Math.sin(a)*r],[px+Math.cos(a)*(r+70),py+Math.sin(a)*(r+70)]]);ctx.strokeStyle='#8ce8e133';ctx.lineWidth=1.5;ctx.stroke();}
    }
    for(const ghost of ghosts){ctx.save();ctx.globalAlpha=ghost.life*.9;ctx.translate(ghost.x,ghost.y);ctx.rotate(ghost.angle);glow('#bdf578',18);ctx.fillRect(-13,-11,28,22);ctx.restore();}
    if(active&&!options.trailer) label(`${badge('dash')} / DASH ${dashCooldown>0?dashCooldown.toFixed(1)+'s':'READY'}`,W-80,H-47,'#8cc9d0',9);

    ctx.save(); ctx.translate(px, py);
    glow(overclockWasOn ? '#8eeaff' : '#c2f66e', 15); ctx.lineWidth = 1;
    ctx.lineWidth=2;ctx.strokeStyle='#79d9f4aa';ctx.beginPath();ctx.arc(0,0,34,-Math.PI/2,-Math.PI/2+TAU*(1-dashCooldown/(run.perk==='dash'?1.7:3)));ctx.stroke();ctx.strokeStyle='#bdf57888';ctx.beginPath();ctx.arc(0,0,28,0,TAU*player.energy/player.maxEnergy);ctx.stroke();
    if(shieldCharge){glow('#79d9f4',12);ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,39,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    ctx.rotate(angle);
    if(muzzle>0){glow('#efffc9',35);path([[22,-3],[48,-12],[37,0],[50,9],[22,3]],true);ctx.fill();}
    const laser = ctx.createLinearGradient(20, 0, 400, 0); laser.addColorStop(0, '#ceff9280'); laser.addColorStop(1, '#ceff9200');
    ctx.strokeStyle = laser; ctx.setLineDash([5, 5]); path([[22, 0], [400, 0]]); ctx.stroke(); ctx.setLineDash([]);
    if (player.invuln <= 0 || Math.floor(clock * 20) % 2 === 0) {
      ctx.fillStyle = '#a9d973'; ctx.shadowColor = '#b6f578'; ctx.shadowBlur = 15;
      path([[-13, -12], [5, -12], [16, -5], [16, 5], [5, 12], [-13, 12], [-8, 0]], true); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#203b2a'; ctx.fillRect(-5, -7, 10, 14); ctx.fillStyle = '#e9ffc7'; ctx.fillRect(7, -3, 20, 6);
    }
    ctx.restore();
    if (active && pointer.inside) {
      ctx.strokeStyle = '#d3eca499'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 8, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4; path([[pointer.x + Math.cos(a) * 12, pointer.y + Math.sin(a) * 12], [pointer.x + Math.cos(a) * 17, pointer.y + Math.sin(a) * 17]]); ctx.stroke(); }
    }
    if (empRing > 0) { glow('#91defb', 20); ctx.lineWidth = 4; ctx.globalAlpha = empRing / .65; ctx.beginPath(); ctx.arc(empOrigin?.x??player.x, empOrigin?.y??player.y, (1 - empRing / .65) * 290, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const ring of rings) { glow(ring.color, 12); ctx.globalAlpha = ring.life * 2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ring.x, ring.y, (1 - ring.life * 2) * 90, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); glow(p.color, 7); ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    for (const n of numbers) { ctx.globalAlpha = n.life; label(n.text, n.x, n.y, n.color, 12); }
    ctx.globalAlpha = 1;
    if (!active) { label('OPERATIVE / 01', px, py + 46, '#b9dc8f88', 8); }
    // Inset vignette keeps the neon readable without raster assets.
    const vignette = ctx.createRadialGradient(600, 380, 200, 600, 380, 730); vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#03090955'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    if(active&&!options.trailer&&clock<3){ctx.fillStyle='#101c21e8';ctx.fillRect(180,100,840,70);label(`MOVE: ${['up','left','down','right'].map(badge).join('/')} | DASH: ${badge('dash')} | SHOOT GOLD RELAYS`,600,129,'#d9edb4',17);label(level.id===2?`DASH INTO GOLD RINGS OR HOLD ${badge('overclock')} TO DECRYPT`: 'ENTER GOLD RINGS TO DECRYPT · RED TARGET RINGS MEAN MOVE NOW',600,153,'#ffc76d',12);}
    if(overclockExhausted&&active)label(`ENERGY DEPLETED / RELEASE ${badge('overclock')} TO REARM`,600,690,'#79d9f4',13);
    if(finale){ctx.fillStyle='#0c161dcc';ctx.fillRect(140,300,920,135);label(level.id===3?'MAINFRAME TERMINATED':'SECTOR CLEARED',600,352,'#d8ff9b',38);label('+150 SHARD SECTOR CLEAR BONUS · RECOVERING ALL DATA',600,391,'#79d9f4',14);label(`UPLINK IN ${Math.max(0,2.2-finale.time).toFixed(1)}s`,600,415,'#ffc76d',12);}
    ctx.restore();
  }
  function drawWorldFeatures(){
    ctx.shadowBlur=0;ctx.lineWidth=1;
    if(level.id===1){for(let x=120;x<1150;x+=160){ctx.strokeStyle='#b1d77f12';path([[x,80],[x,680],[x+40,680]]);ctx.stroke();}}
    if(level.id===2){for(let x=80;x<1160;x+=70)for(let y=80;y<700;y+=70){ctx.strokeStyle='#82c5e51c';path([[x,y-18],[x+18,y],[x,y+18],[x-18,y],[x,y-18]]);ctx.stroke();}}
    if(level.id===3){for(let r=100;r<700;r+=90){ctx.strokeStyle='#ff697b19';ctx.beginPath();ctx.ellipse(600,380,r,r*.6,0,0,TAU);ctx.stroke();}}
    for(const w of wreckage){ctx.fillStyle='#02080a80';ctx.beginPath();ctx.ellipse(w.x,w.y,w.r,w.r*.6,0,0,TAU);ctx.fill();ctx.strokeStyle=w.color+'45';for(let i=0;i<5;i++){const a=i*TAU/5;path([[w.x+Math.cos(a)*10,w.y+Math.sin(a)*10],[w.x+Math.cos(a)*w.r,w.y+Math.sin(a)*w.r*.6]]);ctx.stroke();}}
    for(const z of zones){const progress=1-Math.max(0,z.timer)/z.max;glow('#ff657e',12);ctx.lineWidth=2;ctx.fillStyle=`rgba(255,70,100,${.06+progress*.18})`;ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(z.x,z.y,z.r*(1-progress),0,TAU);ctx.stroke();path([[z.x-15,z.y],[z.x+15,z.y]]);ctx.stroke();path([[z.x,z.y-15],[z.x,z.y+15]]);ctx.stroke();label(`MORTAR LOCK / ${Math.max(0,z.timer).toFixed(1)}s`,z.x,z.y-z.r-12,'#ffad70',12);}
    for(const r of relays)if(r.hp>0){
      const near=dist(player,r)<=level.range,open=(r.broken&&dist(player,r)<=350)||(near&&r.hack>=level.hackTime);ctx.strokeStyle=open?'#ffc76d77':'#ffc76d35';ctx.setLineDash([8,10]);ctx.beginPath();ctx.arc(r.x,r.y,r.broken?350:level.range,0,TAU);ctx.stroke();ctx.setLineDash([]);
      const pulse=42+Math.sin(clock*4)*3;glow('#ffc76d',10);ctx.lineWidth=2;for(let i=0;i<4;i++){const a=i*TAU/4+Math.PI/4,x=r.x+Math.cos(a)*pulse,y=r.y+Math.sin(a)*pulse;path([[x-8,y],[x,y],[x,y+8]]);ctx.stroke();}
      if(active){label(`[ TARGET 0${r.id+1} ]`,r.x,r.y-80,'#ffda8c',13);label(open?'ARMOR EXPOSED':r.broken?'BREACHED / ADVANCE TO GOLD RING':near&&level.id===2&&!r.phaseAccess?`PHASE LOCK / ${badge('dash')} OR ${badge('overclock')}`:near?`DECRYPT ${Math.round(r.hack/level.hackTime*100)}%`:'ENTER PROXIMITY RING',r.x,r.y+82,'#ffda8c',11);}
      if(level.id===2){const emitter={x:r.x<600?65:1135,y:r.y};glow('#ffc76d',8);ctx.lineWidth=2;path([[r.x,r.y],[emitter.x,emitter.y]]);ctx.stroke();ctx.strokeRect(emitter.x-10,emitter.y-10,20,20);}
      if(active&&!finale&&dist(player,r)>300){const a=Math.atan2(r.y-player.y,r.x-player.x),x=clamp(player.x+Math.cos(a)*235,80,W-80),y=clamp(player.y+Math.sin(a)*235,90,H-90);ctx.save();ctx.translate(x,y);ctx.rotate(a);glow('#ffc76d',8);path([[11,0],[-5,-7],[-5,7]],true);ctx.fill();ctx.restore();label(`0${r.id+1}`,x,y+20,'#ffda8c',12);}
    }
    for(const b of barrels)if(b.hp>0){glow('#ffac61',12);ctx.lineWidth=2;ctx.strokeRect(b.x-16,b.y-21,32,42);path([[b.x-11,b.y-13],[b.x+11,b.y+13],[b.x+11,b.y-13],[b.x-11,b.y+13]]);ctx.stroke();label('VOLATILE / BREAK ARMOR',b.x,b.y+36,'#ffac61',10);}
  }
  function drawShard(x, y) {
    ctx.save(); ctx.translate(x, y + Math.sin(clock * 3 + x) * 4); ctx.rotate(Math.PI / 4); glow('#79d9f4', 15); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  }
  let accumulator=0;
  function animate(now) {
    const dt = Math.max(0,Math.min(.1, (now - (lastFrame || now)) / 1000)); lastFrame = now;
    const paused = active && options.isPaused();
    if (!paused) {
      accumulator+=dt;while(accumulator>=1/120){if(hitStop>0)hitStop-=1/120;else {if(options.trailer)choreograph();update(1/120);}accumulator-=1/120;}
      empRing = Math.max(0, empRing - dt);
      if(empOrigin&&empRing>0){const radius=(1-empRing/.65)*290;for(let i=bullets.length-1;i>=0;i--)if(bullets[i].enemy&&dist(bullets[i],empOrigin)<=radius)bullets.splice(i,1);empReached=radius;}
      const fx=finale?.25:1;
      for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt*fx; p.y += p.vy * dt*fx; p.vx *= .97; p.vy *= .97; p.life -= dt*fx; if (p.life <= 0) particles.splice(i, 1); }
      for (let i = numbers.length - 1; i >= 0; i--) { numbers[i].y -= dt * 30; numbers[i].life -= dt; if (numbers[i].life <= 0) numbers.splice(i, 1); }
      for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
    }
    draw();
    hudTime += dt;
    if (hudTime > .08 && active && !done) { hudTime = 0; options.onHud(snapshot()); }
    frame = requestAnimationFrame(animate);
  }
  if (active) { options.onHud(snapshot()); spawn(); }
  frame = requestAnimationFrame(animate);
  return {
    emp, dash,
    clearInput(){keys.clear();pointer.down=false;touch.x=0;touch.y=0;},
    runState(){return structuredClone({...run,health:player.hp});},
    markDemo(){run.demo=true;options.onHud(snapshot());},
    grantShards(amount){run.demo=true;run.shards+=amount;run.totalShards+=amount;options.onHud(snapshot());return structuredClone({...run,health:player.hp});},
    complete() { if (!active || done || finale) return; run.demo=true; for(const r of relays)if(r.hp>0){r.hp=0;for(let i=0;i<RELAY_SHARDS;i++)shards.push({x:r.x+rand(-30,30),y:r.y+rand(-30,30),age:0,value:1});} destroyed=level.target;boss.hp=0;finish(true); },
    snapshot,
    inspect(){return structuredClone({player,relays,boss,enemies,bullets,zones,barrels,shards,finale,worldTime,shieldCharge,shieldTimer,run});},
    destroy() {
      setOverclockAudio(false);setMusicIntensity(1);
      canvas.removeEventListener('contextmenu', contextmenu);
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('pointerup', pointerup); window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointermove', pointermove); canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointercancel', pointerup); canvas.removeEventListener('pointerleave', leave);
    },
  };
}
