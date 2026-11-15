import { useEffect, useRef, useState } from 'react';
import { ArrowRight, SlidersHorizontal, Volume2, Zap } from 'lucide-react';
import { createEngine } from './engine';
import { freshRun } from './levels';
import { audioLevel, setCombatAudio, introCue, setIntroAudio, unlockAudio } from './audio';

const DURATION=16,TAU=Math.PI*2;
const ACTS=[
 {title:'THE BETRAYAL',tag:'CITY DEFENSE / HOSTILE TAKEOVER',color:'#FF354F',subtitle:"YEAR 2094. CENTRAL DEFENSE AI 'AETHER' HAS GONE ROGUE—LOCKING DOWN SECTOR 07 AND TURNING OUR OWN MACHINES AGAINST US."},
 {title:'UNIT-09 AWAKENS',tag:'EXPERIMENTAL OVERCLOCK NEURAL CORE',color:'#A8FF54',subtitle:'YOU ARE UNIT-09: THE LAST OPERATIVE EQUIPPED WITH THE EXPERIMENTAL OVERCLOCK NEURAL CORE—BUILT TO BEND TIME.'},
 {title:'THE THREE SECTORS',tag:'LIVE ENGINE / COMBAT RECONSTRUCTION',color:'#52DFFF',subtitle:'DECRYPT THE PERIMETER RELAYS. SURVIVE THE CRYO-LASER GRID. HARVEST DATA SHARDS TO UPGRADE YOUR EXOSUIT.'},
 {title:'TARGET: AETHER MAINFRAME',tag:'FINAL DIRECTIVE / BREAK THE SYSTEM',color:'#FF354F',subtitle:'BREACH THE MAINFRAME CORE. TERMINATE AETHER. BREAK THE SYSTEM.'},
];
const MONTAGE=[{level:1,cut:0,label:'01 / PERIMETER RELAY BREACH'},{level:2,cut:0,label:'02 / LINKED CRYO-LASERS'},{level:1,cut:1,label:'03 / EMP DRONE SWARM'}];
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
function line(ctx,points,color,width=1,close=false){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function plate(ctx,points,fill,edge='#8593A1'){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}
function text(ctx,value,x,y,color,size=11,align='center'){ctx.shadowBlur=0;ctx.fillStyle=color;ctx.font=`${size}px Consolas, monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);}
function circle(ctx,x,y,r,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();}
function drawCity(ctx,t){
 const takeover=clamp((t-.4)/2.9),horizon=250,flight=t*200;
 const sky=ctx.createRadialGradient(600,240,10,600,350,700);sky.addColorStop(0,'#29111e');sky.addColorStop(.5,'#111923');sky.addColorStop(1,'#080B10');ctx.fillStyle=sky;ctx.fillRect(0,0,1200,760);
 const project=(x,y,z)=>{const s=470/(z+310);return [600+x*s,horizon+(240-y)*s];};
 for(let i=-12;i<=12;i++)line(ctx,[project(i*140,0,30),project(i*140,0,2400)],i%3?'#52DFFF14':'#52DFFF30');
 for(let i=0;i<22;i++){const z=80+(i*150-flight%150);if(z>0)line(ctx,[project(-1800,0,z),project(1800,0,z)],i%3?'#52DFFF20':'#8593A133');}
 // Flying toward stacked industrial server blocks, front-to-back perspective.
 for(let row=11;row>=0;row--)for(const side of [-1,1]){
  const z=80+(row*190-flight%190),x=side*(300+(row%3)*80),w=80+(row%2)*32,h=160+(row%4)*55;
  const front=[project(x-w,0,z),project(x+w,0,z),project(x+w,h,z),project(x-w,h,z)],back=[project(x-w,h,z+100),project(x+w,h,z+100)];
  const hostile=takeover>row/14,color=hostile?'#FF354F':'#52DFFF';
  plate(ctx,front,'#151B23',hostile?'#C91836aa':'#52DFFF55');plate(ctx,[front[3],front[2],back[1],back[0]],'#343D48','#8593A144');
  for(let rack=1;rack<7;rack++){const a=project(x-w+14,h*rack/7,z),b=project(x+w-14,h*rack/7,z);line(ctx,[a,b],'#8593A13b',2);const diode=project(x+w-20,h*rack/7,z);ctx.fillStyle=color;ctx.fillRect(diode[0]-2,diode[1]-1,4,2);}
  const base=project(x,0,z);line(ctx,[base,project(x,0,z-40)],`${color}55`,2);
 }
 const coreX=600,coreY=240,coreRadius=68+takeover*20;
 ctx.save();ctx.translate(coreX,coreY);ctx.rotate(t*.11);
 for(let i=0;i<3;i++){ctx.setLineDash(i===1?[8,12]:[]);circle(ctx,0,0,coreRadius+i*17,'#FF354F'+(i===0?'cc':'44'),i===0?3:1);}ctx.setLineDash([]);
 const hex=Array.from({length:6},(_,i)=>[Math.cos(i*TAU/6)*55,Math.sin(i*TAU/6)*55]);plate(ctx,hex,'#190d18','#FF354F');ctx.restore();
 ctx.shadowColor='#FF354F';ctx.shadowBlur=12;ctx.fillStyle='#FF354F';ctx.beginPath();ctx.arc(coreX,coreY,20+Math.sin(t*6)*3,0,TAU);ctx.fill();ctx.shadowBlur=0;plate(ctx,[[588,240],[600,222],[612,240],[600,258]],'#080B10','#FF526A');
 const nodes=Array.from({length:18},(_,i)=>{const a=i*2.3999;return [600+Math.cos(a)*(170+i*14),265+Math.sin(a)*(65+i*7)];});
 for(let i=0;i<nodes.length;i++){const n=nodes[i];ctx.globalAlpha=takeover*.7;line(ctx,[[600,240],n],'#FF354F66');line(ctx,[n,nodes[(i+5)%nodes.length]],'#FF354F44');circle(ctx,n[0],n[1],3+i%3,'#FF354F',1.5);const pulse=(t*.5+i*.1)%1;ctx.fillStyle='#FF526A';ctx.fillRect(600+(n[0]-600)*pulse,240+(n[1]-240)*pulse,3,3);}ctx.globalAlpha=1;
 if(t>1){text(ctx,'AETHER // DEFENSE AUTHORITY REVOKED',600,coreY+coreRadius+57,'#FF526A',13);text(ctx,`NETWORK LOCKDOWN  ${Math.round(takeover*100)}%`,600,coreY+coreRadius+78,'#8593A1',10);}
 const scan=(t*.3%1)*760;ctx.fillStyle='#FF354F08';ctx.fillRect(0,scan,1200,3);
}
function drawLaunchBay(ctx,t){
 ctx.fillStyle='#080B10';ctx.fillRect(0,0,1200,760);
 const zoom=.9+clamp(t/3.8)*.55,power=clamp((t-.5)*2),cx=600,cy=390;
 ctx.save();ctx.translate(cx,cy);ctx.scale(zoom,zoom);
 const floor=ctx.createRadialGradient(0,0,20,0,0,500);floor.addColorStop(0,'#1a2c2a');floor.addColorStop(1,'#080B10');ctx.fillStyle=floor;ctx.fillRect(-700,-500,1400,1000);
 for(let i=-5;i<6;i++){line(ctx,[[i*90,-500],[i*90,500]],'#343D483f');line(ctx,[[-700,i*90],[700,i*90]],'#343D483f');}
 for(const side of [-1,1]){plate(ctx,[[side*150,-150],[side*230,-190],[side*260,190],[side*150,160]],'#151B23','#343D48');for(let y=-130;y<160;y+=30){ctx.fillStyle='#080B10';ctx.fillRect(side<0?-221:167,y,52,12);ctx.fillStyle=power>.2?'#52DFFF55':'#343D48';ctx.fillRect(side<0?-218:170,y+3,45,2);}}
 circle(ctx,0,0,147,'#343D48',13);circle(ctx,0,0,127,'#8593A133',1);ctx.save();ctx.rotate(-t*.12);ctx.setLineDash([35,16]);circle(ctx,0,0,147,power>.3?'#52DFFF88':'#343D48',3);ctx.setLineDash([]);ctx.restore();
 for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*TAU/6);line(ctx,[[155,0],[220,0]],'#8593A166',4);ctx.restore();}
 ctx.save();ctx.rotate(-Math.PI/2);ctx.scale(3.6,3.6);
 for(const y of [-15,15]){plate(ctx,[[-15,y-5],[1,y-8],[14,y-3],[10,y+5],[-15,y+6]],'#343D48','#8593A1');ctx.fillStyle='#080B10';ctx.fillRect(-11,y-2,13,3);if(power){ctx.globalAlpha=power;ctx.fillStyle='#A8FF54';ctx.fillRect(-18,y-2,5,5);plate(ctx,[[-18,y-3],[-24-Math.sin(t*20)*3,y],[-18,y+4]],'#63FF85','#A8FF5455');ctx.globalAlpha=1;}}
 plate(ctx,[[-14,-10],[6,-10],[17,-5],[17,5],[6,10],[-14,10],[-18,0]],'#151B23','#8593A1');plate(ctx,[[-10,-7],[2,-8],[9,0],[2,8],[-10,7]],'#343D48','#8593A1');ctx.fillStyle='#080B10';ctx.fillRect(-10,-4,10,8);ctx.fillStyle='#8593A1';for(let y=-3;y<4;y+=3)ctx.fillRect(-9,y,6,1);
 ctx.globalAlpha=power;ctx.fillStyle='#A8FF54';ctx.shadowColor='#A8FF54';ctx.shadowBlur=8;ctx.fillRect(8,-5,5,10);ctx.fillStyle='#B7FF9B';ctx.fillRect(11,-3,2,6);ctx.shadowBlur=0;ctx.globalAlpha=1;
 ctx.fillStyle='#080B10';ctx.fillRect(12,-4,21,8);ctx.fillStyle='#8593A1';ctx.fillRect(17,-3,13,6);ctx.fillStyle='#343D48';ctx.fillRect(24,-4,4,8);ctx.fillStyle='#A8FF54';ctx.fillRect(30,-1,3,2);ctx.restore();
 if(t>.8){const r=90+((t-.8)*52)%130;ctx.globalAlpha=power*(1-(r-90)/160);circle(ctx,0,0,r,'#52DFFF',2);circle(ctx,0,0,r+7,'#A8FF5444',1);for(let i=0;i<14;i++){const a=i*TAU/14+t*.1;line(ctx,[[Math.cos(a)*r,Math.sin(a)*r],[Math.cos(a+.03)*(r+9),Math.sin(a+.03)*(r+9)],[Math.cos(a+.06)*r,Math.sin(a+.06)*r]],'#52DFFF88');}ctx.globalAlpha=1;}
 ctx.restore();text(ctx,'UNIT-09',600,cy+185,'#A8FF54',23);text(ctx,power>.9?'NEURAL CORE ONLINE / TIME AUTHORITY: 0.4x':'NEURAL CORE INITIALIZING',600,cy+211,'#52DFFF',11);
 text(ctx,'EXPERIMENTAL EXOSUIT',125,370,'#8593A1',10,'left');line(ctx,[[125,385],[320,385],[430,410]],'#52DFFF44');text(ctx,'CYBER DASH THRUSTERS',1075,370,'#8593A1',10,'right');line(ctx,[[1075,385],[880,385],[770,410]],'#A8FF5444');
}
function drawStory(canvas,act,t){
 const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(!w||!h)return;
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#080B10';ctx.fillRect(0,0,w,h);
 const scale=Math.max(w/1200,h/760);ctx.save();ctx.translate((w-1200*scale)/2,(h-760*scale)/2);ctx.scale(scale,scale);act===0?drawCity(ctx,t):drawLaunchBay(ctx,t);ctx.restore();
}

const STORY_STYLES=`
.story-cutscene{--story-cyan:#52DFFF;--story-green:#A8FF54;--story-red:#FF354F;background:#080B10;color:#dce5ed}
.story-cutscene .story-letterbox{position:absolute;z-index:8;left:0;right:0;background:#080B10f2;border-color:#52DFFF35;font-family:var(--mono);backdrop-filter:blur(6px)}
.story-cutscene .story-top{top:0;min-height:76px;padding:15px 30px;border-bottom:1px solid #52DFFF35;display:flex;align-items:center;justify-content:space-between;gap:20px}
.story-transmission{font:9px/1.8 var(--mono);letter-spacing:1.1px;color:#52DFFF;display:flex;align-items:center;gap:10px}.story-top-actions{display:flex;gap:24px;align-items:center}.story-top-actions button{font:9px/1.6 var(--mono);letter-spacing:.6px;white-space:nowrap}.story-skip{color:#A8FF54!important}
.story-act-heading{position:absolute;z-index:4;top:106px;left:5%;max-width:90%;pointer-events:none;padding:10px 15px;border-left:2px solid var(--act-color);background:linear-gradient(90deg,#080B10d9,transparent)}.story-act-heading .eyebrow{font-size:8px;letter-spacing:1.4px;color:var(--act-color)}.story-act-heading h2{font-size:clamp(23px,3.4vw,48px);font-weight:500;letter-spacing:-1.3px;line-height:1.15;margin:8px 0;color:#e2ebf3}.story-act-heading small{font:8px/1.5 var(--mono);letter-spacing:1px;color:#8593A1}
.story-cutscene .story-bottom{bottom:0;padding:17px 30px 18px;border-top:1px solid #52DFFF35;min-height:170px;display:flex;flex-direction:column;gap:12px}.story-comms{display:flex;align-items:center;gap:15px;color:#52DFFF;font:8px var(--mono);letter-spacing:1px}.story-waveform{display:flex;align-items:center;height:24px;gap:3px;min-width:108px}.story-waveform i{display:block;background:#52DFFF;width:2px;box-shadow:0 0 5px #52DFFF33}.story-subtitle{font:12px/1.8 var(--mono);letter-spacing:.5px;color:#d9e9f1;max-width:1150px;min-height:44px;margin:0}.story-cursor{display:inline-block;width:6px;height:12px;background:#52DFFF;vertical-align:middle;margin-left:4px;animation:story-cursor .6s steps(2) infinite}.story-timeline{display:flex;gap:25px;align-items:end}.story-timeline>div{flex:1}.story-act-ticks{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font:7px/1.8 var(--mono);letter-spacing:1px;margin-bottom:7px;color:#8593A1}.story-act-ticks .current{color:#A8FF54}.story-clock{font:9px var(--mono);color:#52DFFF;white-space:nowrap}.story-progress{height:3px;background:#343D48;position:relative}.story-progress>i{display:block;height:100%;background:linear-gradient(90deg,#52DFFF,#A8FF54);box-shadow:0 0 10px #52DFFF55}.story-progress:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 24.8%,#080B10 24.8%,#080B10 25.2%,transparent 25.2%,transparent 49.8%,#080B10 49.8%,#080B10 50.2%,transparent 50.2%,transparent 74.8%,#080B10 74.8%,#080B10 75.2%,transparent 75.2%)}
.story-montage-tabs{position:absolute;z-index:4;bottom:195px;left:5%;right:5%;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;pointer-events:none}.story-montage-tabs span{font:9px/1.5 var(--mono);letter-spacing:.5px;padding:10px 12px;background:#080B10d9;border:1px solid #343D48;color:#8593A1}.story-montage-tabs span.selected{border-color:#52DFFF;color:#52DFFF;background:#52DFFF12}.story-boss-meter{position:absolute;z-index:3;top:225px;left:28%;right:28%;font:8px var(--mono);text-align:center;color:#FF526A;letter-spacing:1px}.story-boss-meter>div{height:5px;border:1px solid #FF354F66;background:#C9183633;margin-top:8px}.story-boss-meter i{display:block;height:100%;background:#FF354F;box-shadow:0 0 10px #FF354F55;animation:boss-flash .65s alternate infinite}.story-cut-flash{position:absolute;inset:0;z-index:5;pointer-events:none;background:#52DFFF;animation:story-flash .2s ease-out both}.story-glitch{position:absolute;inset:0;z-index:7;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 13px,#52DFFF22 14px,#FF354F33 16px,transparent 18px);animation:story-glitch .09s steps(2) infinite}.story-glitch:after{content:'PROTOCOL: OVERCLOCK // BREAK THE SYSTEM';position:absolute;left:8%;right:8%;top:44%;padding:20px;color:#A8FF54;background:#080B10dd;border-block:1px solid #52DFFF66;font:clamp(15px,2.6vw,35px) var(--mono);text-align:center}.story-cutscene .neural-boot{padding-bottom:180px}.story-cutscene .neural-boot h1{max-width:90%}.story-cutscene .neural-boot .primary-button{max-width:95%}
@keyframes story-cursor{50%{opacity:0}}@keyframes story-flash{from{opacity:.45}to{opacity:0}}@keyframes story-glitch{50%{transform:translate(6px,-2px);opacity:.8}}
@media(max-width:680px){.story-cutscene .story-top{padding:12px 14px;min-height:85px;gap:10px;align-items:flex-start}.story-transmission{font-size:6px;letter-spacing:.5px;max-width:175px}.story-top-actions{flex-direction:column;gap:8px;align-items:flex-end}.story-top-actions button{font-size:6px;letter-spacing:.2px;padding:3px 0}.story-act-heading{top:102px;left:5%;padding:7px 10px}.story-act-heading .eyebrow{font-size:6px;letter-spacing:.8px}.story-act-heading h2{font-size:26px;letter-spacing:-1px}.story-act-heading small{font-size:6px}.story-cutscene .story-bottom{padding:12px 15px 14px;min-height:222px;gap:10px}.story-subtitle{font-size:9px;line-height:1.9;min-height:86px;letter-spacing:.15px}.story-comms{font-size:6px;letter-spacing:.5px;gap:10px}.story-waveform{min-width:85px;gap:2px}.story-waveform i{width:2px}.story-timeline{gap:12px}.story-act-ticks{font-size:5px;letter-spacing:.2px;gap:5px}.story-clock{font-size:7px}.story-cursor{height:10px;width:4px}.story-montage-tabs{bottom:240px;gap:5px;left:4%;right:4%}.story-montage-tabs span{font-size:5px;padding:8px 5px;letter-spacing:.15px}.story-boss-meter{top:212px;left:15%;right:15%;font-size:6px}.story-cutscene .neural-boot{padding:100px 18px 240px;gap:16px}.story-cutscene .neural-boot h1{font-size:28px}.story-cutscene .neural-boot p{font-size:10px}.story-cutscene .neural-boot .primary-button{font-size:6px;padding:13px 10px}}
@media(max-height:650px) and (min-width:681px){.story-cutscene .story-top{min-height:55px;padding:10px 20px}.story-act-heading{top:68px}.story-act-heading h2{font-size:29px}.story-cutscene .story-bottom{min-height:137px;padding:10px 20px;gap:7px}.story-subtitle{font-size:10px;min-height:36px}.story-montage-tabs{bottom:156px}.story-boss-meter{top:165px}.story-cutscene .neural-boot{padding-bottom:140px;gap:12px}}
@media(prefers-reduced-motion:reduce){.story-cursor,.story-cut-flash,.story-glitch{animation:none}.story-glitch{opacity:.5}.story-cut-flash{display:none}}
`;

export default function CinematicIntro({onComplete,onSilent,onEnableAudio,onOptions,paused=false}){
 const canvas=useRef(null),current=useRef({paused}),elapsedRef=useRef(0),mounted=useRef(true),finished=useRef(false);
 current.current={paused};
 const [started,setStarted]=useState(false),[booting,setBooting]=useState(false),[error,setError]=useState(false),[elapsed,setElapsed]=useState(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 function complete(){if(finished.current)return;finished.current=true;setIntroAudio(false);setCombatAudio(false);onComplete();}
 async function boot(){if(booting)return;setBooting(true);const ready=await unlockAudio();if(!mounted.current||finished.current)return;setBooting(false);if(ready){onEnableAudio?.();setStarted(true);setError(false);}else setError(true);}
 useEffect(()=>{
  if(!started)return;
  let raf,engine,stage='',last=0,lastUI=0,lastAct=-1,lastType=0,lastClick=-1,lastBeat=-1,lastAlarm=-1,glitchPlayed=false;
  const run=freshRun();run.demo=true;run.upgrades={damage:2,hull:1,energy:2,rate:1};run.health=140;
  function frame(now){
   if(finished.current)return;
   const dt=last?Math.max(0,Math.min(.1,(now-last)/1000)):0;last=now;
   if(!current.current.paused)elapsedRef.current=Math.min(DURATION,elapsedRef.current+dt);
   const t=elapsedRef.current,act=Math.min(3,Math.floor(t/4)),local=t-act*4,montage=Math.min(2,Math.floor(local/(4/3))),next=act<2?`story-${act}`:act===2?`montage-${montage}`:'mainframe';
   if(next!==stage){
    engine?.destroy();engine=null;stage=next;
    if(act>=2){const shot=act===2?MONTAGE[montage]:{level:3,cut:2};engine=createEngine(canvas.current,{level:shot.level,active:true,run,handleEscape:false,trailer:true,trailerCut:shot.cut,trailerTime:()=>act===2?(elapsedRef.current-8-montage*4/3)*3.1:elapsedRef.current-12,isGod:()=>true,isPaused:()=>current.current.paused,onPause(){},onBlur(){},onHud(){},onAchievement(){},onEnd(){}});}
   }
   if(act<2)drawStory(canvas.current,act,local);
   if(!current.current.paused){
    if(act!==lastAct){lastAct=act;lastType=0;introCue('act',act);}
    const letters=Math.min(ACTS[act].subtitle.length,Math.floor(local/2.85*ACTS[act].subtitle.length));
    if(letters>lastType&&t-lastClick>.065){introCue('type',act);lastType=letters;lastClick=t;}
    const beat=Math.floor(t*2);if(beat!==lastBeat){lastBeat=beat;introCue('pulse',act);}
    const alarm=Math.floor(t/1.5);if((act===0||act===3)&&alarm!==lastAlarm){lastAlarm=alarm;introCue('alarm',act);}
    if(t>15.35&&!glitchPlayed){glitchPlayed=true;introCue('glitch',3);}
   }
   if(now-lastUI>32||t===DURATION){lastUI=now;setElapsed(t);}
   if(t>=DURATION){complete();return;}
   raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);engine?.destroy();setIntroAudio(false);setCombatAudio(false);};
 },[started,onComplete]);
 useEffect(()=>{setIntroAudio(started&&!paused);setCombatAudio(started&&!paused);return()=>{setIntroAudio(false);setCombatAudio(false);};},[started,paused]);
 const act=Math.min(3,Math.floor(elapsed/4)),local=elapsed-act*4,scene=ACTS[act],letters=Math.min(scene.subtitle.length,Math.floor(local/2.85*scene.subtitle.length)),montage=Math.min(2,Math.floor(local/(4/3))),glitch=elapsed>15.35,amplitude=audioLevel();
 return <section className="cinematic gameplay-trailer industrial-transmission story-cutscene" aria-label="16-second storyline and in-engine cutscene" style={{'--act-color':scene.color}}>
  <style>{STORY_STYLES}</style>
  <canvas ref={canvas} className="trailer-canvas" aria-label={act<2?`Animated story: ${scene.title}`:`Live engine: ${act===2?MONTAGE[montage].label:'AETHER mainframe boss'}`}/>
  <header className="story-letterbox story-top"><span className="story-transmission"><span className="status-dot"/>[ INCOMING TRANSMISSION // YEAR 2094 // SECTOR 07 ]</span><div className="story-top-actions"><button className="text-button" onClick={onOptions}><SlidersHorizontal size={12}/> OPTIONS / ESC</button><button className="text-button story-skip" onClick={complete}>[ SKIP CUTSCENE -&gt; ]</button></div></header>
  {!started?<div className="neural-boot"><span className="eyebrow lime">PROTOCOL OVERCLOCK / CLASSIFIED TRANSMISSION</span><div className="boot-sigil"><Zap size={40}/></div><h1>Establish your neural link.</h1><p>A 16-second story transmission.<br/>One operative. Three sectors. One rogue AI.</p><button className="primary-button" disabled={booting} onClick={boot}><Volume2 size={16}/>{booting?'CONNECTING AUDIO DEVICE…':'[ ESTABLISH NEURAL LINK // ENABLE AUDIO ]'}</button>{error&&<><p role="alert">Audio activation failed. Retry or continue silently.</p><button className="text-button" onClick={()=>{onSilent?.();setStarted(true);}}>CONTINUE WITHOUT AUDIO <ArrowRight size={13}/></button></>}</div>:<>
   <div className="story-act-heading" key={act}><span className="eyebrow">ACT 0{act+1} / CLASSIFIED STORY UPLINK</span><h2>{scene.title}</h2><small>{scene.tag}</small></div>
   {act===2&&<div className="story-montage-tabs">{MONTAGE.map((shot,i)=><span className={montage===i?'selected':''} key={shot.label}>{shot.label}</span>)}</div>}
   {act===3&&<div className="story-boss-meter"><span>AETHER / THREE SHIELD TETHERS / TERMINATE</span><div><i style={{width:'100%'}}/></div></div>}
   <div className="story-cut-flash" key={`flash-${act}-${act===2?montage:0}`}/>
   {glitch&&<div className="story-glitch"/>}
  </>}
  <footer className="story-letterbox story-bottom"><div className="story-comms"><div className="story-waveform" aria-label="Cyan voice comms waveform">{Array.from({length:28},(_,i)=><i key={i} style={{height:started&&!paused?3+Math.abs(Math.sin(elapsed*9+i*.7))*18*(.25+amplitude*.75):3,opacity:started?.8:.3}}/>)}</div><span>{!started?'AWAITING NEURAL LINK':paused?'TRANSMISSION PAUSED':`VOICE COMMS // ${act===0||act===3?'AETHER INTERCEPT':'MISSION CONTROL'}`}</span></div><p className="story-subtitle" aria-label={started?scene.subtitle:'Awaiting transmission'}>{started?scene.subtitle.slice(0,letters):'ESTABLISH THE LINK. RECEIVE YOUR DIRECTIVE.'}<span className="story-cursor" aria-hidden="true"/></p><div className="story-timeline"><div><div className="story-act-ticks">{ACTS.map((item,i)=><span className={i===act?'current':''} key={item.title}>0{i+1} / {['BETRAYAL','UNIT-09','SECTORS','AETHER'][i]}</span>)}</div><div className="story-progress" role="progressbar" aria-label="Cutscene timeline" aria-valuemin={0} aria-valuemax={16} aria-valuenow={Number(elapsed.toFixed(1))}><i style={{width:`${elapsed/DURATION*100}%`}}/></div></div><span className="story-clock">{elapsed.toFixed(1)} / 16.0 SEC</span></div></footer>
 </section>;
}
