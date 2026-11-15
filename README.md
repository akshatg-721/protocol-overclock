# PROTOCOL OVERCLOCK / AETHER, 2094

A procedural tactical arena shooter built with Vite, React and Tailwind. No remote graphics, fonts or audio files are used. Canvas supplies the art and Web Audio synthesizes sound.

## Run and validate

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

The cinematic waits at **Establish Neural Link / Enable Audio** until AudioContext resumes successfully. The 14-second, four-scene transmission then starts. Skip remains available; if activation fails, retry or explicitly continue silently. Audio hardware output cannot be guaranteed by a browser application. Bass is toggleable from the header and follows the audio clock; pause and screen changes stop combat music and the Overclock hum.

## Controls

- WASD / arrows: move; mouse: aim and hold left click to shoot.
- Shift / right click: Cyber Dash in movement direction (including arrows and touch movement), or aim direction if stationary. Grants invulnerability and afterimages; base cooldown 3s.
- Space: Overclock. All hostile clocks, boss movement/rotation, charges, mortar fuses, laser cycles and hostile bullet motion/lifetime run at 40%; fire rate doubles. Release after depletion to rearm.
- Q: EMP. Nearby enemies and exposed objectives take damage; the expanding 290-unit wave clears only bullets inside it.
- Escape: pause/resume; losing focus pauses. Mobile has movement/aim areas and ability buttons.

## Three distinct encounters

1. **Firewall Perimeter:** Enter amber rings for a three-second proximity decrypt, then fire while in range. Volatile barrels break armor, damage nearby enemies and extend engagement range to 350 units, still requiring traversal between objectives. Three relays, industrial cable floor and separate cover layout.
2. **Cryo-Laser Grid:** Enter a guarded ring with Dash or activate Overclock nearby to phase-unlock a node, then decrypt its armor. Each node has a gold power tether to its own sweeping hostile emitter. Destroy the node to disable that beam permanently. Four nodes, diamond cryo lattice and corridor cover.
3. **AETHER Core:** Decrypt three shield emitters to cut visible gold tethers. The multi-part core has 6,400 HP and three health-threshold attack phases: predictive plasma/minions, rotating death beam, then telegraphed slams and siege rings with safe pockets. Escalations have brief shielded attack introductions so phases cannot be skipped instantly.

Authored enemy rosters introduce drones, predictive gunners, Breacher Chargers with red aim-line wind-ups, and Mortar Lobbers with 1.5-second area-denial fuses. AETHER also locks artillery onto the player's current position. Standing still cannot reach every objective and is dangerous.

Sector completion starts a **2.2-second on-canvas finale** at 25% simulation speed. Cascading explosions, shockwaves, debris and scorch marks continue, all shards vacuum into the operative, then the shop or victory screen appears. Finale damage is disabled.

## Economy, checkpoints and rank

Upgrades cost spendable credits and shards. Earned score is preserved when spending; shard inventory and total recovered shards are separate. Weapon damage tiers 28 / 44 / 66 / 132 reduce ordinary unboosted drone hits from 5 / 3 / 2 / 1 and gunner hits from 8 / 5 / 4 / 2. Close-range Overclock shots earn deterministic critical damage.

Tactical perks cost 350 credits + 2 shards; only one is equipped:

- Multi-Shot Spread: two half-damage auxiliary bolts, with a 15% fire-rate penalty.
- Nanobot Shield: blocks one hit, regenerates after 12 combat seconds.
- Phase Runner: 1.7-second dash recharge and longer invulnerability.

Each sector's first 24 kills grant score/shards, preventing endless score farming. Only kill awards use the 1×–8× combo; objective, shard and completion bonuses use accurate base-value popups. Relays drop three shards. Transit repairs 20 HP; plating purchases completely repair the upgraded hull. Restart Level restores that sector's entry checkpoint, including health, score, inventory, upgrades and perk. Judge taint cannot be undone by restarting.

Rank value = max(0, score + max(0, round((240 − combat seconds) × 12)) − damage taken × 12). Victory S ≥15,000, A ≥10,000, B ≥5,000, otherwise C. Defeat B ≥6,000, otherwise C. Results show the exact components and fatal threat or cause of termination. Eligible run-end scores save in `overclock-legit-best-v2`; legacy scores are intentionally not imported because prior versions allowed demo-score contamination. God Mode, direct level shortcuts and judge completion are excluded.

Expand **JUDGE DEMO PANEL** to select any level, toggle God Mode or complete a sector. Judge completion preserves the finale and shard recovery so progression screens can be reviewed.

## Verification

`npm test` simulates the real engine deterministically: shields and traversal, combat wins in every sector, all boss phases, finale delay/vacuum, stationary defeat and fatal cause, global hazard slow time, arrow dash, local EMP, enemy archetypes, shield regeneration, dual-currency purchases, weapon breakpoints, score eligibility and rank math. Browser QA covers the audio boot, gameplay displays, finale/shop flow, purchases, checkpoint restart and summaries.
