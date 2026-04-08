# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gem TD** is a browser-based tower defense game in vanilla JavaScript (no build tools, no dependencies). Players place gem towers on a 42×47 grid to defend against endless waves of enemies. Each round has a build phase (roll 5 gems, keep/combine 1) and a defend phase. The game runs on GitHub Pages from the `feature/demo` branch.

## Git Workflow

- `master` — game design data and reference docs only
- `feature/demo` — **production branch**; all source code; serves GitHub Pages; Claude never pushes here directly (no exceptions)
- `feature/<topic>` — short-lived branches cut from `feature/demo`, merged back via GitHub PR

**Starting a feature:**
```bash
cd C:/claude-projects/gem-td/.worktrees/demo
git checkout feature/demo && git pull origin feature/demo
git checkout -b feature/<topic>
git push -u origin feature/<topic>
```

**Commits:** One logical change per commit, imperative mood subject line. The body must explain *what* changed and *why* — enough that the git log serves as a readable changelog. Include the user-visible effect where relevant.

- Good subject: `Attribute poison DoT damage and kills to the Emerald gem`
- Good body: `Enemies now track poisonGemId so tickPoison can credit the source Emerald with damage dealt and kills. Fixes kills/totalDamage never updating for Emerald when enemies die to DoT.`
- Poor: `Fix bug` / `Update ui.js` / `Bump version to v0.9.1`

**Pushing:** Claude proposes a push when a logical stopping point is reached: "Ready to push `feature/<topic>`. Approve?" On approval, Claude pushes. User opens and merges the PR on GitHub.

**After merge:**
```bash
git checkout feature/demo && git pull origin feature/demo
git branch -d feature/<topic>
git push origin --delete feature/<topic>
```

**Continuing work:** If there is an open feature branch for related work, continue committing on that branch instead of creating a new one. Only create a new branch when the work is genuinely unrelated.

## Running the Game

No build step required. Serve files over HTTP:

```bash
# From the feature/demo worktree (where all source lives)
cd .worktrees/demo
python -m http.server 8080
# Then open http://localhost:8080
```

## Repository Structure

Source code lives in `.worktrees/demo/` (git worktree for the `feature/demo` branch):

```
.worktrees/demo/
├── index.html          — Entry point, loads gameloop.js as ES module
├── CLAUDE.md           — This file
├── gemtd_dps_table.md  — DPS reference tables for all gems
└── js/
    ├── gameloop.js     — Main orchestrator: init(), gameLoop(), phase state machine
    ├── state.js        — Game state: createInitialState(), saveState(), loadState()
    ├── grid.js         — Grid data structure + A* pathfinding
    ├── gem.js          — Gem types, 6 quality tiers, rolling mechanics, level scaling
    ├── specialgem.js   — Special gem definitions, recipes, level scaling
    ├── enemy.js        — Enemy stats (waves 1-36 + infinite scaling), spawning
    ├── wave.js         — Wave scheduling and enemy spawning
    ├── combat.js       — Damage calculations, crit, splash, effects, stun immunity
    ├── renderer.js     — Canvas rendering (grid, gems, enemies, projectiles, auras)
    ├── ui.js           — DOM info panel + canvas HUD (buttons, tooltips, gem stats)
    └── input.js        — Mouse/keyboard event handling
```

Game design data (in master branch root):
- `gemtd_rules.txt` — Complete game mechanics
- `gemtd_gemstats.txt` — Gem stats for 8 types × quality tiers
- `gemtd_enemystats.txt` — Enemy HP/armor/speed for waves 1–34
- `gemtd_gemchances.txt` — Gem rarity probabilities across 9 upgrade levels
- `gemtd_gold.txt` — Gold income per wave
- `gemtd_lifebuy.txt` — Extra life costs
- `enemy_scaling_high_level.txt` — Infinite wave scaling rules

## Architecture & Key Details

**Grid system** (`grid.js`):
- 1-indexed 2D array: `grid[y][x]`, dimensions GRID_COLS=42, GRID_ROWS=47, CELL_SIZE=16px
- Cell types: `'empty'`, `'rock'`, `'gem'`, `'blocked'`
- Entry: (1, 9), Exit: (42, 38), with 6 checkpoints
- Towers occupy 2×2 blocks; placement validates that the enemy path remains unblocked
- A* pathfinding uses a min-heap; `findPath()` returns null if path is blocked

**Gem system** (`gem.js`, `specialgem.js`):
- 8 types: Amethyst, Diamond, Topaz, Sapphire, Ruby, Aquamarine, Opal, Emerald
- 6 quality tiers: Chipped → Flawed → Standard → Flawless → Perfect → Great
- Great gems obtained through 2-combine (2× Perfect) or 4-combine (4× Flawless)
- 13 special gem chains with upgrade tiers, created by combining specific base gems
- Level scaling: +10% damage per level (every 10 kills), plus per-type effect scaling
- MVP system: +1% permanent damage bonus to the highest-damage gem each wave

**Combat** (`combat.js`):
- Effects: poison, slow, splash, crit, multi-target, burn aura, armor debuff, stun, nova
- Level + MVP bonuses are additive; damage aura is multiplicative on top
- No slow exceeds 50%; no splash/nova radius scaling; crit chance is fixed (only multiplier scales)
- Stun immunity on every 50th wave

**Waves** (`enemy.js`, `wave.js`):
- Waves 1-36: hand-designed stats; waves 37+: scaling function
- HP: 45000 × (1 + (wave-30) × 10%); flying waves (every 4th) = HP ÷ 3
- Armor caps at 20 (60% reduction); speed caps at 1.5; minSpeed = 50% of speed
- Endless — game ends only when lives reach 0

**Player actions:**
- Build phase: place 5 gems, keep/combine/4-combine one, repick (costs gold)
- Defend phase: downgrade kept gem (one-time), buy extra life
- Both phases: buy extra life, upgrade gem chance level

**Game state** (`state.js`):
- Persisted to localStorage; migrations handle fields added across versions
