/**
 * gameloop.js - Main game loop and phase state machine
 * Orchestrates all game systems and coordinates the game lifecycle.
 */

import { createInitialState, saveState, loadState, clearState } from './state.js';
import { createGrid, validatePlacement, placeGem, placeRock, removeRock, findPath,
         GRID_COLS, GRID_ROWS, CELL_SIZE, ENTRY, CHECKPOINTS, EXIT } from './grid.js';
import { rollGem, getStats, getLeveledStats, getVisual, GEM_CHANCE_LEVELS, QUALITY_LEVELS } from './gem.js';
import { SPECIAL_GEM_DEFS, getSpecialGemLeveledStats, getSpecialVisual, findAvailableRecipes } from './specialgem.js';
import { moveEnemy, GOLD_PER_WAVE } from './enemy.js';
import { WaveSpawner } from './wave.js';
import { attackEnemy, canAttack, isInRange, tickPoison, getGemStats } from './combat.js';
import { render, HUD_HEIGHT } from './renderer.js';
import { InputHandler } from './input.js';
import { drawUI, updateInfoPanel, PANEL_H } from './ui.js';

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

  // Sync info panel height to canvas
  const infoPanel = document.getElementById('info-panel');
  if (infoPanel) infoPanel.style.height = canvas.height + 'px';

  document.getElementById('loading').classList.add('hidden');

  // Load or create state
  const saved = loadState();
  if (saved && confirm('Continue previous game?')) {
    gameState = saved;
    // Ensure new fields exist on loaded saves
    if (gameState.gameOver   === undefined) gameState.gameOver   = false;
    if (gameState.gameWon    === undefined) gameState.gameWon    = false;
    if (!gameState.critNumbers)            gameState.critNumbers = [];
    if (!gameState.gemCounters) gameState.gemCounters = {};
    for (const gem of Object.values(gameState.gems || {})) {
      if (gem.level       === undefined) gem.level       = 1;
      if (gem.auraBonus   === undefined) gem.auraBonus   = 0;
      if (gem.roundDamage === undefined) gem.roundDamage = 0;
      if (gem.mvpBonus    === undefined) gem.mvpBonus    = 0;
      if (!gem.name) {
        const k = `${gem.quality}_${gem.type}`;
        gameState.gemCounters[k] = (gameState.gemCounters[k] || 0) + 1;
        gem.name = `${gem.quality} ${gem.type} ${gameState.gemCounters[k]}`;
      }
    }
    for (const enemy of (gameState.enemies || [])) {
      if (enemy.poisonGemId === undefined) enemy.poisonGemId = null;
    }
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
  updateInfoPanel(gameState, inputHandler.getState());

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
        name: null, // assigned in startDefendPhase once quality is final
        level: 1,
        kills: 0, totalDamage: 0, roundDamage: 0,
        mvpBonus: 0,
        lastAttackTime: 0,
        attackCooldown: Math.round(1000 / stats.attackSpeed),
        auraBonus: 0,
        lastTargetId: null,
      };
      placeGem(gameState.grid, x, y, id);
      gameState.placedThisRound.push(id);
      applyAuraBuffs(gameState); // update aura bonuses after each placement
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
          g1.attackCooldown = Math.round(1000 / getLeveledStats(g1.type, g1.quality, g1.level || 1).attackSpeed);
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

      case 'combineSpecial': {
        _handleCombineSpecial(action.selectedGemId, 'build');
        break;
      }

      case 'upgradeSpecial': {
        _handleUpgradeSpecial(action.gemId);
        break;
      }

      case 'removeRock': {
        removeRock(gameState.grid, action.x, action.y);
        applyAuraBuffs(gameState);
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
// applyAuraBuffs
// ---------------------------------------------------------------------------

/**
 * Resets every gem's attackCooldown to its base value, then applies the
 * strongest Opal aura in range. Called after gem placement and at wave start.
 * Stores gem.auraBonus (0 if none) so the stats panel can show boosted speed.
 */
function applyAuraBuffs(state) {
  // 1. Reset to base (leveled) cooldown and clear previous aura bonus
  for (const gem of Object.values(state.gems)) {
    const ls = getGemStats(gem);
    gem.auraBonus      = 0;
    gem.attackCooldown = Math.round(1000 / ls.attackSpeed);
  }

  // 2. Apply strongest aura from any Opal in range (no stacking)
  for (const opal of Object.values(state.gems)) {
    const opalStats = getGemStats(opal);
    if (opalStats.effect?.type !== 'aura') continue;
    const { bonus, auraRange } = opalStats.effect;
    const radiusPx = auraRange * (CELL_SIZE / 15);
    const opx = opal.x * CELL_SIZE;
    const opy = opal.y * CELL_SIZE;
    for (const gem of Object.values(state.gems)) {
      const dx = gem.x * CELL_SIZE - opx;
      const dy = gem.y * CELL_SIZE - opy;
      if (Math.sqrt(dx * dx + dy * dy) <= radiusPx && bonus > gem.auraBonus) {
        gem.auraBonus = bonus;
        const ls = getGemStats(gem);
        gem.attackCooldown = Math.round(1000 / (ls.attackSpeed * (1 + bonus)));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// _handleCombineSpecial
// ---------------------------------------------------------------------------

/**
 * Executes a special gem combine for the given master gem.
 * Picks the first completable recipe for that gem, sums kills/damage/mvpBonus
 * from all ingredients into the master, converts ingredient gems to rocks,
 * and (in build phase) also converts any remaining placed gems to rocks then
 * starts the defend phase.
 *
 * @param {string} selectedGemId — the master gem (transform destination)
 * @param {'build'|'defend'} phase
 */
function _handleCombineSpecial(selectedGemId, phase) {
  const recipes = findAvailableRecipes(
    selectedGemId, gameState.gems, gameState.placedThisRound, phase
  );
  if (recipes.length === 0) return;

  const { def, ingredientIds } = recipes[0];
  const master = gameState.gems[selectedGemId];
  if (!master) return;

  // Gather all participants: master + all non-master ingredients
  const partnerIds = ingredientIds.filter(id => id !== selectedGemId);
  const allParticipants = [master, ...partnerIds.map(id => gameState.gems[id]).filter(Boolean)];

  // Sum stats from all participants
  const totalKills = allParticipants.reduce((s, g) => s + (g.kills || 0), 0);
  const totalDmg   = allParticipants.reduce((s, g) => s + (g.totalDamage || 0), 0);
  const totalMvp   = allParticipants.reduce((s, g) => s + (g.mvpBonus || 0), 0);
  const newLevel   = Math.max(1, Math.floor(totalKills / 10) + 1);

  // Transform master gem into the special gem
  const sStats = getSpecialGemLeveledStats(def.id, newLevel);
  master.type        = 'special';
  master.specialType = def.id;
  master.quality     = null;
  master.kills       = totalKills;
  master.totalDamage = totalDmg;
  master.mvpBonus    = totalMvp;
  master.level       = newLevel;
  master.attackCooldown = Math.round(1000 / sStats.attackSpeed);

  // Name: 'Jade', or 'Jade 2' if a second one exists
  const nameKey = `special_${def.id}`;
  gameState.gemCounters[nameKey] = (gameState.gemCounters[nameKey] || 0) + 1;
  master.name = gameState.gemCounters[nameKey] === 1
    ? def.name
    : `${def.name} ${gameState.gemCounters[nameKey]}`;

  // Remove ingredient gems (non-master) → rocks
  for (const id of partnerIds) {
    const g = gameState.gems[id];
    if (!g) continue;
    placeRock(gameState.grid, g.x, g.y);
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = 0; dx <= 1; dx++)
        gameState.grid[g.y + dy][g.x + dx].gemId = null;
    delete gameState.gems[id];
    gameState.placedThisRound = gameState.placedThisRound.filter(i => i !== id);
  }

  if (phase === 'build') {
    // Convert any remaining placed-this-round gems (non-master) to rocks
    for (const id of [...gameState.placedThisRound]) {
      if (id === selectedGemId) continue;
      const g = gameState.gems[id];
      if (!g) continue;
      placeRock(gameState.grid, g.x, g.y);
      for (let dy = 0; dy <= 1; dy++)
        for (let dx = 0; dx <= 1; dx++)
          gameState.grid[g.y + dy][g.x + dx].gemId = null;
      delete gameState.gems[id];
    }
    gameState.keptGemId = selectedGemId;
    startDefendPhase();
  } else {
    applyAuraBuffs(gameState);
    saveState(gameState);
  }
}

// ---------------------------------------------------------------------------
// _handleUpgradeSpecial
// ---------------------------------------------------------------------------

/**
 * Upgrades a special gem to its next tier using gold.
 * Carries over all stats (kills, damage, level, mvpBonus); only the name
 * and base attack stats change.
 *
 * @param {string} gemId
 */
function _handleUpgradeSpecial(gemId) {
  const gem = gameState.gems[gemId];
  if (!gem || gem.type !== 'special') return;

  const def = SPECIAL_GEM_DEFS.find(d => d.id === gem.specialType);
  if (!def?.upgradeTo || !def.upgradeCost) return;
  if (gameState.gold < def.upgradeCost) return;

  gameState.gold -= def.upgradeCost;
  gem.specialType = def.upgradeTo;

  const nextDef = SPECIAL_GEM_DEFS.find(d => d.id === gem.specialType);
  gem.name = nextDef.name; // name changes; no counter increment

  const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
  gem.attackCooldown = Math.round(1000 / sStats.attackSpeed);

  applyAuraBuffs(gameState);
  saveState(gameState);
}

// ---------------------------------------------------------------------------
// startDefendPhase
// ---------------------------------------------------------------------------

function startDefendPhase() {
  gameState.wave += 1;
  gameState.phase = 'defend';

  // Compute ground path once (all ground enemies share it)
  groundPath = computeFullPath(gameState.grid);

  // Apply Opal aura bonuses to attack cooldowns before wave begins
  applyAuraBuffs(gameState);

  // Create wave spawner
  waveSpawner = new WaveSpawner(gameState.wave, groundPath);

  // Assign final name to the kept gem now that its quality is settled.
  // Skip special gems — they are named at combine time.
  const keptGem = gameState.gems[gameState.keptGemId];
  if (keptGem && keptGem.type !== 'special') {
    const k = `${keptGem.quality}_${keptGem.type}`;
    gameState.gemCounters[k] = (gameState.gemCounters[k] || 0) + 1;
    keptGem.name = `${keptGem.quality} ${keptGem.type} ${gameState.gemCounters[k]}`;
  }

  // Reset per-round damage counters for all active gems
  for (const gem of Object.values(gameState.gems)) {
    gem.roundDamage = 0;
  }

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
// _checkLevelUp
// ---------------------------------------------------------------------------

/**
 * Checks if a gem has earned enough kills to level up, and applies the level-up
 * if so. Returns true if a level-up occurred so the caller can trigger side effects.
 * Called after each kill credit in updateDefend.
 */
function _checkLevelUp(gem) {
  const expectedLevel = Math.floor(gem.kills / 10) + 1;
  if (expectedLevel > gem.level) {
    gem.level = expectedLevel;
    // Re-run full aura pass: if this gem is an Opal its increased bonus must
    // propagate to nearby gems; if it's any other gem its new base speed must
    // be combined with whatever aura is currently in range.
    applyAuraBuffs(gameState);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// updateDefend
// ---------------------------------------------------------------------------

function updateDefend(dt, now) {
  // Check for actions (restart, upgrade, special gem combine/upgrade)
  const action = inputHandler.consumeAction();
  if (action?.type === 'restart') { clearState(); location.reload(); return; }
  if (action?.type === 'upgrade') { handleUpgrade(); }
  if (action?.type === 'combineSpecial')  { _handleCombineSpecial(action.selectedGemId, 'defend'); }
  if (action?.type === 'upgradeSpecial')  { _handleUpgradeSpecial(action.gemId); }

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
    const poisonResult = tickPoison(e, dt, now);
    if (poisonResult.damage > 0 && e.poisonGemId) {
      const pg = gameState.gems[e.poisonGemId];
      if (pg) {
        pg.totalDamage  += poisonResult.damage;
        pg.roundDamage  += poisonResult.damage;
        if (poisonResult.killed) {
          pg.kills++;
          _checkLevelUp(pg);
        }
      }
    }
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
      gem.totalDamage  += result.damage + result.splashDamage;
      gem.roundDamage  += result.damage + result.splashDamage;
      if (target.dead) gem.kills++;
      gem.kills += result.splashKills;
      _checkLevelUp(gem);

      const color = gem.type === 'special'
        ? getSpecialVisual(gem.specialType).color
        : getVisual(gem.type, gem.quality).color;
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
      if (result.goldAmount > 0) {
        gameState.gold += result.goldAmount;
        gameState.critNumbers.push({ x: target.x, y: target.y - 24, value: `+${result.goldAmount}g`, createdAt: now, color: [255, 215, 0] });
      }

      // Multi-target: Topaz and Malachite family attack additional enemies
      const stats = getGemStats(gem);
      if (stats.effect?.type === 'multi') {
        const extras = gameState.enemies
          .filter(e => !e.dead && !e.exited && e !== target && isInRange(gem, e))
          .sort((a, b) => a.hp - b.hp)
          .slice(0, stats.effect.targets - 1);
        for (const extra of extras) {
          const extraResult = attackEnemy(gem, extra, gameState.enemies, now);
          gem.totalDamage  += extraResult.damage;
          gem.roundDamage  += extraResult.damage;
          if (extra.dead) { gem.kills++; _checkLevelUp(gem); }
          gameState.projectiles.push({ x1: gem.x * CELL_SIZE, y1: gem.y * CELL_SIZE, x2: extra.x, y2: extra.y, color });
          if (extraResult.crit) {
            gameState.critNumbers.push({ x: extra.x, y: extra.y - 12, value: extraResult.damage, createdAt: now });
          }
        }
      }
    }
  }

  // 3b. Red Crystal: passive armor aura debuffs flying enemies within range
  for (const gem of Object.values(gameState.gems)) {
    if (gem.type !== 'special') continue;
    const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
    if (sStats?.effect?.type !== 'air_crystal') continue;
    const auraRadiusPx = sStats.effect.auraRange * (CELL_SIZE / 15);
    const armorAmt     = sStats.effect.armorAura;
    const gemCx = gem.x * CELL_SIZE;
    const gemCy = gem.y * CELL_SIZE;
    for (const enemy of gameState.enemies) {
      if (enemy.dead || enemy.exited || !enemy.flying) continue;
      const dx = enemy.x - gemCx;
      const dy = enemy.y - gemCy;
      if (Math.sqrt(dx * dx + dy * dy) > auraRadiusPx) continue;
      // Refresh debuff each frame; take strongest if multiple Red Crystals
      if (armorAmt >= (enemy.armorDebuff ?? 0)) {
        enemy.armorDebuff      = armorAmt;
        enemy.armorDebuffUntil = now + 200; // 200 ms — expires shortly after leaving range
      }
    }
  }

  // 3c. Star Ruby: passive burn aura damages all enemies within aura range
  for (const gem of Object.values(gameState.gems)) {
    if (gem.type !== 'special') continue;
    const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
    if (sStats?.effect?.type !== 'burn_aura') continue;
    const auraRadiusPx = sStats.effect.auraRange * (CELL_SIZE / 15);
    const gemCx = gem.x * CELL_SIZE;
    const gemCy = gem.y * CELL_SIZE;
    for (const enemy of gameState.enemies) {
      if (enemy.dead || enemy.exited) continue;
      const dx = enemy.x - gemCx;
      const dy = enemy.y - gemCy;
      if (Math.sqrt(dx * dx + dy * dy) > auraRadiusPx) continue;
      const dmg = sStats.effect.auraDps * dt;
      enemy.hp       -= dmg;
      gem.totalDamage += dmg;
      gem.roundDamage += dmg;
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.dead = true;
        gem.kills++;
        _checkLevelUp(gem);
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

  // Award MVP: gem with the highest roundDamage this wave gets +1% permanent damage
  const gemList = Object.values(gameState.gems);
  if (gemList.length > 0) {
    const mvp = gemList.reduce((best, g) => g.roundDamage > best.roundDamage ? g : best);
    if (mvp.roundDamage > 0) mvp.mvpBonus += 1;
  }

  saveState(gameState);

  if (gameState.wave >= 20) {
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
