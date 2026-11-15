import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Volume2 } from 'lucide-react';
import { sound, unlockAudio } from './audio';

const lines = ['YEAR 2094 // SECTOR 07 LOCKDOWN', "AI CORE 'AETHER' HAS SEIZED THE GRID", 'DEPLOYING PROTOCOL: OVERCLOCK', 'NEURAL LINK ESTABLISHED // BREACH AUTHORIZED'];
const starts = [0, 3.5, 7, 11];
const sceneAt = t => t < 3.5 ? 0 : t < 7 ? 1 : t < 11 ? 2 : 3;

export default function CinematicIntro({ onComplete }) {
  const canvas = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
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
      const W = w / devicePixelRatio, H = h / devicePixelRatio, cx = W * .65, cy = H * .42;
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
        const r=45+Math.sin(t*4)*5;ctx.fillRect(-r,-r,r*2,r*2);ctx.strokeRect(-r,-r,r*2,r*2);ctx.rotate(.785);ctx.strokeRect(-r*1.3,-r*1.3,r*2.6,r*2.6);ctx.restore();
        if(chapter===1) {
          for(let i=0;i<5;i++){const y=(t*120+i*H/5)%H;line(0,y,W,y+Math.sin(t+i)*80,'#ff526c99');}
          for(let i=0;i<22;i++){const x=(i*137+t*(35+i%4*20))%W,y=H*.15+(Math.sin(t+i*2)+1)*H*.28;ctx.save();ctx.translate(x,y);ctx.fillStyle='#080e12';ctx.strokeStyle=red;ctx.beginPath();ctx.moveTo(-16,-5);ctx.lineTo(-8,5);ctx.lineTo(8,5);ctx.lineTo(16,-5);ctx.lineTo(0,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=red;ctx.fillRect(-2,-1,4,2);ctx.restore();}
        }
      } else {
        const u=t-7;ctx.translate(cx,cy);ctx.strokeStyle=green;ctx.fillStyle=green;ctx.shadowBlur=30;
        for(let i=0;i<5;i++){ctx.globalAlpha=1-((u*.35+i*.2)%1);ctx.beginPath();ctx.ellipse(0,0,30+((u*.35+i*.2)%1)*W*.65,15+((u*.35+i*.2)%1)*H*.4,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
        for(let i=0;i<12;i++){const a=i*Math.PI/6+u*.12,r=75+(Math.sin(t*15+i)+1)*45;ctx.beginPath();ctx.moveTo(Math.cos(a)*24,Math.sin(a)*24);for(let j=1;j<=5;j++){const R=24+(r-24)*j/5,A=a+Math.sin(t*24+i+j)*.1;ctx.lineTo(Math.cos(A)*R,Math.sin(A)*R);}ctx.stroke();}
        ctx.rotate(-Math.PI/4);ctx.fillRect(-19,-19,38,38);ctx.strokeRect(-30,-30,60,60);
      }
      ctx.restore();
      if(chapter===3){for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#9cf8d012':'#fe5e7722';ctx.fillRect(Math.sin(t*45+i)*w*.06,((i*137+t*300)%h),w,2+Math.sin(t*30+i)*2);}ctx.fillStyle=`rgba(190,255,220,${Math.max(0, .3-(t-11))})`;ctx.fillRect(0,0,w,h);}
      if (t >= 14) onComplete(); else frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [onComplete]);
  const chapter = sceneAt(elapsed);
  return <div className="cinematic">
    <canvas ref={canvas} />
    <div className="cinema-top"><span className="eyebrow">OC / ENCRYPTED TRANSMISSION</span><button className="text-button" onClick={onComplete}>[SKIP INTRO] <ArrowUpRight size={15} /></button></div>
    <div className="cinema-story"><span className="eyebrow lime">INCOMING SIGNAL {String(chapter + 1).padStart(2, '0')} / 04</span><h1 key={chapter}>{lines[chapter].slice(0, Math.floor((elapsed - starts[chapter]) * 34))}<span className="cursor">_</span></h1><button className="text-button muted" onClick={() => { unlockAudio(); sound(`scene${chapter}`); }}><Volume2 size={14} /> ENABLE TRANSMISSION AUDIO</button></div>
    <div className="comms-wave" aria-label="Voice communications active">{Array.from({length:28},(_,i)=><i key={i} style={{height: `${4+Math.abs(Math.sin(elapsed*8+i*1.7))*20}px`}} />)}<span>VOICE COMMS // AETHER UPLINK</span></div><div className="cinema-bottom"><span>ESTABLISHING NEURAL LINK</span><span>{Math.floor(elapsed / 14 * 100)}%</span><div className="intro-track"><i style={{ width: `${elapsed / 14 * 100}%` }} /></div></div>
  </div>;
}
