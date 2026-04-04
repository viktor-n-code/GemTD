// ui.js — Build panel HUD rendering
// Draws the semi-transparent panel at the bottom of the canvas during 'build' phase.

import { getVisual, getStats, GEM_CHANCE_LEVELS } from './gem.js';
import { GRID_ROWS, CELL_SIZE } from './grid.js';
import { HUD_HEIGHT } from './renderer.js';

// ---------------------------------------------------------------------------
// Layout constants (exported so input.js can do hit-testing)
// ---------------------------------------------------------------------------

export const PANEL_H = 46;
export const PANEL_Y = GRID_ROWS * CELL_SIZE + HUD_HEIGHT; // 752 + 24 = 776 — below grid and HUD

// 5 gem slots for gems placed this round
export const GEM_SLOTS = [
  { x: 8,   y: PANEL_Y + 3, w: 40, h: 40 },
  { x: 52,  y: PANEL_Y + 3, w: 40, h: 40 },
  { x: 96,  y: PANEL_Y + 3, w: 40, h: 40 },
  { x: 140, y: PANEL_Y + 3, w: 40, h: 40 },
  { x: 184, y: PANEL_Y + 3, w: 40, h: 40 },
];

// Action buttons
export const BTN_COMBINE  = { x: 232, y: PANEL_Y + 9, w: 70,  h: 28 };
export const BTN_KEEP     = { x: 308, y: PANEL_Y + 9, w: 60,  h: 28 };
export const BTN_UPGRADE  = { x: 374, y: PANEL_Y + 9, w: 90,  h: 28 };
export const BTN_RESTART  = { x: 470, y: PANEL_Y + 9, w: 80,  h: 28 };

// ---------------------------------------------------------------------------
// Private shape helpers (draw gem shapes centred at cx, cy with radius r)
// ---------------------------------------------------------------------------

function drawPolygon(ctx, cx, cy, radius, sides) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else         ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawStar(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    const r = (i % 2 === 0) ? outerR : innerR;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else         ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Draw a gem shape centred at (cx, cy) with the given radius.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} shape  — 'circle' | 'square' | 'diamond' | 'pentagon' | 'star'
 * @param {string} color  — CSS colour string
 * @param {number} cx     — centre x
 * @param {number} cy     — centre y
 * @param {number} r      — radius / half-size
 */
function drawShapeInSlot(ctx, shape, color, cx, cy, r) {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;

  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;

    case 'square':
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      break;

    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(cx,     cy - r);
      ctx.lineTo(cx + r, cy    );
      ctx.lineTo(cx,     cy + r);
      ctx.lineTo(cx - r, cy    );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    case 'pentagon':
      drawPolygon(ctx, cx, cy, r, 5);
      ctx.fill();
      ctx.stroke();
      break;

    case 'star':
      drawStar(ctx, cx, cy, r, r * 0.45);
      ctx.fill();
      ctx.stroke();
      break;

    default:
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

// ---------------------------------------------------------------------------
// Private button drawing helper
// ---------------------------------------------------------------------------

/**
 * Draws a single action button.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x, y, w, h }} rect
 * @param {string}  label    — button text
 * @param {boolean} active   — whether the button is interactive
 * @param {string}  [activeColor='#3a6a3a'] — fill when active
 */
function drawButton(ctx, rect, label, active, activeColor = '#3a6a3a') {
  // Background
  ctx.fillStyle = active ? activeColor : '#2a2a2a';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Border
  ctx.strokeStyle = active ? '#aaaaaa' : '#444444';
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  // Label
  ctx.fillStyle = active ? '#ffffff' : '#666666';
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

// ---------------------------------------------------------------------------
// Info panel — DOM-based right-side panel
// ---------------------------------------------------------------------------

function _row(label, value) {
  return `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;
}

function _buildEffectHTML(effect) {
  if (!effect) return '';
  const wrap = (rows) => `<div class="info-effect">${rows}</div>`;

  switch (effect.type) {
    case 'poison':
      return wrap(
        _row('Effect', 'Poison') +
        _row('DoT', `${effect.dps} dps for ${effect.duration}s`) +
        _row('Slow', `-${Math.round(effect.slow * 100)}% for ${effect.duration}s`)
      );
    case 'slow':
      return wrap(
        _row('Effect', 'Slow') +
        _row('Amount', `-${Math.round(effect.amount * 100)}% speed`) +
        _row('Duration', `${effect.duration}s`)
      );
    case 'splash':
      return wrap(
        _row('Effect', 'Splash') +
        _row('Radius', `${(effect.radius / CELL_SIZE).toFixed(1)} tiles`) +
        _row('Damage', '100% to all in range')
      );
    case 'crit':
      return wrap(
        _row('Effect', 'Critical Strike') +
        _row('Chance', `${Math.round(effect.chance * 100)}%`) +
        _row('Multiplier', `×${effect.multiplier}`)
      );
    case 'multi':
      return wrap(
        _row('Effect', 'Multi-target') +
        _row('Targets', `${effect.targets} simultaneous`)
      );
    case 'aura':
      return wrap(
        _row('Effect', 'Attack Speed Aura') +
        _row('Bonus', `+${Math.round(effect.bonus * 100)}% atk spd`) +
        _row('Radius', `${(effect.auraRange / 15).toFixed(1)} tiles`)
      );
    default:
      return wrap(effect.type);
  }
}

function _buildGemHTML(gem) {
  const stats  = getStats(gem.type, gem.quality);
  const tiles  = (stats.range / 15).toFixed(1);
  const spdBase = stats.attackSpeed;
  const spdEff  = gem.auraBonus > 0
    ? (spdBase * (1 + gem.auraBonus)).toFixed(2)
    : spdBase;
  const spdHTML = gem.auraBonus > 0
    ? `${spdEff}/s<div class="info-aura-note">+${Math.round(gem.auraBonus * 100)}% Opal aura</div>`
    : `${spdBase}/s`;

  let html = `
    <div class="info-section-title">Selected Gem</div>
    <div class="info-gem-name">${gem.quality} ${gem.type}</div>
    <div class="info-row">
      <span class="info-label">Damage</span>
      <span class="info-value">${stats.damageMin}–${stats.damageMax}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Speed</span>
      <span class="info-value">${spdHTML}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Range</span>
      <span class="info-value">${tiles} tiles</span>
    </div>`;

  if (stats.effect) {
    html += _buildEffectHTML(stats.effect);
  }

  if (gem.kills > 0) {
    html += `<div class="info-kills">Kills: ${gem.kills} &nbsp; Dmg: ${Math.round(gem.totalDamage)}</div>`;
  }

  return html;
}

function _buildEnemyHTML(enemy, state) {
  const now    = performance.now();
  const pct    = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
  const hpColor = pct > 50 ? '#00ff44' : pct > 25 ? '#ffcc00' : '#ff4444';

  let html = `
    <div class="info-section-title">Selected Enemy</div>
    <div class="info-enemy-name">Wave ${enemy.wave} ${enemy.flying ? 'Flyer' : 'Enemy'}</div>
    <div class="hp-bar-track">
      <div class="hp-bar-fill" style="width:${pct.toFixed(1)}%;background:${hpColor}"></div>
    </div>
    <div class="info-row">
      <span class="info-label">HP</span>
      <span class="info-value">${Math.ceil(enemy.hp)} / ${enemy.maxHp}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Armor</span>
      <span class="info-value">${Math.round(enemy.armor * 2)}%</span>
    </div>
    <div class="info-row">
      <span class="info-label">Speed</span>
      <span class="info-value">${Math.round(enemy.speed)} px/s</span>
    </div>`;

  const tags = [];
  if (now < enemy.slowUntil)   tags.push(`<span class="info-status-tag tag-slowed">Slowed</span>`);
  if (now < enemy.poisonUntil) tags.push(`<span class="info-status-tag tag-poison">Poison ${enemy.poisonDps}dps</span>`);
  if (tags.length > 0) html += `<div class="info-status-tags">${tags.join('')}</div>`;

  return html;
}

function _buildDefaultHTML(state) {
  if (state.phase === 'build') {
    const entry = GEM_CHANCE_LEVELS[state.gemChanceLevel - 1];
    const c     = entry?.chances;
    if (!c) return '';
    const qualities = [
      ['Chipped',  c.chipped],
      ['Flawed',   c.flawed],
      ['Standard', c.standard],
      ['Flawless', c.flawless],
      ['Perfect',  c.perfect],
    ];
    const rows = qualities.map(([name, val]) => `
      <div class="chance-row">
        <span class="chance-label">${name}</span>
        <span class="chance-value">${val}%</span>
      </div>`).join('');
    return `<div class="info-section-title">Gem Chances — Lvl ${state.gemChanceLevel}</div>${rows}`;
  }

  // Defend / between phases
  const remaining = state.enemies.filter(e => !e.dead && !e.exited).length;
  return `
    <div class="info-section-title">Wave In Progress</div>
    <div class="info-wave-stat">${state.wave}</div>
    <div class="info-wave-sub">Wave ${state.wave} of 10</div>
    <div class="info-row" style="margin-top:14px">
      <span class="info-label">Enemies left</span>
      <span class="info-value">${remaining}</span>
    </div>`;
}

/**
 * Updates the DOM info panel to the right of the canvas.
 * Called every frame from gameloop.js.
 */
export function updateInfoPanel(state, inputState) {
  const el = document.getElementById('panel-content');
  if (!el) return;

  const gemId = inputState?.selectedGemId;
  if (gemId && state.gems[gemId]) {
    el.innerHTML = _buildGemHTML(state.gems[gemId]);
    return;
  }

  const enemyId = inputState?.selectedEnemyId;
  if (enemyId && state.phase === 'defend') {
    const enemy = state.enemies.find(e => e.id === enemyId && !e.dead && !e.exited);
    if (enemy) { el.innerHTML = _buildEnemyHTML(enemy, state); return; }
  }

  el.innerHTML = _buildDefaultHTML(state);
}

// ---------------------------------------------------------------------------
// Tooltip drawing helper
// ---------------------------------------------------------------------------

function drawTooltip(ctx, gem, state, inputState) {
  const { type, quality } = gem;
  const stats = getStats(type, quality);

  // Build text lines
  const titleLine = `${quality} ${type}`;
  const statsLine = `DMG: ${stats.damageMin}-${stats.damageMax}  SPD: ${stats.attackSpeed}  RNG: ${stats.range}`;
  let effectLine = null;
  if (stats.effect) {
    const e = stats.effect;
    if (e.type === 'poison') {
      effectLine = `Poison: ${e.dps}dps, -${Math.round(e.slow * 100)}% slow ${e.duration}s`;
    } else if (e.type === 'slow') {
      effectLine = `Slow: -${Math.round(e.amount * 100)}% for ${e.duration}s`;
    } else if (e.type === 'splash') {
      effectLine = `Splash: ${(e.radius / CELL_SIZE).toFixed(1)}t radius`;
    } else {
      effectLine = `${e.type}`;
    }
  }

  const killsLine = gem.kills > 0
    ? `Kills: ${gem.kills}   Dmg: ${Math.round(gem.totalDamage)}`
    : null;

  const padding = 6;
  const lineH   = 14;
  const lines    = 2 + (effectLine ? 1 : 0) + (killsLine ? 1 : 0);
  const boxW     = 220;
  const boxH     = padding * 2 + lines * lineH;
  const boxY     = PANEL_Y - boxH - 4;

  // Anchor tooltip above the hovered slot, clamped to canvas
  const slotIdx = state.placedThisRound.indexOf(inputState.hoveredGemId);
  const slotX = slotIdx >= 0 ? GEM_SLOTS[slotIdx].x : 8;
  let boxX = slotX;
  if (boxX + boxW > 672) boxX = 672 - boxW - 4;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#667788';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

  // Title (bold)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(titleLine, boxX + padding, boxY + padding);

  // Stats
  ctx.font = '11px Arial';
  ctx.fillText(statsLine, boxX + padding, boxY + padding + lineH);

  let lineIdx = 2;
  // Effect
  if (effectLine) {
    ctx.fillStyle = '#ccddaa';
    ctx.fillText(effectLine, boxX + padding, boxY + padding + lineH * lineIdx);
    lineIdx++;
  }

  // Kills
  if (killsLine) {
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(killsLine, boxX + padding, boxY + padding + lineH * lineIdx);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Draws the build panel HUD.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} state       — full game state
 * @param {Object} inputState  — { hoveredCell, hoveredGemId, selectedGemId, combineStep }
 */
// ---------------------------------------------------------------------------
// formatEffect — shared by tooltip, info panel builders
// ---------------------------------------------------------------------------

function formatEffect(effect) {
  if (!effect) return null;
  if (effect.type === 'poison')  return `Poison ${effect.dps}dps, -${Math.round(effect.slow * 100)}% slow / ${effect.duration}s`;
  if (effect.type === 'slow')    return `Slow ${Math.round(effect.amount * 100)}% / ${effect.duration}s`;
  if (effect.type === 'splash')  return `Splash r=${(effect.radius / CELL_SIZE).toFixed(1)}t`;
  if (effect.type === 'crit')    return `Crit ${Math.round(effect.chance * 100)}% x${effect.multiplier}`;
  if (effect.type === 'multi')   return `Hits ${effect.targets} targets`;
  if (effect.type === 'aura')    return `Aura +${Math.round(effect.bonus * 100)}% atk spd`;
  return effect.type;
}

export function drawUI(ctx, state, inputState) {

  // Range circle around selected gem (any phase)
  if (inputState?.selectedGemId) {
    const gem = state.gems[inputState.selectedGemId];
    if (gem) {
      const stats  = getStats(gem.type, gem.quality);
      const cx     = gem.x * CELL_SIZE;
      const cy     = gem.y * CELL_SIZE;
      const radius = stats.range * (CELL_SIZE / 15);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Opal: draw a separate green dashed circle showing the aura range
      if (stats.effect?.type === 'aura') {
        const auraRadius = stats.effect.auraRange * (CELL_SIZE / 15);
        ctx.strokeStyle = 'rgba(100,255,100,0.65)';
        ctx.beginPath();
        ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // Placement preview — 2×2 highlight, only while fewer than 5 gems placed
  if (state.phase === 'build' && inputState?.hoveredCell && state.placedThisRound.length < 5) {
    const { x: gx, y: gy } = inputState.hoveredCell;
    const px = (gx - 1) * CELL_SIZE;
    const py = (gy - 1) * CELL_SIZE;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px, py, CELL_SIZE * 2, CELL_SIZE * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, CELL_SIZE * 2 - 1, CELL_SIZE * 2 - 1);
    ctx.restore();
  }

  // Build instruction overlay (bottom of grid, above HUD)
  if (state.phase === 'build') {
    const msg   = state.placedThisRound.length < 5
      ? `Place gems (${state.placedThisRound.length}/5)`
      : 'Keep or combine a gem';
    const iy    = GRID_ROWS * CELL_SIZE - 14;
    const icanW = GRID_ROWS * CELL_SIZE; // use grid width (672px)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, iy - 4, 672, 18);
    ctx.fillStyle = '#ccddee';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(msg, 336, iy);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Panel background + always-visible buttons (upgrade + restart)
  // -------------------------------------------------------------------------

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, PANEL_Y, 672, PANEL_H);

  const upgradeCost   = state.gemChanceLevel < 9
    ? GEM_CHANCE_LEVELS[state.gemChanceLevel].cost
    : null;
  const upgradeActive = upgradeCost !== null && state.gold >= upgradeCost;
  const upgradeLabel  = upgradeCost !== null ? `Upgrade (${upgradeCost}g)` : 'Upgrade (max)';
  drawButton(ctx, BTN_UPGRADE, upgradeLabel, upgradeActive, '#3a4a6a');
  drawButton(ctx, BTN_RESTART, 'Restart', true, '#6a1a1a');
  ctx.restore();

  // Build-only elements (slots, combine, keep)
  if (state.phase !== 'build') return;

  ctx.save();

  // -------------------------------------------------------------------------
  // Gem slots
  // -------------------------------------------------------------------------
  for (let i = 0; i < GEM_SLOTS.length; i++) {
    const slot  = GEM_SLOTS[i];
    const gemId = state.placedThisRound[i];
    const cx    = slot.x + slot.w / 2;
    const cy    = slot.y + slot.h / 2;

    if (gemId !== undefined && gemId !== null) {
      const gem    = state.gems[gemId];
      if (gem) {
        const visual = getVisual(gem.type, gem.quality);

        // Slot background (slightly darkened gem colour via the fill)
        ctx.fillStyle = visual.color;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
        ctx.globalAlpha = 1;

        // Gem shape
        drawShapeInSlot(ctx, visual.shape, visual.color, cx, cy - 6, 14);

        // Gem name label below the shape
        ctx.fillStyle = '#ffffff';
        ctx.font      = '8px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${gem.quality} ${gem.type}`, cx, slot.y + slot.h - 2);

        // Kept gem: gold border
        if (gemId === state.keptGemId) {
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth   = 2;
          ctx.strokeRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
        }

        // Selected gem: white border (drawn on top of kept border if both apply)
        if (inputState && gemId === inputState.selectedGemId) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 2;
          ctx.strokeRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
        }
      } else {
        // gemId present but gem data missing — treat as empty
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      }
    } else {
      // Empty slot
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    }

    // Slot border (always drawn)
    ctx.strokeStyle = '#445566';
    ctx.lineWidth   = 1;
    ctx.strokeRect(slot.x + 0.5, slot.y + 0.5, slot.w - 1, slot.h - 1);
  }

  // -------------------------------------------------------------------------
  // Action buttons
  // -------------------------------------------------------------------------

  // Combine — active only when the selected gem has a matching partner (same type + quality)
  const selectedGem = inputState?.selectedGemId ? state.gems[inputState.selectedGemId] : null;
  let combineActive = false;
  if (selectedGem && state.placedThisRound.includes(inputState.selectedGemId)) {
    const matchCount = state.placedThisRound.filter(id => {
      if (id == null || id === inputState.selectedGemId) return false;
      const g = state.gems[id];
      return g && g.type === selectedGem.type && g.quality === selectedGem.quality;
    }).length;
    combineActive = matchCount >= 1;
  }
  drawButton(ctx, BTN_COMBINE, 'Combine', combineActive, '#3a6a3a');

  // Keep — active if a gem is selected and no gem has been kept yet
  const keepActive = (
    inputState !== null &&
    inputState.selectedGemId !== null &&
    state.keptGemId === null
  );
  drawButton(ctx, BTN_KEEP, 'Keep', keepActive, '#3a6a3a');

  // (Upgrade and Restart drawn in always-visible block above)

  // -------------------------------------------------------------------------
  // Tooltip
  // -------------------------------------------------------------------------
  if (inputState && inputState.hoveredGemId != null) {
    const gem = state.gems[inputState.hoveredGemId];
    if (gem) {
      drawTooltip(ctx, gem, state, inputState);
    }
  }

  ctx.restore();
}
