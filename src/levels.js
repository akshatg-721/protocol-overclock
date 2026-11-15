export const LEVELS = [
  { id: 1, name: 'Firewall Perimeter', tag: 'THE OUTER DEFENSE', subtitle: 'Every system has a way in.', objective: 'Destroy security relays', target: 3, color: '#c2f66e', difficulty: 'BREACH', description: 'Break through perimeter drones and destroy three security relays to open a path into the network.' },
  { id: 2, name: 'Cryo-Laser Grid', tag: 'THE FROZEN NETWORK', subtitle: 'Stay sharp. Keep moving.', objective: 'Disable cryo nodes', target: 4, color: '#79d9f4', difficulty: 'ESCALATION', description: 'Dodge the pulsing cryo-laser grid and shatter four coolant nodes. Amber beams warn before they fire.' },
  { id: 3, name: 'Mainframe Boss Fight', tag: 'THE HEART OF THE MACHINE', subtitle: 'End the protocol.', objective: 'Break shield emitters', target: 3, color: '#f3a0ac', difficulty: 'CRITICAL', description: 'Destroy three shield emitters, then bring down the ARCHON mainframe. Watch for radial barrages.' },
];
export const UPGRADES = [
  { id: 'damage', name: 'Voltage amplifier', label: 'WEAPON SYSTEM', description: '+25% weapon damage per tier. Make every shot count.', cost: 650, icon: 'weapon', stat: '+25% DAMAGE' },
  { id: 'hull', name: 'Reactive plating', label: 'DEFENSE SYSTEM', description: '+40 maximum integrity per tier. Repairs your hull completely.', cost: 500, icon: 'shield', stat: '+40 INTEGRITY' },
  { id: 'energy', name: 'Quantum capacitor', label: 'OVERCLOCK SYSTEM', description: '+40 energy capacity and faster regeneration per tier.', cost: 550, icon: 'energy', stat: '+40 ENERGY' },
  { id: 'rate', name: 'Synapse accelerator', label: 'FIRING SYSTEM', description: '+20% fire rate per tier. Less waiting, more firepower.', cost: 700, icon: 'rate', stat: '+20% FIRE RATE' },
];
export function freshRun() { return { score: 0, bank: 0, kills: 0, shards: 0, elapsed: 0, damageTaken: 0, upgrades: { damage: 0, hull: 0, energy: 0, rate: 0 }, achievements: [], demo: false }; }
export function getRank(run, victory) {
  if (!victory) return run.score >= 6000 ? 'B' : 'C';
  const value = run.score + Math.max(0, 300 - run.elapsed) * 12 - run.damageTaken * 5;
  return value >= 14000 ? 'S' : value >= 9000 ? 'A' : value >= 4500 ? 'B' : 'C';
}
