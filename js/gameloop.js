/**
 * gameloop.js - Main game loop and phase state machine
 * Orchestrates all game systems and coordinates the game lifecycle.
 */

import { createInitialState, saveState, loadState, clearState } from './state.js';
import { createGrid, validatePlacement, placeGem, placeRock, findPath,
         GRID_COLS, GRID_ROWS, CELL_SIZE, ENTRY, CHECKPOINTS, EXIT } from './grid.js';
import { rollGem, getStats, getVisual, GEM_CHANCE_LEVELS, QUALITY_LEVELS } from './gem.js';
import { moveEnemy, GOLD_PER_WAVE } from './enemy.js';
import { WaveSpawner } from './wave.js';
import { attackEnemy, canAttack, isInRange, tickPoison } from './combat.js';
import { render, HUD_HEIGHT } from './renderer.js';
import { InputHandler } from './input.js';
import { drawUI, PANEL_H } from './ui.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let canvas;
let ctx;

let gameState    = null;
let inputHandler = null;
let lastTimestamp = 0;
let waveSpawner  = null;   // active WaveSpawner during defend phase
let groundPath   = null;   // cached A* path for current wave

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  canvas.width  = GRID_COLS * CELL_SIZE;                         // 672
  canvas.height = GRID_ROWS * CELL_SIZE + HUD_HEIGHT + PANEL_H; // 752 + 24 + 46 = 822

  document.getElementById('loading').classList.add('hidden');

  // Load or create state
  const saved = loadState();
  if (saved && confirm('Continue previous game?')) {
    gameState = saved;
    // Ensure new fields exist on loaded saves
    if (gameState.gameOver   === undefined) gameState.gameOver   = false;
    if (gameState.gameWon    === undefined) gameState.gameWon    = false;
    if (!gameState.critNumbers)            gameState.critNumbers = [];
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

  if      (gameState.phase === 'build')   updateBuild(dt, now);
  else if (gameState.phase === 'defend')  updateDefend(dt, now);
  else if (gameState.phase === 'between') updateBetween();

  const HUD_Y = GRID_ROWS * CELL_SIZE; // 752 — grid ends here, HUD starts here
  render(gameState, canvas, HUD_Y);
  drawUI(ctx, gameState, inputHandler.getState());

  if (!gameState.gameOver && !gameState.gameWon) {
    requestAnimationFrame(gameLoop);
  } else {
    drawEndScreen(ctx);
  }
}

// ---------------------------------------------------------------------------
// handleUpgrade — shared between build and defend phases
// ---------------------------------------------------------------------------

function handleUpgrade() {
  const nextLevel = gameState.gemChanceLevel + 1;
  if (nextLevel <= 9) {
    const cost = GEM_CHANCE_LEVELS[nextLevel - 1].cost;
    if (gameState.gold >= cost) {
      gameState.gold -= cost;
      gameState.gemChanceLevel = nextLevel;
    }
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
        lastTargetId: null,
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
        // Convert all non-kept placed gems to permanent rocks, then start wave
        gameState.keptGemId = action.gemId;
        for (const id of gameState.placedThisRound) {
          if (id !== action.gemId) {
            const g = gameState.gems[id];
            if (!g) continue;
            placeRock(gameState.grid, g.x, g.y);
            for (let dy = 0; dy <= 1; dy++) {
              for (let dx = 0; dx <= 1; dx++) {
                gameState.grid[g.y + dy][g.x + dx].gemId = null;
              }
            }
            delete gameState.gems[id];
          }
        }
        gameState.placedThisRound = gameState.placedThisRound.filter(
          id => id === action.gemId
        );
        startDefendPhase(); // wave begins immediately after keeping
        break;
      }

      case 'combine': {
        // Selected gem is always the survivor; find any matching partner
        const survivorId = action.selectedGemId;
        const survivor = survivorId ? gameState.gems[survivorId] : null;
        const removedId = survivor
          ? gameState.placedThisRound.find(id => {
              if (!id || id === survivorId) return false;
              const g = gameState.gems[id];
              return g && g.type === survivor.type && g.quality === survivor.quality;
            })
          : null;
        if (survivorId && removedId) {
          const g1 = gameState.gems[survivorId];
          const g2 = gameState.gems[removedId];
          // Upgrade quality of survivor by one level
          const qi = QUALITY_LEVELS.indexOf(g1.quality);
          g1.quality = QUALITY_LEVELS[Math.min(qi + 1, QUALITY_LEVELS.length - 1)];
          g1.attackCooldown = Math.round(1000 / getStats(g1.type, g1.quality).attackSpeed);
          // Removed gem's position becomes a permanent rock
          placeRock(gameState.grid, g2.x, g2.y);
          for (let dy = 0; dy <= 1; dy++)
            for (let dx = 0; dx <= 1; dx++)
              gameState.grid[g2.y + dy][g2.x + dx].gemId = null;
          delete gameState.gems[removedId];
          // Convert all remaining non-combined gems to rocks, then start wave
          gameState.keptGemId = survivorId;
          for (const id of gameState.placedThisRound) {
            if (id !== survivorId && id !== removedId) {
              const g = gameState.gems[id];
              if (!g) continue;
              placeRock(gameState.grid, g.x, g.y);
              for (let dy = 0; dy <= 1; dy++)
                for (let dx = 0; dx <= 1; dx++)
                  gameState.grid[g.y + dy][g.x + dx].gemId = null;
              delete gameState.gems[id];
            }
          }
          gameState.placedThisRound = [survivorId];
          startDefendPhase();
        }
        break;
      }

      case 'upgrade':
        handleUpgrade();
        break;

      case 'restart':
        clearState();
        location.reload();
        break;

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
  // Check for restart (works in any phase)
  const action = inputHandler.consumeAction();
  if (action?.type === 'restart') { clearState(); location.reload(); return; }
  if (action?.type === 'upgrade') { handleUpgrade(); }

  // Clear last frame's projectiles; expire old crit numbers
  gameState.projectiles = [];
  gameState.critNumbers = gameState.critNumbers.filter(n => now - n.createdAt < 600);

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
      const result = attackEnemy(gem, target, gameState.enemies, now);
      gem.lastTargetId = target.id;
      const color = getVisual(gem.type, gem.quality).color;
      gameState.projectiles.push({
        x1: gem.x * CELL_SIZE,
        y1: gem.y * CELL_SIZE,
        x2: target.x,
        y2: target.y,
        color,
      });
      if (result.crit) {
        gameState.critNumbers.push({ x: target.x, y: target.y - 12, value: result.damage, createdAt: now });
      }

      // Topaz: attack additional targets (all in range, excluding primary)
      const stats = getStats(gem.type, gem.quality);
      if (stats.effect?.type === 'multi') {
        const extras = gameState.enemies
          .filter(e => !e.dead && !e.exited && e !== target && isInRange(gem, e))
          .sort((a, b) => a.hp - b.hp)
          .slice(0, stats.effect.targets - 1);
        for (const extra of extras) {
          const extraResult = attackEnemy(gem, extra, gameState.enemies, now);
          gameState.projectiles.push({ x1: gem.x * CELL_SIZE, y1: gem.y * CELL_SIZE, x2: extra.x, y2: extra.y, color });
          if (extraResult.crit) {
            gameState.critNumbers.push({ x: extra.x, y: extra.y - 12, value: extraResult.damage, createdAt: now });
          }
        }
      }
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
    gameState.projectiles = [];
    gameState.critNumbers = [];
    gameState.phase = 'between';
  }
}

// ---------------------------------------------------------------------------
// findTarget
// ---------------------------------------------------------------------------

function findTarget(gem) {
  // Prio 1: keep attacking current target if still alive and in range
  if (gem.lastTargetId) {
    const current = gameState.enemies.find(
      e => e.id === gem.lastTargetId && !e.dead && !e.exited
    );
    if (current && isInRange(gem, current)) return current;
  }

  // Prio 2: lowest HP enemy in range
  let best = null;
  for (const e of gameState.enemies) {
    if (e.dead || e.exited) continue;
    if (!isInRange(gem, e)) continue;
    if (!best || e.hp < best.hp) best = e;
  }
  return best;
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
    gameState.phase = 'gamewon'; // terminal state — prevents re-entry
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
// Bootstrap
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
