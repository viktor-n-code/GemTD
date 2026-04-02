/**
 * gameloop.js - Main game loop and phase state machine
 * Orchestrates all game systems and coordinates the game lifecycle.
 */

import { createInitialState, saveState, loadState, clearState } from './state.js';
import { createGrid, validatePlacement, placeGem, placeRock, findPath,
         GRID_COLS, GRID_ROWS, CELL_SIZE, ENTRY, CHECKPOINTS, EXIT } from './grid.js';
import { rollGem, getStats, GEM_CHANCE_LEVELS } from './gem.js';
import { moveEnemy, GOLD_PER_WAVE } from './enemy.js';
import { WaveSpawner } from './wave.js';
import { attackEnemy, canAttack, isInRange, tickPoison } from './combat.js';
import { render } from './renderer.js';
import { InputHandler } from './input.js';
import { drawUI } from './ui.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');

let gameState    = null;
let inputHandler = null;
let lastTimestamp = 0;
let waveSpawner  = null;   // active WaveSpawner during defend phase
let groundPath   = null;   // cached A* path for current wave

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

function init() {
  canvas.width  = GRID_COLS * CELL_SIZE;   // 672
  canvas.height = GRID_ROWS * CELL_SIZE;   // 752

  document.getElementById('loading').classList.add('hidden');

  // Load or create state
  const saved = loadState();
  if (saved && confirm('Continue previous game?')) {
    gameState = saved;
    // Ensure new fields exist on loaded saves
    if (gameState.gameOver  === undefined) gameState.gameOver  = false;
    if (gameState.gameWon   === undefined) gameState.gameWon   = false;
  } else {
    clearState();
    gameState = createInitialState();
  }

  // Grid is not serialisable (circular-ish structure), rebuild it each time
  gameState.grid = createGrid();

  inputHandler = new InputHandler(canvas);

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// gameLoop
// ---------------------------------------------------------------------------

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // cap at 100 ms
  lastTimestamp = timestamp;

  const now = timestamp; // rAF timestamp in ms

  inputHandler.update(gameState);

  if (gameState.phase === 'build')   updateBuild(dt, now);
  if (gameState.phase === 'defend')  updateDefend(dt, now);
  if (gameState.phase === 'between') updateBetween();

  render(gameState, canvas);
  const ctx = canvas.getContext('2d');
  drawUI(ctx, gameState, inputHandler.getState());

  if (!gameState.gameOver && !gameState.gameWon) {
    requestAnimationFrame(gameLoop);
  } else {
    drawEndScreen(ctx);
  }
}

// ---------------------------------------------------------------------------
// updateBuild
// ---------------------------------------------------------------------------

function updateBuild(dt, now) {
  // --- Placement ---
  const placement = inputHandler.consumePlacement();
  if (placement && gameState.placedThisRound.length < 5) {
    const { x, y } = placement;
    if (validatePlacement(gameState.grid, x, y)) {
      const { type, quality } = rollGem(gameState.gemChanceLevel);
      const id = `gem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const stats = getStats(type, quality);
      gameState.gems[id] = {
        id, type, quality, x, y,
        kills: 0, totalDamage: 0,
        lastAttackTime: 0,
        attackCooldown: Math.round(1000 / stats.attackSpeed),
      };
      placeGem(gameState.grid, x, y, id);
      gameState.placedThisRound.push(id);
    }
  }

  // --- Actions ---
  const action = inputHandler.consumeAction();
  if (action) {
    switch (action.type) {

      case 'keep': {
        // Mark all non-kept placed gems as permanent rocks
        gameState.keptGemId = action.gemId;
        for (const id of gameState.placedThisRound) {
          if (id !== action.gemId) {
            const g = gameState.gems[id];
            if (!g) continue;
            // Convert gem cells to rock
            placeRock(gameState.grid, g.x, g.y);
            // placeRock sets type but not gemId — clear gemId references explicitly
            for (let dy = 0; dy <= 1; dy++) {
              for (let dx = 0; dx <= 1; dx++) {
                gameState.grid[g.y + dy][g.x + dx].gemId = null;
              }
            }
            delete gameState.gems[id];
          }
        }
        // Keep only the kept gem in placedThisRound so the slot UI stays clean
        gameState.placedThisRound = gameState.placedThisRound.filter(
          id => id === action.gemId
        );
        break;
      }

      case 'combine': {
        // Auto-combine: find first pair of same-type gems in placedThisRound
        const QUALITY_LEVELS = ['chipped', 'flawed', 'standard', 'flawless', 'perfect'];
        const byType = {};
        for (const id of gameState.placedThisRound) {
          const g = gameState.gems[id];
          if (!g) continue;
          if (!byType[g.type]) byType[g.type] = [];
          byType[g.type].push(id);
        }
        for (const type of Object.keys(byType)) {
          if (byType[type].length >= 2) {
            const [id1, id2] = byType[type];
            const g1 = gameState.gems[id1];
            const g2 = gameState.gems[id2];
            // Upgrade quality of g1 by one level
            const qi = QUALITY_LEVELS.indexOf(g1.quality);
            const newQuality = QUALITY_LEVELS[Math.min(qi + 1, 4)];
            g1.quality = newQuality;
            const newStats = getStats(g1.type, newQuality);
            g1.attackCooldown = Math.round(1000 / newStats.attackSpeed);
            // g2 position becomes a permanent rock
            placeRock(gameState.grid, g2.x, g2.y);
            for (let dy = 0; dy <= 1; dy++) {
              for (let dx = 0; dx <= 1; dx++) {
                gameState.grid[g2.y + dy][g2.x + dx].gemId = null;
              }
            }
            delete gameState.gems[id2];
            gameState.placedThisRound = gameState.placedThisRound.filter(
              id => id !== id2
            );
            break; // only one combine per action
          }
        }
        break;
      }

      case 'upgrade': {
        const nextLevel = gameState.gemChanceLevel + 1;
        if (nextLevel <= 9) {
          const cost = GEM_CHANCE_LEVELS[nextLevel - 1].cost;
          if (gameState.gold >= cost) {
            gameState.gold -= cost;
            gameState.gemChanceLevel = nextLevel;
          }
        }
        break;
      }

      case 'sendWave': {
        if (gameState.keptGemId !== null) {
          startDefendPhase();
        }
        break;
      }

      // selectGem is purely a UI selection — no game-state change needed here
      case 'selectGem':
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// startDefendPhase
// ---------------------------------------------------------------------------

function startDefendPhase() {
  gameState.wave += 1;
  gameState.phase = 'defend';

  // Compute ground path once (all ground enemies share it)
  groundPath = computeFullPath(gameState.grid);

  // Create wave spawner
  waveSpawner = new WaveSpawner(gameState.wave, groundPath);

  // Reset round state
  gameState.placedThisRound = [];
  gameState.keptGemId = null;
  inputHandler.resetBuildState();
}

// ---------------------------------------------------------------------------
// computeFullPath
// ---------------------------------------------------------------------------

function computeFullPath(grid) {
  const waypoints = [ENTRY, ...CHECKPOINTS, EXIT];
  const fullPath = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segment = findPath(grid, waypoints[i], waypoints[i + 1]);
    if (!segment) return null;
    // Avoid duplicating junction points between segments
    if (fullPath.length > 0) segment.shift();
    fullPath.push(...segment);
  }
  return fullPath;
}

// ---------------------------------------------------------------------------
// updateDefend
// ---------------------------------------------------------------------------

function updateDefend(dt, now) {
  // 1. Spawn
  const newEnemy = waveSpawner.update(dt);
  if (newEnemy) gameState.enemies.push(newEnemy);

  // 2. Move + tick poison
  for (const e of gameState.enemies) {
    if (e.dead || e.exited) continue;
    moveEnemy(e, dt, now);
    tickPoison(e, dt, now);
    if (e.exited) {
      gameState.lives -= 1;
      if (gameState.lives <= 0) {
        gameState.gameOver = true;
        return;
      }
    }
  }

  // 3. Gem attacks
  for (const gem of Object.values(gameState.gems)) {
    if (!canAttack(gem, now)) continue;
    const target = findTarget(gem);
    if (target) {
      attackEnemy(gem, target, gameState.enemies, now);
    }
  }

  // 4. Award gold for kills, then remove dead/exited enemies
  const killGold = GOLD_PER_WAVE[gameState.wave - 1].killGold;
  for (const e of gameState.enemies) {
    if (e.dead) {
      gameState.gold += killGold;
    }
  }
  gameState.enemies = gameState.enemies.filter(e => !e.dead && !e.exited);

  // 5. Check wave end
  if (waveSpawner.isComplete() && gameState.enemies.length === 0) {
    gameState.phase = 'between';
  }
}

// ---------------------------------------------------------------------------
// findTarget
// ---------------------------------------------------------------------------

function findTarget(gem) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const e of gameState.enemies) {
    if (e.dead || e.exited) continue;
    if (!isInRange(gem, e)) continue;
    const dx = e.x - gem.x * CELL_SIZE;
    const dy = e.y - gem.y * CELL_SIZE;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = e;
    }
  }
  return nearest;
}

// ---------------------------------------------------------------------------
// updateBetween
// ---------------------------------------------------------------------------

function updateBetween() {
  const bonus = GOLD_PER_WAVE[gameState.wave - 1].bonusGold;
  gameState.gold += bonus;

  saveState(gameState);

  if (gameState.wave >= 10) {
    gameState.gameWon = true;
    return;
  }

  gameState.phase = 'build';
}

// ---------------------------------------------------------------------------
// drawEndScreen
// ---------------------------------------------------------------------------

function drawEndScreen(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const msg = gameState.gameWon ? 'You Win!' : 'Game Over';
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '18px Arial';
  ctx.fillText('Refresh to play again', canvas.width / 2, canvas.height / 2 + 24);
}

// ---------------------------------------------------------------------------
// handleResize
// ---------------------------------------------------------------------------

function handleResize() {
  // Canvas internal resolution is fixed; CSS handles display scaling.
  // Nothing to do here — the canvas max-width/max-height CSS already scales it.
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('resize', handleResize);
