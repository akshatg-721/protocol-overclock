# PROTOCOL OVERCLOCK / AETHER, 2094

A full-viewport tactical arcade shooter built with Vite, React and Tailwind. There is no outer website layout: only the arena, its edge HUDs, title/pause overlays and an in-game Tactical Menu. All graphics, sound and trailer gameplay are procedural; no downloaded media or fonts are required.

## Run and validate

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

## Unlocked sector selection

All sectors are playable immediately from the title cards or the HUD’s **SECTOR: 01 / 02 / 03 / SHOP** shortcuts, without God Mode or previous completions. Direct Sector 02 starts with **250 shards**; Sector 03 starts with **500 shards**. Use SHOP to equip upgrades and redeploy the current sector. Switching sectors starts a fresh run; direct later-sector runs protect campaign Personal Best by counting as practice.

## Options / Tactical Menu

Use **OPTIONS / ESC** from the HUD or trailer, the title/pause Options buttons, or Escape at any time. The menu pauses combat and the trailer, traps keyboard focus, and scrolls internally rather than scrolling the page. Its tabs contain:

- **Mission Directory:** inspect or deploy into any of the three sectors. Direct sector deployment is a practice run.
- **Controls & How to Play:** SVG tactical diagrams for movement/aim, ring breaches, bullet-time, dash/EMP and sector threats. Seven remappable actions update combat, HUD badges and on-canvas prompts immediately. Click an action, then press a key; Escape cancels. Duplicate keys are rejected. Presets: WASD/Space, arrows/Z/X (C = EMP), or left-handed IJKL/Space/Control/O. Reset restores defaults. Bindings persist in `overclock-keybindings-v1`; invalid saved data recovers defaults.
- **Audio & Display:** independent SFX and combat bassline switches, plus native fullscreen. Browser permission restrictions may block native fullscreen; the game still fills its viewport.
- **Judge / God Mode:** Infinite Integrity, +5,000 shards, complete sector, jump to the armory, or replay the trailer. Judge changes taint the run and cannot overwrite legitimate Personal Best. Grants made at the title are applied to the next deployment; a direct armory jump redeploys the current sector with the edited loadout.

## Actual in-engine gameplay trailer

**Establish Neural Link / Enable Audio** awaits successful AudioContext activation before starting a 14-second trailer. Retry or explicitly continue silently if activation fails. Speaker output depends on browser/device configuration.

The trailer instantiates the production engine with isolated demo state and scripted actor inputs. It uses the same renderer, dash, weapons, laser hazards, damage, relay destruction, particles, slow-time, EMP, drones, projectile rings and mortar zones as gameplay:

1. **0–4s / Sector 01 & 02 Breach:** dash afterimages, rotating cryo beams, proximity decryption and armored relay destruction.
2. **4–9s / Weaponize Time:** cyan Overclock distortion, projectile-ring weaving and an EMP swarm wipe with a combo callout.
3. **9–14s / Final Target: AETHER:** camera push, shield tethers, mechanical core, projectile rings and mortar locks, then a glitch into the title overlay.

The camera pans/zooms beneath cinema letterboxes, a timeline and live synth meter. Options pauses the sequence. Skip is always available. The trailer never shares campaign progress or high-score state.

## Controls and encounters

- WASD / arrows move. Mouse aims; hold left click to shoot.
- Shift / right click Cyber Dashes in movement direction (including arrows/touch movement), otherwise in aim direction. Base cooldown 3 seconds, with invulnerability and neon afterimages.
- Hold Space to Overclock: all hostile clocks, movement, rotation, charge/slam timers, mortar fuses, laser cycles, and hostile bullet motion/lifetime run at 40%; firing speed doubles. Release to recharge and release after depletion to rearm.
- Q triggers an EMP: damage nearby enemies/exposed objectives and erase hostile projectiles only inside its expanding 290-unit radius. Amplifier tiers also improve EMP damage.
- Mobile: drag the left arena half to move and hold the right to aim/fire; ability buttons appear along the bottom HUD.

The three mechanically distinct sectors are preserved:

1. **Firewall Perimeter:** approach amber proximity rings for three-second armor decryption. Volatile barrels damage nearby enemies, break relay armor and extend engagement range to 350 units. Every relay cannot be reached from one stationary position.
2. **Cryo-Laser Grid:** dash into a guarded ring or activate Overclock nearby to phase-unlock a node, then decrypt. Every node has a visible power tether to one sweeping hostile laser emitter. Destroying it disables that beam permanently.
3. **AETHER Mainframe:** decrypt and destroy shield emitters, then face predictive plasma/minions, a rotating death beam, and telegraphed overdrive slams with bullet rings and safe pockets. Health-threshold escalations have shielded introductions so attack phases remain visible.

Authored rosters include drones, predictive gunners, red-line Breacher Chargers and Mortar Lobbers with 1.5-second target rings. Floor patterns and cover layouts differ between sectors. Wins remain on canvas for a 2.2-second finale at 25% simulation speed, with cascading explosions, wreckage and automatic salvage recovery.

## Generous shard economy

Inventory shards are the armory currency; cumulative score is never spent.

- Regular enemies: **2–3 cyan crystals**, each worth **20–25 inventory shards**.
- Elite chargers/lobbers: **8–10 crystals** using the same 20–25 value per crystal.
- Each relay/emitter: **35 shards** in a burst.
- Sector clear: **+150 shards**.
- Pickup magnet: **200 world units**; every remaining crystal is collected during the finale.

Level 1 objectives and clear bonus guarantee **255 shards** before enemy loot. A fast route with one ordinary kill earns 295–330, or about 335 with two low-value ordinary drops. Longer combat runs and elite kills deliberately pay more; there is no 350-shard salvage cap. Crystal pickups are currency rather than score farming; the first 24 kills per sector still grant kill score and combos.

All four upgrade paths cost **80 / 140 / 220 shards** for tiers 1 / 2 / 3. The 255-shard base reward buys three first-tier upgrades and leaves 15 shards:

- **Synapse accelerator:** +35% firing speed per tier.
- **Prism split array:** +2 auxiliary half-damage spread bolts per tier; retains amplified central damage 28 / 44 / 66 / 132.
- **Quantum capacitor:** +50% capacity per tier, rounded up: 100 / 150 / 225 / 338 energy.
- **Reactive plating:** +40 maximum hull per tier and a complete heal.

Perks cost **100 shards** each; one equipped at a time. Multi-Shot adds two more auxiliary bolts with a 15% firing-speed penalty. Nanobot Shield blocks a hit and regenerates after 12 combat seconds. Phase Runner reduces dash cooldown to 1.7 seconds and extends invulnerability.

Sector transit repairs 20 HP. Restart restores the sector-entry checkpoint, preserving previous-sector score, inventory, upgrades, perk and hull state. Judge taint survives restarts.

## Rank and records

Rank value = max(0, score + max(0, round((240 − combat seconds) × 12)) − damage taken × 12). Victory S ≥15,000, A ≥10,000, B ≥5,000, otherwise C. Defeat B ≥6,000, otherwise C. Results show the exact formula and fatal threat or cause of termination. Eligible run-end scores save in `overclock-legit-best-v2`; judge shortcuts, grants and God Mode are excluded.

## Verification

`npm test` simulates real gameplay wins, shields/traversal, all boss phases, finale/vacuum, stationary defeat, hazard slowdown, arrow dash, local EMP, new archetypes, shield regeneration, exact prices/drop ranges, first-shop affordability, actual upgraded projectiles/fire rate/capacity, live judge grants and all three real-engine trailer cuts. Browser QA covers viewport geometry, menu tabs/pause, title/pause controls, audio switches, native fullscreen handling, trailer playback, armory grants and purchases, and responsive layouts.
