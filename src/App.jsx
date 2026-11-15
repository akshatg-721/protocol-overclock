import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2, Crosshair, Expand, Flag, Gauge, Heart, Hexagon, Keyboard, Layers3, MousePointer2, Pause, Play, Radio, RotateCcw, Shield, Signal, SkipForward, SlidersHorizontal, Target, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import GameCanvas from './GameCanvas';
import CinematicIntro from './CinematicIntro';
import UpgradeShop from './UpgradeShop';
import { freshRun, getRank, LEVELS, purchaseUpgrade, purchasePerk, rankBreakdown, eligibleHighScore } from './levels';
import { setMuted, sound, unlockAudio, setCombatAudio, setMusicEnabled } from './audio';

const emptyHud = { dashCooldown:0, shieldCharge:0, shieldTimer:0, bossStage:1, finale:false, hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, score: 0, bank: 0, combo: 1, comboTime: 0, shards: 0, kills: 0, elapsed: 0, destroyed: 0, target: 3, empCooldown: 0, overclock: false, bossHp: 6400, bossMax: 6400, bossPhase: false };
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function readHighScore() { try { return Number(localStorage.getItem('overclock-legit-best-v2')) || 0; } catch { return 0; } }

function Wordmark({ small = false }) {
  return <div className={`wordmark ${small ? 'small' : ''}`}><div className="brand-symbol"><Hexagon size={small ? 26 : 32} strokeWidth={1.7} /><Zap size={small ? 13 : 17} strokeWidth={2.4} /></div><div><span>PROTOCOL</span><strong>OVERCLOCK<span className="brand-dot">®</span></strong></div></div>;
}

export default function App() {
  const [phase, setPhase] = useState('intro');
  const [level, setLevel] = useState(1);
  const [run, setRun] = useState(freshRun);
  const [session, setSession] = useState(0);
  const [hud, setHud] = useState(emptyHud);
  const [paused, setPaused] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [judge, setJudge] = useState(false);
  const [highScore, setHighScore] = useState(readHighScore);
  const [music, updateMusic] = useState(false);
  const [muted, updateMuted] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState(null);
  const [result, setResult] = useState(null);
  const [touchOverclock, setTouchOverclock] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const checkpoint = useRef(freshRun()), tainted = useRef(false);
  const engine = useRef(null), arena = useRef(null), toastTimer = useRef(null);
  const isPlaying = phase === 'playing';
  const config = LEVELS[level - 1];
  const endIntro = useCallback(() => { setPhase('menu'); }, []);
  useEffect(() => {
    function interaction() { unlockAudio(); }
    window.addEventListener('pointerdown', interaction); window.addEventListener('keydown', interaction);
    return () => { window.removeEventListener('pointerdown', interaction); window.removeEventListener('keydown', interaction); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => { setCombatAudio(isPlaying && !paused && !help); return () => setCombatAudio(false); }, [isPlaying, paused, help]);
  function equip(perk) { setRun(previous => purchasePerk(previous,perk)); sound('collect'); }
  function start(target = level, judgeRun = false) {
    unlockAudio(); sound('click');
    const next = freshRun(); next.demo = godMode || judgeRun || target!==1;tainted.current=next.demo;checkpoint.current=structuredClone(next);
    setRun(next); setHud({ ...emptyHud, target: LEVELS[target - 1].target }); setLevel(target); setPaused(false); setResult(null); setTouchOverclock(false); setSession(s => s + 1); setPhase('playing');
  }
  function onEnd(data) {
    if(tainted.current||godMode)data.run.demo=true;
    if(eligibleHighScore(data.run)&&data.run.score>highScore){setHighScore(data.run.score);try{localStorage.setItem('overclock-legit-best-v2',String(data.run.score));}catch{}}
    setRun(data.run); setResult(data); setPaused(false); setTouchOverclock(false);
    if (data.won && level < 3) setPhase('shop'); else setPhase('summary');
  }
  function onAchievement(item) { setToast(item); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4200); }
  function buy(id){setRun(previous=>purchaseUpgrade(previous,id));sound('collect');}
  function restartLevel(){const restored=structuredClone(checkpoint.current);restored.demo ||= tainted.current||godMode;setRun(restored);setHud({...emptyHud,score:restored.score,shards:restored.shards,kills:restored.kills,elapsed:restored.elapsed,target:config.target});setPaused(false);setTouchOverclock(false);setResult(null);setSession(s=>s+1);setPhase('playing');}
  function nextLevel(){const next={...run,health:Math.min(100+run.upgrades.hull*40,run.health+20)};checkpoint.current=structuredClone(next);setRun(next);setLevel(l=>l+1);setHud({...emptyHud,score:next.score,shards:next.shards,kills:next.kills,elapsed:next.elapsed,target:LEVELS[level].target});setPaused(false);setSession(s=>s+1);setPhase('playing');sound('click');}
  function menu() { setPhase('menu'); setPaused(false); setTouchOverclock(false); setHud(emptyHud); setRun(freshRun()); setToast(null); }
  useEffect(() => {
    function leaveExpanded(event) { if (event.code === 'Escape') setExpanded(false); }
    window.addEventListener('keydown', leaveExpanded);
    return () => window.removeEventListener('keydown', leaveExpanded);
  }, []);
  async function fullscreen() {
    if (expanded || document.fullscreenElement) {
      setExpanded(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      return;
    }
    setExpanded(true);
    try { await arena.current.requestFullscreen(); }
    catch { /* The expanded layout also works in embedded browsers that deny native fullscreen. */ }
  }
  const objective = level === 3 && hud.bossPhase ? `Terminate AETHER / phase ${hud.bossStage||1}` : config.objective;
  const victory = result?.won;
  const breakdown = result ? rankBreakdown(result.run,victory) : null;
  const rank = result ? getRank(result.run, victory) : 'C';

  return <div className={`app-shell ${expanded ? 'expanded' : ''}`} ref={arena}>
    <header className="site-header"><a className="brand-link" href="#" onClick={e => { e.preventDefault(); if (isPlaying) setPaused(true); else menu(); }} aria-label="Protocol Overclock home"><Wordmark small /></a><nav aria-label="Main navigation"><button className="nav-item active" onClick={() => { setHelp(false); if (isPlaying) setPaused(false); }}><span /> THE GAME</button><button className="nav-item" onClick={() => { setHelp(true); if (isPlaying) setPaused(true); }}>HOW TO PLAY <ArrowUpRight size={12} /></button></nav><div className="header-right"><button className={`text-button ${music ? "lime" : "muted"}`} aria-pressed={music} onClick={() => {unlockAudio();updateMusic(!music);setMusicEnabled(!music);}}>BASS {music ? "ON" : "OFF"}</button><span className="build-tag">INDEPENDENT ARCADE EXPERIENCE</span><span className="version">v.1.0.0 <span className="status-dot" /></span><button className="icon-button sound-button" aria-label={muted ? 'Enable sound' : 'Mute sound'} onClick={() => { unlockAudio(); updateMuted(!muted); setMuted(!muted); if (muted) sound('click'); }}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div></header>

    <main className="main-layout">
      <section className="page-heading"><div><div className="eyebrow pretitle"><span className="status-dot" /> SYSTEM ONLINE <span className="heading-slash">/</span> A ROGUE SIGNAL. A FINAL CHANCE.</div><h1>Break the system<span className="lime">.</span></h1><p>One operative. Three layers of defense. Move. Decrypt. Survive.</p></div><div className="high-score"><Trophy size={19} strokeWidth={1.5} /><div><span className="eyebrow">PERSONAL BEST</span><strong>{String(highScore).padStart(6, '0')}</strong></div></div></section>

      <div className="game-layout">
        <aside className="sidebar">
          <div className="sidebar-title"><span className="eyebrow">MISSION DIRECTORY</span><span className="tiny muted">03 SECTORS</span></div>
          <div className="level-list">{LEVELS.map(item => <button key={item.id} className={`level-card ${level === item.id ? 'selected' : ''}`} disabled={isPlaying || phase === 'shop'} onClick={() => { setLevel(item.id); sound('click'); }}><div className="level-card-top"><span className="eyebrow">LEVEL 0{item.id}</span>{item.id < level && isPlaying ? <Flag size={12} /> : level === item.id ? <span className="level-status">{isPlaying ? 'IN PROGRESS' : 'SELECTED'}</span> : <ArrowUpRight size={12} />}</div><LevelGraphic level={item.id} /><div className="level-card-bottom"><h3>{item.name}</h3><span className="tiny">{item.difficulty} <span className="difficulty-bars">▰▰{item.id >= 2 ? '▰' : '▱'}{item.id === 3 ? '▰' : '▱'}</span></span></div></button>)}</div>
          <div className="sidebar-note"><Radio size={16} /><p>Their network.<br /><span>Your rules.</span></p><span className="signal-bars">▂▄▆▇</span></div>
        </aside>

        <section className={`game-deck ${hud.overclock && isPlaying ? 'overclock-active' : ''}`} aria-label="Game and mission status">
          <div className="deck-top"><div className="deck-path"><span className="status-dot" /><span>LIVE SIMULATION</span><ChevronRight size={12} /><strong>SECTOR 0{level}</strong></div><div className="deck-tools"><span className="tiny muted"><Signal size={12} /> CONNECTION STABLE</span><button className="icon-button" title="How to play" aria-label="How to play" onClick={() => { setHelp(true); if (isPlaying) setPaused(true); }}><CircleHelp size={15} /></button><button className="icon-button" title="Toggle fullscreen" aria-label="Toggle fullscreen" onClick={fullscreen}><Expand size={14} /></button></div></div>
          <div className="game-hud">
            <div className="hud-integrity"><span className="eyebrow"><Heart size={11} /> INTEGRITY <b className={hud.hp < 35 ? 'danger' : ''}>{Math.ceil(hud.hp)}<span>/{hud.maxHp}</span></b></span><div className="meter integrity"><i style={{ width: `${hud.hp / hud.maxHp * 100}%`, background: hud.hp < 35 ? '#f58c9e' : undefined }} /></div></div>
            <div className="mission-objective"><span className="eyebrow"><Target size={10} /> MISSION OBJECTIVE</span><strong>{objective} <span>{level === 3 && hud.bossPhase ? `${Math.ceil(hud.bossHp / hud.bossMax * 100)}% HP` : `${hud.destroyed}/${config.target}`}</span></strong></div>
            <div className="hud-score"><span className="eyebrow">CURRENT SCORE</span><strong>{String(hud.score).padStart(6, '0')}<small> {hud.combo}×</small></strong></div>
          </div>

          <div className="arena-wrap">
            <GameCanvas ref={engine} level={level} session={session} active={isPlaying} paused={paused || help} godMode={godMode} run={run} touchOverclock={touchOverclock} onPause={() => setPaused(p => !p)} onBlur={() => setPaused(true)} onHud={setHud} onEnd={onEnd} onAchievement={onAchievement} onInteract={unlockAudio} />
            <div className="arena-top-label"><span className="tiny">{isPlaying ? <><span className="rec-dot" /> REC // OPERATIVE VIEW</> : 'SIMULATION AWAITING INPUT'}</span><span className="tiny">{formatTime(hud.elapsed)} <Clock3 size={10} /></span></div>
            {isPlaying && level === 3 && <div className="boss-bar"><span>AETHER // PHASE {hud.bossStage||1} // {hud.bossPhase ? 'CORE EXPOSED' : 'SHIELD ACTIVE'}</span><div><i style={{ width: `${hud.bossHp / hud.bossMax * 100}%` }} /></div></div>}
            {phase === 'menu' && <div className="menu-overlay"><div className="menu-card"><div className="menu-kicker"><span /> AN UNAUTHORIZED AWAKENING</div><span className="menu-protocol">PROTOCOL</span><h2>OVER<span>CLOCK</span><sup>™</sup></h2><p>The mainframe owns the city.<br />Time to take it back.</p><button className="primary-button deploy-button" onClick={() => start()}><Play size={16} fill="currentColor" /> INITIATE BREACH <ArrowUpRight size={19} /></button><span className="menu-level">LEVEL 0{level} <span>/</span> {config.name.toUpperCase()}</span><button className="replay-button" onClick={() => { setPhase('intro'); }}><RotateCcw size={12} /> REPLAY CINEMATIC</button></div><div className="arena-corner top-left" /><div className="arena-corner bottom-right" /><span className="arena-version">BUILT TO BREAK THE LOOP.</span><span className="arena-coordinates">X: 0600 / Y: 0450</span></div>}
            {isPlaying && <><div className="arena-bottom-status"><div><Hexagon size={13} /><span>DATA SHARDS</span><b>{String(hud.shards).padStart(2, '0')}</b></div><div><Crosshair size={12} /><span>HOSTILES DOWN</span><b>{String(hud.kills).padStart(2, '0')}</b></div>{godMode && <span className="god-indicator"><Shield size={11} /> GOD MODE</span>}</div><div className="combo-float" style={{ opacity: hud.combo > 1 ? 1 : 0 }}><strong>{hud.combo}<small>×</small></strong><span>COMBO CHAIN</span><div className="meter"><i style={{ width: `${hud.comboTime * 100}%` }} /></div></div></>}
            {isPlaying && paused && !help && <div className="pause-overlay"><div className="pause-card"><Pause size={25} className="lime" /><span className="eyebrow">NEURAL LINK SUSPENDED</span><h2>Catch your breath.</h2><p>The network can wait.</p><button className="primary-button" onClick={() => setPaused(false)}>RESUME OPERATION <Play size={14} /></button><button className="text-button" onClick={restartLevel}>RESTART LEVEL <RotateCcw size={13} /></button><button className="text-button muted" onClick={menu}>RETURN TO MAIN MENU <ArrowUpRight size={13} /></button></div></div>}
            {phase === 'intro' && <CinematicIntro onComplete={endIntro} onSilent={()=>{updateMuted(true);setMuted(true);}} onEnableAudio={()=>{updateMuted(false);setMuted(false);}} />}
          </div>

          <div className="ability-bar"><div className="energy-ability"><div className="ability-icon"><Zap size={17} /></div><div className="energy-info"><div><span className="eyebrow">OVERCLOCK <kbd>SPACE</kbd></span><span className="tiny">{Math.ceil(hud.energy / hud.maxEnergy * 100)}%</span></div><div className="meter energy"><i style={{ width: `${hud.energy / hud.maxEnergy * 100}%` }} /></div></div></div><div className="dash-ability"><button className="text-button" disabled={!isPlaying||paused||hud.dashCooldown>0} onClick={()=>engine.current?.dash()}>CYBER DASH <kbd>SHIFT</kbd> <span className="lime">{hud.dashCooldown>0?`${hud.dashCooldown.toFixed(1)}s`:'READY'}</span></button><div className="meter"><i style={{width:`${100*(1-(hud.dashCooldown||0)/(run.perk==='dash'?1.7:3))}%`}}/></div>{run.perk==='shield'&&<span className="tiny">NANOSHIELD {hud.shieldCharge?'ARMED':`${Math.ceil(hud.shieldTimer)}s`}</span>}</div><div className="ability-divider" /><button className="emp-ability" disabled={!isPlaying || hud.empCooldown > 0 || paused} onClick={() => engine.current?.emp()}><Radio size={18} /><span><span className="eyebrow">EMP SHOCKWAVE <kbd>Q</kbd></span><span className={`tiny ${hud.empCooldown > 0 ? 'muted' : 'lime'}`}>{hud.empCooldown > 0 ? `${Math.ceil(hud.empCooldown)}s RECHARGING` : 'READY TO DEPLOY'}</span></span></button><div className="ability-hint">{hud.overclock && isPlaying ? <><Zap size={12} className="lime" /> TIME DILATION ACTIVE</> : 'BEND TIME. BREAK THROUGH.'}</div><button className="icon-button pause-button" aria-label={paused ? 'Resume game' : 'Pause game'} disabled={!isPlaying} onClick={() => setPaused(p => !p)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button></div>
          {isPlaying && <div className="touch-controls"><span>DRAG LEFT TO MOVE · HOLD RIGHT TO FIRE</span><button onPointerDown={() => setTouchOverclock(true)} onPointerUp={() => setTouchOverclock(false)} onPointerCancel={() => setTouchOverclock(false)} onPointerLeave={() => setTouchOverclock(false)}>HOLD OVERCLOCK</button><button onClick={() => engine.current?.dash()}>CYBER DASH</button><button onClick={() => engine.current?.emp()}>EMP {hud.empCooldown > 0 ? Math.ceil(hud.empCooldown) : 'READY'}</button></div>}
        </section>
      </div>

      <section className="below-game"><div className="control-guide"><span className="eyebrow muted">YOUR CONTROLS</span><div className="control-item"><span className="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Move</span></div><div className="control-item"><MousePointer2 size={17} /><span>Aim & shoot · SHIFT / right click to dash</span></div><div className="control-item"><kbd>SPACE</kbd><span>Bullet-time</span></div><div className="control-item"><kbd>Q</kbd><span>EMP</span></div><div className="control-item"><kbd>ESC</kbd><span>Pause</span></div></div><button className={`judge-toggle ${judge ? 'open' : ''}`} aria-expanded={judge} aria-controls="judge-panel" onClick={() => setJudge(v => !v)}><SlidersHorizontal size={13} /> JUDGE DEMO PANEL <ChevronDown size={13} /></button></section>
      {judge && <section id="judge-panel" className="judge-panel"><div><span className="eyebrow lime"><Code2 size={13} /> DIRECT SYSTEM ACCESS</span><p>Instantly deploy to any level. God mode protects your integrity.</p></div><div className="judge-actions"><label className="god-toggle"><input type="checkbox" checked={godMode} onChange={e => { setGodMode(e.target.checked); if(e.target.checked&&isPlaying)tainted.current=true; if (isPlaying) setRun(r => ({ ...r, demo: true })); }} /><span className="switch" /><span>Level Select / God Mode</span></label><div className="warp-buttons">{LEVELS.map(item => <button key={item.id} onClick={() => start(item.id,true)}>PLAY LEVEL 0{item.id} <ArrowUpRight size={11} /></button>)}</div>{isPlaying && <button className="text-button lime" onClick={() => engine.current?.complete()}>COMPLETE CURRENT LEVEL <SkipForward size={13} /></button>}{phase === 'intro' && <button className="text-button lime" onClick={endIntro}>SKIP INTRO <SkipForward size={13} /></button>}</div></section>}

      <section className="feature-strip"><div><span className="feature-number">01 /</span><div><span>Three layers. One way out.</span><p>Distinct arenas. Escalating resistance.</p></div><Layers3 size={23} /></div><div><span className="feature-number">02 /</span><div><span>Time is your weapon.</span><p>Slow the world. Double your firepower.</p></div><Gauge size={24} /></div><div><span className="feature-number">03 /</span><div><span>Every run leaves a mark.</span><p>Chain combos. Upgrade. Chase your best.</p></div><Activity size={24} /></div></section>
    </main>
    <footer className="site-footer"><span>© 2094 OVERCLOCK INITIATIVE</span><span className="footer-message"><span className="status-dot" /> ALL SYSTEMS ARE MEANT TO BE BROKEN.</span><span>100% PROCEDURAL <span className="footer-plus">+</span> 0 EXTERNAL ASSETS</span></footer>

    {phase === 'shop' && <UpgradeShop run={run} level={level} onBuy={buy} onEquip={equip} onContinue={nextLevel} />}
    {phase === 'summary' && result && <div className="modal-backdrop"><section className={`summary-panel ${victory ? 'won' : 'lost'}`}><div className="summary-top"><span className="eyebrow">OPERATION DEBRIEF</span><span className={`eyebrow ${victory ? 'lime' : 'danger'}`}>{victory ? 'VICTORY / MISSION COMPLETE' : 'GAME OVER / SIGNAL LOST'}</span></div><div className="summary-emblem">{victory ? <Trophy size={36} /> : <Radio size={36} />}</div><span className="eyebrow muted">{victory ? 'THE CITY IS OURS AGAIN.' : 'THE NETWORK CLAIMED ANOTHER.'}</span><h2>{victory ? 'Protocol terminated.' : 'Connection severed.'}</h2><p>{victory ? 'AETHER is offline. The city can breathe again.' : 'Your signal faded. Your next run starts with everything you learned.'}</p><div className="termination-detail"><span className="eyebrow">{victory?"CAUSE OF TERMINATION":"FATAL THREAT"}</span><strong>{result.run.termination||result.run.fatalThreat||"Unknown signal loss"}</strong></div><div className="summary-stats"><div className="rank"><strong>{rank}</strong><span>RUN RANK</span></div><div><span>FINAL SCORE</span><strong>{run.score.toLocaleString()}</strong></div><div><span>HOSTILES DOWN</span><strong>{run.kills}</strong></div><div><span>DATA SHARDS</span><strong>{run.totalShards}</strong></div><div><span>OPERATION TIME</span><strong>{formatTime(run.elapsed)}</strong></div></div><div className="rank-breakdown"><strong>RANK VALUE {breakdown.value.toLocaleString()} = {breakdown.score.toLocaleString()} SCORE + {breakdown.timeBonus} TIME − {breakdown.damagePenalty} DAMAGE</strong><p>{breakdown.formula}</p></div>{(run.demo || godMode) && <div className="demo-note">JUDGE / GOD MODE RUN · EXCLUDED FROM PERSONAL BEST</div>}<button className="primary-button" onClick={() => start(1)}>RUN IT BACK <RotateCcw size={16} /></button><button className="text-button muted" onClick={menu}>RETURN TO MAIN MENU <ArrowUpRight size={13} /></button></section></div>}
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-panel" onClick={e => e.stopPropagation()}><button className="close-button icon-button" aria-label="Close instructions" onClick={() => setHelp(false)}><X size={21} /></button><span className="eyebrow lime">OPERATIVE FIELD MANUAL</span><h2>Know your advantage<span className="lime">.</span></h2><p>Enter gold proximity rings to decrypt target armor, then destroy the marked relays. In Level 1, volatile barrels break armor and extend engagement range to 350 units, so you still need to advance. In Level 2, Dash into a gold ring or hold SPACE nearby to phase-unlock its node. Each node powers one sweeping beam; destroy it to disable that beam permanently. In the final arena, break all shield emitters before attacking AETHER.</p><div className="help-controls"><div><Keyboard /><strong>Move with WASD</strong><p>Arrow keys also work. Keep moving to avoid drones and gunfire.</p></div><div><Crosshair /><strong>Aim. Hold to fire.</strong><p>Point your mouse and hold the left button. Your laser sight shows the way.</p></div><div><Zap /><strong>Hold SPACE to overclock</strong><p>Enemies and their bullets move 60% slower. Your fire rate doubles. Energy drains while active and regenerates when released.</p></div><div><Radio /><strong>Press Q for an EMP</strong><p>Damage nearby enemies and exposed relays. Clear hostile bullets only inside the expanding 290-unit wave. Recharges in 12 seconds.</p></div><div><Hexagon /><strong>Recover data shards</strong><p>Walk near blue diamonds to collect points, energy, and a small hull repair. Quick kills chain your multiplier up to 8×. Close-range Overclock shots earn critical hits. Only the first 24 kills per sector award credits or drop shards.</p></div><div><Shield /><strong>Adapt and survive</strong><p>Cover absorbs shots and can be destroyed. Spend credits and shards between levels. Nanobot Shield regenerates every 12 seconds; Multi-Shot Spread reduces fire rate by 15%. Shift or right click to Cyber Dash with brief invulnerability. Press ESC to pause.</p></div></div><p className="help-rank">RANKING / Score, speed, and damage taken determine your S / A / B / C rank. Legitimate run scores save at the end. Judge / God Mode runs never overwrite personal best. Upgrades cost credits and cyan data shards. Standard sector transit repairs only 20 HP.</p><button className="primary-button" onClick={() => { setHelp(false); if (isPlaying) setPaused(false); }}>UNDERSTOOD <ArrowRight size={16} /></button></section></div>}
    {toast && <div className="achievement-toast" role="status"><div><Trophy size={20} /></div><span><small>ACHIEVEMENT UNLOCKED</small><strong>{toast.title}</strong><p>{toast.detail}</p></span><button className="icon-button" aria-label="Dismiss achievement" onClick={() => setToast(null)}><X size={13} /></button></div>}
  </div>;
}

function LevelGraphic({ level }) {
  return <svg className={`level-graphic graphic-${level}`} viewBox="0 0 210 83" fill="none" aria-hidden="true"><defs><pattern id={`grid-${level}`} width="13" height="13" patternUnits="userSpaceOnUse"><path d="M13 0H0V13" stroke="currentColor" strokeOpacity=".1" strokeWidth=".5" /></pattern><linearGradient id={`fade-${level}`}><stop stopColor="currentColor" stopOpacity=".02" /><stop offset=".5" stopColor="currentColor" stopOpacity=".12" /><stop offset="1" stopColor="currentColor" stopOpacity=".02" /></linearGradient></defs><rect width="210" height="83" fill={`url(#grid-${level})`} /><path d="M0 42H210M105 0V83" stroke="currentColor" strokeOpacity=".1" />{level === 1 ? <><path d="M31 66V29L49 14H161L179 29V66H31Z" stroke="currentColor" strokeOpacity=".4" /><path d="M40 58V33L54 22H156L170 33V58H40Z" stroke="currentColor" strokeOpacity=".2" /><path d="M68 64V44L76 36H134L142 44V64" stroke="currentColor" strokeOpacity=".5" /><path d="M96 58V38L105 31L114 38V58" fill={`url(#fade-${level})`} stroke="currentColor" /><path d="M52 14V6M158 14V6M31 42H16M179 42H194M75 66V77M135 66V77" stroke="currentColor" strokeOpacity=".4" /><rect x="101" y="42" width="8" height="8" fill="currentColor" /><circle cx="50" cy="39" r="2" fill="currentColor" /><circle cx="160" cy="39" r="2" fill="currentColor" /></> : level === 2 ? <><path d="M39 64L82 17H155L184 54L155 72H76L39 64Z" stroke="currentColor" strokeOpacity=".3" /><path d="M70 16V70M105 9V75M140 16V70M38 42H182" stroke="currentColor" strokeOpacity=".5" /><path d="M55 29H166M49 56H172" stroke="currentColor" strokeOpacity=".2" />{[70, 105, 140].map((x, i) => <g key={x}><rect x={x - 5} y={25 + i * 9} width="10" height="10" transform={`rotate(45 ${x} ${30 + i * 9})`} fill="#15282b" stroke="currentColor" /><circle cx={x} cy={30 + i * 9} r="2" fill="currentColor" /></g>)}</> : <><path d="M105 8L139 25V59L105 77L71 59V25L105 8Z" stroke="currentColor" strokeOpacity=".3" /><path d="M105 20L128 31V53L105 65L82 53V31L105 20Z" stroke="currentColor" strokeOpacity=".6" /><rect x="94" y="31" width="22" height="22" transform="rotate(45 105 42)" fill={`url(#fade-${level})`} stroke="currentColor" /><path d="M71 25L49 16H20M71 59L49 69H20M139 25L162 16H190M139 59L162 69H190M71 42H13M139 42H197" stroke="currentColor" strokeOpacity=".4" /><circle cx="105" cy="42" r="4" fill="currentColor" /><circle cx="49" cy="16" r="2" fill="currentColor" /><circle cx="162" cy="69" r="2" fill="currentColor" /></>}</svg>;
}
