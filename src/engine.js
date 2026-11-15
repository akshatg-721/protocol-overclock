import { DEFAULT_BINDINGS, normalizeKey, actionHeld, actionKeys, keyLabel } from './controls.js';
import { sound, setOverclockAudio, setMusicIntensity } from './audio.js';
import { LEVELS, WEAPON_DAMAGE, ENEMY_HP, ENERGY_CAPACITY, RELAY_SHARDS, SECTOR_CLEAR_SHARDS, enemyShardDrops } from './levels.js';

const W = 1200, H = 760;
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min, max) => min + Math.random() * (max - min);

// Render-only assets. Deterministic geometry never consumes the combat RNG.
function renderSurface(width,height,paint){
  if(typeof document==='undefined')return null;
  const surface=document.createElement('canvas');surface.width=width;surface.height=height;
  const pen=surface.getContext('2d');if(!pen)return null;paint(pen);return surface;
}
function metalPath(p,points,fill,stroke='#8593A1'){
  p.beginPath();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();
  p.fillStyle=fill;p.fill();p.strokeStyle=stroke;p.lineWidth=1;p.stroke();
}
function cacheIndustrialFloor(sector){return renderSurface(W,H,p=>{
  const wash=p.createRadialGradient(600,350,40,600,380,750);wash.addColorStop(0,'#151B23');wash.addColorStop(1,'#080B10');p.fillStyle=wash;p.fillRect(0,0,W,H);
  for(let y=36;y<725;y+=86)for(let x=40;x<1160;x+=112){
    const shade=p.createLinearGradient(x,y,x+90,y+86);shade.addColorStop(0,'#1b222b');shade.addColorStop(.12,'#151B23');shade.addColorStop(1,'#0d1219');
    p.fillStyle=shade;p.fillRect(x+2,y+2,108,82);p.strokeStyle='#343D4866';p.lineWidth=1;p.strokeRect(x+3.5,y+3.5,106,80);
    p.fillStyle='#8593A105';for(let k=7;k<78;k+=5)p.fillRect(x+6,y+k,99,1);
    p.fillStyle='#080B10';for(const [bx,by] of [[9,9],[102,9],[9,76],[102,76]]){p.fillRect(x+bx,y+by,3,3);p.fillStyle='#8593A13d';p.fillRect(x+bx,y+by,2,1);p.fillStyle='#080B10';}
    if(((x-40)/112+(y-36)/86)%3===0){p.fillStyle='#080B10';p.fillRect(x+25,y+65,60,7);p.fillStyle=sector===2?'#52DFFF35':sector===3?'#FF354F25':'#A8FF5430';p.fillRect(x+28,y+67,54,2);}
  }
  p.lineWidth=1;p.strokeStyle='#52DFFF09';for(let x=0;x<W;x+=40){p.beginPath();p.moveTo(x,30);p.lineTo(x,H-30);p.stroke();}for(let y=0;y<H;y+=40){p.beginPath();p.moveTo(30,y);p.lineTo(W-30,y);p.stroke();}
  p.strokeStyle='#343D48';p.lineWidth=12;p.strokeRect(38,38,1124,684);p.strokeStyle='#080B10';p.lineWidth=5;p.strokeRect(38,38,1124,684);
  for(let i=0;i<14;i++){
    const x=105+i*76;p.strokeStyle='#52DFFF17';p.lineWidth=1;p.beginPath();p.moveTo(x,45);p.lineTo(x,67);p.lineTo(x+14,81);p.lineTo(x+14,113);p.stroke();
    p.beginPath();p.moveTo(x,715);p.lineTo(x,691);p.lineTo(x-14,677);p.lineTo(x-14,645);p.stroke();
    p.fillStyle=sector===3?'#FF354F66':sector===2?'#52DFFF80':'#A8FF5460';p.fillRect(x-13,39,26,2);p.fillRect(x-13,719,26,2);
  }
  for(const [x,y] of [[60,95],[1090,95],[60,648],[1090,648]]){
    p.fillStyle='#080B10';p.fillRect(x,y,50,18);p.save();p.beginPath();p.rect(x,y,50,18);p.clip();p.strokeStyle='#c6a45455';p.lineWidth=5;
    for(let k=-16;k<65;k+=13){p.beginPath();p.moveTo(x+k,y+20);p.lineTo(x+k+20,y-2);p.stroke();}p.restore();
  }
  p.strokeStyle=sector===2?'#52DFFF13':sector===3?'#FF354F14':'#A8FF5412';p.lineWidth=1;
  if(sector===1){for(let x=120;x<1150;x+=160){p.beginPath();p.moveTo(x,80);p.lineTo(x,680);p.lineTo(x+40,680);p.stroke();}}
  if(sector===2){for(let x=100;x<1150;x+=100)for(let y=100;y<710;y+=100){p.beginPath();p.moveTo(x,y-34);p.lineTo(x+34,y);p.lineTo(x,y+34);p.lineTo(x-34,y);p.closePath();p.stroke();}}
  if(sector===3){for(let r=95;r<700;r+=75){p.beginPath();p.ellipse(600,380,r,r*.6,0,0,TAU);p.stroke();}}
  for(const [x,y] of [[100,140],[1100,140],[100,620],[1100,620]]){p.strokeStyle='#8593A12c';for(let r=16;r<39;r+=10){p.beginPath();p.arc(x,y,r,0,TAU);p.stroke();}p.fillStyle='#080B10';p.fillRect(x-18,y-9,36,18);p.fillStyle='#343D48';for(let k=-14;k<15;k+=5)p.fillRect(x+k,y-6,2,12);}
  p.font='9px Consolas, monospace';p.fillStyle='#8593A14d';p.fillText(`SECTOR 0${sector} / AETHER INDUSTRIAL NETWORK`,80,92);p.textAlign='center';p.fillText('RESTRICTED ACCESS  //  NEURAL UPLINK 2094',600,690);
});}
function paintMech(p,type){
  const player=type==='operative',drone=type==='drone',mortar=type==='mortar',charger=type==='charger',accent=player?'#A8FF54':'#FF354F';
  p.lineJoin='round';p.fillStyle='#00000080';p.beginPath();p.ellipse(1,6,player?23:21,player?17:18,0,0,TAU);p.fill();
  if(drone){
    metalPath(p,[[-15,-10],[-4,-15],[12,-9],[19,0],[12,9],[-4,15],[-15,10],[-8,0]],'#151B23','#586675');
    for(const y of [-13,13]){p.fillStyle='#343D48';p.fillRect(-15,y-4,17,8);p.fillStyle='#080B10';p.fillRect(-13,y-2,12,4);p.fillStyle='#FF526A';p.fillRect(-18,y-2,4,4);}
    metalPath(p,[[-6,-7],[8,-7],[13,0],[8,7],[-6,7]],'#343D48','#8593A1');
    p.shadowColor=accent;p.shadowBlur=10;p.fillStyle=accent;p.beginPath();p.arc(7,0,4,0,TAU);p.fill();p.shadowBlur=0;p.fillStyle='#ffe1e6';p.fillRect(7,-1,3,2);return;
  }
  for(const side of [-1,1]){
    const y=side*12;metalPath(p,[[-15,y-4],[3,y-7],[12,y-3],[10,y+4],[-14,y+5]],'#343D48','#657383');
    p.fillStyle='#080B10';p.fillRect(-11,y-1,14,2);p.fillStyle=accent;p.fillRect(-14,y,4,2);
    if(!player){p.fillStyle='#151B23';p.fillRect(5,y-3,17,6);p.fillStyle='#8593A1';p.fillRect(17,y-2,7,4);p.fillStyle=accent;p.fillRect(22,y-1,3,2);}
  }
  metalPath(p,[[-13,-10],[7,-10],[15,-5],[15,5],[7,10],[-13,10],[-16,0]],'#151B23','#8593A1');
  metalPath(p,[[-10,-7],[3,-8],[8,-3],[8,3],[3,8],[-10,7]],'#343D48','#586675');
  p.fillStyle='#080B10';p.fillRect(-12,-4,10,8);p.fillStyle='#8593A1';for(let y=-3;y<=3;y+=3)p.fillRect(-10,y,6,1);
  p.shadowColor=accent;p.shadowBlur=9;p.fillStyle=player?'#63FF85':'#C91836';p.fillRect(player?5:-2,-5,player?7:9,10);p.fillStyle=accent;p.fillRect(player?10:0,-4,3,8);p.shadowBlur=0;
  if(player){p.fillStyle='#080B10';p.fillRect(11,-4,20,8);p.fillStyle='#8593A1';p.fillRect(15,-3,12,6);p.fillStyle='#343D48';p.fillRect(19,-4,5,8);p.fillStyle='#B7FF9B';p.fillRect(28,-2,5,4);}
  if(charger){metalPath(p,[[9,-9],[26,0],[9,9],[14,0]],'#343D48','#FF526A');p.fillStyle=accent;p.fillRect(-19,-7,3,14);}
  if(mortar){p.strokeStyle='#8593A1';p.lineWidth=3;p.beginPath();p.arc(0,0,20,0,TAU);p.stroke();p.fillStyle='#080B10';p.beginPath();p.arc(0,0,10,0,TAU);p.fill();p.strokeStyle=accent;p.lineWidth=2;p.beginPath();p.arc(0,0,7,0,TAU);p.stroke();p.fillStyle='#343D48';p.fillRect(-6,-22,12,15);p.fillStyle='#FF526A';p.fillRect(-3,-24,6,4);}
}
function cacheMech(type){return renderSurface(112,112,p=>{p.translate(56,56);paintMech(p,type);});}
function cacheBarrier(cover){return renderSurface(cover.w+16,cover.h+18,p=>{
  const w=cover.w,h=cover.h;p.translate(4,4);p.fillStyle='#00000090';p.fillRect(4,7,w,h);
  const metal=p.createLinearGradient(0,0,0,h);metal.addColorStop(0,'#485361');metal.addColorStop(.13,'#343D48');metal.addColorStop(1,'#151B23');p.fillStyle=metal;p.fillRect(0,0,w,h);p.strokeStyle='#8593A180';p.strokeRect(.5,.5,w-1,h-1);
  p.fillStyle='#080B10';p.fillRect(7,8,w-14,h-16);p.fillStyle='#343D48';for(let y=12;y<h-11;y+=6)p.fillRect(10,y,w-20,2);
  p.strokeStyle='#52DFFF40';p.strokeRect(5.5,5.5,w-11,h-11);for(const [x,y] of [[3,3],[w-6,3],[3,h-6],[w-6,h-6]]){p.fillStyle='#8593A1';p.fillRect(x,y,3,3);p.fillStyle='#080B10';p.fillRect(x,y+1,3,1);}
});}
function cacheRelay(){return renderSurface(110,110,p=>{
  p.translate(55,55);p.fillStyle='#00000090';p.beginPath();p.ellipse(3,7,40,32,0,0,TAU);p.fill();
  metalPath(p,[[-33,-22],[-22,-33],[22,-33],[33,-22],[33,22],[22,33],[-22,33],[-33,22]],'#151B23','#8593A1');
  p.strokeStyle='#343D48';p.lineWidth=4;p.strokeRect(-25,-25,50,50);p.fillStyle='#080B10';p.fillRect(-19,-24,38,48);
  for(const x of [-29,25]){p.fillStyle='#485361';p.fillRect(x,-19,5,38);p.fillStyle='#8593A1';p.fillRect(x+1,-22,3,3);p.fillRect(x+1,19,3,3);}
  for(let y=-21;y<=20;y+=7){p.fillStyle='#343D48';p.fillRect(-16,y,32,4);p.fillStyle='#8593A155';p.fillRect(-14,y,20,1);}
  p.strokeStyle='#ffc76d55';p.lineWidth=1;p.beginPath();p.arc(0,0,39,0,TAU);p.stroke();
});}

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
  const floorArt=cacheIndustrialFloor(level.id),relayArt=cacheRelay();
  const vignetteArt=renderSurface(W,H,p=>{const shade=p.createRadialGradient(600,380,200,600,380,730);shade.addColorStop(0,'#00000000');shade.addColorStop(1,'#080B1055');p.fillStyle=shade;p.fillRect(0,0,W,H);});
  const warpArt=renderSurface(800,800,p=>{const halo=p.createRadialGradient(400,400,30,400,400,400);halo.addColorStop(0,'#63FF8500');halo.addColorStop(.7,'#52DFFF0a');halo.addColorStop(1,'#52DFFF28');p.fillStyle=halo;p.fillRect(0,0,800,800);});
  const mechArt=Object.fromEntries(['operative','drone','gunner','charger','mortar'].map(type=>[type,cacheMech(type)]));
  const barrierArt=covers.map(cacheBarrier);

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
          const critical = overclock && dist(player,enemy)<150; const damage = b.damage * (critical ? 1.65 : 1); enemy.hp -= damage; if(critical) number(enemy.x,enemy.y-35,'CRIT!','#fff6b3'); sound(critical?'crit':'hit'); consumed = true; burst(b.x, b.y, enemy.color, 10, Math.atan2(b.vy, b.vx)); number(enemy.x, enemy.y - 15, Math.round(damage), '#e7e9e2');
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
    setMusicIntensity(boss.phase,true);
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
  function glow(color, amount = 12) { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = Math.min(amount, 6); }
  function label(text, x, y, color = '#73847e', size = 9, align = 'center') { ctx.shadowBlur = 0; ctx.fillStyle = color; const fit=Math.min(canvas.clientWidth/W,canvas.clientHeight/H);const legible=size>=17?Math.max(size,12/fit):size>=11?Math.max(size,9/fit):size;ctx.font = `${legible}px "SFMono-Regular", Consolas, monospace`; ctx.textAlign = align; ctx.fillText(text, x, y); }
  function draw() {
    const width = canvas.width, height = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#080B10'; ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / W, height / H);
    ctx.translate((width - W * scale) / 2, (height - H * scale) / 2); ctx.scale(scale, scale);
    ctx.save();
    if(options.trailer){const t=options.trailerTime?.()??0,cut=options.trailerCut;const zoom=cut===2?1.1+t*.055:1.08+Math.sin(t*.9)*.035;const focus=cut===0?{x:420-t*24,y:320}:cut===1?{x:600+Math.sin(t*.7)*30,y:380}:{x:600+Math.sin(t*.4)*65,y:330};ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-focus.x,-focus.y);}
    if (shake > .1 && active) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= .89; }
    if(finale){ctx.translate(600,380);ctx.scale(1+Math.min(.08,finale.time*.035),1+Math.min(.08,finale.time*.035));ctx.translate(-600,-380);}
    ctx.shadowBlur=0;
    if(floorArt)ctx.drawImage(floorArt,0,0);else {ctx.fillStyle='#080B10';ctx.fillRect(0,0,W,H);}
    drawAmbient();
    drawWorldFeatures();
    for (const relay of relays) {
      path([[relay.x, relay.y], [relay.x, 380], [600, 380]]); ctx.lineWidth = 1; ctx.strokeStyle = relay.hp > 0 ? `${level.color}18` : '#748b7920'; ctx.stroke();
      if (relay.hp <= 0) { label('OFFLINE', relay.x, relay.y + 5, '#627769', 9); ctx.strokeStyle = '#485b5044'; ctx.strokeRect(relay.x - 22, relay.y - 22, 44, 44); continue; }
      ctx.save(); ctx.translate(relay.x, relay.y);
      ctx.shadowBlur=0;if(relayArt)ctx.drawImage(relayArt,-55,-55);
      ctx.lineWidth=2;
      // Rack LEDs and a suspended energy coil remain independently animated.
      for(let y=-20;y<=20;y+=7){ctx.fillStyle=Math.sin(clock*3+y+relay.id)>0?'#63FF85':'#398DFF66';ctx.fillRect(10,y+1,3,2);}
      ctx.save();ctx.rotate(clock*.45);glow('#ffc76d',9);ctx.beginPath();ctx.ellipse(0,0,15,24,0,0,TAU);ctx.stroke();ctx.restore();
      glow('#ffc76d',10);ctx.fillRect(-3,-15,6,30);ctx.fillStyle='#fff3cd';ctx.fillRect(-1,-11,2,22);ctx.shadowBlur=0;
      ctx.fillStyle='#343D48';ctx.fillRect(-25,-47,50,3);ctx.fillStyle='#ffc76d';ctx.fillRect(-25,-47,50*relay.hp/relay.maxHp,3);
      if(relay.hp<relay.maxHp*.6){ctx.strokeStyle='#52DFFF';ctx.lineWidth=1;for(let j=0;j<3;j++){const t=clock*6+j+relay.id;if(Math.sin(t*2)> .55){const x=22+Math.sin(t)*5,y=-17+j*14;path([[x,y],[x+9,y-6],[x+5,y-10],[x+15,y-16]]);ctx.stroke();}}}
      label(level.id === 3 ? 'SHIELD EMITTER' : options.trailerCut===0&&relay.id===0?'ARMORED RELAY':level.id === 2 ? 'CRYO NODE' : 'SECURITY RELAY', 0, 59, `${level.color}a0`, 8);
      ctx.restore();
    }
    for (let i=0;i<covers.length;i++) {
      const cover=covers[i];ctx.shadowBlur=0;
      if(cover.hp<=0){ctx.fillStyle='#080B1099';ctx.fillRect(cover.x,cover.y,cover.w,cover.h);ctx.strokeStyle='#343D48';path([[cover.x,cover.y],[cover.x+cover.w,cover.y+cover.h]]);ctx.stroke();continue;}
      if(barrierArt[i])ctx.drawImage(barrierArt[i],cover.x-4,cover.y-4);
      ctx.fillStyle='#52DFFF55';ctx.fillRect(cover.x+8,cover.y+cover.h-5,(cover.w-16)*cover.hp/cover.maxHp,2);
    }
    if(level.id===2)for(const r of relays)if(r.hp>0){const a=laserAngle(r),em=emitter(r),firing=worldTime%5>1.4;glow(firing?'#FF354F':'#ffb965',firing?20:5);ctx.lineWidth=firing?5:2;ctx.setLineDash(firing?[]:[8,10]);path([[em.x,em.y],[em.x+Math.cos(a)*600,em.y+Math.sin(a)*600]]);ctx.stroke();ctx.setLineDash([]);label(`EMITTER ${r.id+1} / ${firing?'LIVE':'CHARGING'}`,r.x,r.y-65,'#FF526A',10);}
    if(level.id===3){
      for(const r of relays)if(r.hp>0){glow('#ffc76d',12);ctx.lineWidth=2;path([[r.x,r.y],[boss.x,boss.y]]);ctx.stroke();}
      ctx.save();ctx.translate(boss.x,boss.y);
      ctx.shadowBlur=0;
      // Concentric bearing races, six articulated armor satellites, exposed AI heart.
      ctx.fillStyle='#080B10cc';ctx.beginPath();ctx.ellipse(3,13,112,93,0,0,TAU);ctx.fill();
      for(let ring=0;ring<3;ring++){
        const radius=47+ring*22;ctx.strokeStyle=ring===1?'#8593A1':'#343D48';ctx.lineWidth=ring===1?5:9;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.stroke();
        ctx.save();ctx.rotate(worldTime*(ring%2?-.13:.09));ctx.strokeStyle='#FF354F88';ctx.lineWidth=2;for(let k=0;k<8;k++){ctx.beginPath();ctx.arc(0,0,radius,k*TAU/8,k*TAU/8+.27);ctx.stroke();}ctx.restore();
      }
      for(let i=0;i<6;i++){const a=i*TAU/6+worldTime*.08;ctx.save();ctx.rotate(a);ctx.strokeStyle='#8593A1';ctx.lineWidth=5;path([[42,0],[76,12],[101,-13]]);ctx.stroke();
        metalPath(ctx,[[65,-21],[94,-24],[111,-11],[104,14],[72,19],[62,8]],'#343D48','#8593A1');ctx.fillStyle='#080B10';ctx.fillRect(73,-10,22,12);ctx.fillStyle='#8593A1';for(let k=0;k<3;k++)ctx.fillRect(76+k*6,-7,2,7);
        glow('#FF354F',9);ctx.fillRect(100,-10,9,5);ctx.shadowBlur=0;ctx.fillStyle='#FF526A';ctx.fillRect(71,12,19,2);ctx.restore();}
      ctx.save();ctx.rotate(-worldTime*.06);metalPath(ctx,[[-44,-25],[0,-51],[44,-25],[44,25],[0,51],[-44,25]],'#151B23','#8593A1');ctx.restore();
      glow('#C91836',18);ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,32+Math.sin(worldTime*5)*2,0,TAU);ctx.stroke();
      ctx.fillStyle='#080B10';ctx.beginPath();ctx.arc(0,0,27,0,TAU);ctx.fill();ctx.fillStyle='#FF354F';ctx.beginPath();ctx.arc(0,0,18+boss.phase*2,0,TAU);ctx.fill();ctx.shadowBlur=0;metalPath(ctx,[[-12,0],[0,-17],[12,0],[0,17]],'#080B10','#FF526A');ctx.fillStyle='#ffe0e5';ctx.fillRect(-2,-8,4,16);
      if(boss.phase>1){for(let j=0;j<boss.phase*3;j++){const a=j*2.4+worldTime*.7,x=Math.cos(a)*70,y=Math.sin(a)*60;ctx.globalAlpha=.15+.12*Math.sin(clock+j);ctx.fillStyle='#8593A1';ctx.beginPath();ctx.ellipse(x,y-((clock*12+j*9)%35),8+j%4,4,0,0,TAU);ctx.fill();ctx.globalAlpha=.75;ctx.strokeStyle='#FF526A';path([[x,y],[x+Math.sin(clock*11+j)*12,y-14],[x+16,y-20]]);ctx.stroke();}ctx.globalAlpha=1;}
      ctx.restore();
      label(`AETHER // PHASE ${boss.phase} / ${['','PLASMA BARRAGE','ROTATING DEATH BEAM','OVERDRIVE SIEGE'][boss.phase]}`,boss.x,Math.min(H-100,boss.y+130),'#FF526A',12);
      if(bossPhase&&boss.phase===2){const firing=boss.phaseTime%4>1;glow(firing?'#FF354F':'#ffc76d',25);ctx.lineWidth=firing?13:2;path([[boss.x,boss.y],[boss.x+Math.cos(boss.beam)*1250,boss.y+Math.sin(boss.beam)*1250]]);ctx.stroke();}
      if(boss.target){glow('#FF354F',20);ctx.setLineDash([10,8]);ctx.lineWidth=3;path([[boss.x,boss.y],[boss.target.x,boss.target.y]]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(boss.target.x,boss.target.y,125,0,TAU);ctx.stroke();label('CHARGE SLAM / DASH OUT',boss.target.x,boss.target.y-140,'#FF526A',13);}
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
      ctx.shadowBlur=0;
      if(enemy.type==='drone'){ctx.fillStyle='#FF354F08';path([[15,0],[95,-29],[95,29]],true);ctx.fill();}
      if(mechArt[enemy.type])ctx.drawImage(mechArt[enemy.type],-56,-56);else paintMech(ctx,enemy.type);
      if(enemy.windup>0){glow('#FF354F',8);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,25,0,TAU*Math.min(1,enemy.windup));ctx.stroke();ctx.fillStyle='#FF526A';ctx.fillRect(-3,-3,6,6);}
      ctx.restore();
      if(enemy.type==='charger'&&enemy.windup>0){glow('#FF354F',15);ctx.lineWidth=2;ctx.setLineDash([8,6]);path([[enemy.x,enemy.y],[enemy.x+Math.cos(enemy.aim)*350,enemy.y+Math.sin(enemy.aim)*350]]);ctx.stroke();ctx.setLineDash([]);label('BREACHER / EVADE',enemy.x,enemy.y-40,'#FF526A',10);}
      const max = ENEMY_HP[enemy.type];
      if(enemy.hp < max){ctx.shadowBlur=0;ctx.fillStyle='#321e29';ctx.fillRect(enemy.x-16,enemy.y-25,32,3);ctx.fillStyle=enemy.color;ctx.fillRect(enemy.x-16,enemy.y-25,32*Math.max(0,enemy.hp)/max,3);}
    }
    if (!active) for (const [x, y] of [[460, 500], [725, 150], [1000, 580]]) drawShard(x, y);
    for (const shard of shards) drawShard(shard.x, shard.y);
    for (const b of bullets) {
      const color=b.enemy?'#FF354F':'#A8FF54',tail=b.trail[0];
      if(tail){const length=Math.hypot(b.vx,b.vy)||1,nx=-b.vy/length,ny=b.vx/length,w=b.enemy?2.4:3.5;ctx.shadowBlur=0;ctx.fillStyle=b.enemy?'#FF354F38':'#A8FF544d';path([[tail.x,tail.y],[b.x+nx*w,b.y+ny*w],[b.x-nx*w,b.y-ny*w]],true);ctx.fill();}
      glow(color,b.enemy?7:10);ctx.lineWidth=b.enemy?4:4.5;path([[b.x,b.y],[b.x-b.vx*.016,b.y-b.vy*.016]]);ctx.stroke();
      ctx.shadowBlur=0;ctx.strokeStyle=b.enemy?'#ffe0e5':'#f3ffe9';ctx.lineWidth=b.enemy?1:1.5;ctx.stroke();
    }
    // The operative has an angular chassis, independent aim, and an actual laser sight.
    const px = active ? player.x : 600, py = active ? player.y : 450;
    const angle = active ? player.angle : -.75 + Math.sin(clock * .4) * .13;
    if (overclockWasOn) {
      ctx.shadowBlur=0;if(warpArt)ctx.drawImage(warpArt,px-650,py-650,1300,1300);
      ctx.shadowBlur=0;ctx.strokeStyle='#52DFFF18';ctx.lineWidth=1;for(let y=60;y<H;y+=70){ctx.beginPath();for(let x=40;x<W;x+=30){const wave=Math.sin(x*.012+clock*4+y)*7;x===40?ctx.moveTo(x,y+wave):ctx.lineTo(x,y+wave);}ctx.stroke();}
      for(let i=0;i<24;i++){const a=i*TAU/24,r=220+(clock*430+i*43)%480;path([[px+Math.cos(a)*r,py+Math.sin(a)*r],[px+Math.cos(a)*(r+70),py+Math.sin(a)*(r+70)]]);ctx.strokeStyle='#63FF8540';ctx.stroke();}
      glow('#A8FF54',14);ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,44+Math.sin(clock*9)*2,0,TAU);ctx.stroke();
    }
    // Three sampled afterimages, rather than a full sprite for every simulation tick.
    for(let i=0;i<3&&ghosts.length;i++){const ghost=ghosts[Math.floor(i*(ghosts.length-1)/2)];ctx.save();ctx.globalAlpha=ghost.life*(.7+i*.35);ctx.translate(ghost.x,ghost.y);ctx.rotate(ghost.angle);ctx.shadowBlur=0;ctx.fillStyle='#A8FF5430';path([[-16,-18],[12,-14],[26,0],[12,14],[-16,18]],true);ctx.fill();if(mechArt.operative)ctx.drawImage(mechArt.operative,-56,-56);ctx.strokeStyle='#A8FF54';ctx.lineWidth=1;path([[-18,-13],[-42-i*8,-13]]);ctx.stroke();path([[-18,13],[-36-i*8,13]]);ctx.stroke();ctx.restore();}
    if(dashTime>0){glow('#A8FF54',10);ctx.lineWidth=2;ctx.globalAlpha=dashTime/.19;ctx.beginPath();ctx.arc(px,py,26+(1-dashTime/.19)*50,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
    if(active&&!options.trailer) label(`${badge('dash')} / DASH ${dashCooldown>0?dashCooldown.toFixed(1)+'s':'READY'}`,W-80,H-47,'#52DFFF',9);

    ctx.save(); ctx.translate(px, py);
    glow(overclockWasOn ? '#63FF85' : '#A8FF54', 15); ctx.lineWidth = 1;
    ctx.lineWidth=2;ctx.strokeStyle='#52DFFFaa';ctx.beginPath();ctx.arc(0,0,34,-Math.PI/2,-Math.PI/2+TAU*(1-dashCooldown/(run.perk==='dash'?1.7:3)));ctx.stroke();ctx.strokeStyle='#A8FF5488';ctx.beginPath();ctx.arc(0,0,28,0,TAU*player.energy/player.maxEnergy);ctx.stroke();
    if(shieldCharge){glow('#52DFFF',12);ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,39,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    ctx.rotate(angle);
    if(muzzle>0){glow('#B7FF9B',35);path([[22,-3],[48,-12],[37,0],[50,9],[22,3]],true);ctx.fill();}
    const laser = ctx.createLinearGradient(20, 0, 400, 0); laser.addColorStop(0, '#A8FF5480'); laser.addColorStop(1, '#A8FF5400');
    ctx.strokeStyle = laser; ctx.setLineDash([5, 5]); path([[22, 0], [400, 0]]); ctx.stroke(); ctx.setLineDash([]);
    if (player.invuln <= 0 || Math.floor(clock * 20) % 2 === 0) {
      ctx.shadowBlur=0;if(mechArt.operative)ctx.drawImage(mechArt.operative,-56,-56);else paintMech(ctx,'operative');
      glow(overclockWasOn?'#63FF85':'#A8FF54',overclockWasOn?20:7);ctx.fillRect(-18,-14,4,7);ctx.fillRect(-18,7,4,7);ctx.fillRect(10,-4,3,8);
      if(overclockWasOn){ctx.strokeStyle='#B7FF9B';ctx.lineWidth=1;path([[-22,-12],[-31,-9],[-26,-3],[-37,0]]);ctx.stroke();}
    }
    ctx.restore();
    if (active && pointer.inside) {
      ctx.strokeStyle = '#52DFFF99'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 8, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4; path([[pointer.x + Math.cos(a) * 12, pointer.y + Math.sin(a) * 12], [pointer.x + Math.cos(a) * 17, pointer.y + Math.sin(a) * 17]]); ctx.stroke(); }
    }
    if (empRing > 0) {
      const ex=empOrigin?.x??player.x,ey=empOrigin?.y??player.y,progress=1-empRing/.65,r=progress*290;
      glow('#52DFFF',12);ctx.globalAlpha=empRing/.65;ctx.lineWidth=3;ctx.beginPath();ctx.arc(ex,ey,r,0,TAU);ctx.stroke();ctx.lineWidth=1;ctx.beginPath();ctx.arc(ex,ey,r*.93,0,TAU);ctx.stroke();
      ctx.shadowBlur=0;for(let i=0;i<12;i++){const a=i*TAU/12+progress*.4;path([[ex+Math.cos(a)*r,ey+Math.sin(a)*r],[ex+Math.cos(a+.045)*(r+8),ey+Math.sin(a+.045)*(r+8)],[ex+Math.cos(a+.09)*(r-6),ey+Math.sin(a+.09)*(r-6)],[ex+Math.cos(a+.13)*r,ey+Math.sin(a+.13)*r]]);ctx.stroke();}ctx.globalAlpha=1;
    }
    for (const ring of rings) {
      const progress=1-ring.life*2,r=progress*90,color=ring.color.startsWith('#ff')||ring.color.startsWith('#f3')?'#FF354F':'#A8FF54';
      glow(color,9);ctx.globalAlpha=ring.life*2;ctx.lineWidth=3;ctx.beginPath();ctx.arc(ring.x,ring.y,r,0,TAU);ctx.stroke();ctx.lineWidth=1;ctx.beginPath();ctx.arc(ring.x,ring.y,r*1.15,0,TAU);ctx.stroke();
      if(progress<.32){ctx.fillStyle='#ffffff';ctx.globalAlpha=(1-progress/.32)*.8;ctx.beginPath();ctx.arc(ring.x,ring.y,6+progress*55,0,TAU);ctx.fill();}ctx.globalAlpha=1;
    }
    ctx.shadowBlur=0;
    for (let i=0;i<particles.length;i++) {const p=particles[i],life=Math.max(0,p.life/p.max);ctx.globalAlpha=life;const hostile=/^#(ff|f3|f4|f5|f6)/i.test(p.color),color=hostile?'#FF526A':p.color==='#9aa9a3'?'#8593A1':p.color==='#52DFFF'?'#52DFFF':'#A8FF54';
      if(i%5===0){ctx.fillStyle='#8593A1';ctx.fillRect(p.x,p.y,p.size*1.5,p.size);ctx.fillStyle='#343D48';ctx.fillRect(p.x+1,p.y+1,p.size,2);}
      else {ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,p.size*.6);path([[p.x,p.y],[p.x-p.vx*.025,p.y-p.vy*.025]]);ctx.stroke();ctx.fillStyle='#efffe8';ctx.fillRect(p.x,p.y,1,1);}
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    for (const n of numbers) { ctx.globalAlpha = n.life; label(n.text, n.x, n.y, n.color, 12); }
    ctx.globalAlpha = 1;
    if (!active) { label('OPERATIVE / 01', px, py + 46, '#b9dc8f88', 8); }
    // Inset vignette keeps the neon readable without raster assets.
    if(vignetteArt)ctx.drawImage(vignetteArt,0,0);
    if(active&&!options.trailer&&clock<3){ctx.fillStyle='#101c21e8';ctx.fillRect(180,100,840,70);label(`MOVE: ${['up','left','down','right'].map(badge).join('/')} | DASH: ${badge('dash')} | SHOOT GOLD RELAYS`,600,129,'#d9edb4',17);label(level.id===2?`DASH INTO GOLD RINGS OR HOLD ${badge('overclock')} TO DECRYPT`: 'ENTER GOLD RINGS TO DECRYPT · RED TARGET RINGS MEAN MOVE NOW',600,153,'#ffc76d',12);}
    if(overclockExhausted&&active)label(`ENERGY DEPLETED / RELEASE ${badge('overclock')} TO REARM`,600,690,'#52DFFF',13);
    if(finale){ctx.fillStyle='#0c161dcc';ctx.fillRect(140,300,920,135);label(level.id===3?'MAINFRAME TERMINATED':'SECTOR CLEARED',600,352,'#d8ff9b',38);label('+150 SHARD SECTOR CLEAR BONUS · RECOVERING ALL DATA',600,391,'#52DFFF',14);label(`UPLINK IN ${Math.max(0,2.2-finale.time).toFixed(1)}s`,600,415,'#ffc76d',12);}
    ctx.restore();
  }
  function drawAmbient(){
    ctx.shadowBlur=0;
    for(let i=0;i<24;i++){const x=65+(i*173.7+Math.sin(clock*.17+i)*15)%1070,y=70+((i*97-clock*(3+i%4))%620+620)%620;ctx.globalAlpha=.08+.08*Math.sin(clock+i);ctx.fillStyle=i%6===0?'#52DFFF':'#8593A1';ctx.fillRect(x,y,i%3===0?2:1,1);}
    for(let i=0;i<4;i++){const x=i%2?1100:100,y=i<2?140:620,t=(clock*.14+i*.27)%1;ctx.globalAlpha=(1-t)*.045;ctx.strokeStyle='#8593A1';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(x+Math.sin(clock+i)*8,y-t*45,8+t*14,3+t*5,-.3,0,TAU);ctx.stroke();}ctx.globalAlpha=1;
  }
  function drawWorldFeatures(){
    ctx.shadowBlur=0;ctx.lineWidth=1;
    for(const w of wreckage){ctx.fillStyle='#02080a80';ctx.beginPath();ctx.ellipse(w.x,w.y,w.r,w.r*.6,0,0,TAU);ctx.fill();ctx.strokeStyle=w.color+'45';for(let i=0;i<5;i++){const a=i*TAU/5;path([[w.x+Math.cos(a)*10,w.y+Math.sin(a)*10],[w.x+Math.cos(a)*w.r,w.y+Math.sin(a)*w.r*.6]]);ctx.stroke();}}
    for(const z of zones){const progress=1-Math.max(0,z.timer)/z.max;glow('#FF354F',12);ctx.lineWidth=2;ctx.fillStyle=`rgba(255,70,100,${.06+progress*.18})`;ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(z.x,z.y,z.r*(1-progress),0,TAU);ctx.stroke();path([[z.x-15,z.y],[z.x+15,z.y]]);ctx.stroke();path([[z.x,z.y-15],[z.x,z.y+15]]);ctx.stroke();label(`MORTAR LOCK / ${Math.max(0,z.timer).toFixed(1)}s`,z.x,z.y-z.r-12,'#FF526A',12);}
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
    ctx.save(); ctx.translate(x, y + Math.sin(clock * 3 + x) * 4); ctx.rotate(Math.PI / 4); glow('#52DFFF', 15); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
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
