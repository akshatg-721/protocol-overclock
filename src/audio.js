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
export function setMuted(value){muted=value;if(value)cancelIntroNarration();if(masterGain)masterGain.gain.setTargetAtTime(value?0:MASTER_LEVEL,context.currentTime,.025);if(value)stopOverclockLoop();else if(slow)startOverclockLoop();}
export function setSfxEnabled(enabled){sfxEnabled=enabled;if(!enabled)cancelIntroNarration();if(sfxBus){sfxBus.gain.setTargetAtTime(enabled?.9*(narrationDucked?.62:1):0,context.currentTime,.02);uiBus.gain.setTargetAtTime(enabled?.8:0,context.currentTime,.02);}if(!enabled)stopOverclockLoop();else if(slow)startOverclockLoop();}

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
 if(kind==='pttStart'||kind==='pttEnd'){const first=kind==='pttStart'?1200:800,second=kind==='pttStart'?800:1200;tone(first,first,.035,{...options,wave:'sine',volume:.055,filter:3400});tone(second,second,.035,{...options,wave:'sine',volume:.045,filter:3400,delay:.035});noise(.025,{...options,type:'bandpass',filter:1800,end:900,volume:.035});return;}
 if(kind==='radio'){noise(.08,{...options,type:'bandpass',filter:1600,end:700,q:1.6,volume:.075});tone(1400,1900,.055,{...options,wave:'triangle',volume:.055,delay:.015});return;}
 if(kind==='act'){
  playBraaam(act);
  if(act===0){tone(110,30,.9,{...options,volume:.2});tone(130,85,3.5,{...options,wave:'triangle',volume:.035,filter:400,filterEnd:160});tone(430,790,.7,{...options,wave:'triangle',volume:.035,delay:.1});}
  if(act===1)tone(200,1400,1.2,{...options,wave:'sawtooth',volume:.085,filter:2600,filterEnd:1800,q:2.5});
  if(act===2)for(let i=0;i<3;i++){tone(980,180,.09,{...options,wave:'triangle',volume:.07,delay:i*.085});noise(.025,{...options,type:'bandpass',filter:2600,end:1200,volume:.035,delay:i*.085});}
  if(act===3)for(const ratio of [1.5,2])tone(root*ratio,root*ratio*.75,1.25,{...options,wave:'sawtooth',detune:ratio===2?7:-7,attack:.07,filter:1200,filterEnd:160,volume:.055});
  return;
 }
 if(kind==='shieldBreak'){for(let i=0;i<4;i++)tone(2000+i*690,1100+i*380,.35+i*.06,{...options,wave:'triangle',volume:.035,delay:i*.02,pan:(i-1.5)*.3});noise(.16,{...options,type:'highpass',filter:6000,end:2100,volume:.09});return;}
 if(kind==='heartbeat'){tone(68,32,.13,{...options,volume:.14});tone(59,35,.11,{...options,delay:.11,volume:.095});return;}
 if(kind==='type')return tone(1800,800,.024,{...options,wave:'square',volume:.012,filter:2600,priority:1});
 if(kind==='pulse'){tone(root,root*.5,.23,{...options,wave:'sawtooth',volume:.065,filter:900});tone(110,28,.15,{...options,volume:.08});return;}
 if(kind==='alarm'){tone(540,950,.24,{...options,wave:'triangle',volume:.045});tone(950,540,.24,{...options,wave:'triangle',volume:.035,delay:.24});return;}
 if(kind==='impact'){tone(160,24,.65,{...options,volume:.25});noise(.18,{...options,filter:2400,end:160,volume:.1});if(act===1){tone(1800,400,.065,{...options,wave:'square',volume:.04});tone(600,90,.65,{...options,wave:'sawtooth',filter:1800,filterEnd:120,q:3,volume:.09});}if(act===2){noise(.8,{...options,filter:2200,end:60,q:6,pan:-.5,volume:.12});noise(.7,{...options,filter:2400,end:70,q:5,pan:.5,volume:.1});}return;}
 if(kind==='finale'){playBraaam(3);noise(.1,{...options,type:'highpass',filter:6500,end:1600,volume:.15});tone(1500,180,.45,{...options,wave:'triangle',volume:.09});tone(110,30,.7,{...options,volume:.24});[65.4064,98.1,130.8128].forEach((f,i)=>tone(f,f*.5,.9,{...options,wave:'sawtooth',volume:.055,delay:i*.035}));return;}
 if(kind==='glitch'){for(let i=0;i<3;i++)tone(1600-i*350,35,.12,{...options,wave:'sawtooth',volume:.06,delay:i*.05});}
}
export function audioLevel(){if(!analyser||muted)return 0;analyser.getByteTimeDomainData(meterData);let sum=0;for(const value of meterData)sum+=((value-128)/128)**2;return Math.min(1,Math.sqrt(sum/meterData.length)*8);}
export function introFrequencyData(target){if(!analyser||muted){target.fill(0);return target;}analyser.getByteFrequencyData(frequencyBins);for(let i=0;i<target.length;i++){const lo=Math.floor(Math.exp(i/target.length*Math.log(frequencyBins.length))-1),hi=Math.max(lo+1,Math.floor(Math.exp((i+1)/target.length*Math.log(frequencyBins.length))-1));let value=0;for(let j=lo;j<Math.min(hi,frequencyBins.length);j++)value+=frequencyBins[j];target[i]=value/Math.max(1,hi-lo);}return target;}

// Recorded voice receives real radio DSP. Native speech cannot be piped into Web Audio:
// its natural voice is accompanied by the same PTT/carrier bed and soundtrack ducking.
let commanderVoice=null,narration=null,narrationToken=0,narrationPaused=false,narrationDucked=false;
const recordingBytes=new Map(),recordingBuffers=new Map();
const RADIO_CURVE=Float32Array.from({length:1024},(_,i)=>Math.tanh((i/1023*2-1)*1.25)/Math.tanh(1.25));
const COMMANDER_VOICES=['Daniel','Google UK English Male','Alex','Arthur','Aaron','David','George','Oliver','Thomas','Tom','James','Guy','Ryan','Andrew','Brian','Eric','Roger','Christopher','Steffan','Fred'];
function speechApi(){return typeof window!=='undefined'&&window.speechSynthesis&&window.SpeechSynthesisUtterance?window.speechSynthesis:null;}
export function selectIntroVoice(voices){
 const english=voices.filter(voice=>/^en(?:[-_]|$)/i.test(voice.lang||''));
 const quality=voice=>/Natural|Premium|Enhanced/i.test(voice.name)?1:0;
 for(const name of COMMANDER_VOICES){const pattern=new RegExp(`\\b${name}\\b`,'i'),matches=english.filter(voice=>pattern.test(voice.name));if(matches.length)return matches.sort((a,b)=>quality(b)-quality(a))[0];}
 // SpeechSynthesis exposes no standard gender field. Do not fall back to a female
 // or unknown default voice when a male commander was requested.
 return english.find(voice=>/\bmale\b/i.test(voice.name))||null;
}
function voiceBytes(act){
 if(!recordingBytes.has(act))recordingBytes.set(act,(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),1800);try{const response=await fetch(`/voice/act${act+1}.mp3`,{signal:controller.signal});if(!response.ok||/text|html|json/i.test(response.headers.get('content-type')||''))return null;return await response.arrayBuffer();}catch{return null;}finally{clearTimeout(timeout);}})());
 return recordingBytes.get(act);
}
async function recordedVoice(act){
 if(!recordingBuffers.has(act))recordingBuffers.set(act,(async()=>{const bytes=await voiceBytes(act);if(!bytes||!context)return null;try{return await context.decodeAudioData(bytes.slice(0));}catch{return null;}})());
 return recordingBuffers.get(act);
}
export function prepareIntroNarration(){
 for(let act=0;act<4;act++)void voiceBytes(act);
 const synth=speechApi();if(!synth)return ()=>{};
 const refresh=()=>{commanderVoice=selectIntroVoice(synth.getVoices());};refresh();synth.addEventListener?.('voiceschanged',refresh);
 return ()=>synth.removeEventListener?.('voiceschanged',refresh);
}
function duckNarration(active){narrationDucked=active;if(!context)return;sfxBus.gain.setTargetAtTime(sfxEnabled?.9*(active?.62:1):0,context.currentTime,.04);musicBus.gain.setTargetAtTime(.62*(active?.38:1),context.currentTime,.05);}
function currentNarration(record){return narration===record&&record.token===narrationToken;}
function later(record,fn,delay){const timer=setTimeout(()=>{record.timers.delete(timer);if(currentNarration(record))fn();},delay);record.timers.add(timer);}
function startCarrier(record){
 if(record.carrier||!ready('intro'))return;
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noiseBuffer;source.loop=true;filter.type='bandpass';filter.frequency.value=1700;filter.Q.value=.65;gain.gain.value=.012;source.connect(filter);filter.connect(gain);gain.connect(compressor);
 source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};record.carrier={source,gain};source.start();
}
function stopCarrier(record){if(!record?.carrier)return;const {source,gain}=record.carrier;record.carrier=null;gain.gain.setTargetAtTime(EPS,context.currentTime,.005);try{source.stop(context.currentTime+.02);}catch{}}
function stopRecordedSource(record){if(!record.source)return;const source=record.source;record.source=null;try{source.stop();}catch{}source.disconnect();}
function finishNarration(record,ptt=true){
 if(!currentNarration(record))return;
 for(const timer of record.timers)clearTimeout(timer);record.timers.clear();record.releaseVoiceWait?.();stopCarrier(record);stopRecordedSource(record);record.dsp?.forEach(node=>node.disconnect());narration=null;duckNarration(false);record.onSpeaking?.(false);if(ptt)introCue('pttEnd',record.act);
}
export function cancelIntroNarration({ptt=false}={}){
 const previous=narration;if(previous){previous.paused=true;for(const timer of previous.timers)clearTimeout(timer);previous.timers.clear();previous.releaseVoiceWait?.();stopCarrier(previous);stopRecordedSource(previous);previous.dsp?.forEach(node=>node.disconnect());}
 narrationToken++;narration=null;narrationPaused=false;duckNarration(false);try{speechApi()?.cancel();}catch{}previous?.onSpeaking?.(false);if(ptt&&previous?.started)introCue('pttEnd',previous.act);
}
function waitForVoice(record){
 const synth=speechApi();if(!synth)return Promise.resolve(null);
 const available=selectIntroVoice(synth.getVoices())||commanderVoice;if(available)return Promise.resolve(available);
 // Never issue an utterance with an empty/default voice while voices are loading.
 return new Promise(resolve=>{let settled=false,timeout;const finish=voice=>{if(settled)return;settled=true;clearTimeout(timeout);synth.removeEventListener?.('voiceschanged',changed);record.releaseVoiceWait=null;resolve(voice);};const changed=()=>{const voice=selectIntroVoice(synth.getVoices());if(voice)finish(voice);};record.releaseVoiceWait=()=>finish(null);synth.addEventListener?.('voiceschanged',changed);timeout=setTimeout(()=>finish(selectIntroVoice(synth.getVoices())),2000);changed();});
}
function radioDSP(record){
 const high=context.createBiquadFilter(),low=context.createBiquadFilter(),presence=context.createBiquadFilter(),drive=context.createWaveShaper(),gain=context.createGain();
 high.type='highpass';high.frequency.value=280;high.Q.value=.707;low.type='lowpass';low.frequency.value=3400;low.Q.value=.707;presence.type='peaking';presence.frequency.value=1600;presence.Q.value=1;presence.gain.value=4;drive.curve=RADIO_CURVE;drive.oversample='2x';gain.gain.value=.9;
 high.connect(low);low.connect(presence);presence.connect(drive);drive.connect(gain);gain.connect(compressor);record.dsp=[high,low,presence,drive,gain];
}
function startRecorded(record){
 if(!currentNarration(record)||record.paused||narrationPaused||record.source)return;
 if(record.offset>=record.buffer.duration){finishNarration(record);return;}
 if(!record.dsp)radioDSP(record);
 const source=context.createBufferSource();source.buffer=record.buffer;source.connect(record.dsp[0]);record.source=source;record.beganAt=context.currentTime;record.started=true;startCarrier(record);duckNarration(true);record.onSpeaking?.(true);
 source.onended=()=>{source.disconnect();if(currentNarration(record)&&record.source===source&&!record.paused)finishNarration(record);};source.start(0,record.offset);
}
function speakClause(record){
 if(!currentNarration(record)||record.paused||narrationPaused)return;
 const synth=speechApi();if(!synth){finishNarration(record,false);return;}
 const utterance=new window.SpeechSynthesisUtterance(record.clauses[record.clause]);utterance.voice=record.voice;utterance.lang=record.voice.lang;utterance.pitch=.96;utterance.rate=1.02;utterance.volume=1;record.utterance=utterance;record.issued=true;
 utterance.onstart=()=>{if(!currentNarration(record)||record.utterance!==utterance)return;record.started=true;if(!record.paused){startCarrier(record);duckNarration(true);record.onSpeaking?.(true);}};
 utterance.onend=()=>{if(!currentNarration(record)||record.utterance!==utterance)return;record.issued=false;if(++record.clause>=record.clauses.length)finishNarration(record);else{record.clauseWaiting=true;later(record,()=>{record.clauseWaiting=false;speakClause(record);},/[.!?]$/.test(utterance.text)?110:65);}};
 utterance.onerror=()=>{if(currentNarration(record)&&record.utterance===utterance)finishNarration(record,false);};
 try{if(synth.paused)synth.resume();synth.speak(utterance);}catch{finishNarration(record,false);}
}
function issueNarration(record){if(record.mode==='recording')startRecorded(record);else speakClause(record);}
function keyUpTransmission(record){
 if(!currentNarration(record)||record.paused||narrationPaused||record.preRolling||record.readyToPlay)return;
 record.preRolling=true;introCue('pttStart',record.act);later(record,()=>{record.preRolling=false;record.readyToPlay=true;issueNarration(record);},80);
}
export function narrateIntroLine(text,{act=0,onSpeaking}={}){
 const hadTransmission=!!narration?.started;cancelIntroNarration({ptt:true});if(muted||!sfxEnabled||!introEnabled||!text)return false;
 const record={token:++narrationToken,act,onSpeaking,timers:new Set(),paused:false,started:false,mode:null,offset:0,clause:0};narration=record;
 void(async()=>{const buffer=await recordedVoice(act);if(!currentNarration(record))return;
  if(buffer){record.buffer=buffer;record.mode='recording';}else{const voice=await waitForVoice(record);if(!currentNarration(record))return;if(!voice){finishNarration(record,false);return;}record.voice=voice;record.clauses=text.match(/[^.!?;,—:]+[.!?;,—:]*/g)?.map(clause=>clause.trim()).filter(Boolean)||[text];record.mode='speech';}
  if(hadTransmission)later(record,()=>keyUpTransmission(record),75);else keyUpTransmission(record);
 })();return true;
}
export function pauseIntroNarration(paused){
 narrationPaused=paused;const record=narration;if(!record)return;record.paused=paused;
 if(paused){if(record.mode==='recording'&&record.source){record.offset+=Math.max(0,context.currentTime-record.beganAt);stopRecordedSource(record);}else if(record.mode==='speech')try{speechApi()?.pause();}catch{}stopCarrier(record);duckNarration(false);record.onSpeaking?.(false);return;}
 if(!record.mode)return;
 if(record.mode==='speech'&&record.issued){try{speechApi()?.resume();}catch{}if(record.started){startCarrier(record);duckNarration(true);record.onSpeaking?.(true);}}
 else if(!record.preRolling&&!record.clauseWaiting){if(record.readyToPlay)issueNarration(record);else keyUpTransmission(record);}
}
