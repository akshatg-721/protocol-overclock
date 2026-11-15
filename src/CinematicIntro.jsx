import { useEffect, useRef, useState } from 'react';
import { ArrowRight, SlidersHorizontal, Volume2, Zap } from 'lucide-react';
import { createEngine } from './engine';
import { freshRun } from './levels';
import { audioLevel, setCombatAudio, sound, unlockAudio } from './audio';

const CUTS=[
 {start:0,end:4,level:2,title:'SECTOR 01 & 02 BREACH',detail:'MOVE THROUGH THE GRID. BREAK THEIR DEFENSE.',cue:'scene0'},
 {start:4,end:9,level:1,title:'WEAPONIZE TIME',detail:'OVERCLOCK BULLET-TIME / EMP / COMBO CHAINS',cue:'scene2'},
 {start:9,end:14,level:3,title:'FINAL TARGET: AETHER MAINFRAME',detail:'THREE PHASES. ONE CORE. YOUR FINAL SHOT.',cue:'scene3'},
];
export default function CinematicIntro({onComplete,onSilent,onEnableAudio,onOptions,paused=false}){
 const canvas=useRef(null),current=useRef({paused}),elapsedRef=useRef(0);
 current.current={paused};
 const [started,setStarted]=useState(false),[booting,setBooting]=useState(false),[error,setError]=useState(false),[elapsed,setElapsed]=useState(0);
 async function boot(){setBooting(true);const ready=await unlockAudio();setBooting(false);if(ready){onEnableAudio?.();setStarted(true);setError(false);}else setError(true);}
 useEffect(()=>{
  if(!started)return;
  let raf,engine,cut=-1,last=0,finished=false;
  const run=freshRun();run.demo=true;run.upgrades={damage:2,hull:1,energy:2,rate:1};run.health=140;
  function frame(now){
   const dt=last?Math.max(0,Math.min(.1,(now-last)/1000)):0;last=now;
   if(!current.current.paused)elapsedRef.current=Math.min(14,elapsedRef.current+dt);
   const t=elapsedRef.current,next=t<4?0:t<9?1:2;
   if(next!==cut){engine?.destroy();cut=next;const scene=CUTS[cut];sound(scene.cue);engine=createEngine(canvas.current,{level:scene.level,active:true,run,handleEscape:false,trailer:true,trailerCut:cut,trailerTime:()=>elapsedRef.current-scene.start,isGod:()=>true,isPaused:()=>current.current.paused,onPause(){},onBlur(){},onHud(){},onAchievement(){},onEnd(){}});}
   setElapsed(t);
   if(t>=14&&!finished){finished=true;engine?.destroy();setCombatAudio(false);onComplete();return;}
   raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);engine?.destroy();setCombatAudio(false);};
 },[started,onComplete]);
 useEffect(()=>{setCombatAudio(started&&!paused);return()=>setCombatAudio(false);},[started,paused]);
 const cut=elapsed<4?0:elapsed<9?1:2,scene=CUTS[cut],glitch=elapsed>13.25;
 return <section className={`cinematic gameplay-trailer ${glitch?'trailer-glitch':''}`} aria-label="14-second in-engine gameplay trailer">
  <canvas ref={canvas} className="trailer-canvas" aria-label={`Live game engine trailer: ${scene.title}`}/>
  <div className="cinema-letterbox top"><span className="eyebrow"><span className="status-dot"/> AETHER / 2094 / ENGINE CAPTURE</span><div><button className="text-button" onClick={onOptions}><SlidersHorizontal size={13}/> OPTIONS / ESC</button><button className="text-button lime" onClick={onComplete}>[SKIP TRAILER →]</button></div></div>
  {!started?<div className="neural-boot"><span className="eyebrow lime">PROTOCOL OVERCLOCK / LIVE COMBAT TRANSMISSION</span><div className="boot-sigil"><Zap size={40}/></div><h1>Establish your neural link.</h1><p>A 14-second, in-engine transmission.<br/>Dash. Bend time. Face AETHER.</p><button className="primary-button" disabled={booting} onClick={boot}><Volume2 size={16}/>{booting?'CONNECTING AUDIO DEVICE…':'[ESTABLISH NEURAL LINK // ENABLE AUDIO]'}</button>{error&&<><p role="alert">Audio activation failed. Retry or continue silently.</p><button className="text-button" onClick={()=>{onSilent?.();setStarted(true);}}>CONTINUE WITHOUT AUDIO <ArrowRight size={13}/></button></>}</div>:<>
   {cut===2&&<div className="trailer-boss-hud"><span>AETHER / MAINFRAME CORE / BOSS PREVIEW</span><div><i style={{width:'100%'}}/></div></div>}
   <div className="trailer-caption" key={cut}><span className="eyebrow lime">CUT 0{cut+1} / ATTRACT MODE · ISOLATED DEMO</span><h2>{scene.title}</h2><p>{scene.detail}</p></div>
   <div className="trailer-wave" aria-label="Live synth amplitude">{Array.from({length:24},(_,i)=><i key={i} style={{height:3+Math.abs(Math.sin(elapsed*7+i))*22*audioLevel()}}/>)}<span>{paused?'TRANSMISSION PAUSED':'AUDIO LINK ACTIVE'}</span></div>
  </>}
  <div className="cinema-letterbox bottom"><div className="trailer-timeline"><div>{CUTS.map((c,i)=><span className={i===cut?'lime':''} key={c.start}>0{i+1} / {['BREACH','OVERCLOCK','AETHER'][i]}</span>)}</div><div className="intro-track"><i style={{width:`${elapsed/14*100}%`}}/></div></div><span className="eyebrow">{elapsed.toFixed(1)} / 14.0 SEC</span></div>
 </section>;
}
