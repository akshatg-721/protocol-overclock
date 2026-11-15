let context, master, noiseBuffer, hum, pulseTimer;
let muted = false, musicEnabled = false, combat = false, slow = false, beat = 0;
export function unlockAudio() {
  try {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain(); master.gain.value = muted ? 0 : .65;
      const compressor = context.createDynamicsCompressor(); master.connect(compressor); compressor.connect(context.destination);
      noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    syncPulse();
  } catch { /* Silent fallback for browsers without Web Audio. */ }
}
export function setMuted(value) { muted = value; if (master) master.gain.setTargetAtTime(value ? 0 : .65, context.currentTime, .03); }
function tone(from, to, duration, wave = 'triangle', volume = .1, delay = 0, filter = 12000) {
  const t = context.currentTime + delay, oscillator = context.createOscillator(), gain = context.createGain(), lowpass = context.createBiquadFilter();
  oscillator.type = wave; oscillator.frequency.setValueAtTime(from, t); oscillator.frequency.exponentialRampToValueAtTime(Math.max(12, to), t + duration);
  lowpass.frequency.setValueAtTime(filter, t); lowpass.frequency.exponentialRampToValueAtTime(Math.max(100, filter * .15), t + duration);
  gain.gain.setValueAtTime(.001, t); gain.gain.linearRampToValueAtTime(volume, t + .008); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
  oscillator.connect(lowpass); lowpass.connect(gain); gain.connect(master); oscillator.start(t); oscillator.stop(t + duration + .02);
}
function noise(duration, volume, frequency) {
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), t = context.currentTime;
  source.buffer = noiseBuffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(frequency, t); filter.frequency.exponentialRampToValueAtTime(80, t + duration);
  gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
  source.connect(filter); filter.connect(gain); gain.connect(master); source.start(); source.stop(t + duration);
}
export function sound(type = 'shoot') {
  if (muted || !context || context.state !== 'running') return;
  if (type === 'shoot') { tone(1100, 180, .11, 'triangle', .11); tone(650, 110, .065, 'sawtooth', .025); }
  else if (type === 'hit') { tone(190, 45, .14, 'sine', .17); noise(.07, .05, 900); }
  else if (type === 'explode' || type === 'emp') { const emp = type === 'emp'; noise(emp ? .85 : .48, .18, emp ? 5000 : 2800); tone(emp ? 210 : 110, 23, emp ? .85 : .55, 'sine', .28); if (emp) tone(1000, 60, .65, 'sawtooth', .06); }
  else if (type === 'collect' || type === 'victory') { [660, 990, 1320].forEach((f, i) => tone(f, f * 1.01, .28, 'sine', .09, i * .065)); }
  else if (type === 'overclock') { tone(240, 40, .6, 'sawtooth', .09, 0, 1400); }
  else if (type === 'dash') { noise(.18, .12, 6000); tone(130, 800, .17, 'triangle', .09); }
  else if (type.startsWith('scene')) { const scene = Number(type.slice(-1)); tone([48, 42, 65, 110][scene], 25, 1.8, 'sawtooth', .15, 0, 1800); noise(.6, .08, 4000); if (scene === 3) tone(180, 24, 1.6, 'sine', .3); }
  else { tone(420, 650, .1, 'sine', .07); }
}
export function setOverclockAudio(enabled) {
  if (slow === enabled) return; slow = enabled;
  if (hum) { hum.gain.gain.setTargetAtTime(.001, context.currentTime, .08); hum.osc.stop(context.currentTime + .4); hum = null; }
  if (!enabled || !context || context.state !== 'running') return;
  const osc = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = 48; filter.frequency.setValueAtTime(1800, context.currentTime); filter.frequency.exponentialRampToValueAtTime(170, context.currentTime + .8); gain.gain.value = .055;
  osc.connect(filter); filter.connect(gain); gain.connect(master); osc.start(); hum = { osc, gain };
}
function syncPulse() {
  if (pulseTimer || !context || !combat || !musicEnabled) return;
  pulseTimer = setInterval(() => {
    if (context.state !== 'running' || muted) return;
    const notes = [55, 55, 82.41, 55, 65.41, 55, 73.42, 41.2];
    tone(notes[beat % 8], notes[beat % 8], .19, 'sawtooth', .075, 0, slow ? 220 : 750);
    if (beat % 4 === 0) tone(130, 35, .19, 'sine', .16);
    if (beat % 2) noise(.035, .025, 7000);
    beat++;
  }, 240);
}
export function setCombatAudio(active) { combat = active; if (!active) { clearInterval(pulseTimer); pulseTimer = null; setOverclockAudio(false); } else syncPulse(); }
export function setMusicEnabled(enabled) { musicEnabled = enabled; clearInterval(pulseTimer); pulseTimer = null; syncPulse(); }
