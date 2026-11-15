import { ArrowRight, Crosshair, Shield, Zap, Gauge, Plus, Check } from 'lucide-react';
import { UPGRADES, LEVELS } from './levels';
import { sound } from './audio';
const icons = { weapon: Crosshair, shield: Shield, energy: Zap, rate: Gauge };
export default function UpgradeShop({ run, level, onBuy, onEquip, onContinue }) {
  return <div className="modal-backdrop shop-backdrop"><section className="shop-panel" aria-labelledby="shop-title">
    <div className="shop-top"><span className="eyebrow lime"><Check size={14} /> SECTOR 0{level} SECURED</span><span className="eyebrow">NEURAL LINK STABLE</span></div>
    <div className="shop-heading"><div><span className="eyebrow muted">BETWEEN-LEVEL UPLINK</span><h2 id="shop-title">Upgrade armory<span className="lime">.</span></h2><p>The next layer hits harder. Spend your recovered credits.</p></div><div className="bank"><span className="eyebrow">AVAILABLE CREDITS</span><strong>{run.bank.toLocaleString()} <span>CR</span></strong></div></div>
    <div className="armory-summary"><span>DATA SHARDS <b>{run.shards}</b></span><span>RUN SCORE <b>{run.score.toLocaleString()}</b></span><span>LOADOUT / FOUR SYSTEMS ONLINE</span></div>
    <div className="upgrade-grid">{UPGRADES.map(upgrade => {
      const Icon = icons[upgrade.icon], tier = run.upgrades[upgrade.id], cost = upgrade.cost * (tier + 1), max = tier >= 3;
      return <article className="upgrade-card" key={upgrade.id}><div className="upgrade-icon"><Icon size={23} /><span className="eyebrow">TIER {tier} / 3</span></div><span className="eyebrow muted">{upgrade.label}</span><h3>{upgrade.name}</h3><p>{upgrade.description}</p><div className="tier-pips">{[1,2,3].map(n=><span className={n<=tier?'filled':''} key={n}>T{n}</span>)}</div><span className="upgrade-stat">{upgrade.stat}</span><span className="stat-delta">{upgrade.id==='damage'?`DAMAGE ${24*(1+tier*.25)} → ${24*(1+Math.min(3,tier+1)*.25)}`:upgrade.id==='hull'?`HULL ${100+tier*40} → ${100+Math.min(3,tier+1)*40}`:upgrade.id==='energy'?`ENERGY ${100+tier*40} → ${100+Math.min(3,tier+1)*40}`:`FIRE RATE +${tier*20}% → +${Math.min(3,tier+1)*20}%`}</span><button className="buy-button" disabled={max || run.bank < cost} onClick={() => { sound('collect'); onBuy(upgrade.id, cost); }}>{max ? <><Check size={14} /> MAXED OUT</> : <><span>{cost.toLocaleString()} CR</span><Plus size={16} /></>}</button></article>;
    })}</div>
    <div className="perk-armory"><span className="eyebrow lime">EQUIP TACTICAL PERK / BONUS · CHOOSE ONE</span><div>{[['spread','Multi-Shot Spread','Two auxiliary bolts at 50% damage.'],['shield','Nanobot Shield','Absorbs the first hit in every sector.'],['dash','Phase Runner','Dash cooldown: 3s → 1.7s.']].map(([id,title,detail])=><button key={id} className={run.perk===id?'equipped':''} onClick={()=>onEquip(id)} aria-pressed={run.perk===id}><strong>{title} {run.perk===id?'✓':''}</strong><span>{detail}</span></button>)}</div></div>
    <div className="shop-bottom"><div><span className="eyebrow muted">NEXT UP / LEVEL 0{level + 1}</span><strong>{LEVELS[level]?.name}</strong></div><button className="primary-button" onClick={onContinue}>DEPLOY TO NEXT SECTOR <ArrowRight size={17} /></button></div>
  </section></div>;
}
