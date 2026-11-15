import { useEffect, useRef, useState } from 'react';
import { ArrowRight, SlidersHorizontal, Volume2, Zap } from 'lucide-react';
import { createEngine } from './engine';
import { freshRun } from './levels';
import { audioLevel, setCombatAudio, introCue, setIntroAudio, unlockAudio } from './audio';

const DURATION=16,TAU=Math.PI*2;
const ACTS=[
 {title:'THE AETHER LOCKDOWN',tag:'ORBITAL SATELLITE / SECTOR 07',color:'#FF354F',subtitle:"YEAR 2094. CENTRAL DEFENSE AI 'AETHER' HAS GONE ROGUE—LOCKING DOWN SECTOR 07 AND TURNING OUR OWN MACHINES AGAINST US."},
 {title:'UNIT-09: OVERCLOCK IGNITION',tag:'EXPERIMENTAL OVERCLOCK NEURAL CORE',color:'#A8FF54',subtitle:'YOU ARE UNIT-09: THE LAST OPERATIVE EQUIPPED WITH THE EXPERIMENTAL OVERCLOCK NEURAL CORE—BUILT TO BEND TIME.'},
 {title:'THE THREE SECTORS',tag:'LIVE ENGINE / COMBAT RECONSTRUCTION',color:'#52DFFF',subtitle:'DECRYPT THE PERIMETER RELAYS. SURVIVE THE CRYO-LASER GRID. HARVEST DATA SHARDS TO UPGRADE YOUR EXOSUIT.'},
 {title:'TARGET: AETHER MAINFRAME',tag:'FINAL DIRECTIVE / BREAK THE SYSTEM',color:'#FF354F',subtitle:'BREACH THE MAINFRAME CORE. TERMINATE AETHER. BREAK THE SYSTEM.'},
];
const MONTAGE=[{level:1,cut:0,label:'01 / PERIMETER RELAY BREACH'},{level:2,cut:0,label:'02 / LINKED CRYO-LASERS'},{level:1,cut:1,label:'03 / EMP DRONE SWARM'}];
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
function text(ctx,value,x,y,color,size=11,align='center'){ctx.shadowBlur=0;ctx.fillStyle=color;ctx.font=`${size}px Consolas, monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);}
function circle(ctx,x,y,r,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();}
const easeOutCubic=n=>1-(1-clamp(n))**3;
const easeInOutSine=n=>.5-.5*Math.cos(Math.PI*clamp(n));
// Fixed geometry and analytic trajectories: nothing is randomized or respawned per frame.
const HEX=new Float32Array([0,-96,83,-48,83,48,0,96,-83,48,-83,-48]);
const INNER_HEX=new Float32Array([0,-66,57,-33,57,33,0,66,-57,33,-57,-33]);
const EYE=new Float32Array([0,-28,17,0,0,28,-17,0]);
const FACILITY_NODES=[{x:310,y:220,id:'01'},{x:890,y:220,id:'02'},{x:255,y:355,id:'03'},{x:945,y:355,id:'04'},{x:310,y:490,id:'05'},{x:890,y:490,id:'06'}];
for(const node of FACILITY_NODES){node.lockAt=.35+Math.acos(1-2*(node.y-120)/450)/Math.PI*3;node.label=`FACILITY ${node.id}`;}
const RADAR_RINGS=new Float32Array([64,116,168,220,272]);
const RING_TICKS=Array.from({length:72},(_,i)=>({c:Math.cos(i*TAU/72),s:Math.sin(i*TAU/72),major:i%6===0}));
const DATA_MOTES=Array.from({length:36},(_,i)=>({x:100+(i*173)%1000,y:190+(i*79)%370,phase:i*.73,travel:15+i%5*5,size:i%4===0?2:1}));
const RED_ORDNANCE=Array.from({length:16},(_,i)=>{const a=i*TAU/16+.12,radius=190+(i%3)*28;return {c:Math.cos(a),s:Math.sin(a),radius,arrival:1.2+2.6*(1-Math.cbrt(1-(radius-70)/600)),shards:Array.from({length:6},(_,k)=>{const b=a+(k-2.5)*.58;return {vx:Math.cos(b)*(22+k*6),vy:Math.sin(b)*(22+k*6),dx:Math.cos(b)*4,dy:Math.sin(b)*4};})};});
const COLOR_BLEND=Array.from({length:256},(_,i)=>{const p=i/255;return `rgb(${Math.round(82+173*p)},${Math.round(223-170*p)},${Math.round(255-176*p)})`;});
const DIAGNOSTIC_RINGS=[{r:160,speed:.07,alpha:.7},{r:191,speed:-.055,alpha:.45},{r:222,speed:.04,alpha:.3}];
const WAVE_BARS=Array.from({length:28},(_,i)=>i);
const ART_CACHE=new WeakMap();
function segment(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function polygon(ctx,vertices,fill,edge,width=1){ctx.beginPath();ctx.moveTo(vertices[0],vertices[1]);for(let i=2;i<vertices.length;i+=2)ctx.lineTo(vertices[i],vertices[i+1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=width;ctx.stroke();}
function staticSurface(paint){const surface=document.createElement('canvas');surface.width=1200;surface.height=760;paint(surface.getContext('2d'));return surface;}
function storyArt(ctx){
 let art=ART_CACHE.get(ctx);if(art)return art;
 const orbital=staticSurface(p=>{
  const wash=p.createRadialGradient(600,355,30,600,355,680);wash.addColorStop(0,'#192630');wash.addColorStop(1,'#080B10');p.fillStyle=wash;p.fillRect(0,0,1200,760);
  for(let y=90;y<700;y+=64)for(let x=55;x<1180;x+=96){p.fillStyle='#151B23';p.fillRect(x+2,y+2,91,59);p.strokeStyle='#343D4866';p.strokeRect(x+2.5,y+2.5,90,58);p.fillStyle='#8593A10c';for(let k=8;k<57;k+=8)p.fillRect(x+7,y+k,80,1);p.fillStyle='#8593A155';p.fillRect(x+7,y+7,2,2);p.fillRect(x+85,y+52,2,2);}
  for(const node of FACILITY_NODES){segment(p,600,355,node.x,355,'#080B10',7);segment(p,node.x,355,node.x,node.y,'#080B10',7);segment(p,600,355,node.x,355,'#52DFFF24');segment(p,node.x,355,node.x,node.y,'#52DFFF24');p.fillStyle='#080B10';p.fillRect(node.x-38,node.y-30,76,60);p.strokeStyle='#8593A155';p.strokeRect(node.x-38.5,node.y-30.5,77,61);p.fillStyle='#343D48';for(let i=-24;i<=24;i+=12)p.fillRect(node.x+i,node.y-20,6,40);}
  for(let i=0;i<72;i++){const tick=RING_TICKS[i];segment(p,600+tick.c*312,355+tick.s*248,600+tick.c*(tick.major?324:318),355+tick.s*(tick.major?260:254),'#52DFFF25');}
 });
 const bay=staticSurface(p=>{
  const wash=p.createRadialGradient(600,355,25,600,355,540);wash.addColorStop(0,'#1b2930');wash.addColorStop(1,'#080B10');p.fillStyle=wash;p.fillRect(0,0,1200,760);
  for(let y=100;y<700;y+=60)segment(p,50,y,1150,y,'#343D4826');for(let x=120;x<1200;x+=80)segment(p,x,100,x,690,'#343D4826');
  circle(p,600,355,249,'#343D48',18);circle(p,600,355,236,'#8593A13b',2);circle(p,600,355,150,'#080B10',20);circle(p,600,355,138,'#8593A133');
  for(let i=0;i<12;i++){const a=i*TAU/12,c=Math.cos(a),s=Math.sin(a);segment(p,600+c*250,355+s*250,600+c*280,355+s*280,'#8593A144',5);}
  for(const side of [-1,1]){const x=600+side*300;p.fillStyle='#151B23';p.fillRect(x-25,150,50,410);p.strokeStyle='#343D48';p.strokeRect(x-25.5,150.5,51,410);for(let y=167;y<545;y+=24){p.fillStyle='#080B10';p.fillRect(x-17,y,34,10);p.fillStyle='#52DFFF33';p.fillRect(x-14,y+3,28,2);}}
 });
 const suit=document.createElement('canvas');suit.width=300;suit.height=340;const p=suit.getContext('2d');p.translate(150,163);p.lineJoin='round';
 const shoulders=new Float32Array([-91,-39,-68,-71,-36,-60,-31,7,-48,59,-91,48]);polygon(p,shoulders,'#343D48','#8593A1',2);p.save();p.scale(-1,1);polygon(p,shoulders,'#343D48','#8593A1',2);p.restore();
 const chest=new Float32Array([-38,-47,-22,-65,22,-65,38,-47,42,65,23,84,-23,84,-42,65]);polygon(p,chest,'#151B23','#8593A1',2);
 const inner=new Float32Array([-27,-30,0,-45,27,-30,25,51,0,65,-25,51]);polygon(p,inner,'#343D48','#6c7a88',1.5);
 p.fillStyle='#080B10';p.fillRect(-22,-92,44,39);p.strokeStyle='#8593A1';p.strokeRect(-22.5,-92.5,45,39);p.fillStyle='#343D48';p.fillRect(-14,-87,28,18);
 for(const side of [-1,1]){const x=side<0?-80:58;p.fillStyle='#080B10';p.fillRect(x,-25,22,59);p.fillStyle='#8593A155';for(let y=-18;y<30;y+=9)p.fillRect(x+4,y,14,2);p.strokeStyle='#8593A1';p.strokeRect(x-1,-27,24,63);p.fillStyle='#080B10';p.fillRect(x-2,40,27,16);for(const y of [-48,47]){p.fillStyle='#8593A1';p.fillRect(side*51-2,y,4,4);}}
 p.fillStyle='#080B10';p.fillRect(-16,9,32,32);for(let x=-12;x<15;x+=7){p.fillStyle='#8593A1';p.fillRect(x,16,3,19);}p.fillStyle='#151B23';p.fillRect(43,67,22,48);p.strokeStyle='#8593A1';p.strokeRect(43.5,67.5,21,47);p.fillStyle='#343D48';p.fillRect(47,74,14,27);
 const halo=staticSurface(p=>{const g=p.createRadialGradient(600,355,15,600,355,400);g.addColorStop(0,'#A8FF5422');g.addColorStop(.5,'#52DFFF08');g.addColorStop(1,'#52DFFF00');p.fillStyle=g;p.fillRect(0,0,1200,760);});
 art={orbital,bay,suit,halo};ART_CACHE.set(ctx,art);return art;
}
function drawCity(ctx,t,art){
 const takeover=easeInOutSine((t-.45)/2.8),zoom=.84+.18*easeOutCubic(t/4),color=COLOR_BLEND[Math.round(takeover*255)];
 ctx.fillStyle='#080B10';ctx.fillRect(0,0,1200,760);ctx.save();ctx.translate(600,355);ctx.scale(zoom,zoom);ctx.translate(-600,-355);ctx.drawImage(art.orbital,0,0);
 for(let i=0;i<RADAR_RINGS.length;i++){const progress=easeOutCubic(t/4);ctx.globalAlpha=.2-progress*.1;circle(ctx,600,355,RADAR_RINGS[i]+progress*85,'#52DFFF',1);}ctx.globalAlpha=1;
 const scanY=120+450*easeInOutSine((t-.35)/3);
 for(const node of FACILITY_NODES){
  const lock=clamp((t-node.lockAt)/.28),nodeColor=COLOR_BLEND[Math.round(easeOutCubic(lock)*255)];ctx.globalAlpha=.25+.5*lock;segment(ctx,600,355,node.x,355,nodeColor,1.5);segment(ctx,node.x,355,node.x,node.y,nodeColor,1.5);ctx.globalAlpha=1;
  ctx.strokeStyle=nodeColor;ctx.lineWidth=1.5;ctx.strokeRect(node.x-34,node.y-26,68,52);ctx.fillStyle=nodeColor;ctx.fillRect(node.x-22,node.y-17,5,34);ctx.fillRect(node.x+17,node.y-17,5,34);circle(ctx,node.x,node.y,12,nodeColor,2);
  text(ctx,node.label,node.x,node.y-43,'#8593A1',9);if(t>=node.lockAt){ctx.globalAlpha=easeOutCubic(lock);text(ctx,'[ LOCKED ]',node.x,node.y+48,'#FF354F',12);const shock=clamp((t-node.lockAt)/1.05);ctx.globalAlpha=(1-shock)*.6;circle(ctx,node.x,node.y,35+easeOutCubic(shock)*70,'#FF354F',1.5);ctx.globalAlpha=1;}
 }
 ctx.save();ctx.translate(600,355);circle(ctx,0,0,116,'#8593A144',3);circle(ctx,0,0,107,color,1);polygon(ctx,HEX,'#080B10',color,2.5);polygon(ctx,INNER_HEX,'#151B23','#8593A166',1);ctx.fillStyle=color;ctx.globalAlpha=.12;ctx.beginPath();ctx.arc(0,0,53,0,TAU);ctx.fill();ctx.globalAlpha=1;circle(ctx,0,0,42,color,5);polygon(ctx,EYE,'#080B10',color,1.5);ctx.fillStyle=color;ctx.fillRect(-2,-11,4,22);ctx.restore();
 ctx.globalAlpha=Math.sin(Math.PI*clamp((t-.2)/3.65))*.8;ctx.fillStyle='#FF354F0d';ctx.fillRect(90,scanY-14,1020,28);segment(ctx,90,scanY,1110,scanY,'#FF354F',2);ctx.globalAlpha=1;
 for(const mote of DATA_MOTES){ctx.globalAlpha=takeover*(.2+.2*Math.sin(t*.9+mote.phase));ctx.fillStyle='#FF526A';ctx.fillRect(mote.x+Math.sin(t*.45+mote.phase)*9,mote.y-Math.sin(t*.5+mote.phase)*mote.travel,mote.size,mote.size);}ctx.globalAlpha=1;ctx.restore();
 const titleAlpha=easeOutCubic((t-.35)/.65);ctx.globalAlpha=titleAlpha;ctx.fillStyle='#080B10df';ctx.fillRect(260,570,680,37);segment(ctx,260,570,940,570,color);text(ctx,'SECTOR 07 // AETHER LOCKDOWN DETECTED',600,594,color,16);ctx.globalAlpha=1;
}
function drawLaunchBay(ctx,t,art){
 const ignition=easeOutCubic((t-1.2)/.28),zoom=.95+.09*easeOutCubic(t/4);
 ctx.fillStyle='#080B10';ctx.fillRect(0,0,1200,760);ctx.save();ctx.translate(600,355);ctx.scale(zoom,zoom);ctx.translate(-600,-355);ctx.drawImage(art.bay,0,0);
 ctx.globalAlpha=ignition;ctx.drawImage(art.halo,0,0);ctx.globalAlpha=1;
 for(const ring of DIAGNOSTIC_RINGS){ctx.save();ctx.translate(600,355);ctx.rotate(t*ring.speed);ctx.globalAlpha=ring.alpha;circle(ctx,0,0,ring.r,'#52DFFF',1);ctx.beginPath();for(const tick of RING_TICKS){ctx.moveTo(tick.c*ring.r,tick.s*ring.r);ctx.lineTo(tick.c*(ring.r+(tick.major?10:4)),tick.s*(ring.r+(tick.major?10:4)));}ctx.strokeStyle='#52DFFF';ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;ctx.restore();}
 // Projectiles decelerate to a fixed position, then fragment analytically at wave contact.
 for(const shell of RED_ORDNANCE){
  const flight=1-easeOutCubic(t/1.2),r=shell.radius+flight*85,x=600+shell.c*r,y=355+shell.s*r,shatter=t-shell.arrival;
  if(shatter<0){ctx.globalAlpha=.8;segment(ctx,x,y,x+shell.c*11,y+shell.s*11,'#FF354F',3);ctx.fillStyle='#ffe0e5';ctx.fillRect(x-1,y-1,2,2);}
  else if(shatter<1.2){const spread=easeOutCubic(shatter/1.2),originX=600+shell.c*shell.radius,originY=355+shell.s*shell.radius;ctx.globalAlpha=(1-spread)*.9;for(const shard of shell.shards){const sx=originX+shard.vx*spread*1.8,sy=originY+shard.vy*spread*1.8;segment(ctx,sx,sy,sx+shard.dx,sy+shard.dy,'#FF526A',1.5);}}
 }ctx.globalAlpha=1;
 for(let i=0;i<3;i++){const age=t-1.2-i*.12;if(age>=0){const progress=clamp(age/2.6),r=70+600*easeOutCubic(progress);ctx.globalAlpha=(1-progress)*(.65-i*.12);circle(ctx,600,355,r,i===1?'#A8FF54':'#52DFFF',i===0?2.5:1.5);circle(ctx,600,355,r+5,'#B7FF9B33',1);}}ctx.globalAlpha=1;
 ctx.drawImage(art.suit,450,192);
 if(ignition>0){ctx.globalAlpha=ignition;ctx.shadowColor='#A8FF54';ctx.shadowBlur=6;ctx.fillStyle='#A8FF54';ctx.fillRect(583,303,34,6);ctx.fillStyle='#B7FF9B';ctx.fillRect(590,304,20,2);ctx.shadowBlur=0;for(let side=-1;side<=1;side+=2){const x=600+side*70;ctx.fillStyle='#A8FF54';ctx.fillRect(x-9,399,18,7);ctx.globalAlpha=ignition*.5;ctx.fillStyle='#63FF85';ctx.fillRect(x-6,406,12,10+Math.sin(t*2)*2);ctx.globalAlpha=ignition;}ctx.globalAlpha=1;}
 ctx.restore();
 text(ctx,'UNIT-09',600,552,ignition?'#A8FF54':'#8593A1',22);text(ctx,'EXPERIMENTAL OVERCLOCK NEURAL CORE',600,574,'#8593A1',9);
 const telemetryAlpha=easeOutCubic((t-.35)/.6);ctx.globalAlpha=telemetryAlpha;segment(ctx,760,300,855,275,'#52DFFF55');segment(ctx,855,275,1100,275,'#52DFFF55');text(ctx,ignition?'NEURAL CORE: ONLINE':'NEURAL CORE: STANDBY',870,301,ignition?'#A8FF54':'#8593A155',12,'left');text(ctx,ignition?'TIME DILATION: 0.4x':'TIME DILATION: 1.0x',870,326,ignition?'#52DFFF':'#8593A155',12,'left');text(ctx,ignition?'WEAPONS: ARMED':'WEAPONS: SAFE',870,351,ignition?'#A8FF54':'#8593A155',12,'left');text(ctx,ignition?'OVERCLOCK IGNITION CONFIRMED':'IGNITION AT T+05.2s',870,379,'#8593A1',9,'left');
 text(ctx,'UNIT-09 // NEURAL LINK',125,300,'#52DFFF',10,'left');text(ctx,'EXOSUIT INTEGRITY: 100%',125,325,'#8593A1',10,'left');text(ctx,'DUAL THRUSTERS / READY',125,350,ignition?'#A8FF54':'#8593A1',10,'left');segment(ctx,125,370,340,370,'#52DFFF44');segment(ctx,340,370,433,346,'#52DFFF44');ctx.globalAlpha=1;
}
function drawStory(canvas,act,t){
 const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(!w||!h)return;
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const ctx=canvas.getContext('2d'),art=storyArt(ctx);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#080B10';ctx.fillRect(0,0,w,h);
 const scale=Math.max(w/1200,h/760);ctx.save();ctx.translate((w-1200*scale)/2,(h-760*scale)/2);ctx.scale(scale,scale);act===0?drawCity(ctx,t,art):drawLaunchBay(ctx,t,art);ctx.restore();
}

const STORY_STYLES=`
.story-cutscene{--story-cyan:#52DFFF;--story-green:#A8FF54;--story-red:#FF354F;background:#080B10;color:#dce5ed}
.story-cutscene .story-letterbox{position:absolute;z-index:8;left:0;right:0;background:#080B10f2;border-color:#52DFFF35;font-family:var(--mono);backdrop-filter:blur(6px)}
.story-cutscene .story-top{top:0;min-height:76px;padding:15px 30px;border-bottom:1px solid #52DFFF35;display:flex;align-items:center;justify-content:space-between;gap:20px}
.story-transmission{font:9px/1.8 var(--mono);letter-spacing:1.1px;color:#52DFFF;display:flex;align-items:center;gap:10px}.story-top-actions{display:flex;gap:24px;align-items:center}.story-top-actions button{font:9px/1.6 var(--mono);letter-spacing:.6px;white-space:nowrap}.story-skip{color:#A8FF54!important}
.story-act-heading{position:absolute;z-index:4;top:106px;left:5%;max-width:90%;pointer-events:none;padding:10px 15px;border-left:2px solid var(--act-color);background:linear-gradient(90deg,#080B10d9,transparent)}.story-act-heading .eyebrow{font-size:8px;letter-spacing:1.4px;color:var(--act-color)}.story-act-heading h2{font-size:clamp(23px,3.4vw,48px);font-weight:500;letter-spacing:-1.3px;line-height:1.15;margin:8px 0;color:#e2ebf3}.story-act-heading small{font:8px/1.5 var(--mono);letter-spacing:1px;color:#8593A1}
.story-cutscene .story-bottom{bottom:0;padding:17px 30px 18px;border-top:1px solid #52DFFF35;min-height:170px;display:flex;flex-direction:column;gap:12px}.story-comms{display:flex;align-items:center;gap:15px;color:#52DFFF;font:8px var(--mono);letter-spacing:1px}.story-waveform{display:flex;align-items:center;height:24px;gap:3px;min-width:108px}.story-waveform i{display:block;background:#52DFFF;width:2px;box-shadow:0 0 5px #52DFFF33}.story-subtitle{font:12px/1.8 var(--mono);letter-spacing:.5px;color:#d9e9f1;max-width:1150px;min-height:44px;margin:0}.story-cursor{display:inline-block;width:6px;height:12px;background:#52DFFF;vertical-align:middle;margin-left:4px;animation:story-cursor .6s steps(2) infinite}.story-timeline{display:flex;gap:25px;align-items:end}.story-timeline>div{flex:1}.story-act-ticks{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font:7px/1.8 var(--mono);letter-spacing:1px;margin-bottom:7px;color:#8593A1}.story-act-ticks .current{color:#A8FF54}.story-clock{font:9px var(--mono);color:#52DFFF;white-space:nowrap}.story-progress{height:3px;background:#343D48;position:relative}.story-progress>i{display:block;height:100%;background:linear-gradient(90deg,#52DFFF,#A8FF54);box-shadow:0 0 10px #52DFFF55}.story-progress:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 24.8%,#080B10 24.8%,#080B10 25.2%,transparent 25.2%,transparent 49.8%,#080B10 49.8%,#080B10 50.2%,transparent 50.2%,transparent 74.8%,#080B10 74.8%,#080B10 75.2%,transparent 75.2%)}
.story-montage-tabs{position:absolute;z-index:4;bottom:195px;left:5%;right:5%;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;pointer-events:none}.story-montage-tabs span{font:9px/1.5 var(--mono);letter-spacing:.5px;padding:10px 12px;background:#080B10d9;border:1px solid #343D48;color:#8593A1}.story-montage-tabs span.selected{border-color:#52DFFF;color:#52DFFF;background:#52DFFF12}.story-boss-meter{position:absolute;z-index:3;top:225px;left:28%;right:28%;font:8px var(--mono);text-align:center;color:#FF526A;letter-spacing:1px}.story-boss-meter>div{height:5px;border:1px solid #FF354F66;background:#C9183633;margin-top:8px}.story-boss-meter i{display:block;height:100%;background:#FF354F;box-shadow:0 0 10px #FF354F55;animation:boss-flash .65s alternate infinite}.story-cut-flash{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden;animation:story-transition .25s cubic-bezier(.16,1,.3,1) both}.story-cut-flash:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,#e1fbff88,#52DFFF18);animation:story-flash .25s ease-out both;animation-play-state:inherit}.story-cut-flash:after{content:'';position:absolute;left:0;right:0;top:-15%;height:18%;background:linear-gradient(0deg,transparent,#52DFFF18 25%,#52DFFFa8 49%,#eaffff 50%,#52DFFF40 51%,transparent 80%);animation:story-scan-wipe .25s cubic-bezier(.4,0,.2,1) both;animation-play-state:inherit}.story-exit{position:absolute;inset:0;z-index:7;pointer-events:none;background:#080B1088;animation:story-exit .25s ease-out both}.story-exit:after{content:'PROTOCOL: OVERCLOCK // BREAK THE SYSTEM';position:absolute;left:8%;right:8%;top:44%;padding:20px;color:#A8FF54;background:#080B10dd;border-block:1px solid #52DFFF66;font:clamp(15px,2.6vw,35px) var(--mono);text-align:center}.story-cutscene .neural-boot{padding-bottom:180px}.story-cutscene .neural-boot h1{max-width:90%}.story-cutscene .neural-boot .primary-button{max-width:95%}
@keyframes story-cursor{50%{opacity:0}}@keyframes story-transition{0%,95%{opacity:1}100%{opacity:0}}@keyframes story-flash{0%{opacity:.7}100%{opacity:0}}@keyframes story-scan-wipe{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,700%,0)}}@keyframes story-exit{from{opacity:0}to{opacity:1}}
@media(max-width:680px){.story-cutscene .story-top{padding:12px 14px;min-height:85px;gap:10px;align-items:flex-start}.story-transmission{font-size:6px;letter-spacing:.5px;max-width:175px}.story-top-actions{flex-direction:column;gap:8px;align-items:flex-end}.story-top-actions button{font-size:6px;letter-spacing:.2px;padding:3px 0}.story-act-heading{top:102px;left:5%;padding:7px 10px}.story-act-heading .eyebrow{font-size:6px;letter-spacing:.8px}.story-act-heading h2{font-size:26px;letter-spacing:-1px}.story-act-heading small{font-size:6px}.story-cutscene .story-bottom{padding:12px 15px 14px;min-height:222px;gap:10px}.story-subtitle{font-size:9px;line-height:1.9;min-height:86px;letter-spacing:.15px}.story-comms{font-size:6px;letter-spacing:.5px;gap:10px}.story-waveform{min-width:85px;gap:2px}.story-waveform i{width:2px}.story-timeline{gap:12px}.story-act-ticks{font-size:5px;letter-spacing:.2px;gap:5px}.story-clock{font-size:7px}.story-cursor{height:10px;width:4px}.story-montage-tabs{bottom:240px;gap:5px;left:4%;right:4%}.story-montage-tabs span{font-size:5px;padding:8px 5px;letter-spacing:.15px}.story-boss-meter{top:212px;left:15%;right:15%;font-size:6px}.story-cutscene .neural-boot{padding:100px 18px 240px;gap:16px}.story-cutscene .neural-boot h1{font-size:28px}.story-cutscene .neural-boot p{font-size:10px}.story-cutscene .neural-boot .primary-button{font-size:6px;padding:13px 10px}}
@media(max-height:650px) and (min-width:681px){.story-cutscene .story-top{min-height:55px;padding:10px 20px}.story-act-heading{top:68px}.story-act-heading h2{font-size:29px}.story-cutscene .story-bottom{min-height:137px;padding:10px 20px;gap:7px}.story-subtitle{font-size:10px;min-height:36px}.story-montage-tabs{bottom:156px}.story-boss-meter{top:165px}.story-cutscene .neural-boot{padding-bottom:140px;gap:12px}}
@media(prefers-reduced-motion:reduce){.story-cursor,.story-cut-flash,.story-exit{animation:none}.story-cut-flash{display:none}}
`;

export default function CinematicIntro({onComplete,onSilent,onEnableAudio,onOptions,paused=false}){
 const canvas=useRef(null),current=useRef({paused}),elapsedRef=useRef(0),mounted=useRef(true),finished=useRef(false);
 current.current={paused};
 const [started,setStarted]=useState(false),[booting,setBooting]=useState(false),[error,setError]=useState(false),[elapsed,setElapsed]=useState(0);
 useEffect(()=>{mounted.current=true;storyArt(canvas.current.getContext('2d'));return()=>{mounted.current=false;};},[]);
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
 const act=Math.min(3,Math.floor(elapsed/4)),local=elapsed-act*4,scene=ACTS[act],letters=Math.min(scene.subtitle.length,Math.floor(local/2.85*scene.subtitle.length)),montage=Math.min(2,Math.floor(local/(4/3))),exit=elapsed>15.75,amplitude=audioLevel();
 return <section className="cinematic gameplay-trailer industrial-transmission story-cutscene" aria-label="16-second storyline and in-engine cutscene" style={{'--act-color':scene.color}}>
  <style>{STORY_STYLES}</style>
  <canvas ref={canvas} className="trailer-canvas" aria-label={act<2?`Animated story: ${scene.title}`:`Live engine: ${act===2?MONTAGE[montage].label:'AETHER mainframe boss'}`}/>
  <header className="story-letterbox story-top"><span className="story-transmission"><span className="status-dot"/>[ INCOMING TRANSMISSION // YEAR 2094 // SECTOR 07 ]</span><div className="story-top-actions"><button className="text-button" onClick={onOptions}><SlidersHorizontal size={12}/> OPTIONS / ESC</button><button className="text-button story-skip" onClick={complete}>[ SKIP CUTSCENE -&gt; ]</button></div></header>
  {!started?<div className="neural-boot"><span className="eyebrow lime">PROTOCOL OVERCLOCK / CLASSIFIED TRANSMISSION</span><div className="boot-sigil"><Zap size={40}/></div><h1>Establish your neural link.</h1><p>A 16-second story transmission.<br/>One operative. Three sectors. One rogue AI.</p><button className="primary-button" disabled={booting} onClick={boot}><Volume2 size={16}/>{booting?'CONNECTING AUDIO DEVICE…':'[ ESTABLISH NEURAL LINK // ENABLE AUDIO ]'}</button>{error&&<><p role="alert">Audio activation failed. Retry or continue silently.</p><button className="text-button" onClick={()=>{onSilent?.();setStarted(true);}}>CONTINUE WITHOUT AUDIO <ArrowRight size={13}/></button></>}</div>:<>
   <div className="story-act-heading" key={act}><span className="eyebrow">ACT 0{act+1} / CLASSIFIED STORY UPLINK</span><h2>{scene.title}</h2><small>{scene.tag}</small></div>
   {act===2&&<div className="story-montage-tabs">{MONTAGE.map((shot,i)=><span className={montage===i?'selected':''} key={shot.label}>{shot.label}</span>)}</div>}
   {act===3&&<div className="story-boss-meter"><span>AETHER / THREE SHIELD TETHERS / TERMINATE</span><div><i style={{width:'100%'}}/></div></div>}
   <div className="story-cut-flash" key={`flash-${act}-${act===2?montage:0}`} style={{animationPlayState:paused?'paused':'running'}}/>
   {exit&&<><div className="story-exit"/><div className="story-cut-flash"/></>}
  </>}
  <footer className="story-letterbox story-bottom"><div className="story-comms"><div className="story-waveform" aria-label="Cyan voice comms waveform">{WAVE_BARS.map(i=><i key={i} style={{height:started&&!paused?3+Math.abs(Math.sin(elapsed*9+i*.7))*18*(.25+amplitude*.75):3,opacity:started?.8:.3}}/>)}</div><span>{!started?'AWAITING NEURAL LINK':paused?'TRANSMISSION PAUSED':`VOICE COMMS // ${act===0||act===3?'AETHER INTERCEPT':'MISSION CONTROL'}`}</span></div><p className="story-subtitle" aria-label={started?scene.subtitle:'Awaiting transmission'}>{started?scene.subtitle.slice(0,letters):'ESTABLISH THE LINK. RECEIVE YOUR DIRECTIVE.'}<span className="story-cursor" aria-hidden="true"/></p><div className="story-timeline"><div><div className="story-act-ticks">{ACTS.map((item,i)=><span className={i===act?'current':''} key={item.title}>0{i+1} / {['BETRAYAL','UNIT-09','SECTORS','AETHER'][i]}</span>)}</div><div className="story-progress" role="progressbar" aria-label="Cutscene timeline" aria-valuemin={0} aria-valuemax={16} aria-valuenow={Number(elapsed.toFixed(1))}><i style={{width:`${elapsed/DURATION*100}%`}}/></div></div><span className="story-clock">{elapsed.toFixed(1)} / 16.0 SEC</span></div></footer>
 </section>;
}
