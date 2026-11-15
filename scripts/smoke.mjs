import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { freshRun, getRank, LEVELS, WEAPON_DAMAGE, ENEMY_HP, purchaseUpgrade, purchasePerk, eligibleHighScore, rankBreakdown } from '../src/levels.js';

const originalRandom = Math.random;
let seed = 73421;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// Simulate the real engine without a browser or real time delays.
// These checks exercise combat outcomes, not a separate implementation.
function harness(level, god = true, upgrades = {}, perk = null) {
  const listeners = new Map();
  let nextFrame, time = 0, ended, paused = false;
  const context = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  const listen = (name, callback) => listeners.set(name, callback);
  const unlisten = name => listeners.delete(name);
  globalThis.window = { addEventListener: listen, removeEventListener: unlisten };
  globalThis.devicePixelRatio = 1;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = callback => { nextFrame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { nextFrame = null; };
  const canvas = {
    clientWidth: 1200, clientHeight: 760,
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 760 }),
    addEventListener: listen, removeEventListener: unlisten, focus() {}, setPointerCapture() {},
  };
  const run = freshRun(); run.perk=perk; Object.assign(run.upgrades, upgrades);
  const engine = createEngine(canvas, {
    level, active: true, run, isGod: () => god, isPaused: () => paused,
    onPause: () => { paused = !paused; }, onHud() {}, onAchievement() {}, onEnd: result => { ended = result; },
  });
  function step(seconds, eachFrame) {
    for (let i = 0; i < seconds * 60; i++) { eachFrame?.(); time += 1000 / 60; const callback = nextFrame; if (callback) callback(time); }
  }
  function key(code, down = true) { listeners.get(down ? 'keydown' : 'keyup')?.({ code, repeat: false, target: { tagName: 'CANVAS' }, preventDefault() {} }); }
  function aim(x, y, down = true) { listeners.get(down ? 'pointerdown' : 'pointermove')?.({ clientX: x, clientY: y, pointerType: 'mouse', pointerId: 1 }); }
  return { setGod(value){god=value;}, engine, step, key, aim, result: () => ended, release: () => listeners.get('pointerup')?.({ pointerId: 1 }), close: () => engine.destroy() };
}


function travel(h,x,y){
 const codes=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
 for(let n=0;n<1500;n++){
  const p=h.engine.inspect().player,dx=x-p.x,dy=y-p.y;
  if(Math.hypot(dx,dy)<9)break;
  for(const c of codes)h.key(c,false);
  if(dx>5)h.key('ArrowRight');if(dx< -5)h.key('ArrowLeft');if(dy>5)h.key('ArrowDown');if(dy< -5)h.key('ArrowUp');h.step(1/60);
  if(n===1499)assert.fail(`Route blocked at ${p.x},${p.y} toward ${x},${y}`);
 }
 for(const c of codes)h.key(c,false);
}
for(const level of LEVELS){
 const h=harness(level.id,true,{damage:3,rate:3});
 const [tx,ty]=level.positions[0];h.aim(tx,ty);h.step(5);h.release();
 if(level.id!==1)assert.equal(h.engine.snapshot().destroyed,0,'Remote fire cannot defeat shielded objectives');
 else assert.ok(h.engine.inspect().barrels.some(b=>b.hp<=0),'Explosive barrels can break armor from range');
 for(const [x,y] of level.positions){
  travel(h,h.engine.inspect().player.x, y>400?690:90);travel(h,x,y>400?690:90);travel(h,x,y);
  h.aim(x,y);if(level.id===2)h.key('Space');h.step(10);h.key('Space',false);h.release();
 }
 assert.equal(h.engine.snapshot().destroyed,level.target,`Sector ${level.id} objectives can be decrypted and destroyed`);
 if(level.id===3){
  assert.equal(h.engine.snapshot().bossPhase,true);
  const phases=new Set();h.aim(600,220);
  h.step(90,()=>{const b=h.engine.inspect().boss;phases.add(b.phase);h.aim(b.x,b.y,false);});
  assert.ok(phases.has(2)&&phases.has(3),'Boss enters death-beam and siege phases');
 }
 h.step(3);assert.equal(h.result()?.won,true,`Sector ${level.id} can be won`);
 assert.ok(h.result().run.totalShards>=level.target*3,'Finale recovers objective shards');
 assert.equal(h.engine.inspect().shards.length,0,'No finale loot is lost');
 h.close();console.log(`PASS sector ${level.id}: shields, traversal, destruction, finale loot, boss phases`);
}
{
 const h=harness(1);h.step(.1);h.key('Space');h.step(1);h.key('Space',false);assert.ok(h.engine.snapshot().energy<80);
 h.step(1);assert.ok(h.engine.snapshot().energy>80);
 const before=h.engine.snapshot().worldTime;h.key('Space');h.step(1);h.key('Space',false);assert.ok(h.engine.snapshot().worldTime-before<.45,'All hostile world clocks slow to 40%');
 h.key('ArrowLeft');h.key('ShiftLeft');h.step(.2);h.key('ArrowLeft',false);h.key('ShiftLeft',false);assert.ok(h.engine.snapshot().playerX<450,'Arrow keys control dash direction');
 h.key('KeyQ');assert.ok(h.engine.snapshot().empCooldown>11);h.key('KeyQ',false);
 h.key('Escape');const elapsed=h.engine.snapshot().elapsed;h.step(2);assert.equal(h.engine.snapshot().elapsed,elapsed);h.key('Escape');h.step(.1);assert.ok(h.engine.snapshot().elapsed>elapsed);
 h.close();console.log('PASS controls: overclock, global hazard clock, arrow dash, EMP, pause');
}
{
 const h=harness(1);h.step(.1);h.engine.complete();assert.equal(h.result(),undefined,'Completion does not switch immediately');h.step(1);assert.equal(h.result(),undefined);assert.ok(h.engine.snapshot().finale);h.step(1.3);assert.equal(h.result()?.won,true);assert.equal(h.result().run.demo,true);assert.equal(h.result().run.totalShards,9);h.close();console.log('PASS 2.2-second delayed finale, vacuum and demo taint');
}
{
 const h=harness(1,false);h.step(50);assert.equal(h.result()?.won,false,'Standing still is fatal');assert.ok(h.result().run.fatalThreat,'Fatal threat is recorded');h.close();console.log('PASS stationary defeat and exact fatal threat');
}
{
 const h=harness(1,false,{},'shield');h.step(6);let state=h.engine.inspect();assert.equal(state.shieldCharge,0,'Nanoshield blocks initial hit');h.setGod(true);h.step(12.1);state=h.engine.inspect();assert.equal(state.shieldCharge,1,'Shield regenerates after 12 combat seconds');h.close();console.log('PASS nanoshield block and regeneration clock');
}
{
 const h=harness(3);h.step(12);const before=h.engine.inspect().bullets.filter(b=>b.enemy);assert.ok(before.length>0,'Combat has hostile bullets');h.key('KeyQ');assert.equal(h.engine.inspect().bullets.filter(b=>b.enemy).length,before.length,'EMP does not instantly erase distant projectiles');h.key('KeyQ',false);h.step(.2);const types=new Set(h.engine.inspect().enemies.map(e=>e.type));h.step(15);for(const e of h.engine.inspect().enemies)types.add(e.type);assert.ok(types.has('charger')&&types.has('mortar'),'New enemy archetypes spawn');h.close();console.log('PASS local expanding EMP and new enemy archetypes');
}

{
 const run=freshRun();run.bank=6000;run.shards=12;run.score=6000;
 const bought=purchaseUpgrade(run,'damage');assert.equal(bought.upgrades.damage,1);assert.equal(bought.shards,11);assert.equal(bought.bank,5350);assert.equal(bought.score,6000);
 assert.equal(purchaseUpgrade({...run,shards:0},'damage').upgrades.damage,0,'Shards required');
 const perk=purchasePerk(run,'spread');assert.equal(perk.shards,10);assert.equal(perk.bank,5650);
 for(const hp of Object.values({drone:ENEMY_HP.drone,gunner:ENEMY_HP.gunner})){const hits=WEAPON_DAMAGE.map(d=>Math.ceil(hp/d));for(let i=1;i<hits.length;i++)assert.ok(hits[i]<hits[i-1],'Every damage tier improves hits to kill');}
 assert.equal(eligibleHighScore({...run,demo:true}),false);assert.equal(eligibleHighScore(run),true);
 assert.equal(getRank({...run,score:20000,elapsed:150,damageTaken:10},true),'S');assert.equal(getRank(freshRun(),false),'C');assert.ok(rankBreakdown(run,true).formula.includes('damage'));
 console.log('PASS shard economy, weapon breakpoints, score eligibility and rank formula');
}
Math.random=originalRandom;
