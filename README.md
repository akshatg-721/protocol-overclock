# PROTOCOL OVERCLOCK

A complete procedural arena shooter built with Vite, React, and Tailwind CSS. All graphics and sound are generated in the browser; no remote image, audio, or font assets are required.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production bundle with `npm run build`; serve it with `npm run preview`.

Run `npm test` for deterministic simulation checks covering actual wins in all three levels, the boss shield, game over from enemy attacks, abilities, shard collection, upgrade capacities, and every rank.

## Play

- **WASD / arrows:** move.
- **Mouse:** aim; hold the left button to shoot.
- **Space:** hold for Overclock. Enemies and hostile bullets slow by 60%, fire rate doubles, and energy drains. Release to regenerate.
- **Q:** EMP shockwave. Damages nearby enemies and objectives, clears hostile projectiles, and recharges in 12 seconds.
- **Shift / right click:** Cyber Dash with invincibility frames and a three-second cooldown.
- **Bass toggle:** enable the procedural combat bassline from the header.
- **Escape:** pause/resume. Switching away from the browser also pauses gameplay.
- **Touch:** drag the left half of the arena to move; hold the right half to aim/fire. Mobile ability buttons appear below the arena.

Destroy three relays in **Firewall Perimeter**, disable four nodes while dodging telegraphed beams in **Cryo-Laser Grid**, then break three shield emitters and defeat **ARCHON** in **Mainframe Boss Fight**. Cover blocks movement and gunfire until destroyed. Blue data shards restore a little health and energy and award points. Chain kills within four seconds to raise the multiplier up to 8×.

The between-level shop offers three tiers of four upgrades: damage, hull, energy, and fire rate. Credits are spendable; cumulative score is preserved. Score, completion time, and damage taken determine the final S/A/B/C rank. Your high score persists in localStorage when available.

The game launches with a 14-second animated cinematic. Use `[SKIP INTRO]` to skip it, or replay it from the main menu. Browsers require a user gesture to unlock Web Audio: click Enable Transmission Audio or any game control to enable synthesized sound.

## Judge demo

Expand **JUDGE DEMO PANEL** below the game. Launch any level immediately, toggle **Level Select / God Mode** for invulnerability, or complete the current level to inspect the shop and victory flow. Demo completion marks the run as a judge run. Level cards also select an arena from the main menu.

## Source

- `src/App.jsx`: interface, progression, state, and persistence.
- `src/GameCanvas.jsx`: React lifecycle and imperative game controls.
- `src/engine.js`: real-time combat simulation and procedural Canvas rendering.
- `src/audio.js`: Web Audio synthesizer.
- `src/CinematicIntro.jsx`: timed procedural opening and terminal subtitles.
- `src/UpgradeShop.jsx`: four upgrade paths and credit purchases.
- `src/levels.js`: missions, upgrades, new-run state, and rank calculation.
- `src/index.css`: Tailwind import and responsive interface styling.

Project rules are recorded verbatim in `AGENTS.md`.

The armory offers a free tactical perk: Multi-Shot Spread (two half-damage auxiliary bolts), Nanobot Shield (blocks the first hit per sector), or Phase Runner (1.7-second dash cooldown). Pick one and swap it at the next armory. The four-scene cinematic depicts the 2094 lockdown, AETHER drone takeover, operative activation, and glitch breach.
