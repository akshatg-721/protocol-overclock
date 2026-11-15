# Hackathon Project Rules: PROTOCOL OVERCLOCK (First Place Target)

## 1. Mandatory Competition Rubric (NEVER VIOLATE)
- **01 Minimum 2 Playable Levels**: Maintain 3 distinct playable levels (Level 1: Firewall Perimeter, Level 2: Cryo-Laser Grid, Level 3: Mainframe Boss Fight) PLUS a collapsible "JUDGE DEMO PANEL" & "Level Select / God Mode" toggle so judges can test any level immediately.
- **02 Cinematic Intro**: The game MUST launch into an automated 12-second HTML5 Canvas/CSS animated cinematic story cutscene with procedural Web Audio synth sound, animated terminal subtitles, progress bar, and a `[SKIP INTRO]` button, plus a "Replay Cinematic" button on the Main Menu.
- **03 Scoring, Reward & Progression**: Maintain a live score counter, High Score in localStorage, dynamic Combo Multiplier (1x-8x), collectible Data Shards, achievement toast popups, and a between-level Upgrade Shop where players spend points on 4 upgrades.
- **04 Clear Objectives & Win/Lose Conditions**: Always display a top-center HUD Mission Objective tracker with live progress (e.g., "Destroy Security Relays: 2/3") and distinct Victory / Game Over summary screens with S/A/B/C Rank calculation.
- **05 Interactive Mechanics**: WASD movement, Mouse-aim shooting with laser sight, SPACEBAR "Overclock Bullet-Time" (slows enemies by 60% and doubles fire rate while draining energy), Q key "EMP Shockwave", and destructible arena cover pylons.
- **06 Originality & Juice**: Zero external image/audio files that can fail to load. Use procedural HTML5 Canvas neon glow (`shadowBlur`), directional particle explosions, hit-stop frames, screen shake, floating damage numbers, and procedural Web Audio API sound effects.

## 2. Coding & Credit Efficiency Rules
- Keep code modular across `src/audio.js`, `src/CinematicIntro.jsx`, `src/GameCanvas.jsx`, `src/UpgradeShop.jsx`, and `src/App.jsx`.
- Always run `npm run build` after changes to verify zero syntax or import errors before finishing a turn.
- Do not block the agent turn with a foreground `npm run dev` process.
