// ui.js — Build panel HUD rendering
// Draws the semi-transparent panel at the bottom of the canvas during 'build' phase.

import { getVisual, getStats, GEM_CHANCE_LEVELS } from './gem.js';

// ---------------------------------------------------------------------------
// Layout constants (exported so input.js can do hit-testing)
// ---------------------------------------------------------------------------

export const PANEL_Y = 706;
export const PANEL_H = 46;

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
export const BTN_SENDWAVE = { x: 560, y: PANEL_Y + 9, w: 104, h: 28 };

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
// Tooltip drawing helper
// ---------------------------------------------------------------------------

function drawTooltip(ctx, gem) {
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
      effectLine = `Splash: ${e.radius}px radius`;
    } else {
      effectLine = `${e.type}`;
    }
  }

  const padding = 6;
  const lineH   = 14;
  const lines    = effectLine ? 3 : 2;
  const boxW     = 220;
  const boxH     = padding * 2 + lines * lineH;
  const boxY     = PANEL_Y - boxH - 4;

  // Measure to find an x that fits inside the canvas (672px wide)
  let boxX = 8;
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

  // Effect
  if (effectLine) {
    ctx.fillStyle = '#ccddaa';
    ctx.fillText(effectLine, boxX + padding, boxY + padding + lineH * 2);
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
export function drawUI(ctx, state, inputState) {
  // Only draw during build phase
  if (state.phase !== 'build') return;

  ctx.save();

  // -------------------------------------------------------------------------
  // Panel background
  // -------------------------------------------------------------------------
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, PANEL_Y, 672, PANEL_H);

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

  // Combine — active if >=2 gems share the same type
  const typeCounts = {};
  for (const gemId of state.placedThisRound) {
    if (gemId == null) continue;
    const gem = state.gems[gemId];
    if (!gem) continue;
    typeCounts[gem.type] = (typeCounts[gem.type] || 0) + 1;
  }
  const combineActive = Object.values(typeCounts).some(c => c >= 2);
  drawButton(ctx, BTN_COMBINE, 'Combine', combineActive, '#3a6a3a');

  // Keep — active if a gem is selected and no gem has been kept yet
  const keepActive = (
    inputState !== null &&
    inputState.selectedGemId !== null &&
    state.keptGemId === null
  );
  drawButton(ctx, BTN_KEEP, 'Keep', keepActive, '#3a6a3a');

  // Upgrade — active if not max level and player can afford it
  const upgradeCost   = GEM_CHANCE_LEVELS[state.gemChanceLevel]
    ? GEM_CHANCE_LEVELS[state.gemChanceLevel].cost
    : null;
  const upgradeActive = upgradeCost !== null && state.gemChanceLevel < 9 && state.gold >= upgradeCost;
  const upgradeLabel  = upgradeCost !== null ? `Upgrade (${upgradeCost}g)` : 'Upgrade (max)';
  drawButton(ctx, BTN_UPGRADE, upgradeLabel, upgradeActive, '#3a4a6a');

  // Send Wave — active if player has chosen a gem to keep
  const sendActive = state.keptGemId !== null;
  drawButton(ctx, BTN_SENDWAVE, `Send Wave ${state.wave + 1}`, sendActive, '#6a3a3a');

  // -------------------------------------------------------------------------
  // Tooltip
  // -------------------------------------------------------------------------
  if (inputState && inputState.hoveredGemId != null) {
    const gem = state.gems[inputState.hoveredGemId];
    if (gem) {
      drawTooltip(ctx, gem);
    }
  }

  ctx.restore();
}
