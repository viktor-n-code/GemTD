/**
 * renderer.js - Canvas rendering
 * Handles all visual output to the game canvas.
 */

import { GRID_COLS, GRID_ROWS, CELL_SIZE, CHECKPOINTS, ENTRY, EXIT } from './grid.js';
import { getVisual } from './gem.js';
import { getSpecialVisual, getSpecialGemLeveledStats } from './specialgem.js';

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

const COLOR_EMPTY    = '#1a2a3a';
const COLOR_BLOCKED  = '#0f1f2f';
const COLOR_ROCK     = '#555566';
const COLOR_GRID_LINE = '#2a3a4a';

const COLOR_CHECKPOINT = '#ffff00';
const COLOR_ENTRY      = '#00ff00';
const COLOR_EXIT       = '#ff4444';

const COLOR_ENEMY_GROUND = '#ff6600';
const COLOR_ENEMY_FLYING = '#00ccff';
const COLOR_ENEMY_HP_BG  = '#660000';
const COLOR_ENEMY_HP_FG  = '#00ff44';

const COLOR_PROJECTILE = '#ffff88';

const COLOR_HUD_BG   = 'rgba(0,0,0,0.6)';
const COLOR_HUD_TEXT = '#ffffff';

export const HUD_HEIGHT = 24;

// ---------------------------------------------------------------------------
// Helpers — polygon drawing
// ---------------------------------------------------------------------------

/**
 * Draws a regular n-gon centered at (cx, cy) with the given radius.
 * The first vertex is at the top (angle = -PI/2).
 */
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

/**
 * Draws a 5-pointed star centered at (cx, cy).
 * outerR = tip radius, innerR = inner notch radius.
 */
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

// ---------------------------------------------------------------------------
// Draw grid
// ---------------------------------------------------------------------------

function drawGrid(ctx, state) {
  const { grid, gems } = state;

  for (let y = 1; y <= GRID_ROWS; y++) {
    for (let x = 1; x <= GRID_COLS; x++) {
      const cell = grid[y][x];
      const px = (x - 1) * CELL_SIZE;
      const py = (y - 1) * CELL_SIZE;

      // Determine fill color
      let fillColor;
      if (cell.type === 'rock') {
        fillColor = COLOR_ROCK;
      } else if (cell.type === 'blocked') {
        fillColor = COLOR_BLOCKED;
      } else if (cell.type === 'gem' && cell.gemId !== null) {
        const gem = gems[cell.gemId];
        if (gem) {
          const visual = getVisual(gem.type, gem.quality);
          fillColor = visual.color;
        } else {
          fillColor = COLOR_EMPTY;
        }
      } else {
        // 'empty'
        fillColor = COLOR_EMPTY;
      }

      // Fill cell leaving 1px gap for grid lines (draw 1px smaller on each side)
      ctx.fillStyle = fillColor;
      ctx.fillRect(px + 1, py + 1, CELL_SIZE - 1, CELL_SIZE - 1);
    }
  }

  // Draw grid lines in a single pass (1px lines at cell boundaries)
  ctx.fillStyle = COLOR_GRID_LINE;
  // Vertical lines
  for (let x = 0; x <= GRID_COLS; x++) {
    ctx.fillRect(x * CELL_SIZE, 0, 1, GRID_ROWS * CELL_SIZE);
  }
  // Horizontal lines
  for (let y = 0; y <= GRID_ROWS; y++) {
    ctx.fillRect(0, y * CELL_SIZE, GRID_COLS * CELL_SIZE, 1);
  }
}

// ---------------------------------------------------------------------------
// Draw special zones — entry, exit, checkpoint arrows
// ---------------------------------------------------------------------------

// Fills a rectangle of grid cells (1-indexed, inclusive) with a colour,
// leaving the 1px grid-line gap so the grid overlay still shows through.
function fillZone(ctx, x1, y1, x2, y2, color) {
  ctx.fillStyle = color;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      ctx.fillRect((x - 1) * CELL_SIZE + 1, (y - 1) * CELL_SIZE + 1,
                   CELL_SIZE - 1, CELL_SIZE - 1);
    }
  }
}

// Checkpoint arrow shapes — body + tip zones and the direction each points.
// Matches the BLOCKED_ZONES in grid.js exactly.
const CP_ZONES = [
  // CP1: body horizontal, tip south
  { body: [7, 9, 12, 10], tip: [9, 11, 10, 12] },
  // CP2: body vertical, tip east
  { body: [9, 21, 10, 26], tip: [11, 23, 12, 24] },
  // CP3: body horizontal, tip north
  { body: [31, 23, 36, 24], tip: [33, 21, 34, 22] },
  // CP4: body vertical, tip west
  { body: [33, 7, 34, 12], tip: [31, 9, 32, 10] },
  // CP5: body horizontal, tip south
  { body: [19, 9, 24, 10], tip: [21, 11, 22, 12] },
  // CP6: body vertical, tip east
  { body: [21, 33, 22, 38], tip: [23, 35, 24, 36] },
];

const COLOR_CP_BODY = 'rgba(200, 80, 40, 0.55)';  // muted red
const COLOR_CP_TIP  = 'rgba(220, 130, 30, 0.75)'; // amber tip (arrow head)
const COLOR_CP_AIM  = 'rgba(255, 220, 60, 0.40)'; // faint yellow aim block

function drawZones(ctx) {
  // Entry — 2 green tiles on left border
  fillZone(ctx, 1, 9, 1, 10, 'rgba(40, 180, 60, 0.70)');

  // Exit — 2 yellow tiles on right border
  fillZone(ctx, EXIT.x, EXIT.y, EXIT.x, EXIT.y + 1, 'rgba(220, 200, 40, 0.70)');

  // Checkpoint arrow zones
  for (let i = 0; i < CP_ZONES.length; i++) {
    const { body, tip } = CP_ZONES[i];
    fillZone(ctx, body[0], body[1], body[2], body[3], COLOR_CP_BODY);
    fillZone(ctx, tip[0],  tip[1],  tip[2],  tip[3],  COLOR_CP_TIP);

    // 2×2 aim-point block at centre of body (where enemies aim)
    const cp = CHECKPOINTS[i];
    fillZone(ctx, cp.x, cp.y, cp.x + 1, cp.y + 1, COLOR_CP_AIM);

    // Checkpoint number label in the aim-point centre
    const labelX = cp.x * CELL_SIZE;
    const labelY = cp.y * CELL_SIZE;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i + 1, labelX, labelY);
  }
}

// ---------------------------------------------------------------------------
// Draw gem shapes
// ---------------------------------------------------------------------------

function _contrastStroke(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)';
}

function drawGems(ctx, state) {
  ctx.save();
  const { grid, gems } = state;
  const drawn = new Set(); // avoid drawing the same gem 4× for its 2×2 block

  for (let y = 1; y <= GRID_ROWS; y++) {
    for (let x = 1; x <= GRID_COLS; x++) {
      const cell = grid[y][x];
      if (cell.type !== 'gem' || cell.gemId === null) continue;
      if (drawn.has(cell.gemId)) continue;
      drawn.add(cell.gemId);

      const gem = gems[cell.gemId];
      if (!gem) continue;

      const visual = gem.type === 'special'
        ? getSpecialVisual(gem.specialType)
        : getVisual(gem.type, gem.quality);

      // The gem occupies a 2×2 block with top-left at (gem.x, gem.y).
      // Center: ((gem.x-1)*CS + (gem.x+1)*CS) / 2 = gem.x * CS
      const cx = gem.x * CELL_SIZE;
      const cy = gem.y * CELL_SIZE;
      const R  = 12; // radius / half-size

      ctx.fillStyle   = visual.color;
      ctx.strokeStyle = _contrastStroke(visual.color);
      ctx.lineWidth   = 1;

      switch (visual.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;

        case 'square':
          ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
          ctx.strokeRect(cx - R, cy - R, R * 2, R * 2);
          break;

        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(cx,     cy - R);
          ctx.lineTo(cx + R, cy    );
          ctx.lineTo(cx,     cy + R);
          ctx.lineTo(cx - R, cy    );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;

        case 'pentagon':
          drawPolygon(ctx, cx, cy, R, 5);
          ctx.fill();
          ctx.stroke();
          break;

        case 'star':
          drawStar(ctx, cx, cy, R, R * 0.45);
          ctx.fill();
          ctx.stroke();
          break;

        case 'hexagon':
          drawPolygon(ctx, cx, cy, R, 6);
          ctx.fill();
          ctx.stroke();
          // Gold outer ring
          ctx.strokeStyle = 'rgba(255,220,80,0.7)';
          ctx.lineWidth   = 1;
          drawPolygon(ctx, cx, cy, R + 2, 6);
          ctx.stroke();
          break;

        default:
          // Fallback: circle
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.fill();
          break;
      }

      // Star Ruby aura ring — faint red circle showing burn aura radius
      if (gem.type === 'special') {
        const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level || 1);
        if (sStats?.effect?.type === 'burn_aura') {
          const auraR = sStats.effect.auraRange * (CELL_SIZE / 15);
          ctx.save();
          ctx.strokeStyle = 'rgba(255,60,60,0.25)';
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Draw build-phase highlights
// ---------------------------------------------------------------------------

/**
 * During the build phase, draws a bright outline around the 5 newly placed gems
 * so they stand out from the established maze.
 */
function drawBuildHighlights(ctx, state) {
  if (state.phase !== 'build' || !state.placedThisRound?.length) return;

  const placed = new Set(state.placedThisRound);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 160, 0.92)';
  ctx.lineWidth = 2;

  for (const gem of Object.values(state.gems)) {
    if (!placed.has(gem.id)) continue;
    // 2×2 block top-left pixel = ((gem.x - 1) * CS, (gem.y - 1) * CS)
    const px = (gem.x - 1) * CELL_SIZE + 1;
    const py = (gem.y - 1) * CELL_SIZE + 1;
    ctx.strokeRect(px, py, CELL_SIZE * 2 - 2, CELL_SIZE * 2 - 2);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Draw enemies
// ---------------------------------------------------------------------------

function drawEnemies(ctx, enemies) {
  if (!enemies || enemies.length === 0) return;

  for (const enemy of enemies) {
    const { x, y, hp, maxHp, flying } = enemy;
    const color = flying ? COLOR_ENEMY_FLYING : COLOR_ENEMY_GROUND;
    const radius = 6;

    // Body circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // HP bar: 8px wide, 2px tall, centered above the circle
    const barW  = 8;
    const barH  = 2;
    const barX  = x - barW / 2;
    const barY  = y - radius - barH - 2; // 2px gap above the circle
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

    // Background
    ctx.fillStyle = COLOR_ENEMY_HP_BG;
    ctx.fillRect(barX, barY, barW, barH);

    // Foreground (current HP)
    ctx.fillStyle = COLOR_ENEMY_HP_FG;
    ctx.fillRect(barX, barY, barW * hpPct, barH);
  }
}

// ---------------------------------------------------------------------------
// Draw projectiles
// ---------------------------------------------------------------------------

function drawProjectiles(ctx, projectiles) {
  if (!projectiles || projectiles.length === 0) return;

  ctx.save();
  ctx.lineWidth = 1.5;

  for (const p of projectiles) {
    ctx.strokeStyle = p.color || COLOR_PROJECTILE;
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    ctx.lineTo(p.x2, p.y2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCritNumbers(ctx, critNumbers) {
  if (!critNumbers || critNumbers.length === 0) return;
  const now = performance.now();
  ctx.save();
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const n of critNumbers) {
    const t = Math.min(1, (now - n.createdAt) / 600);
    const alpha = 1 - t;
    const offsetY = t * 22;
    ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
    ctx.fillText(n.value, n.x, n.y - offsetY);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Draw HUD overlay
// ---------------------------------------------------------------------------

function drawHUD(ctx, state, canvasWidth, hudY) {
  ctx.save();
  // Semi-transparent bar
  ctx.fillStyle = COLOR_HUD_BG;
  ctx.fillRect(0, hudY, canvasWidth, HUD_HEIGHT);

  // Text
  ctx.fillStyle = COLOR_HUD_TEXT;
  ctx.font      = '12px Arial';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';

  const text = `Wave: ${state.wave}  Lives: ${state.lives}  Gold: ${state.gold}g  Chance Lvl: ${state.gemChanceLevel}`;
  ctx.fillText(text, 8, hudY + HUD_HEIGHT / 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main render entry point
// ---------------------------------------------------------------------------

/**
 * Renders the full game state to the canvas every frame.
 *
 * @param {Object}            state  - Current game state
 * @param {HTMLCanvasElement} canvas - Target canvas element
 */
export function render(state, canvas, hudY) {
  const ctx = canvas.getContext('2d'); // browser caches this; same object every call

  // No clearRect needed: drawGrid fills every canvas pixel with a cell color.
  // 1. Draw grid cells (fills entire canvas)
  drawGrid(ctx, state);

  // 2. Special zones — entry, exit, checkpoint arrows
  drawZones(ctx);

  // 3. Gem tower shapes (drawn over the colored cells)
  drawGems(ctx, state);

  // 3b. Build-phase highlights — bright outline on newly placed gems
  drawBuildHighlights(ctx, state);

  // 4. Enemies
  drawEnemies(ctx, state.enemies);

  // 5. Projectiles
  drawProjectiles(ctx, state.projectiles);

  // 6. Crit damage numbers
  drawCritNumbers(ctx, state.critNumbers);

  // 7. HUD (drawn last, below grid)
  drawHUD(ctx, state, canvas.width, hudY);
}
