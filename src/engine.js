import { sound, setOverclockAudio } from './audio.js';
import { LEVELS } from './levels.js';

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
  const player = { x: 600, y: 450, hp: 100 + upgrades.hull * 40, maxHp: 100 + upgrades.hull * 40, energy: 100 + upgrades.energy * 40, maxEnergy: 100 + upgrades.energy * 40, angle: -.8, invuln: 0 };
  const keys = new Set();
  const pointer = { x: 840, y: 260, down: false, inside: false };
  let clock = 0, shotTimer = 0, spawnTimer = 1.5, empCooldown = 0, combo = 1, comboTimer = 0, chain = 0;
  let shake = 0, hitStop = 0, lastFrame = 0, frame, hudTime = 0, done = false, overclockWasOn = false;
  let overclockExhausted = false, dashCooldown = 0, dashTime = 0, dashAngle = 0, muzzle = 0;
  const ghosts = [];
  let shieldCharge = run.perk === "shield" ? 1 : 0;
  let destroyed = 0, bossPhase = false, laserHit = 0, empRing = 0;
  const enemies = [], bullets = [], particles = [], numbers = [], shards = [], rings = [];
  const active = options.active;
  const covers = [
    { x: 315, y: 270, w: 72, h: 42 }, { x: 835, y: 270, w: 72, h: 42 },
    { x: 360, y: 545, w: 44, h: 68 }, { x: 805, y: 530, w: 44, h: 68 },
    { x: 570, y: 300, w: 80, h: 34 },
  ].map(p => ({ ...p, hp: 70, maxHp: 70 }));
  const positions = level.id === 2 ? [[250, 180], [950, 180], [250, 570], [950, 570]] : [[260, 220], [940, 220], [600, 605]];
  const relays = positions.map(([x, y]) => ({ x, y, hp: level.id === 3 ? 150 : 110, maxHp: level.id === 3 ? 150 : 110, radius: 25 }));
  const boss = { x: 600, y: 210, hp: 1800, maxHp: 1800, radius: 52, timer: 2.2 };
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
    if (!active || done || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) dash();
    if (e.code === 'Escape' && !e.repeat) options.onPause();
    if (e.code === 'KeyQ' && !e.repeat && !options.isPaused()) emp();
    keys.add(e.code);
  }
  function keyup(e) { keys.delete(e.code); }
  function pointermove(e) {
    if (e.pointerType === 'touch' && touch.id === e.pointerId) {
      touch.x = clamp((e.clientX - touch.startX) / 42, -1, 1); touch.y = clamp((e.clientY - touch.startY) / 42, -1, 1);
    } else { Object.assign(pointer, coords(e)); pointer.inside = true; }
  }
  function pointerdown(e) {
    if (!active) return;
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
  function award(points) { const earned = Math.round(points * combo); run.score += earned; run.bank += earned; }
  function kill(enemy) {
    if (enemy.dead) return;
    enemy.dead = true; run.kills++; chain++; comboTimer = 4;
    combo = Math.min(8, 1 + Math.floor(chain / 2)); award(enemy.type === 'gunner' ? 180 : 120);
    burst(enemy.x, enemy.y, enemy.color, 36, Math.atan2(enemy.y - player.y, enemy.x - player.x));
    number(enemy.x, enemy.y - 18, `+${(enemy.type === 'gunner' ? 180 : 120) * combo}`);
    shards.push({ x: enemy.x, y: enemy.y, age: 0 });
    if(overclockWasOn) number(enemy.x,enemy.y-45,`OVERCLOCK x${combo}!`,'#79d9f4');
    shake = Math.max(shake, 4); hitStop = .035; sound('explode');
    if (run.kills === 1) toast('first', 'FIRST CONTACT', 'First hostile eliminated. Welcome to the network.');
    if (combo >= 4) toast('combo', 'CHAIN REACTION', 'Combo multiplier reached 4×. Keep it going.');
    if (combo === 8) toast('eight', 'SYSTEM OVERLOAD', 'Maximum 8× multiplier achieved.');
  }
  function hurt(amount) {
    if (options.isGod() || player.invuln > 0 || done) return;
    if (shieldCharge) { shieldCharge = 0; player.invuln = 1; number(player.x, player.y - 30, "NANOSHIELD", "#79d9f4"); return; }
    player.hp = Math.max(0, player.hp - amount); player.invuln = .5; run.damageTaken += amount;
    shake = 7; burst(player.x, player.y, '#f48d9c', 12); sound('hit'); number(player.x, player.y - 25, `−${amount}`, '#f48d9c');
    if (player.hp <= 0) finish(false);
  }
  function finish(won) {
    if (done) return;
    done = true; keys.clear(); pointer.down = false;
    if (won) {
      if(level.id===3){burst(boss.x,boss.y,'#f3a0ac',100);shake=22;hitStop=.16;sound('explode');}
      award(level.id === 3 ? 2000 : 1000); sound('victory');
      toast(`level-${level.id}`, level.id === 3 ? 'PROTOCOL TERMINATED' : 'SECTOR SECURED', level.id === 3 ? 'The mainframe is yours.' : `${level.name} cleared. +1,000 base score.`);
    }
    options.onHud(snapshot());
    options.onEnd({ won, run, health: player.hp });
  }
  function dash() {
    if (!active || done || options.isPaused() || dashCooldown > 0) return;
    dashCooldown = run.perk === 'dash' ? 1.7 : 3; dashTime = .19; player.invuln = .32;
    const dx = Number(keys.has('KeyD')) - Number(keys.has('KeyA')), dy = Number(keys.has('KeyS')) - Number(keys.has('KeyW'));
    dashAngle = dx || dy ? Math.atan2(dy, dx) : player.angle;
    sound('dash'); burst(player.x, player.y, '#79d9f4', 28, dashAngle + Math.PI);
  }
  function emp() {
    if (!active || done || empCooldown > 0 || options.isPaused()) return;
    empCooldown = 12; empRing = .65; shake = 9; sound('emp');
    for (const enemy of enemies) if (!enemy.dead && dist(player, enemy) < 270) { enemy.hp -= 105; if (enemy.hp <= 0) kill(enemy); }
    for (const relay of relays) if (relay.hp > 0 && dist(player, relay) < 270) damageRelay(relay, 95);
    if (level.id === 3 && bossPhase && dist(player, boss) < 320) { boss.hp = Math.max(0, boss.hp - 160); if (boss.hp === 0) finish(true); }
    for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].enemy) bullets.splice(i, 1);
    toast('emp', 'ELECTROMAGNETIC PERSONALITY', 'EMP deployed. Hostile projectiles erased.');
  }
  function damageRelay(relay, damage) {
    relay.hp -= damage; burst(relay.x, relay.y, level.color, 5); number(relay.x + rand(-12, 12), relay.y - 30, Math.round(damage), '#e2e9d9');
    if (relay.hp <= 0) {
      destroyed++; award(350); shards.push({ x: relay.x, y: relay.y, age: 0 });
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
    const type = Math.random() < (level.id === 1 ? .22 : .45) ? 'gunner' : 'drone';
    enemies.push({ x, y, hp: type === 'gunner' ? 65 : 42, radius: type === 'gunner' ? 17 : 13, type, color: type === 'gunner' ? '#e0a879' : '#f58c9e', shot: rand(1.2, 2.6), dead: false });
  }
  function fire(x, y, angle, enemy = false, speed = 650, damage = 20) {
    bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, enemy, damage, trail: [], life: 2.6 });
  }
  function solid(x, y, r) {
    return covers.some(c => c.hp > 0 && x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h);
  }
  function snapshot() {
    return { hp: player.hp, maxHp: player.maxHp, energy: player.energy, maxEnergy: player.maxEnergy, score: run.score, bank: run.bank, combo, comboTime: comboTimer / 4, shards: run.shards, kills: run.kills, elapsed: run.elapsed, destroyed, target: level.target, empCooldown, dashCooldown, overclock: overclockWasOn, bossHp: boss.hp, bossMax: boss.maxHp, bossPhase, achievements: run.achievements.length };
  }
  function update(dt) {
    clock += dt;
    if (!active || done || options.isPaused()) return;
    if (options.isGod()) run.demo = true;
    run.elapsed += dt;
    dashCooldown = Math.max(0, dashCooldown - dt); muzzle = Math.max(0, muzzle - dt);
    for(let i=ghosts.length-1;i>=0;i--){ghosts[i].life-=dt;if(ghosts[i].life<=0)ghosts.splice(i,1);}
    if(dashTime>0){dashTime-=dt;ghosts.push({x:player.x,y:player.y,angle:dashAngle,life:.32});const x=clamp(player.x+Math.cos(dashAngle)*1050*dt,57,W-57),y=clamp(player.y+Math.sin(dashAngle)*1050*dt,57,H-57);if(!solid(x,player.y,12))player.x=x;if(!solid(player.x,y,12))player.y=y;}
    player.invuln -= dt; shotTimer -= dt; empCooldown = Math.max(0, empCooldown - dt); laserHit = Math.max(0, laserHit - dt);
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer === 0) { combo = 1; chain = 0; }
    const overclockRequested = keys.has('Space') || options.isTouchOverclock?.();
    if (!overclockRequested) overclockExhausted = false;
    if (player.energy <= 1) overclockExhausted = true;
    const overclock = overclockRequested && !overclockExhausted && player.energy > 1;
    if (overclock && !overclockWasOn) sound('overclock');
    overclockWasOn = overclock; setOverclockAudio(overclock);
    player.energy = clamp(player.energy + (overclock ? -29 : 14 + upgrades.energy * 3) * dt, 0, player.maxEnergy);
    const enemyDt = dt * (overclock ? .4 : 1);
    let dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + touch.x;
    let dy = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + touch.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    const nx = clamp(player.x + dx * 245 * dt, 57, W - 57), ny = clamp(player.y + dy * 245 * dt, 57, H - 57);
    if (!solid(nx, player.y, 12)) player.x = nx;
    if (!solid(player.x, ny, 12)) player.y = ny;
    player.angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);
    if (pointer.down && shotTimer <= 0) {
      shotTimer = .19 / ((1 + upgrades.rate * .2) * (overclock ? 2 : 1));
      fire(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, player.angle, false, 850, 24 * (1 + upgrades.damage * .25));
      if(run.perk === 'spread') for(const offset of [-.13,.13]) fire(player.x,player.y,player.angle+offset,false,850,12*(1+upgrades.damage*.25));
      muzzle = .07;
      sound('shoot'); burst(player.x + Math.cos(player.angle) * 25, player.y + Math.sin(player.angle) * 25, '#d4ff9d', 3, player.angle);
    }
    spawnTimer -= enemyDt;
    if (spawnTimer <= 0) { spawn(); spawnTimer = Math.max(.55, 2.3 - level.id * .3 - clock * .007); }
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const d = dist(player, enemy);
      const speed = enemy.type === 'gunner' ? (d > 300 ? 55 : d < 190 ? -35 : 0) : 72 + level.id * 13;
      const ex = enemy.x + Math.cos(angle) * speed * enemyDt, ey = enemy.y + Math.sin(angle) * speed * enemyDt;
      if (!solid(ex, enemy.y, enemy.radius)) enemy.x = ex; else enemy.y += Math.cos(clock * 2 + enemy.x) * 80 * enemyDt;
      if (!solid(enemy.x, ey, enemy.radius)) enemy.y = ey; else enemy.x += Math.sin(clock * 2 + enemy.y) * 80 * enemyDt;
      if (d < 26) hurt(12);
      if (enemy.type === 'gunner') {
        enemy.shot -= enemyDt;
        if (enemy.shot <= 0) { fire(enemy.x, enemy.y, angle, true, 215 + level.id * 20, 13); enemy.shot = 2.3; }
      }
    }
    if (level.id === 3) {
      boss.x = 600 + Math.sin(clock * .35) * 170;
      boss.timer -= enemyDt;
      if (boss.timer <= 0) {
        const count = bossPhase ? 18 : 10;
        for (let i = 0; i < count; i++) fire(boss.x, boss.y, i * TAU / count + clock, true, bossPhase ? 200 : 155, 16);
        boss.timer = bossPhase ? 1.8 : 3;
      }
      if (dist(player, boss) < 65) hurt(20);
    }
    if (level.id === 2) {
      const cycle = clock % 6;
      if (cycle > 3.1 && cycle < 4.5 && laserHit === 0) {
        if (Math.abs(player.x - 450) < 15 || Math.abs(player.x - 750) < 15 || Math.abs(player.y - 380) < 15) { hurt(16); laserHit = .75; }
      }
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; const time = b.enemy ? enemyDt : dt;
      b.trail.push({x:b.x,y:b.y}); if(b.trail.length>7)b.trail.shift();
      b.x += b.vx * time; b.y += b.vy * time; b.life -= dt;
      let consumed = b.life <= 0 || b.x < 30 || b.x > W - 30 || b.y < 30 || b.y > H - 30;
      if (!consumed) for (const c of covers) {
        if (c.hp > 0 && b.x > c.x - 3 && b.x < c.x + c.w + 3 && b.y > c.y - 3 && b.y < c.y + c.h + 3) {
          c.hp -= b.damage; consumed = true; burst(b.x, b.y, '#9aa9a3', c.hp <= 0 ? 20 : 5);
          if (c.hp <= 0) { shake = 3; sound('explode'); if (!b.enemy) award(50); }
          break;
        }
      }
      if (!consumed && b.enemy && dist(b, player) < 15) { hurt(b.damage); consumed = true; }
      if (!consumed && !b.enemy) {
        for (const enemy of enemies) if (!enemy.dead && dist(b, enemy) < enemy.radius + 4) {
          const critical = Math.random() < .15; const damage = b.damage * (critical ? 1.65 : 1); enemy.hp -= damage; if(critical) number(enemy.x,enemy.y-35,'CRIT!','#fff6b3'); sound('hit'); consumed = true; burst(b.x, b.y, enemy.color, 10, Math.atan2(b.vy, b.vx)); number(enemy.x, enemy.y - 15, Math.round(damage), '#e7e9e2');
          if (enemy.hp <= 0) kill(enemy);
          break;
        }
        if (!consumed) for (const relay of relays) if (relay.hp > 0 && dist(b, relay) < 30) { damageRelay(relay, b.damage); consumed = true; break; }
        if (!consumed && level.id === 3 && dist(b, boss) < 57) {
          consumed = true;
          if (bossPhase) { boss.hp = Math.max(0, boss.hp - b.damage); burst(b.x, b.y, '#f3a0ac', 5); number(b.x, b.y - 30, Math.round(b.damage)); if (boss.hp <= 0) finish(true); }
          else { burst(b.x, b.y, '#79d9f4', 4); number(b.x, b.y - 25, 'SHIELDED', '#79d9f4'); }
        }
      }
      if (consumed) bullets.splice(i, 1);
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const shard = shards[i]; shard.age += dt; const d = dist(player, shard);
      if (d < 125) { shard.x += (player.x - shard.x) * dt * 6; shard.y += (player.y - shard.y) * dt * 6; }
      if (d < 20) { shards.splice(i, 1); run.shards++; award(100); player.energy = Math.min(player.maxEnergy, player.energy + 15); player.hp = Math.min(player.maxHp, player.hp + 4); sound('collect'); number(player.x, player.y - 30, '+100 DATA'); if (run.shards >= 5) toast('shards', 'DATA LIBERATOR', 'Five data shards recovered.'); }
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
  }

  function path(points, close = false) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (close) ctx.closePath();
  }
  function glow(color, amount = 12) { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = amount; }
  function label(text, x, y, color = '#73847e', size = 9, align = 'center') { ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.font = `${size}px "SFMono-Regular", Consolas, monospace`; ctx.textAlign = align; ctx.fillText(text, x, y); }
  function draw() {
    const width = canvas.width, height = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0d1718'; ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / W, height / H);
    ctx.translate((width - W * scale) / 2, (height - H * scale) / 2); ctx.scale(scale, scale);
    ctx.save();
    if (shake > .1 && active) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= .89; }
    const gradient = ctx.createRadialGradient(600, 380, 50, 600, 380, 700);
    gradient.addColorStop(0, '#192a2d'); gradient.addColorStop(.6, '#132024'); gradient.addColorStop(1, '#0c1516');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
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
    for (const relay of relays) {
      path([[relay.x, relay.y], [relay.x, 380], [600, 380]]); ctx.lineWidth = 1; ctx.strokeStyle = relay.hp > 0 ? `${level.color}18` : '#748b7920'; ctx.stroke();
      if (relay.hp <= 0) { label('OFFLINE', relay.x, relay.y + 5, '#627769', 9); ctx.strokeStyle = '#485b5044'; ctx.strokeRect(relay.x - 22, relay.y - 22, 44, 44); continue; }
      ctx.save(); ctx.translate(relay.x, relay.y);
      ctx.strokeStyle = '#64756666'; ctx.fillStyle = '#1e3130'; ctx.lineWidth = 2;
      path([[-30, -18], [-18, -30], [18, -30], [30, -18], [30, 18], [18, 30], [-18, 30], [-30, 18]], true); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.rotate(clock * .45); glow(level.color, 13); ctx.lineWidth = 1.4; ctx.strokeRect(-16, -16, 32, 32); ctx.restore();
      glow(level.color, 16); ctx.fillRect(-6, -11, 12, 22); ctx.shadowBlur = 0;
      ctx.fillStyle = '#35463b'; ctx.fillRect(-25, -44, 50, 3); ctx.fillStyle = level.color; ctx.fillRect(-25, -44, 50 * relay.hp / relay.maxHp, 3);
      label(level.id === 3 ? 'SHIELD EMITTER' : level.id === 2 ? 'CRYO NODE' : 'SECURITY RELAY', 0, 59, `${level.color}a0`, 8);
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
    if (level.id === 2) {
      const cycle = clock % 6, firing = cycle > 3.1 && cycle < 4.5, warning = cycle > 1.8 && cycle <= 3.1;
      ctx.lineWidth = firing ? 5 : 1; glow(firing ? '#7ee9ff' : warning ? '#f0b96f' : '#38616b', firing ? 25 : 5);
      ctx.setLineDash(firing ? [] : [7, 10]);
      for (const x of [450, 750]) { path([[x, 70], [x, 690]]); ctx.stroke(); }
      path([[70, 380], [1130, 380]]); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
      if (warning || firing) label(firing ? 'LASER GRID ACTIVE' : 'WARNING: GRID CHARGING', 600, 115, firing ? '#7ee9ff' : '#f0b96f', 11);
    }
    if (level.id === 3) {
      ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(clock * .12);
      glow(bossPhase ? '#f3a0ac' : '#79d9f4', 20); ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.strokeRect(-42 - k * 3, -42 - k * 3, 84 + k * 6, 84 + k * 6); }
      ctx.fillStyle = '#161d2a'; ctx.fillRect(-28, -28, 56, 56); glow('#f3a0ac', 20); ctx.fillRect(-12, -12, 24, 24);
      ctx.restore(); label('A R C H O N', boss.x, boss.y - 82, '#f3a0ac', 12);
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
      if (enemy.type === 'gunner') { ctx.strokeRect(-12, -12, 24, 24); ctx.fillStyle = '#281f25'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = enemy.color; ctx.fillRect(3, -3, 18, 6); }
      else { path([[16, 0], [-10, -11], [-5, 0], [-10, 11]], true); ctx.fillStyle = '#3b2430'; ctx.fill(); ctx.stroke(); }
      ctx.restore();
      const max = enemy.type === 'gunner' ? 65 : 42;
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
    for(const ghost of ghosts){ctx.save();ctx.globalAlpha=ghost.life*.9;ctx.translate(ghost.x,ghost.y);ctx.rotate(ghost.angle);glow('#79d9f4',18);ctx.fillRect(-13,-11,28,22);ctx.restore();}
    if(active) label(`SHIFT / DASH ${dashCooldown>0?dashCooldown.toFixed(1)+'s':'READY'}`,W-80,H-47,'#8cc9d0',9);

    ctx.save(); ctx.translate(px, py);
    glow(overclockWasOn ? '#8eeaff' : '#c2f66e', 15); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.strokeStyle = '#b7ea6e30'; ctx.stroke();
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
    if (empRing > 0) { glow('#91defb', 20); ctx.lineWidth = 4; ctx.globalAlpha = empRing / .65; ctx.beginPath(); ctx.arc(player.x, player.y, (1 - empRing / .65) * 290, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const ring of rings) { glow(ring.color, 12); ctx.globalAlpha = ring.life * 2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ring.x, ring.y, (1 - ring.life * 2) * 90, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); glow(p.color, 7); ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    for (const n of numbers) { ctx.globalAlpha = n.life; label(n.text, n.x, n.y, n.color, 12); }
    ctx.globalAlpha = 1;
    if (!active) { label('OPERATIVE / 01', px, py + 46, '#b9dc8f88', 8); }
    // Inset vignette keeps the neon readable without raster assets.
    const vignette = ctx.createRadialGradient(600, 380, 200, 600, 380, 730); vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#030909aa'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function drawShard(x, y) {
    ctx.save(); ctx.translate(x, y + Math.sin(clock * 3 + x) * 4); ctx.rotate(Math.PI / 4); glow('#79d9f4', 15); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  }
  function animate(now) {
    const dt = Math.min(.033, (now - (lastFrame || now)) / 1000); lastFrame = now;
    const paused = active && options.isPaused();
    if (!paused) {
      if (hitStop > 0) hitStop -= dt; else update(dt);
      empRing = Math.max(0, empRing - dt);
      for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
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
    complete() { if (!active || done) return; run.demo = true; destroyed = level.target; boss.hp = 0; finish(true); },
    snapshot,
    destroy() {
      setOverclockAudio(false);
      canvas.removeEventListener('contextmenu', contextmenu);
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('pointerup', pointerup); window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointermove', pointermove); canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointercancel', pointerup); canvas.removeEventListener('pointerleave', leave);
    },
  };
}
