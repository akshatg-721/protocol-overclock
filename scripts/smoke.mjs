import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { freshRun, getRank, LEVELS } from '../src/levels.js';

const originalRandom = Math.random;
let seed = 73421;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// Simulate the real engine without a browser or real time delays.
// These checks exercise combat outcomes, not a separate implementation.
function harness(level, god = true, upgrades = {}) {
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
  const run = freshRun(); Object.assign(run.upgrades, upgrades);
  const engine = createEngine(canvas, {
    level, active: true, run, isGod: () => god, isPaused: () => paused,
    onPause: () => { paused = !paused; }, onHud() {}, onAchievement() {}, onEnd: result => { ended = result; },
  });
  function step(seconds, eachFrame) {
    for (let i = 0; i < seconds * 60; i++) { eachFrame?.(); time += 1000 / 60; const callback = nextFrame; if (callback) callback(time); }
  }
  function key(code, down = true) { listeners.get(down ? 'keydown' : 'keyup')?.({ code, repeat: false, target: { tagName: 'CANVAS' }, preventDefault() {} }); }
  function aim(x, y, down = true) { listeners.get(down ? 'pointerdown' : 'pointermove')?.({ clientX: x, clientY: y, pointerType: 'mouse', pointerId: 1 }); }
  return { engine, step, key, aim, result: () => ended, release: () => listeners.get('pointerup')?.({ pointerId: 1 }), close: () => engine.destroy() };
}

for (const level of LEVELS) {
  const h = harness(level.id, true, { damage: 3, rate: 3 });
  if (level.id === 3) {
    h.aim(600, 210);
    h.step(5, () => h.aim(600 + Math.sin(h.engine.snapshot().elapsed * .35) * 170, 210, false));
    h.release();
    assert.equal(h.engine.snapshot().bossHp, 1800, 'Shield blocks boss damage before emitters are destroyed');
  }
  const targets = level.id === 2 ? [[250, 180], [950, 180], [250, 570], [950, 570]] : [[260, 220], [940, 220], [600, 605]];
  for (const [x, y] of targets) { h.aim(x, y); h.step(6); h.release(); }
  assert.equal(h.engine.snapshot().destroyed, level.target, `Level ${level.id} objectives are destructible`);
  if (level.id === 3) {
    assert.equal(h.engine.snapshot().bossPhase, true, 'Destroying emitters exposes the boss');
    h.aim(600, 210);
    h.step(35, () => h.aim(600 + Math.sin(h.engine.snapshot().elapsed * .35) * 170, 210, false));
  }
  assert.equal(h.result()?.won, true, `Level ${level.id} can be won through actual combat`);
  assert.ok(h.result().run.score > 0, 'Combat awards points');
  assert.equal(h.engine.snapshot().hp, 100, 'God mode protects integrity');
  h.close();
  console.log(`PASS level ${level.id}: actual objective destruction${level.id === 3 ? ' and boss defeat' : ''}, scoring, god mode`);
}

{
  const h = harness(1);
  h.step(.1); const initial = h.engine.snapshot();
  h.key('Space'); h.step(1); h.key('Space', false);
  assert.ok(h.engine.snapshot().energy < initial.energy - 20, 'Overclock drains energy');
  h.step(1); assert.ok(h.engine.snapshot().energy > 75, 'Energy regenerates');
  h.key('KeyQ'); assert.ok(h.engine.snapshot().empCooldown > 11, 'EMP starts a cooldown'); h.key('KeyQ', false);
  h.key('Escape'); const elapsed = h.engine.snapshot().elapsed; h.step(2);
  assert.equal(h.engine.snapshot().elapsed, elapsed, 'Pause freezes the simulation');
  h.key('Escape'); h.step(.5); assert.ok(h.engine.snapshot().elapsed > elapsed, 'Resume restarts the simulation');
  h.aim(260, 220); h.step(4); h.release();
  h.key('KeyA'); h.step(1.38); h.key('KeyA', false);
  h.key('KeyW'); h.step(.94); h.key('KeyW', false); h.step(.5);
  assert.ok(h.engine.snapshot().shards > 0, 'Data shards can be collected by approaching them');
  h.close(); console.log('PASS abilities: energy drain/regeneration, EMP cooldown, pause/resume, shard collection');
}

{
  const h = harness(1, true, { hull: 2, energy: 1 });
  assert.equal(h.engine.snapshot().maxHp, 180, 'Hull upgrades increase maximum integrity');
  assert.equal(h.engine.snapshot().maxEnergy, 140, 'Capacitor upgrades increase maximum energy');
  h.key('ShiftLeft'); assert.ok(h.engine.snapshot().dashCooldown > 2.9, 'Dash starts cooldown'); h.key('ShiftLeft',false); h.step(.25); assert.ok(h.engine.snapshot().dashCooldown < 3, 'Dash recovers');
  h.close(); console.log('PASS upgrades: hull and energy capacities apply to the actual engine');
}

{
  const h = harness(1, false);
  h.step(180);
  assert.equal(h.result()?.won, false, 'Hostile attacks can cause game over');
  assert.equal(h.engine.snapshot().hp, 0, 'Losing run reaches zero health');
  assert.ok(h.result().run.damageTaken >= 100, 'Damage is recorded for rank calculation');
  h.close(); console.log('PASS game over: real enemy attacks exhaust player health');
}

assert.equal(getRank({ ...freshRun(), score: 15000 }, true), 'S');
assert.equal(getRank({ ...freshRun(), score: 10000, elapsed: 300 }, true), 'A');
assert.equal(getRank({ ...freshRun(), score: 5000, elapsed: 300 }, true), 'B');
assert.equal(getRank(freshRun(), false), 'C');
console.log('PASS ranks: S / A / B / C');
Math.random = originalRandom;
