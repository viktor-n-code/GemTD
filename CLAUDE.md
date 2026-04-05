# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gem TD** is a browser-based tower defense game in vanilla JavaScript (no build tools, no dependencies). Players place gem towers on a 42×47 grid to defend against 34 waves of enemies. Each round has a build phase (roll 5 gems, keep 1) and a defend phase.

## Git Workflow

- `master` — read-only for Claude; game design data and docs only
- `feature/demo` — main dev branch; all source code; Claude never pushes here directly (no exceptions)
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

## Running the Game

No build step required. Serve files over HTTP:

```bash
# From the feature/demo worktree (where all source lives)
cd .worktrees/demo
python -m http.server 8080
# Then open http://localhost:8080
```

The `master` branch contains only game design data files. All implementation is on the `feature/demo` branch in `.worktrees/demo/`.

## Repository Structure

Source code lives in `.worktrees/demo/` (git worktree for the `feature/demo` branch):

```
.worktrees/demo/
├── index.html          — Entry point, loads gameloop.js as ES module
└── js/
    ├── gameloop.js     — Main orchestrator: init(), gameLoop(timestamp), handleResize()
    ├── state.js        — Game state: createInitialState(), saveState(), loadState()
    ├── grid.js         — Grid data structure + A* pathfinding (most complete module)
    ├── gem.js          — Gem types, quality levels, rolling mechanics
    ├── enemy.js        — Enemy definitions and movement
    ├── wave.js         — Wave scheduling and enemy spawning
    ├── combat.js       — Damage calculations and status effects
    ├── renderer.js     — Canvas rendering
    ├── ui.js           — HUD (gold, lives, wave info)
    └── input.js        — Mouse/keyboard event handling
```

Game design data (in root and worktree):
- `gemtd_rules.txt` — Complete game mechanics
- `gemtd_gemstats.txt` — All gem stats (damage, speed, range, abilities) for 8 types × 8 qualities
- `gemtd_enemystats.txt` — Enemy HP/armor/speed for waves 1–34
- `gemtd_gemchances.txt` — Gem rarity probabilities across 9 upgrade levels
- `gemtd_gold.txt` — Gold income per wave
- `gemtd_lifebuy.txt` — Extra life costs

## Architecture & Key Details

**Grid system** (`grid.js` — most complete, ~372 lines):
- 1-indexed 2D array: `grid[y][x]`, dimensions GRID_COLS=42, GRID_ROWS=47, CELL_SIZE=16px
- Cell types: `'empty'`, `'rock'`, `'gem'`, `'blocked'`
- Entry: (1, 9), Exit: (42, 38), with 6 checkpoints
- Towers occupy 2×2 blocks; placement validates that the enemy path remains unblocked
- A* pathfinding uses a min-heap; `findPath()` returns null if path is blocked

**Game state** (`state.js`):
- `createInitialState()` returns: `{ gold, lives, currentWave, gems, enemies, grid, gemChanceLevel, placedThisRound, keptGemId, projectiles }`

**Data flow per frame:**
1. `gameloop.js` drives the loop
2. `input.js` captures player actions → updates state
3. `wave.js` / `enemy.js` advance enemy positions
4. `combat.js` resolves tower attacks
5. `renderer.js` + `ui.js` draw canvas

## Implementation Status

- ✅ Grid data structure with A* pathfinding and placement validation
- ✅ Game state structure
- ⏳ Game loop, gem system, enemy movement, combat, rendering, UI, input — all stubbed with TODO comments

All stubs are in `.worktrees/demo/js/`. Game mechanics are fully specified in the design data files.

## Gem Types & Qualities

8 gem types: Amethyst, Diamond, Topaz, Sapphire, Ruby, Aquamarine, Opal, Emerald  
8 quality levels: Chipped → Flawed → Normal → Fine → Superior → Magnificent (+ 2 more)  
Type bonuses: e.g., Amethyst deals 150% damage to flying enemies. See `gemtd_gemstats.txt` for full stats.
