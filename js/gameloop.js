/**
 * gameloop.js - Main game loop and phase state machine
 * Orchestrates all game systems and coordinates the game lifecycle.
 */

import { createInitialState, saveToSlot, loadFromSlot, clearSlot,
         getAllSlotMetas, migrateLegacySave } from './state.js';
import { createGrid, validatePlacement, placeGem, placeRock, removeRock, findPath,
         GRID_COLS, GRID_ROWS, CELL_SIZE, ENTRY, CHECKPOINTS, EXIT, computeBoardFillPct,
         hasValidPlacement } from './grid.js';
import { initFirebase } from './firebase.js';
import { initTabs, initCommentForm, showScoreModal } from './social.js';
import { rollGem, getStats, getLeveledStats, getVisual, GEM_CHANCE_LEVELS, QUALITY_LEVELS } from './gem.js';
import { SPECIAL_GEM_DEFS, getSpecialGemLeveledStats, getSpecialVisual, findAvailableRecipes } from './specialgem.js';
import { moveEnemy, getWaveGold, getWaveStats as _getWaveStats } from './enemy.js';
import { WaveSpawner, getWaveDef } from './wave.js';
import { attackEnemy, canAttack, isInRange, tickPoison, getGemStats, getGemAttackType, applyEffect } from './combat.js';
import { render } from './renderer.js';
import { InputHandler } from './input.js';
import { drawUI, updateInfoPanel, updateLeftPanel, PANEL_H } from './ui.js';

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
// Save/Load modal
// ---------------------------------------------------------------------------

function openSaveLoadModal() {
  renderSaveLoadModal();
  document.getElementById('saveload-modal').classList.remove('hidden');
}

function closeSaveLoadModal() {
  document.getElementById('saveload-modal').classList.add('hidden');
}

function renderSaveLoadModal() {
  const slotsEl = document.getElementById('saveload-slots');
  if (!slotsEl) return;

  const metas   = getAllSlotMetas();
  const isBuild = gameState.phase === 'build';

  // 5-wave survival cooldown: players must survive 5 defenses between saves,
  // so reloading a save to then re-save at the same point is blocked.
  const SAVE_COOLDOWN_WAVES = 5;
  const wavesSinceSave = gameState.lastSaveWave == null
    ? Infinity
    : gameState.wave - gameState.lastSaveWave;
  const cooldownRemaining = Math.max(0, SAVE_COOLDOWN_WAVES - wavesSinceSave);
  const saveDisabled = !isBuild || cooldownRemaining > 0;
  const saveDisabledAttr = saveDisabled ? 'disabled' : '';

  let html = '';
  if (isBuild && cooldownRemaining > 0) {
    html += `<div class="save-cooldown-notice">Save cooldown: ${cooldownRemaining} wave${cooldownRemaining === 1 ? '' : 's'} left</div>`;
  }

  for (let i = 0; i < 3; i++) {
    const slot = i + 1;
    const meta = metas[i];

    if (meta) {
      const date    = new Date(meta.timestamp);
      const dateStr = date.toLocaleDateString() + ' ' +
                      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `<div class="save-slot">
        <div class="save-slot-info">
          <div class="save-slot-label">Slot ${slot}</div>
          <div class="save-slot-meta">
            Wave ${meta.wave} | ${meta.gold}g | ${meta.lives} lives | ${meta.gemCount} gems<br>
            ${dateStr}
          </div>
        </div>
        <div class="save-slot-actions">
          <button class="slot-btn-save" data-slot="${slot}" ${saveDisabledAttr}>Save</button>
          <button class="slot-btn-load" data-slot="${slot}" ${isBuild ? '' : 'disabled'}>Load</button>
          <button class="slot-btn-delete" data-slot="${slot}">Delete</button>
        </div>
      </div>`;
    } else {
      html += `<div class="save-slot">
        <div class="save-slot-info">
          <div class="save-slot-label">Slot ${slot}</div>
          <div class="save-slot-empty">Empty</div>
        </div>
        <div class="save-slot-actions">
          <button class="slot-btn-save" data-slot="${slot}" ${saveDisabledAttr}>Save</button>
        </div>
      </div>`;
    }
  }

  slotsEl.innerHTML = html;
  attachSaveLoadListeners();
}

function attachSaveLoadListeners() {
  const modal = document.getElementById('saveload-modal');

  document.getElementById('saveload-close').onclick = closeSaveLoadModal;
  modal.onclick = (e) => { if (e.target === modal) closeSaveLoadModal(); };

  for (const btn of modal.querySelectorAll('.slot-btn-save')) {
    btn.onclick = () => {
      const slot = parseInt(btn.dataset.slot);
      saveToSlot(slot, gameState);
      renderSaveLoadModal();
    };
  }

  for (const btn of modal.querySelectorAll('.slot-btn-load')) {
    btn.onclick = () => {
      const slot = parseInt(btn.dataset.slot);
      loadGameFromSlot(slot);
      closeSaveLoadModal();
    };
  }

  for (const btn of modal.querySelectorAll('.slot-btn-delete')) {
    btn.onclick = () => {
      const slot = parseInt(btn.dataset.slot);
      clearSlot(slot);
      renderSaveLoadModal();
    };
  }
}

function loadGameFromSlot(slot) {
  const loaded = loadFromSlot(slot);
  if (!loaded) return;

  // Delete-on-load: a save can only be used once so players can't reload a
  // single snapshot indefinitely to fish for better rolls. The cooldown stamp
  // lives inside `loaded` (state.lastSaveWave) so the save's remaining
  // cooldown survives the load.
  clearSlot(slot);

  // Replace game state
  gameState = loaded;

  // Rebuild grid (not serialised) and re-place gems + rocks
  gameState.grid = createGrid();
  for (const gem of Object.values(gameState.gems)) {
    placeGem(gameState.grid, gem.x, gem.y, gem.id);
  }
  for (const rock of (gameState.rocks || [])) {
    placeRock(gameState.grid, rock.x, rock.y);
  }

  // Recompute derived state
  gameState.groundPath = computeFullPath(gameState.grid);
  groundPath = gameState.groundPath;
  applyAllAuraBuffs(gameState);

  // Clear transient combat state (should be empty in build-phase saves)
  gameState.enemies     = [];
  gameState.projectiles = [];
  gameState.critNumbers = [];
  waveSpawner = null;

  // Ensure build phase
  gameState.phase = 'build';

  // Reset input handler
  inputHandler.resetBuildState();

  // If loading from a game-over state, restart the loop
  if (loaded.gameOver || loaded.gameWon) {
    gameState.gameOver = false;
    gameState.gameWon  = false;
    requestAnimationFrame(gameLoop);
  }
}

// ---------------------------------------------------------------------------
// Responsive resize
// ---------------------------------------------------------------------------

function onResize() {
  if (!canvas) return;
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // On mobile, let the canvas fill the viewport width; CSS handles aspect ratio
    canvas.style.width  = window.innerWidth + 'px';
    canvas.style.height = 'auto';
  } else {
    // Desktop — clear any mobile overrides and sync panel heights to canvas
    canvas.style.width  = '';
    canvas.style.height = '';
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.style.height = canvas.height + 'px';
    const leftPanel = document.getElementById('left-panel');
    if (leftPanel) leftPanel.style.height = canvas.height + 'px';
  }
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  canvas.width  = GRID_COLS * CELL_SIZE;                         // 672
  canvas.height = GRID_ROWS * CELL_SIZE + PANEL_H; // 752 + 78 = 830 (HUD moved to left panel)

  // Sync panel heights on desktop; on mobile CSS handles layout
  onResize();
  window.addEventListener('resize', onResize);

  document.getElementById('loading').classList.add('hidden');

  // Migrate any pre-v1.9 single-save key into slot 1
  migrateLegacySave();

  // Always start a fresh game — player loads manually via Save/Load modal
  gameState = createInitialState();
  gameState.grid = createGrid();

  // Compute initial path so the build-phase highlight is visible from the start
  gameState.groundPath = computeFullPath(gameState.grid);
  // Waves are endless — no totalWaves cap

  inputHandler = new InputHandler(canvas);

  initFirebase();
  initTabs();
  initCommentForm();

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// gameLoop
// ---------------------------------------------------------------------------

function gameLoop(timestamp) {
  const realDt = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // cap at 100 ms
  lastTimestamp = timestamp;

  // Scale time by game speed — game logic uses gameDt and gameTime
  const gameDt = realDt * (gameState.gameSpeed || 1);
  gameState.gameTime += gameDt * 1000;
  const now = gameState.gameTime; // virtual game clock for all game logic

  inputHandler.update(gameState);

  // Pause game logic when viewing Leaderboard/Comments tabs (still render)
  if (window.gameTabActive !== false) {
    if      (gameState.phase === 'build')   updateBuild(gameDt, now);
    else if (gameState.phase === 'defend')  updateDefend(gameDt, now);
    else if (gameState.phase === 'between') updateBetween();
  }

  const HUD_Y = GRID_ROWS * CELL_SIZE; // 752 — grid ends here, HUD starts here
  render(gameState, canvas, HUD_Y, inputHandler.getState().selectedGemId);
  drawUI(ctx, gameState, inputHandler.getState());
  updateInfoPanel(gameState, inputHandler.getState());
  updateLeftPanel(gameState);

  if (!gameState.gameOver) {
    requestAnimationFrame(gameLoop);
  } else {
    drawEndScreen(ctx);
    const mazeLen = gameState.groundPath?.length ?? 0;
    const fillPct = computeBoardFillPct(gameState.grid, gameState.groundPath);

    // Find MVP gem (highest kills)
    let mvpGem = '';
    let mvpGemKills = 0;
    for (const gem of Object.values(gameState.gems)) {
      if ((gem.kills || 0) > mvpGemKills) {
        mvpGemKills = gem.kills;
        mvpGem = gem.name || '?';
      }
    }

    // Final wave damage dealt %
    let aliveDmg = 0;
    for (const e of gameState.enemies) aliveDmg += Math.max(0, e.maxHp - e.hp);
    const finalWaveDmgPct = gameState.waveTotalHp > 0
      ? Math.min(100, ((gameState.waveDamageDealt + aliveDmg) / gameState.waveTotalHp) * 100)
      : 0;

    showScoreModal(gameState, mazeLen, fillPct, gameState.endReason || 'lose', mvpGem, mvpGemKills, finalWaveDmgPct);
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
  // --- Win detection: board is full, no rocks to remove ---
  if (gameState.placedThisRound.length === 0 && !hasValidPlacement(gameState.grid)) {
    gameState.endReason = 'win';
    gameState.gameOver = true;
    return;
  }

  // --- Placement ---
  const placement = inputHandler.consumePlacement();
  if (placement && gameState.placedThisRound.length < 5) {
    const { x, y } = placement;
    if (validatePlacement(gameState.grid, x, y)) {
      // Opal Attunement: if a Perfect Opal is already placed this round,
      // boost the chance of rolling another (deducted from Chipped chance).
      let rolled;
      const attuned = gameState.opalAttunement > 0
        && !gameState.opalAttunementDone
        && gameState.placedThisRound.some(id => {
          const g = gameState.gems[id];
          return g && g.type === 'Opal' && g.quality === 'perfect';
        });
      if (attuned) {
        const attunePct = gameState.opalAttunement * 100;
        if (Math.random() * 100 < attunePct) {
          rolled = { type: 'Opal', quality: 'perfect' };
        } else {
          rolled = rollGem(gameState.gemChanceLevel);
        }
      } else {
        rolled = rollGem(gameState.gemChanceLevel);
      }
      const { type, quality } = rolled;
      const id = `gem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const stats = getStats(type, quality);
      gameState.gems[id] = {
        id, type, quality, x, y,
        name: null, // assigned in startDefendPhase once quality is final
        level: 1,
        kills: 0, totalDamage: 0, roundDamage: 0, goldGenerated: 0,
        directDamage: 0, splashDamage: 0, dotDamage: 0, auraDamage: 0,
        roundDirectDamage: 0, roundSplashDamage: 0, roundDotDamage: 0, roundAuraDamage: 0,
        mvpBonus: 0,
        lastAttackTime: 0,
        attackCooldown: Math.round(1000 / stats.attackSpeed),
        auraBonus: 0,
        dmgBonus: 0,
        dmgBonus2: 0,
        lastTargetId: null,
      };
      placeGem(gameState.grid, x, y, id);
      gameState.placedThisRound.push(id);
      applyAllAuraBuffs(gameState); // update aura bonuses after each placement
      gameState.groundPath = computeFullPath(gameState.grid); // refresh path highlight
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
          // Opal Attunement: disable once a Great Opal is on the board
          if (g1.type === 'Opal' && g1.quality === 'great' && !gameState.opalAttunementDone) {
            gameState.opalAttunementDone = true;
            gameState.opalAttunement = 0;
            if (gameState.greatOpalWave == null) gameState.greatOpalWave = gameState.wave;
          }
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

      case 'combine4': {
        // 4-combine: selected gem + 3 matching partners → upgrade by 2 tiers
        const sid4 = action.selectedGemId;
        const s4 = sid4 ? gameState.gems[sid4] : null;
        if (!s4) break;
        const qi4 = QUALITY_LEVELS.indexOf(s4.quality);
        if (qi4 + 2 >= QUALITY_LEVELS.length) break;
        const partners4 = gameState.placedThisRound.filter(id => {
          if (!id || id === sid4) return false;
          const g = gameState.gems[id];
          return g && g.type === s4.type && g.quality === s4.quality;
        }).slice(0, 3);
        if (partners4.length < 3) break;
        // Upgrade survivor by 2 tiers
        s4.quality = QUALITY_LEVELS[qi4 + 2];
        s4.attackCooldown = Math.round(1000 / getLeveledStats(s4.type, s4.quality, s4.level || 1).attackSpeed);
        // Opal Attunement: disable once a Great Opal is on the board
        if (s4.type === 'Opal' && s4.quality === 'great' && !gameState.opalAttunementDone) {
          gameState.opalAttunementDone = true;
          gameState.opalAttunement = 0;
          if (gameState.greatOpalWave == null) gameState.greatOpalWave = gameState.wave;
        }
        // Convert partners to rocks
        for (const id of partners4) {
          const g = gameState.gems[id];
          if (!g) continue;
          placeRock(gameState.grid, g.x, g.y);
          for (let dy = 0; dy <= 1; dy++)
            for (let dx = 0; dx <= 1; dx++)
              gameState.grid[g.y + dy][g.x + dx].gemId = null;
          delete gameState.gems[id];
        }
        // Convert remaining non-survivor gems to rocks, start wave
        gameState.keptGemId = sid4;
        for (const id of gameState.placedThisRound) {
          if (id === sid4 || partners4.includes(id)) continue;
          const g = gameState.gems[id];
          if (!g) continue;
          placeRock(gameState.grid, g.x, g.y);
          for (let dy = 0; dy <= 1; dy++)
            for (let dx = 0; dx <= 1; dx++)
              gameState.grid[g.y + dy][g.x + dx].gemId = null;
          delete gameState.gems[id];
        }
        gameState.placedThisRound = [sid4];
        startDefendPhase();
        break;
      }

      case 'repick': {
        _handleRepick();
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
        applyAllAuraBuffs(gameState);
        gameState.groundPath = computeFullPath(gameState.grid); // refresh path highlight
        break;
      }

      case 'upgrade':
        handleUpgrade();
        break;

      case 'buyLife':
        _handleBuyLife();
        break;

      case 'forfeit':
        gameState.endReason = 'forfeit';
        gameState.gameOver = true;
        return;

      case 'restart':
        location.reload();
        break;

      case 'toggleSpeed': {
        const speeds = [1, 2, 4];
        const idx = speeds.indexOf(gameState.gameSpeed);
        gameState.gameSpeed = speeds[(idx + 1) % speeds.length];
        break;
      }

      case 'openSaveLoad':
        openSaveLoadModal();
        break;

      // selectGem is purely a UI selection — no game-state change needed here
      case 'selectGem':
        break;
    }
  }
}

function _handleBuyLife() {
  const cost = 10 + gameState.extraLivesPurchased ** 2;
  if (gameState.gold >= cost && gameState.lives < 20) {
    gameState.gold -= cost;
    gameState.lives += 1;
    gameState.extraLivesPurchased += 1;

  }
}

function _handleRepick() {
  const cost = 25 * (gameState.repickCount + 1);
  if (gameState.gold < cost || gameState.placedThisRound.length === 0) return;
  // Remove all placed gems from grid (back to empty, not rocks)
  for (const id of [...gameState.placedThisRound]) {
    const g = gameState.gems[id];
    if (!g) continue;
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = 0; dx <= 1; dx++) {
        const cell = gameState.grid[g.y + dy][g.x + dx];
        cell.type = 'empty';
        cell.gemId = null;
      }
    delete gameState.gems[id];
  }
  gameState.placedThisRound = [];
  gameState.keptGemId = null;
  gameState.gold -= cost;
  gameState.repickCount += 1;
  applyAllAuraBuffs(gameState);
  gameState.groundPath = computeFullPath(gameState.grid);
}

function _handleDowngrade() {
  const gemId = gameState.downgradeAvailableId;
  if (!gemId) return;
  const gem = gameState.gems[gemId];
  if (!gem || gem.type === 'special') return;
  const qi = QUALITY_LEVELS.indexOf(gem.quality);
  if (qi <= 0) return;
  gem.quality = QUALITY_LEVELS[qi - 1];
  const ls = getLeveledStats(gem.type, gem.quality, gem.level || 1);
  gem.attackCooldown = Math.round(1000 / ls.attackSpeed);
  gameState.downgradeAvailableId = null;

  // Regenerate name with new quality
  const nameKey = `${gem.quality}_${gem.type}`;
  gameState.gemCounters[nameKey] = (gameState.gemCounters[nameKey] || 0) + 1;
  gem.name = `${gem.quality[0].toUpperCase() + gem.quality.slice(1)} ${gem.type} ${gameState.gemCounters[nameKey]}`;

  applyAllAuraBuffs(gameState);
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
      if (Math.sqrt(dx * dx + dy * dy) <= radiusPx + CELL_SIZE / 2 && bonus > gem.auraBonus) {
        gem.auraBonus = bonus;
        const ls = getGemStats(gem);
        gem.attackCooldown = Math.round(1000 / (ls.attackSpeed * (1 + bonus)));
      }
    }
  }
}

/**
 * Recalculates gem.dmgBonus (slot 1: Black Opal / Mystic Black Opal) and
 * gem.dmgBonus2 (slot 2: Star Yellow Sapphire) for all gems. Each slot takes
 * the strongest aura in range; the two slots stack additively in attackEnemy.
 */
function applyDmgAuraBuffs(state) {
  // 1. Reset both damage bonus slots on all gems
  for (const gem of Object.values(state.gems)) {
    gem.dmgBonus  = 0;
    gem.dmgBonus2 = 0;
  }

  // 2. Slot 1: strongest dmg_aura (Black Opal / Mystic Black Opal)
  for (const auraGem of Object.values(state.gems)) {
    const auraStats = getGemStats(auraGem);
    if (auraStats.effect?.type !== 'dmg_aura') continue;
    const { bonus, auraRange } = auraStats.effect;
    const radiusPx = auraRange * (CELL_SIZE / 15);
    const apx = auraGem.x * CELL_SIZE;
    const apy = auraGem.y * CELL_SIZE;
    for (const gem of Object.values(state.gems)) {
      const dx = gem.x * CELL_SIZE - apx;
      const dy = gem.y * CELL_SIZE - apy;
      if (Math.sqrt(dx * dx + dy * dy) <= radiusPx + CELL_SIZE / 2 && bonus > gem.dmgBonus) {
        gem.dmgBonus = bonus;
      }
    }
  }

  // 3. Slot 2: strongest splash_slow_dmg_aura (Star Yellow Sapphire)
  for (const auraGem of Object.values(state.gems)) {
    const auraStats = getGemStats(auraGem);
    if (auraStats.effect?.type !== 'splash_slow_dmg_aura') continue;
    const { dmgBonus: bonus, dmgAuraRange: auraRange } = auraStats.effect;
    const radiusPx = auraRange * (CELL_SIZE / 15);
    const apx = auraGem.x * CELL_SIZE;
    const apy = auraGem.y * CELL_SIZE;
    for (const gem of Object.values(state.gems)) {
      const dx = gem.x * CELL_SIZE - apx;
      const dy = gem.y * CELL_SIZE - apy;
      if (Math.sqrt(dx * dx + dy * dy) <= radiusPx + CELL_SIZE / 2 && bonus > gem.dmgBonus2) {
        gem.dmgBonus2 = bonus;
      }
    }
  }
}

/** Applies all passive aura buffs (attack speed + damage). Call after any gem change. */
function applyAllAuraBuffs(state) {
  applyAuraBuffs(state);
  applyDmgAuraBuffs(state);
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
  const totalGold  = allParticipants.reduce((s, g) => s + (g.goldGenerated || 0), 0);
  let sumDirect = allParticipants.reduce((s, g) => s + (g.directDamage || 0), 0);
  let sumSplash = allParticipants.reduce((s, g) => s + (g.splashDamage || 0), 0);
  let sumDot    = allParticipants.reduce((s, g) => s + (g.dotDamage || 0), 0);
  let sumAura   = allParticipants.reduce((s, g) => s + (g.auraDamage || 0), 0);
  const newLevel   = Math.max(1, Math.floor(totalKills / 10) + 1);

  // Fold orphaned damage categories into direct if the new gem can't produce them
  const sStats = getSpecialGemLeveledStats(def.id, newLevel);
  const et = sStats?.effect?.type;
  const canDoT    = et === 'poison' || et === 'lucky_jade';
  const canSplash = et === 'splash' || et === 'splash_slow' || et === 'splash_slow_dmg_aura'
                 || et === 'ancient_blood_stone' || et === 'paraiba_nova';
  const canAura   = et === 'burn_aura' || et === 'blood_stone' || et === 'ancient_blood_stone'
                 || et === 'uranium';
  if (!canDoT)    { sumDirect += sumDot;    sumDot = 0; }
  if (!canSplash) { sumDirect += sumSplash; sumSplash = 0; }
  if (!canAura)   { sumDirect += sumAura;   sumAura = 0; }

  // Transform master gem into the special gem
  master.type        = 'special';
  master.specialType = def.id;
  master.quality     = null;
  master.kills       = totalKills;
  master.totalDamage = totalDmg;
  master.mvpBonus    = totalMvp;
  master.goldGenerated = totalGold;
  master.directDamage = sumDirect;
  master.splashDamage = sumSplash;
  master.dotDamage    = sumDot;
  master.auraDamage   = sumAura;
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
    applyAllAuraBuffs(gameState);

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
  const nameKey = `special_${nextDef.id}`;
  gameState.gemCounters[nameKey] = (gameState.gemCounters[nameKey] || 0) + 1;
  gem.name = gameState.gemCounters[nameKey] === 1
    ? nextDef.name
    : `${nextDef.name} ${gameState.gemCounters[nameKey]}`;

  const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
  gem.attackCooldown = Math.round(1000 / sStats.attackSpeed);

  applyAllAuraBuffs(gameState);
}

// ---------------------------------------------------------------------------
// startDefendPhase
// ---------------------------------------------------------------------------

function startDefendPhase() {
  gameState.wave += 1;
  gameState.phase = 'defend';

  // Compute ground path once (all ground enemies share it)
  groundPath = computeFullPath(gameState.grid);
  gameState.groundPath = groundPath; // expose to renderer for path highlight

  // Opal Attunement: +0.1% per round at max gem level, capped at 10%
  if (gameState.gemChanceLevel === 9 && !gameState.opalAttunementDone) {
    gameState.opalAttunement = Math.min(gameState.opalAttunement + 0.001, 0.10);
  }

  // Reset per-wave counters
  gameState.finalWaveKills = 0;
  gameState.waveEnemiesGone = 0;
  const waveStats = _getWaveStats(gameState.wave);
  const waveDef   = getWaveDef(gameState.wave);
  gameState.waveTotalHp     = waveDef.count * waveStats.hp;
  gameState.waveDamageDealt = 0;

  // Apply all aura bonuses (attack speed + damage) before wave begins
  applyAllAuraBuffs(gameState);

  // Create wave spawner
  waveSpawner = new WaveSpawner(gameState.wave, groundPath);

  // Assign final name to the kept gem now that its quality is settled.
  // Skip special gems — they are named at combine time.
  const keptGem = gameState.gems[gameState.keptGemId];
  if (keptGem && keptGem.type !== 'special') {
    const k = `${keptGem.quality}_${keptGem.type}`;
    gameState.gemCounters[k] = (gameState.gemCounters[k] || 0) + 1;
    keptGem.name = `${keptGem.quality[0].toUpperCase() + keptGem.quality.slice(1)} ${keptGem.type} ${gameState.gemCounters[k]}`;
  }

  // The just-kept gem can be downgraded during this defend phase
  gameState.downgradeAvailableId = gameState.keptGemId;

  // Reset per-round damage counters for all active gems
  for (const gem of Object.values(gameState.gems)) {
    gem.roundDamage = 0;
    gem.roundDirectDamage = 0;
    gem.roundSplashDamage = 0;
    gem.roundDotDamage = 0;
    gem.roundAuraDamage = 0;
    gem.attackDisabled = false;
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
    applyAllAuraBuffs(gameState);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// updateDefend
// ---------------------------------------------------------------------------

function updateDefend(dt, now) {
  gameState.defendTime += dt;

  // Check for actions (restart, upgrade, forfeit, special gem combine/upgrade)
  const action = inputHandler.consumeAction();
  if (action?.type === 'restart') { location.reload(); return; }
  if (action?.type === 'forfeit') { gameState.endReason = 'forfeit'; gameState.gameOver = true; return; }
  if (action?.type === 'upgrade') { handleUpgrade(); }
  if (action?.type === 'buyLife') { _handleBuyLife(); }
  if (action?.type === 'downgrade') { _handleDowngrade(); }
  if (action?.type === 'combineSpecial')  { _handleCombineSpecial(action.selectedGemId, 'defend'); }
  if (action?.type === 'upgradeSpecial')  { _handleUpgradeSpecial(action.gemId); }
  if (action?.type === 'toggleSpeed') {
    const speeds = [1, 2, 4];
    const idx = speeds.indexOf(gameState.gameSpeed);
    gameState.gameSpeed = speeds[(idx + 1) % speeds.length];
  }
  if (action?.type === 'openSaveLoad') { openSaveLoadModal(); }

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
        // Apply weakness modifier to poison DoT damage
        const weakMultP = getGemAttackType(pg) === e.weakness ? 1.75 : 0.90;
        const adjDmg = poisonResult.damage * weakMultP;
        // Adjust the HP difference (tickPoison already subtracted base damage)
        e.hp -= adjDmg - poisonResult.damage;
        if (e.hp <= 0 && !e.dead) { e.dead = true; poisonResult.killed = true; }
        pg.totalDamage  += adjDmg;
        pg.roundDamage  += adjDmg;
        pg.dotDamage    += adjDmg;
        pg.roundDotDamage += adjDmg;
        if (poisonResult.killed) {
          pg.kills++;
          _checkLevelUp(pg);
        }
      }
    }
    if (e.exited) {
      gameState.lives -= 1;
      gameState.livesLost += 1;
      if (gameState.lives <= 0) {
        gameState.endReason = 'lose';
        gameState.gameOver = true;
        return;
      }
    }
  }

  // 3. Gem attacks
  for (const gem of Object.values(gameState.gems)) {
    if (gem.attackDisabled) continue;
    if (!canAttack(gem, now)) continue;
    const target = findTarget(gem);
    if (target) {
      const result = attackEnemy(gem, target, gameState.enemies, now, gameState.wave);
      gem.lastTargetId = target.id;
      gem.totalDamage  += result.damage + result.splashDamage;
      gem.roundDamage  += result.damage + result.splashDamage;
      gem.directDamage += result.damage;
      gem.splashDamage += result.splashDamage;
      gem.roundDirectDamage += result.damage;
      gem.roundSplashDamage += result.splashDamage;
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
        gem.goldGenerated += result.goldAmount;
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
          const extraResult = attackEnemy(gem, extra, gameState.enemies, now, gameState.wave);
          gem.totalDamage  += extraResult.damage;
          gem.roundDamage  += extraResult.damage;
          gem.directDamage += extraResult.damage;
          gem.roundDirectDamage += extraResult.damage;
          if (extra.dead) { gem.kills++; _checkLevelUp(gem); }
          gameState.projectiles.push({ x1: gem.x * CELL_SIZE, y1: gem.y * CELL_SIZE, x2: extra.x, y2: extra.y, color });
          if (extraResult.crit) {
            gameState.critNumbers.push({ x: extra.x, y: extra.y - 12, value: extraResult.damage, createdAt: now });
          }
        }
      }

      // Blood Stone: same multi-target pattern as Topaz/Malachite
      if (stats.effect?.type === 'blood_stone') {
        const extras = gameState.enemies
          .filter(e => !e.dead && !e.exited && e !== target && isInRange(gem, e))
          .sort((a, b) => a.hp - b.hp)
          .slice(0, stats.effect.targets - 1);
        for (const extra of extras) {
          const extraResult = attackEnemy(gem, extra, gameState.enemies, now, gameState.wave);
          gem.totalDamage  += extraResult.damage;
          gem.roundDamage  += extraResult.damage;
          gem.directDamage += extraResult.damage;
          gem.roundDirectDamage += extraResult.damage;
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
    if (gem.attackDisabled) continue;
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
      // Refresh aura debuff each frame; take strongest if multiple Red Crystals
      if (armorAmt >= (enemy.armorAuraDebuff ?? 0)) {
        enemy.armorAuraDebuff      = armorAmt;
        enemy.armorAuraDebuffUntil = now + 200; // 200 ms — expires shortly after leaving range
      }
    }
  }

  // 3b-2. Paraiba Tourmaline: passive armor aura debuffs ground enemies within range
  for (const gem of Object.values(gameState.gems)) {
    if (gem.type !== 'special') continue;
    const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
    if (sStats?.effect?.type !== 'paraiba_nova') continue;
    const auraRadiusPx = sStats.effect.auraRange * (CELL_SIZE / 15);
    const armorAmt     = sStats.effect.groundArmorAura;
    const gemCx = gem.x * CELL_SIZE;
    const gemCy = gem.y * CELL_SIZE;
    for (const enemy of gameState.enemies) {
      if (enemy.dead || enemy.exited || enemy.flying) continue; // ground only
      const dx = enemy.x - gemCx;
      const dy = enemy.y - gemCy;
      if (Math.sqrt(dx * dx + dy * dy) > auraRadiusPx) continue;
      if (armorAmt >= (enemy.armorAuraDebuff ?? 0)) {
        enemy.armorAuraDebuff      = armorAmt;
        enemy.armorAuraDebuffUntil = now + 200;
      }
    }
  }

  // 3c. Star Ruby / Blood Stone / Ancient Blood Stone: passive burn aura damages all enemies within aura range
  for (const gem of Object.values(gameState.gems)) {
    if (gem.attackDisabled) continue;
    if (gem.type !== 'special') continue;
    const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
    const effectType = sStats?.effect?.type;
    if (effectType !== 'burn_aura' && effectType !== 'blood_stone' && effectType !== 'ancient_blood_stone') continue;
    const auraRadiusPx = sStats.effect.auraRange * (CELL_SIZE / 15);
    const gemCx = gem.x * CELL_SIZE;
    const gemCy = gem.y * CELL_SIZE;
    for (const enemy of gameState.enemies) {
      if (enemy.dead || enemy.exited) continue;
      const dx = enemy.x - gemCx;
      const dy = enemy.y - gemCy;
      if (Math.sqrt(dx * dx + dy * dy) > auraRadiusPx) continue;
      const weakMult1 = getGemAttackType(gem) === enemy.weakness ? 1.75 : 0.90;
      const dmg = sStats.effect.auraDps * dt * weakMult1;
      enemy.hp       -= dmg;
      gem.totalDamage += dmg;
      gem.roundDamage += dmg;
      gem.auraDamage  += dmg;
      gem.roundAuraDamage += dmg;
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.dead = true;
        gem.kills++;
        _checkLevelUp(gem);
      }
    }
  }

  // 3d. Uranium 235 / Uranium 238: passive slow aura + burn aura
  for (const gem of Object.values(gameState.gems)) {
    if (gem.attackDisabled) continue;
    if (gem.type !== 'special') continue;
    const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
    if (sStats?.effect?.type !== 'uranium') continue;
    const auraRadiusPx = sStats.effect.auraRange * (CELL_SIZE / 15);
    const gemCx = gem.x * CELL_SIZE;
    const gemCy = gem.y * CELL_SIZE;
    for (const enemy of gameState.enemies) {
      if (enemy.dead || enemy.exited) continue;
      const dx = enemy.x - gemCx;
      const dy = enemy.y - gemCy;
      if (Math.sqrt(dx * dx + dy * dy) > auraRadiusPx) continue;
      // Burn DPS (with weakness modifier)
      const weakMult2 = getGemAttackType(gem) === enemy.weakness ? 1.75 : 0.90;
      const dmg = sStats.effect.auraDps * dt * weakMult2;
      enemy.hp        -= dmg;
      gem.totalDamage += dmg;
      gem.roundDamage += dmg;
      gem.auraDamage  += dmg;
      gem.roundAuraDamage += dmg;
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.dead = true;
        gem.kills++;
        _checkLevelUp(gem);
      }
      // Slow aura (refreshed each frame; expires 200 ms after leaving range)
      applyEffect(enemy, { type: 'slow', amount: sStats.effect.slowAmount, duration: 0.2 }, now, gem.id);
    }
  }

  // 4. Award gold for kills, count removed enemies, then filter
  const killGold = getWaveGold(gameState.wave).killGold;
  for (const e of gameState.enemies) {
    if (e.dead) {
      gameState.gold += killGold;
      gameState.finalWaveKills += 1;
      gameState.waveDamageDealt += e.maxHp;
    } else if (e.exited) {
      // Leaked: only count damage actually dealt (maxHp - remaining hp)
      gameState.waveDamageDealt += Math.max(0, e.maxHp - e.hp);
    }
    if (e.dead || e.exited) gameState.waveEnemiesGone += 1;
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
  const stats = getGemStats(gem);
  const effectType = stats.effect?.type;

  // Greedy targeting for poison gems: prefer unpoisoned or weakly-poisoned enemies
  if (effectType === 'poison' || effectType === 'lucky_jade') {
    const gemDps = stats.effect.dps;
    let unpoisoned = null; // no DoT at all
    let weakPoison = null; // DoT weaker than ours (we can override)
    let fallback   = null; // any enemy in range

    for (const e of gameState.enemies) {
      if (e.dead || e.exited) continue;
      if (!isInRange(gem, e)) continue;
      if (e.poisonDps === 0 || e.poisonUntil <= gameState.gameTime) {
        if (!unpoisoned || e.hp < unpoisoned.hp) unpoisoned = e;
      } else if (e.poisonDps < gemDps) {
        if (!weakPoison || e.hp < weakPoison.hp) weakPoison = e;
      }
      if (!fallback || e.hp < fallback.hp) fallback = e;
    }

    return unpoisoned || weakPoison || fallback;
  }

  // Standard targeting: keep current target, then lowest HP
  if (gem.lastTargetId) {
    const current = gameState.enemies.find(
      e => e.id === gem.lastTargetId && !e.dead && !e.exited
    );
    if (current && isInRange(gem, current)) return current;
  }

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
  const bonus = getWaveGold(gameState.wave).bonusGold;
  gameState.gold += bonus;

  // Award MVP: gem with the highest roundDamage this wave gets +1% permanent damage
  const gemList = Object.values(gameState.gems);
  if (gemList.length > 0) {
    const mvp = gemList.reduce((best, g) => g.roundDamage > best.roundDamage ? g : best);
    if (mvp.roundDamage > 0) mvp.mvpBonus += 1;
  }

  gameState.downgradeAvailableId = null; // lock gem — no more downgrading
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
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '18px Arial';
  ctx.fillText(`Wave ${gameState.wave} reached`, canvas.width / 2, canvas.height / 2 + 14);
  ctx.fillText('Refresh to play again', canvas.width / 2, canvas.height / 2 + 40);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
