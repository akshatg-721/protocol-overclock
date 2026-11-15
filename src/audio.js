// All sound is synthesized locally. SFX, music, UI and intro share one warm mix.
let context,compressor,masterGain,limiter,sfxBus,musicBus,uiBus,introBus,analyser,noiseBuffer,meterData,frequencyBins;
let muted=false,sfxEnabled=true,musicEnabled=false,combat=false,slow=false,introEnabled=false,bossFight=false,intensity=1;
let pulseTimer=null,nextStep=0,step=0,hum=null,pickupChain=0,lastPickup=-10,lastExplosion=-10,lastHit=-10,lastHover=-10,lastClick=-10,lastPurchase=-10;
let audioSeed=0x91e10da5,uiInstalled=false;
const voices=new Set(),MAX_VOICES=176,EPS=.0001,MASTER_LEVEL=.84;
const SIXTEENTH=60/128/4;
const PENTATONIC=[523.25,659.25,783.99,1046.50,1318.51];
const ARP=[55,82.4069,110,65.4064,55,98,82.4069,73.4162,55,110,130.8128,98,82.4069,65.4064,73.4162,103.8262];
const BRAAAM=[41.2034,65.4064,55,36.7081];
function randomAudio(){audioSeed^=audioSeed<<13;audioSeed^=audioSeed>>>17;audioSeed^=audioSeed<<5;return (audioSeed>>>0)/4294967296;}
const ready=owner=>!!context&&context.state==='running'&&!muted&&(owner==='music'?musicEnabled&&combat:owner==='intro'?sfxEnabled&&introEnabled:sfxEnabled);
function bus(owner){return owner==='music'?musicBus:owner==='intro'?introBus:owner==='ui'||owner==='reward'?uiBus:sfxBus;}
function cancelVoice(voice,tail=.018){if(voice.cancelled)return;voice.cancelled=true;const now=context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(EPS,now,.005);try{voice.source.stop(now+tail);}catch{}}
function stopOwner(owner){for(const voice of voices)if(voice.owner===owner)cancelVoice(voice);}
function track(source,gain,nodes,owner,priority){
 if(voices.size>=MAX_VOICES){let oldest;for(const voice of voices)if(!voice.cancelled&&(!oldest||voice.priority<oldest.priority))oldest=voice;if(oldest)cancelVoice(oldest);}
 const voice={source,gain,owner,priority,cancelled:false};voices.add(voice);
 source.onended=()=>{voices.delete(voice);for(const node of nodes)try{node.disconnect();}catch{}};return voice;
}
function envelope(gain,t,duration,volume,attack=.004){gain.gain.setValueAtTime(EPS,t);gain.gain.linearRampToValueAtTime(Math.max(EPS,volume),t+Math.min(attack,duration*.35));gain.gain.exponentialRampToValueAtTime(EPS,t+duration);}
function tone(from,to,duration,{wave='sine',volume=.08,delay=0,filter=6000,filterEnd=filter*.45,q=.7,pan=0,detune=0,attack=.004,owner='sfx',priority=2}={}){
 if(!ready(owner))return;
 const t=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain(),lowpass=context.createBiquadFilter(),nodes=[osc,lowpass,gain];
 osc.type=wave;osc.detune.value=detune;osc.frequency.setValueAtTime(Math.max(15,from),t);osc.frequency.exponentialRampToValueAtTime(Math.max(15,to),t+duration);
 lowpass.type='lowpass';lowpass.Q.value=q;lowpass.frequency.setValueAtTime(filter,t);lowpass.frequency.exponentialRampToValueAtTime(Math.max(30,filterEnd),t+duration);envelope(gain,t,duration,volume,attack);
 osc.connect(lowpass);lowpass.connect(gain);
 if(pan&&context.createStereoPanner){const panner=context.createStereoPanner();panner.pan.value=pan;gain.connect(panner);panner.connect(bus(owner));nodes.push(panner);}else gain.connect(bus(owner));
 track(osc,gain,nodes,owner,priority);osc.start(t);osc.stop(t+duration+.015);
}
function noise(duration,{volume=.08,delay=0,filter=1200,end=120,type='lowpass',q=.7,pan=0,peak=null,owner='sfx',priority=2}={}){
 if(!ready(owner))return;
 const t=context.currentTime+delay,source=context.createBufferSource(),gain=context.createGain(),sweep=context.createBiquadFilter(),nodes=[source,sweep,gain];source.buffer=noiseBuffer;sweep.type=type;sweep.Q.value=q;sweep.frequency.setValueAtTime(filter,t);
 if(peak){sweep.frequency.exponentialRampToValueAtTime(peak,t+duration*.42);sweep.frequency.exponentialRampToValueAtTime(end,t+duration);}else sweep.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+duration);
 envelope(gain,t,duration,volume,.002);source.connect(sweep);sweep.connect(gain);
 if(pan&&context.createStereoPanner){const panner=context.createStereoPanner();panner.pan.value=pan;gain.connect(panner);panner.connect(bus(owner));nodes.push(panner);}else gain.connect(bus(owner));
 track(source,gain,nodes,owner,priority);source.start(t,randomAudio()*Math.max(0,noiseBuffer.duration-duration-.02));source.stop(t+duration+.01);
}
export async function unlockAudio(){
 try{
  if(!context){
   context=new (window.AudioContext||window.webkitAudioContext)();
   compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.15;
   masterGain=context.createGain();masterGain.gain.value=muted?0:MASTER_LEVEL;
   // Final peak guard supplements the musical compressor during extreme overlap.
   limiter=context.createDynamicsCompressor();limiter.threshold.value=-1.5;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.08;
   sfxBus=context.createGain();sfxBus.gain.value=sfxEnabled?.9:0;uiBus=context.createGain();uiBus.gain.value=sfxEnabled?.8:0;musicBus=context.createGain();musicBus.gain.value=.62;introBus=context.createGain();introBus.gain.value=introEnabled?.9:0;
   sfxBus.connect(compressor);uiBus.connect(compressor);musicBus.connect(compressor);introBus.connect(sfxBus);compressor.connect(masterGain);masterGain.connect(limiter);
   analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.72;meterData=new Uint8Array(analyser.fftSize);frequencyBins=new Uint8Array(analyser.frequencyBinCount);limiter.connect(analyser);analyser.connect(context.destination);
   noiseBuffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const samples=noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=randomAudio()*2-1;
   installUiAudio();
  }
  if(context.state!=='running')await context.resume();
  syncPulse();if(slow&&!hum)startOverclockLoop();return context.state==='running';
 }catch{return false;}
}
export function setMuted(value){muted=value;if(masterGain)masterGain.gain.setTargetAtTime(value?0:MASTER_LEVEL,context.currentTime,.025);if(value)stopOverclockLoop();else if(slow)startOverclockLoop();}
export function setSfxEnabled(enabled){sfxEnabled=enabled;if(sfxBus){sfxBus.gain.setTargetAtTime(enabled?.9:0,context.currentTime,.02);uiBus.gain.setTargetAtTime(enabled?.8:0,context.currentTime,.02);}if(!enabled)stopOverclockLoop();else if(slow)startOverclockLoop();}

export function playShoot(){if(!ready('sfx'))return;const pitch=1+(randomAudio()*2-1)*.06;tone(980*pitch,180*pitch,.09,{wave:'triangle',volume:.125,filter:6500});tone(980*pitch,180*pitch,.09,{wave:'sawtooth',volume:.032,filter:3400});noise(.025,{type:'bandpass',filter:2200,end:1100,q:.9,volume:.09});}
export function playHit(critical=false){if(!ready('sfx')||context.currentTime-lastHit<(critical?.018:.025))return;lastHit=context.currentTime;tone(160,55,.13,{volume:.14});tone(1400,critical?2200:1150,critical?.25:.1,{wave:'triangle',volume:critical?.09:.035,filter:5200,pan:critical?.15:0});noise(.018,{filter:2900,end:700,type:'bandpass',volume:.045});}
export function playCrit(){playHit(true);}
export function playExplosion(){if(!ready('sfx')||context.currentTime-lastExplosion<.035)return;lastExplosion=context.currentTime;tone(110,28,.55,{volume:.3,priority:4});noise(.72,{filter:1200,end:120,volume:.23,q:1.2,priority:4});for(let i=0;i<4;i++)noise(.035+i*.009,{delay:.035+i*.047,filter:6500-i*800,end:1900,type:'highpass',volume:.055-i*.008,pan:i%2?.4:-.4});}
export function playDash(){noise(.16,{filter:300,peak:1800,end:400,type:'bandpass',q:2.2,volume:.19});tone(440,1320,.18,{wave:'triangle',volume:.07,filter:5000});tone(880,1760,.12,{delay:.035,volume:.035,pan:.3});}
export function playOverclockStart(){tone(600,90,.58,{wave:'sawtooth',volume:.1,filter:2200,filterEnd:180,q:3});tone(120,32,.65,{volume:.17});}
function stopOverclockLoop(){if(!hum)return;const old=hum;hum=null;old.gain.gain.cancelScheduledValues(context.currentTime);old.gain.gain.setTargetAtTime(EPS,context.currentTime,.05);for(const source of old.sources)try{source.stop(context.currentTime+.24);}catch{}}
function startOverclockLoop(){
 if(hum||!ready('sfx')||!slow)return;
 const now=context.currentTime,gain=context.createGain(),filter=context.createBiquadFilter(),sub=context.createOscillator(),overtone=context.createOscillator(),lfo=context.createOscillator(),mod=context.createGain();
 sub.type='sine';sub.frequency.value=48;overtone.type='triangle';overtone.frequency.value=96;lfo.frequency.value=3.2;mod.gain.value=.014;gain.gain.setValueAtTime(EPS,now);gain.gain.linearRampToValueAtTime(.035,now+.12);filter.type='lowpass';filter.Q.value=4;filter.frequency.setValueAtTime(1100,now);filter.frequency.exponentialRampToValueAtTime(150,now+.65);
 sub.connect(filter);overtone.connect(filter);filter.connect(gain);gain.connect(sfxBus);lfo.connect(mod);mod.connect(gain.gain);hum={sources:[sub,overtone,lfo],gain};let remaining=3;for(const source of hum.sources){source.onended=()=>{if(--remaining===0)for(const node of [sub,overtone,lfo,mod,filter,gain])node.disconnect();};source.start();}
}
export function playOverclockLoop(enabled=true){setOverclockAudio(enabled);}
export function setOverclockAudio(enabled){slow=!!enabled;if(!enabled)stopOverclockLoop();else startOverclockLoop();}
export function playEmp(){tone(420,2000,.13,{wave:'sawtooth',volume:.08,filter:6500,q:3});tone(180,26,.95,{delay:.09,volume:.28,priority:4});noise(.9,{delay:.1,filter:2200,end:60,q:7,volume:.16,pan:-.55,priority:4});noise(.8,{delay:.12,filter:2450,end:75,q:6,volume:.13,pan:.55,priority:4});for(let i=0;i<5;i++)noise(.025,{delay:.11+i*.055,filter:7500,end:2600,type:'highpass',volume:.04,pan:i%2?.65:-.65});}
export function playShardPickup(){if(!ready('sfx'))return;const now=context.currentTime;pickupChain=now-lastPickup<.4?Math.min(10,pickupChain+1):0;lastPickup=now;const pitch=1+pickupChain*.018;PENTATONIC.forEach((frequency,i)=>tone(frequency*pitch,frequency*pitch*1.006,.2,{delay:i*.027,volume:.035,pan:(i-2)*.12,owner:'sfx',priority:1}));}
export function playUiHover(){if(!ready('ui')||context.currentTime-lastHover<.07)return;lastHover=context.currentTime;tone(1900,1300,.023,{volume:.025,owner:'ui',filter:5000});}
export function playUiClick(){if(!ready('ui')||context.currentTime-lastClick<.04)return;lastClick=context.currentTime;tone(1100,1750,.045,{wave:'triangle',volume:.05,owner:'ui'});noise(.012,{filter:4400,end:1800,type:'bandpass',volume:.025,owner:'ui'});}
export function playUpgradePurchase(){if(!ready('ui'))return;lastPurchase=context.currentTime;[130.8128,164.8138,195.9977,246.9417,293.6648].forEach((f,i)=>tone(f,f*1.003,.9,{wave:'triangle',attack:.075,delay:i*.024,volume:.065,filter:3600,filterEnd:1200,pan:(i-2)*.16,owner:'ui',priority:4}));tone(523.25,1046.5,.32,{delay:.12,volume:.045,owner:'ui'});}
function installUiAudio(){if(uiInstalled||typeof document==='undefined')return;uiInstalled=true;
 document.addEventListener('pointerover',event=>{const button=event.target?.closest?.('button');if(button&&!button.disabled&&!button.contains(event.relatedTarget))playUiHover();},{passive:true});
 document.addEventListener('click',event=>{const button=event.target?.closest?.('button');if(!button||button.disabled)return;if(button.matches('.buy-button,.perk-armory button')&&button.getAttribute('aria-pressed')!=='true')playUpgradePurchase();else playUiClick();},true);
}
function playBraaam(act=0,owner='intro'){const root=BRAAAM[act]||BRAAAM[0];for(const detune of [-9,9])tone(root,root*.72,1.15,{wave:'sawtooth',detune,attack:.055,volume:.105,filter:1500,filterEnd:160,q:1.7,pan:detune/25,owner,priority:5});tone(root*.5,22,.95,{volume:.18,owner,priority:5});noise(.25,{filter:1400,end:160,volume:.045,owner});}

export function sound(type='shoot'){
 if(!ready('sfx'))return;
 switch(type){
  case 'shoot':return playShoot();case 'hit':return playHit();case 'crit':return playCrit();case 'explode':case 'explosion':return playExplosion();case 'dash':return playDash();case 'emp':return playEmp();case 'overclock':return playOverclockStart();
  case 'collect':if(context.currentTime-lastPurchase<.06)return;return playShardPickup();
  case 'click':return playUiClick();case 'hover':return playUiHover();case 'purchase':return playUpgradePurchase();
  case 'playerHit':tone(260,42,.23,{volume:.2});noise(.09,{filter:800,end:150,volume:.12});tone(780,390,.12,{wave:'square',volume:.03});return;
  case 'bossPhase':playExplosion();playBraaam(3,'sfx');return;
  case 'victory':[220,330,440,550,660].forEach((f,i)=>tone(f,f,.75,{wave:'triangle',delay:i*.085,volume:.065,owner:'reward',priority:4}));return;
  default:if(type.startsWith('scene'))playBraaam(Number(type.slice(-1)),'sfx');else playUiClick();
 }
}
function stopMusic(){clearInterval(pulseTimer);pulseTimer=null;stopOwner('music');}
function scheduleStep(at){
 const delay=Math.max(0,at-context.currentTime),index=step%16,boost=bossFight?1.18:1,root=ARP[index]*(bossFight&&intensity===3&&index%4===3?2:1);
 tone(root,root,.095,{wave:'sawtooth',volume:.052*boost,filter:slow?300:750+intensity*180,filterEnd:slow?140:300,q:slow?3:1.1,delay,owner:'music',priority:1});
 if(index%4===0){tone(150,38,.19,{volume:.23,delay,owner:'music',priority:3});noise(.012,{volume:.055,filter:3800,end:1100,type:'highpass',delay,owner:'music'});tone(55,55,.14,{volume:.045,delay,owner:'music'});}
 noise(index%2?.025:.038,{type:'highpass',filter:8000,end:5000,volume:(index%2?.019:.032)*boost,delay,pan:index%2?.25:-.25,owner:'music',priority:1});
 if(index===4||index===12)noise(.09,{type:'bandpass',filter:1800,end:900,volume:.045,delay,owner:'music'});
 if(bossFight&&intensity>=2&&index%4===2)tone(root*2,root*2,.07,{wave:'triangle',volume:.025,delay,filter:2400,owner:'music'});
 step++;
}
function syncPulse(){
 if(pulseTimer||!context||!combat||!musicEnabled)return;nextStep=context.currentTime+.035;
 const schedule=()=>{if(context.state!=='running'||muted){nextStep=context.currentTime+.035;return;}if(nextStep<context.currentTime-.15)nextStep=context.currentTime+.02;while(nextStep<context.currentTime+.1){scheduleStep(nextStep);nextStep+=SIXTEENTH;}};
 schedule();pulseTimer=setInterval(schedule,25);
}
export function setCombatAudio(active){combat=active;if(!active){stopMusic();setOverclockAudio(false);}else syncPulse();}
export function setMusicEnabled(enabled){musicEnabled=enabled;stopMusic();if(enabled)syncPulse();}
export function setMusicIntensity(phase,isBoss=false){intensity=Math.max(1,Math.min(3,phase));bossFight=isBoss;}
export function setIntroAudio(enabled){introEnabled=enabled;if(introBus)introBus.gain.setTargetAtTime(enabled?.9:0,context.currentTime,.015);if(!enabled)stopOwner('intro');}
export function introCue(kind,act=0){
 if(!ready('intro'))return;const root=BRAAAM[act]||48,options={owner:'intro',priority:4};
 if(kind==='act')return playBraaam(act);
 if(kind==='type')return tone(1800,800,.024,{...options,wave:'square',volume:.012,filter:2600,priority:1});
 if(kind==='pulse'){tone(root,root*.5,.23,{...options,wave:'sawtooth',volume:.065,filter:900});tone(110,28,.15,{...options,volume:.08});return;}
 if(kind==='alarm'){tone(540,950,.24,{...options,wave:'triangle',volume:.045});tone(950,540,.24,{...options,wave:'triangle',volume:.035,delay:.24});return;}
 if(kind==='impact'){tone(160,24,.65,{...options,volume:.25});noise(.18,{...options,filter:2400,end:160,volume:.1});return;}
 if(kind==='finale'){playBraaam(3);[65.4064,98.1,130.8128].forEach((f,i)=>tone(f,f*.5,.9,{...options,wave:'sawtooth',volume:.055,delay:i*.035}));return;}
 if(kind==='glitch'){for(let i=0;i<3;i++)tone(1600-i*350,35,.12,{...options,wave:'sawtooth',volume:.06,delay:i*.05});}
}
export function audioLevel(){if(!analyser||muted)return 0;analyser.getByteTimeDomainData(meterData);let sum=0;for(const value of meterData)sum+=((value-128)/128)**2;return Math.min(1,Math.sqrt(sum/meterData.length)*8);}
export function introFrequencyData(target){if(!analyser||muted){target.fill(0);return target;}analyser.getByteFrequencyData(frequencyBins);for(let i=0;i<target.length;i++){const lo=Math.floor(Math.exp(i/target.length*Math.log(frequencyBins.length))-1),hi=Math.max(lo+1,Math.floor(Math.exp((i+1)/target.length*Math.log(frequencyBins.length))-1));let value=0;for(let j=lo;j<Math.min(hi,frequencyBins.length);j++)value+=frequencyBins[j];target[i]=value/Math.max(1,hi-lo);}return target;}
