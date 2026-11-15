export const WEAPON_DAMAGE = [28, 44, 66, 132];
export const ENEMY_HP = { drone: 132, gunner: 220, charger: 175, mortar: 200 };
export const LEVELS = [
 {id:1,name:'Firewall Perimeter',tag:'THE OUTER DEFENSE',subtitle:'Get close. Break the armor.',objective:'Breach armored security relays',target:3,color:'#ffc76d',difficulty:'BREACH',description:'Enter gold proximity rings to decrypt relay armor. Shoot volatile barrels to break armor and extend engagement range to 350 units; you still need to advance. Dodge mortar locks.',positions:[[210,180],[990,200],[600,630]],cover:[[350,255,85,45],[775,325,45,95],[425,525,95,40]],hp:480,range:175,hackTime:3},
 {id:2,name:'Cryo-Laser Grid',tag:'THE FROZEN NETWORK',subtitle:'Sever the power. Open the route.',objective:'Sever cryo node power links',target:4,color:'#ffc76d',difficulty:'ESCALATION',description:'Dash into guarded cryo zones or hold Overclock nearby to phase-unlock and decrypt their shields. Each gold power tether feeds one sweeping laser. Destroy its node to permanently disable its beam.',positions:[[180,165],[1020,165],[180,615],[1020,615]],cover:[[390,170,45,120],[765,470,45,120],[470,355,95,40],[650,355,95,40]],hp:640,range:165,hackTime:3},
 {id:3,name:'AETHER Mainframe Boss Fight',tag:'THE HEART OF THE MACHINE',subtitle:'Break the shield. Survive the siege.',objective:'Sever AETHER shield emitters',target:3,color:'#ffc76d',difficulty:'CRITICAL',description:'Decrypt and destroy tethered shield emitters. AETHER retaliates with predictive plasma, a rotating death beam, then overdrive charge slams and bullet rings with safe pockets.',positions:[[210,225],[990,225],[600,640]],cover:[[345,410,70,45],[785,410,70,45],[535,515,130,35]],hp:720,range:180,hackTime:2.5},
];
export const UPGRADES = [
 {id:'damage',name:'Voltage amplifier',label:'WEAPON SYSTEM',description:'28 → 44 → 66 → 132 damage. Each tier reduces shots to kill drones and gunners.',cost:650,icon:'weapon',stat:'BREAKPOINT AMPLIFIER'},
 {id:'hull',name:'Reactive plating',label:'DEFENSE SYSTEM',description:'+40 maximum hull per tier. Includes a complete repair; standard sector transit repairs only 20 HP.',cost:500,icon:'shield',stat:'+40 INTEGRITY + REPAIR'},
 {id:'energy',name:'Quantum capacitor',label:'OVERCLOCK SYSTEM',description:'+40 capacity and faster energy regeneration per tier.',cost:550,icon:'energy',stat:'+40 ENERGY'},
 {id:'rate',name:'Synapse accelerator',label:'FIRING SYSTEM',description:'+20% firing speed per tier. Stacks with Overclock; Spread applies a 15% speed penalty.',cost:700,icon:'rate',stat:'+20% FIRE RATE'},
];
export const PERKS = [
 {id:'spread',name:'Multi-Shot Spread',description:'+2 half-damage bolts; −15% fire rate.',cost:350,shards:2},
 {id:'shield',name:'Nanobot Shield',description:'Blocks one hit. Regenerates every 12s in combat.',cost:350,shards:2},
 {id:'dash',name:'Phase Runner',description:'Dash cooldown 3s → 1.7s; longer invulnerability.',cost:350,shards:2},
];
export function freshRun(){return {score:0,bank:0,kills:0,shards:0,totalShards:0,elapsed:0,damageTaken:0,health:100,upgrades:{damage:0,hull:0,energy:0,rate:0},achievements:[],cleared:[],demo:false,perk:null,fatalThreat:null};}
export function purchaseUpgrade(run,id){const item=UPGRADES.find(u=>u.id===id);if(!item)return run;const tier=run.upgrades[id],cost=item.cost*(tier+1),shards=tier+1;if(tier>=3||run.bank<cost||run.shards<shards)return run;return {...run,bank:run.bank-cost,shards:run.shards-shards,health:id==='hull'?100+(tier+1)*40:run.health,upgrades:{...run.upgrades,[id]:tier+1}};}
export function purchasePerk(run,id){const item=PERKS.find(p=>p.id===id);if(!item||run.perk===id||run.bank<item.cost||run.shards<item.shards)return run;return {...run,bank:run.bank-item.cost,shards:run.shards-item.shards,perk:id};}
export function rankBreakdown(run,victory){const timeBonus=Math.max(0,Math.round((240-run.elapsed)*12)),damagePenalty=Math.round(run.damageTaken*12),value=Math.max(0,run.score+timeBonus-damagePenalty);return {score:run.score,timeBonus,damagePenalty,value,rank:!victory?(value>=6000?'B':'C'):value>=15000?'S':value>=10000?'A':value>=5000?'B':'C',formula:'Score + max(0, round((240 − seconds) × 12)) − (damage taken × 12). Victory: S ≥15000 / A ≥10000 / B ≥5000 / C <5000. Defeat: B ≥6000, otherwise C.'};}
export function getRank(run,victory){return rankBreakdown(run,victory).rank;}
export function eligibleHighScore(run){return !run.demo;}
