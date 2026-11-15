export const WEAPON_DAMAGE = [28, 44, 66, 132];
export const ENEMY_HP = { drone: 132, gunner: 220, charger: 175, mortar: 200 };
export const LEVELS = [
 {id:1,name:'Firewall Perimeter',tag:'THE OUTER DEFENSE',subtitle:'Get close. Break the armor.',objective:'Breach armored security relays',target:3,color:'#ffc76d',difficulty:'BREACH',description:'Enter gold proximity rings to decrypt relay armor. Shoot volatile barrels to break armor and extend engagement range to 350 units; you still need to advance. Dodge mortar locks.',positions:[[210,180],[990,200],[600,630]],cover:[[350,255,85,45],[775,325,45,95],[425,525,95,40]],hp:480,range:175,hackTime:3},
 {id:2,name:'Cryo-Laser Grid',tag:'THE FROZEN NETWORK',subtitle:'Sever the power. Open the route.',objective:'Sever cryo node power links',target:4,color:'#ffc76d',difficulty:'ESCALATION',description:'Dash into guarded cryo zones or hold Overclock nearby to phase-unlock and decrypt their shields. Each gold power tether feeds one sweeping laser. Destroy its node to permanently disable its beam.',positions:[[180,165],[1020,165],[180,615],[1020,615]],cover:[[390,170,45,120],[765,470,45,120],[470,355,95,40],[650,355,95,40]],hp:640,range:165,hackTime:3},
 {id:3,name:'AETHER Mainframe Boss Fight',tag:'THE HEART OF THE MACHINE',subtitle:'Break the shield. Survive the siege.',objective:'Sever AETHER shield emitters',target:3,color:'#ffc76d',difficulty:'CRITICAL',description:'Decrypt and destroy tethered shield emitters. AETHER retaliates with predictive plasma, a rotating death beam, then overdrive charge slams and bullet rings with safe pockets.',positions:[[210,225],[990,225],[600,640]],cover:[[345,410,70,45],[785,410,70,45],[535,515,130,35]],hp:720,range:180,hackTime:2.5},
];
export const SHARD_COSTS=[80,140,220];
export const ENERGY_CAPACITY=[100,150,225,338];
export const RELAY_SHARDS=35;
export const SECTOR_CLEAR_SHARDS=150;
export const UPGRADES=[
 {id:'rate',name:'Synapse accelerator',label:'FIRING SYSTEM',description:'+35% fire rate per tier. Stacks with Overclock. Turn a volley into a storm.',icon:'rate',stat:'+35% FIRE RATE'},
 {id:'damage',name:'Prism split array',label:'WEAPON SYSTEM',description:'+2 extra spread bolts per tier, plus the existing damage amplifier. Each side bolt deals 50% damage.',icon:'weapon',stat:'+2 PROJECTILES / TIER'},
 {id:'energy',name:'Quantum capacitor',label:'OVERCLOCK SYSTEM',description:'+50% Overclock capacity per tier, rounded up. More time to move, decrypt and fire.',icon:'energy',stat:'+50% ENERGY CAPACITY'},
 {id:'hull',name:'Reactive plating',label:'DEFENSE SYSTEM',description:'+40 maximum integrity per tier and a complete repair. Stay in the fight.',icon:'shield',stat:'+40 MAX HP + FULL HEAL'},
];
export const PERKS=[
 {id:'spread',name:'Multi-Shot Spread',description:'+2 auxiliary half-damage bolts; −15% fire rate. Stacks with Prism.',shards:100},
 {id:'shield',name:'Nanobot Shield',description:'Blocks one hit. Regenerates every 12 combat seconds.',shards:100},
 {id:'dash',name:'Phase Runner',description:'Dash cooldown 3s → 1.7s; longer invulnerability.',shards:100},
];
export function enemyShardDrops(type,rng=Math.random){const elite=type==='charger'||type==='mortar';const count=(elite?8:2)+Math.floor(rng()*(elite?3:2));return Array.from({length:count},()=>20+Math.floor(rng()*6));}
export function freshRun(){return {score:0,bank:0,kills:0,shards:0,totalShards:0,elapsed:0,damageTaken:0,health:100,upgrades:{damage:0,hull:0,energy:0,rate:0},achievements:[],cleared:[],demo:false,perk:null,fatalThreat:null};}
export function purchaseUpgrade(run,id){if(!UPGRADES.some(u=>u.id===id))return run;const tier=run.upgrades[id],cost=SHARD_COSTS[tier];if(tier>=3||run.shards<cost)return run;return {...run,shards:run.shards-cost,health:id==='hull'?100+(tier+1)*40:run.health,upgrades:{...run.upgrades,[id]:tier+1}};}
export function purchasePerk(run,id){const item=PERKS.find(p=>p.id===id);if(!item||run.perk===id||run.shards<item.shards)return run;return {...run,shards:run.shards-item.shards,perk:id};}
export function rankBreakdown(run,victory){const timeBonus=Math.max(0,Math.round((240-run.elapsed)*12)),damagePenalty=Math.round(run.damageTaken*12),value=Math.max(0,run.score+timeBonus-damagePenalty);return {score:run.score,timeBonus,damagePenalty,value,rank:!victory?(value>=6000?'B':'C'):value>=15000?'S':value>=10000?'A':value>=5000?'B':'C',formula:'Score + max(0, round((240 − seconds) × 12)) − (damage taken × 12). Victory: S ≥15000 / A ≥10000 / B ≥5000 / C <5000. Defeat: B ≥6000, otherwise C.'};}
export function getRank(run,victory){return rankBreakdown(run,victory).rank;}
export function eligibleHighScore(run){return !run.demo;}
