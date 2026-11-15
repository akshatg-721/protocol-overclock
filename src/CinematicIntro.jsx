import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Volume2 } from 'lucide-react';
import { sound, unlockAudio, audioLevel } from './audio';

const lines = ['YEAR 2094 // SECTOR 07 LOCKDOWN', "AI CORE 'AETHER' HAS SEIZED THE GRID", 'DEPLOYING PROTOCOL: OVERCLOCK', 'NEURAL LINK ESTABLISHED // BREACH AUTHORIZED'];
const starts = [0, 3.5, 7, 11];
const sceneAt = t => t < 3.5 ? 0 : t < 7 ? 1 : t < 11 ? 2 : 3;

export default function CinematicIntro({ onComplete, onSilent, onEnableAudio }) {
  const canvas = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [started,setStarted]=useState(false),[booting,setBooting]=useState(false),[audioError,setAudioError]=useState(false);
  async function boot(){setBooting(true);const ready=await unlockAudio();setBooting(false);if(ready){onEnableAudio?.();setStarted(true);setAudioError(false);}else setAudioError(true);}
  useEffect(() => {
    if(!started)return;
    let frame;
    let lastChapter = -1;
    const start = performance.now();
    const ctx = canvas.current.getContext('2d');
    function render(now) {
      const t = Math.max(0, Math.min(14, (now - start) / 1000));
      setElapsed(t);
      const chapter = sceneAt(t);
      if (chapter !== lastChapter) { sound(`scene${chapter}`); lastChapter = chapter; }
      const w = canvas.current.width = canvas.current.clientWidth * devicePixelRatio;
      const h = canvas.current.height = canvas.current.clientHeight * devicePixelRatio;
      ctx.fillStyle = '#0b100d'; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.scale(devicePixelRatio, devicePixelRatio);
      const W = w / devicePixelRatio, H = h / devicePixelRatio, cx = W * (chapter===0?.68:chapter===1?.60+Math.sin(t*.5)*.04:chapter===2?.72:.60), cy = H * (chapter<2?.42:.46);
      const red = '#ff526c', green = '#bdf578';
      ctx.lineWidth = 1; ctx.shadowBlur = 14; ctx.shadowColor = chapter < 2 ? red : green;
      const line = (x,y,X,Y,color) => { ctx.strokeStyle=color; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke(); };
      if (chapter < 2) {
        const project = (x,y,z) => [cx+x*310/z, cy+y*310/z];
        for(let z=50;z<1500;z+=60) { const depth=50+(z+t*160)%1450; const [x,y]=project(-1800,180,depth),[X,Y]=project(1800,180,depth);line(x,y,X,Y,'#ff526c35'); }
        for(let x=-1800;x<=1800;x+=120) { const [a,b]=project(x,180,50),[c,d]=project(x,180,1500);line(a,b,c,d,'#ff526c30'); }
        for(let i=0;i<34;i++) {
          const z=100+(i*113+t*125)%1400, x=(i%2?1:-1)*(230+(i%5)*100), height=80+(i*37)%230;
          const points=[[x,180,z],[x,180-height,z],[x+70,180-height,z],[x+70,180,z],[x+70,180,z+75],[x+70,180-height,z+75],[x,180-height,z+75],[x,180,z+75]] .map(p=>project(...p));
          for(const [a,b] of [[0,1],[1,2],[2,3],[3,0],[2,5],[5,6],[6,1],[5,4],[4,3],[6,7]]) line(...points[a],...points[b],'#cf687b55');
        }
        ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.3);ctx.strokeStyle=red;ctx.fillStyle='#591524';ctx.shadowBlur=35;
        const r=45+Math.sin(t*4)*5;for(let j=0;j<6;j++){ctx.save();ctx.rotate(j*Math.PI/3);ctx.fillStyle='#23191f';ctx.fillRect(r,-12,34,24);ctx.strokeRect(r,-12,34,24);ctx.restore();}ctx.beginPath();for(let j=0;j<6;j++){const a=j*Math.PI/3;j?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(r,0);}ctx.closePath();ctx.fillStyle='#591524';ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.62,0,Math.PI*2);ctx.stroke();ctx.fillStyle=red;ctx.fillRect(-9,-9,18,18);ctx.restore();
        if(chapter===1) {
          for(let i=0;i<5;i++){const y=(t*120+i*H/5)%H;line(0,y,W,y+Math.sin(t+i)*80,'#ff526c99');}
          for(let i=0;i<22;i++){const x=(i*137+t*(35+i%4*20))%W,y=H*.15+(Math.sin(t+i*2)+1)*H*.28;ctx.save();ctx.translate(x,y);ctx.fillStyle='#080e12';ctx.strokeStyle=red;ctx.beginPath();ctx.moveTo(-16,-5);ctx.lineTo(-8,5);ctx.lineTo(8,5);ctx.lineTo(16,-5);ctx.lineTo(0,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=red;ctx.fillRect(-2,-1,4,2);ctx.restore();}
        }
      } else {
        const u=t-7;ctx.translate(cx,cy);ctx.strokeStyle=green;ctx.fillStyle=green;ctx.shadowBlur=30;
        for(let i=0;i<5;i++){ctx.globalAlpha=1-((u*.35+i*.2)%1);ctx.beginPath();ctx.ellipse(0,0,30+((u*.35+i*.2)%1)*W*.65,15+((u*.35+i*.2)%1)*H*.4,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
        for(let i=0;i<12;i++){const a=i*Math.PI/6+u*.12,r=75+(Math.sin(t*15+i)+1)*45;ctx.beginPath();ctx.moveTo(Math.cos(a)*24,Math.sin(a)*24);for(let j=1;j<=5;j++){const R=24+(r-24)*j/5,A=a+Math.sin(t*24+i+j)*.1;ctx.lineTo(Math.cos(A)*R,Math.sin(A)*R);}ctx.stroke();}
        ctx.save();ctx.rotate(Math.sin(u)*.08);ctx.lineWidth=5;for(const side of [-1,1]){line(side*12,12,side*26,39,green);line(side*26,39,side*19,55,green);line(side*17,-5,side*41,9,green);}ctx.fillRect(-13,-21,26,39);ctx.fillStyle='#0c1918';ctx.fillRect(-8,-16,16,21);ctx.fillStyle=green;ctx.fillRect(-9,-33,18,12);ctx.fillRect(26,-4,31,8);ctx.restore();
      }
      ctx.restore();
      if(chapter===3){ctx.strokeStyle='#bdf57833';for(let y=h*.6;y<h;y+=35){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#9cf8d012':'#fe5e7722';ctx.fillRect(Math.sin(t*45+i)*w*.06,((i*137+t*300)%h),w,2+Math.sin(t*30+i)*2);}ctx.fillStyle=`rgba(190,255,220,${Math.max(0, .3-(t-11))})`;ctx.fillRect(0,0,w,h);}
      if(chapter===3){
        const p=Math.min(1,(t-11)/3);ctx.save();ctx.globalAlpha=p;ctx.fillStyle='#132024';ctx.fillRect(0,0,w,h);const scale=Math.min(w/1200,h/760);ctx.translate((w-1200*scale)/2,(h-760*scale)/2);ctx.scale(scale,scale);ctx.strokeStyle='#8bbca322';ctx.lineWidth=1;
        for(let x=40;x<1200;x+=40){ctx.beginPath();ctx.moveTo(x,40);ctx.lineTo(x,720);ctx.stroke();}for(let y=40;y<760;y+=40){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(1160,y);ctx.stroke();}
        ctx.strokeStyle='#87a37c66';ctx.strokeRect(40,40,1120,680);for(const [x,y,W,H] of [[350,255,85,45],[775,325,45,95],[425,525,95,40]]){ctx.fillStyle='#2b3e40';ctx.fillRect(x,y,W,H);ctx.strokeRect(x,y,W,H);}ctx.shadowBlur=18;ctx.shadowColor='#ffc76d';ctx.strokeStyle='#ffc76d';for(const [x,y] of [[210,180],[990,200],[600,630]])ctx.strokeRect(x-25,y-25,50,50);
        ctx.shadowColor='#bdf578';ctx.fillStyle='#bdf578';ctx.save();ctx.translate(600,450);ctx.rotate(-.8);ctx.fillRect(-13,-12,28,24);ctx.fillRect(10,-3,20,6);ctx.restore();ctx.restore();
      }
      if (t >= 14) onComplete(); else frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [onComplete,started]);
  const chapter = sceneAt(elapsed);
  return <div className="cinematic">
    <canvas ref={canvas} />
    {!started&&<div className="neural-boot"><span className="eyebrow lime">AETHER / SECTOR 07 / 2094</span><div className="boot-sigil">ϟ</div><h2>Your signal is the resistance.</h2><p>Initialize sound, then receive the 14-second mission transmission.</p><button className="primary-button" disabled={booting} onClick={boot}>{booting?'AWAITING AUDIO DEVICE…':'[ ESTABLISH NEURAL LINK // ENABLE AUDIO ]'}</button>{audioError&&<><p role="alert">Audio activation failed. Retry the link, or choose a silent transmission.</p><button className="text-button" onClick={()=>{onSilent?.();setStarted(true);}}>CONTINUE WITHOUT AUDIO</button></>}</div>}
    <div className="cinema-top"><span className="eyebrow">OC / ENCRYPTED TRANSMISSION</span><button className="text-button" onClick={onComplete}>[SKIP INTRO] <ArrowUpRight size={15} /></button></div>
    <div className="cinema-story"><span className="eyebrow lime">INCOMING SIGNAL {String(chapter + 1).padStart(2, '0')} / 04</span><h1 key={chapter}>{lines[chapter].slice(0, Math.floor((elapsed - starts[chapter]) * 34))}<span className="cursor">_</span></h1><button className="text-button muted" onClick={() => { unlockAudio(); sound(`scene${chapter}`); }}><Volume2 size={14} /> ENABLE TRANSMISSION AUDIO</button></div>
    <div className="comms-wave" aria-label="Synth signal amplitude">{Array.from({length:28},(_,i)=><i key={i} style={{height: `${3+Math.abs(Math.sin(elapsed*8+i*1.7))*24*audioLevel()}px`}} />)}<span>COMMS // LIVE SYNTH SIGNAL</span></div><div className="cinema-bottom"><span>ESTABLISHING NEURAL LINK</span><span>{Math.floor(elapsed / 14 * 100)}%</span><div className="scene-ticks">{[0,1,2,3].map(i=><span key={i} className={chapter===i?"lime":"muted"}>0{i+1} / {["LOCKDOWN","TAKEOVER","DEPLOYMENT","BREACH"][i]}</span>)}</div><div className="intro-track"><i style={{ width: `${elapsed / 14 * 100}%` }} /></div></div>
  </div>;
}
