/**
 * sprites.js — Offscreen canvas sprite cache
 *
 * Pre-renders gem, special gem, and enemy visuals to small offscreen canvases.
 * Each unique visual is drawn once and cached; the main render loop uses
 * drawImage() for fast blitting.
 */

import { CELL_SIZE } from './grid.js';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new Map();

/** Clear all cached sprites (e.g. on resize). */
export function invalidateCache() { cache.clear(); }

function getOrCreate(key, size, drawFn) {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  // Guard against browser canvas context limit — if context is null or
  // non-functional, return null so the caller falls back to simple rendering.
  if (!ctx) return null;
  try {
    drawFn(ctx, size);
  } catch {
    return null;
  }
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------------------
// Color palettes — light (center) → dark (edge) per gem type
// ---------------------------------------------------------------------------

const GEM_COLORS = {
  Emerald:    { light: '#5dde82', dark: '#1a6b32' },
  Ruby:       { light: '#ff6b6b', dark: '#8b1a1a' },
  Sapphire:   { light: '#4477cc', dark: '#0a1a3a' },
  Amethyst:   { light: '#c86bff', dark: '#5a1a8b' },
  Diamond:    { light: '#e8f4ff', dark: '#8ab8d6' },
  Topaz:      { light: '#ffee55', dark: '#ccaa00' },
  Aquamarine: { light: '#5ce0ee', dark: '#1a6b8b' },
  Opal:       { light: '#ffaa55', dark: '#8a5a1a' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Radial gradient from light center to dark edge. */
function gemGradient(ctx, cx, cy, r, light, dark) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

/** Compute luminance to choose contrasting stroke color. */
function contrastStroke(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? '#1a1a2e' : '#ffffff';
}

/** Draw a regular polygon path (first vertex at top). */
function polyPath(ctx, cx, cy, r, sides) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / sides;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

/** Draw a 5-pointed star path. */
function starPath(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

/** Draw a 6-pointed star (hexagram) path. */
function hexagramPath(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 6;
    const r = i % 2 === 0 ? outerR : innerR;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Regular gem sprites — 8 types × 6 qualities
// ---------------------------------------------------------------------------

const SPRITE_SIZE = 32; // pixels per sprite canvas
const R = 12;           // gem radius (matches current renderer)

function drawChipped(ctx, cx, cy, r, light, dark, stroke) {
  // Rough, chunky stone with pronounced wobble
  ctx.beginPath();
  const verts = 8;
  for (let i = 0; i < verts; i++) {
    const a = (2 * Math.PI * i) / verts;
    const wobble = r * (0.75 + 0.25 * Math.sin(i * 4.3 + 1.7));
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + wobble * Math.cos(a), cy + wobble * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = gemGradient(ctx, cx, cy, r, light, dark);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Crack line for chipped feel
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.15, cy - r * 0.4);
  ctx.lineTo(cx + r * 0.05, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawFlawed(ctx, cx, cy, r, light, dark, stroke) {
  // Equilateral triangle — first cut, minimal facets
  const s = r * 0.95;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / 3;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + s * Math.cos(a), cy + s * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = gemGradient(ctx, cx, cy, r, light, dark);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Inner facet triangle rotated 60deg for cut look
  const inner = s * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + (2 * Math.PI * i) / 3;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + inner * Math.cos(a), cy + inner * Math.sin(a));
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawStandard(ctx, cx, cy, r, light, dark, stroke) {
  // Clean diamond (rotated square)
  const s = r * 0.95;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s, cy);
  ctx.closePath();
  ctx.fillStyle = gemGradient(ctx, cx, cy, r, light, dark);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Inner highlight line
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.3, cy);
  ctx.lineTo(cx, cy + s * 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawFlawless(ctx, cx, cy, r, light, dark, stroke) {
  // Pentagon with inner highlight
  polyPath(ctx, cx, cy, r * 0.95, 5);
  ctx.fillStyle = gemGradient(ctx, cx, cy, r, light, dark);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Inner highlight pentagon
  polyPath(ctx, cx, cy, r * 0.5, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawPerfect(ctx, cx, cy, r, light, dark, stroke) {
  // 5-pointed star with radial gradient
  starPath(ctx, cx, cy, r, r * 0.45);
  ctx.fillStyle = gemGradient(ctx, cx, cy, r, light, dark);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Center sparkle
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
}

function drawGreat(ctx, cx, cy, r, light, dark, stroke) {
  // Hexagram with outer glow + inner sparkle
  ctx.save();
  ctx.shadowColor = light;
  ctx.shadowBlur = 6;
  hexagramPath(ctx, cx, cy, r, r * 0.55);
  ctx.fillStyle = gemGradient(ctx, cx, cy, r, light, dark);
  ctx.fill();
  ctx.restore();
  hexagramPath(ctx, cx, cy, r, r * 0.55);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Inner sparkle cross
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy);
  ctx.lineTo(cx + r * 0.3, cy);
  ctx.moveTo(cx, cy - r * 0.3);
  ctx.lineTo(cx, cy + r * 0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

const QUALITY_DRAWERS = {
  chipped:  drawChipped,
  flawed:   drawFlawed,
  standard: drawStandard,
  flawless: drawFlawless,
  perfect:  drawPerfect,
  great:    drawGreat,
};

/**
 * Get the cached sprite canvas for a regular gem.
 * @param {string} type    — e.g. 'Ruby'
 * @param {string} quality — e.g. 'perfect'
 * @returns {HTMLCanvasElement}
 */
export function getGemSprite(type, quality) {
  const key = `gem_${type}_${quality}`;
  const palette = GEM_COLORS[type];
  if (!palette) return null;
  const draw = QUALITY_DRAWERS[quality];
  if (!draw) return null;
  return getOrCreate(key, SPRITE_SIZE, (ctx, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const stroke = contrastStroke(palette.light);
    draw(ctx, cx, cy, R, palette.light, palette.dark, stroke);
    // Opal iridescent shimmer overlay — rebuild the gem shape path first
    if (type === 'Opal') {
      // Re-create the outer shape path (the drawer left a different path active)
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const shimmer = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
      shimmer.addColorStop(0, 'rgba(255, 200, 220, 0.25)');
      shimmer.addColorStop(0.5, 'rgba(200, 220, 255, 0.15)');
      shimmer.addColorStop(1, 'rgba(255, 240, 200, 0.10)');
      ctx.fillStyle = shimmer;
      ctx.fill();
    }
    // Specular highlight for polished gems (all except chipped)
    if (quality !== 'chipped') {
      ctx.beginPath();
      ctx.arc(cx - R * 0.25, cy - R * 0.25, R * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
  });
}

// ---------------------------------------------------------------------------
// Special gem sprites — unique per chain
// ---------------------------------------------------------------------------

/** Definitions for each special gem chain visual. */
const SPECIAL_VISUALS = {
  // Jade chain — rounded octagon, green→gold, clover icon
  jade:            { shape: 'octagon', light: '#3aaa5a', dark: '#1a5a2a', icon: 'clover', tier: 1 },
  asian_jade:      { shape: 'octagon', light: '#2a9a4a', dark: '#0a4a1a', icon: 'clover', tier: 2 },
  lucky_asian_jade:{ shape: 'octagon', light: '#1a8a3a', dark: '#005a0a', icon: 'clover', tier: 3 },
  // Malachite chain — triangle, green→teal→blue
  malachite:       { shape: 'triangle', light: '#4cae5c', dark: '#1a6a2a', icon: 'dots', tier: 1 },
  chrysocolla:     { shape: 'triangle', light: '#5abe6c', dark: '#1a7a3a', icon: 'dots', tier: 2 },
  azurite:         { shape: 'triangle', light: '#6ece7c', dark: '#1a8a4a', icon: 'dots', tier: 3 },
  // Silver chain — shield, silver→steel blue
  silver:          { shape: 'shield', light: '#ccccee', dark: '#6666aa', icon: 'sword', tier: 1 },
  sterling_silver: { shape: 'shield', light: '#bbbbdd', dark: '#5555aa', icon: 'sword', tier: 2 },
  silver_knight:   { shape: 'shield', light: '#aaaacc', dark: '#4444aa', icon: 'sword', tier: 3 },
  // Blood Stone chain — flame, dark red→crimson
  blood_stone:     { shape: 'flame', light: '#ff4444', dark: '#660000', icon: 'skull', tier: 1 },
  ancient_blood_stone: { shape: 'flame', light: '#cc0000', dark: '#440000', icon: 'skull', tier: 2 },
  // Rose Quartz chain — heart/gem, pink→rose
  rose_quartz:     { shape: 'heart', light: '#ff88cc', dark: '#993366', icon: 'spiral', tier: 1 },
  rose_quartz_crystal: { shape: 'heart', light: '#ff55aa', dark: '#882255', icon: 'spiral', tier: 2 },
  // Pink Diamond chain — cut diamond, pink→magenta
  pink_diamond:    { shape: 'cutdiamond', light: '#ff8099', dark: '#993355', icon: 'bolt', tier: 1 },
  great_pink_diamond: { shape: 'cutdiamond', light: '#ff55aa', dark: '#882244', icon: 'bolt', tier: 2 },
  // Gold chain — coin, gold→amber
  gold:            { shape: 'coin', light: '#f5c518', dark: '#8a6a00', icon: 'cross', tier: 1 },
  egyptian_gold:   { shape: 'coin', light: '#e6a800', dark: '#7a5a00', icon: 'cross', tier: 2 },
  // Paraiba chain — crystal/prism, teal→cyan
  paraiba_tourmaline:      { shape: 'prism', light: '#4fd1e8', dark: '#1a7a8a', icon: 'burst', tier: 1 },
  paraiba_tourmaline_facet:{ shape: 'prism', light: '#3ab8cf', dark: '#0a6a7a', icon: 'burst', tier: 2 },
  // Black Opal chain — dark star, black→purple
  black_opal:        { shape: 'darkstar', light: '#6644aa', dark: '#1a0a2e', icon: 'eye', tier: 1 },
  mystic_black_opal: { shape: 'darkstar', light: '#8855cc', dark: '#2a1a4e', icon: 'eye', tier: 2 },
  // Uranium chain — hazard, green→yellow-green
  uranium_235:     { shape: 'hazard', light: '#aaff44', dark: '#446600', icon: 'trefoil', tier: 1 },
  uranium_238:     { shape: 'hazard', light: '#66cc00', dark: '#335500', icon: 'trefoil', tier: 2 },
  // Yellow Sapphire chain — starburst, yellow→gold
  yellow_sapphire:      { shape: 'starburst', light: '#ffe066', dark: '#997700', icon: 'wave', tier: 1 },
  star_yellow_sapphire: { shape: 'starburst', light: '#ffd700', dark: '#886600', icon: 'wave', tier: 2 },
  // Tanzanite — hex with spikes, violet→indigo
  tanzanite:       { shape: 'spikehex', light: '#cc2222', dark: '#660000', icon: 'hammer', tier: 1 },
  // Air Crystal — wing, white→sky blue
  air_crystal:     { shape: 'wing', light: '#ccddff', dark: '#5577bb', icon: 'wind', tier: 1 },
};

// --- Shape drawers for special gems ---

function drawOctagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 4 + Math.PI / 8;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function drawShield(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.85, cy - r * 0.4);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.5);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.7, cy + r * 0.5);
  ctx.lineTo(cx - r * 0.85, cy - r * 0.4);
  ctx.closePath();
}

function drawTriangle(ctx, cx, cy, r) {
  polyPath(ctx, cx, cy, r, 3);
}

function drawFlame(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.6, cx + r, cy - r * 0.1, cx + r * 0.6, cy + r * 0.4);
  ctx.quadraticCurveTo(cx + r * 0.3, cy + r, cx, cy + r * 0.7);
  ctx.quadraticCurveTo(cx - r * 0.3, cy + r, cx - r * 0.6, cy + r * 0.4);
  ctx.bezierCurveTo(cx - r, cy - r * 0.1, cx - r * 0.5, cy - r * 0.6, cx, cy - r);
  ctx.closePath();
}

function drawHeart(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.85);
  ctx.bezierCurveTo(cx - r * 1.2, cy + r * 0.1, cx - r * 0.7, cy - r * 0.9, cx, cy - r * 0.3);
  ctx.bezierCurveTo(cx + r * 0.7, cy - r * 0.9, cx + r * 1.2, cy + r * 0.1, cx, cy + r * 0.85);
  ctx.closePath();
}

function drawCutDiamond(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.65, cy - r * 0.35);
  ctx.lineTo(cx + r * 0.4, cy + r);
  ctx.lineTo(cx - r * 0.4, cy + r);
  ctx.lineTo(cx - r * 0.65, cy - r * 0.35);
  ctx.closePath();
}

function drawCoin(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.closePath();
}

function drawPrism(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.55, cy - r * 0.2);
  ctx.lineTo(cx + r * 0.55, cy + r * 0.7);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.55, cy + r * 0.7);
  ctx.lineTo(cx - r * 0.55, cy - r * 0.2);
  ctx.closePath();
}

function drawDarkStar(ctx, cx, cy, r) {
  starPath(ctx, cx, cy, r, r * 0.5);
}

function drawHazard(ctx, cx, cy, r) {
  polyPath(ctx, cx, cy, r, 6);
}

function drawStarburst(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    const rad = i % 2 === 0 ? r : r * 0.6;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath();
}

function drawSpikeHex(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 6;
    const rad = i % 2 === 0 ? r : r * 0.7;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath();
}

function drawWing(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.3);
  ctx.quadraticCurveTo(cx + r * 1.1, cy - r, cx + r * 0.5, cy + r * 0.2);
  ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 0.8, cx, cy + r * 0.6);
  ctx.quadraticCurveTo(cx - r * 0.2, cy + r * 0.8, cx - r * 0.5, cy + r * 0.2);
  ctx.quadraticCurveTo(cx - r * 1.1, cy - r, cx, cy - r * 0.3);
  ctx.closePath();
}

const SPECIAL_SHAPES = {
  octagon: drawOctagon, shield: drawShield, triangle: drawTriangle,
  flame: drawFlame, heart: drawHeart, cutdiamond: drawCutDiamond,
  coin: drawCoin, prism: drawPrism, darkstar: drawDarkStar,
  hazard: drawHazard, starburst: drawStarburst, spikehex: drawSpikeHex,
  wing: drawWing,
};

// --- Icon drawers (small symbol inside special gems) ---

function iconClover(ctx, cx, cy, s) {
  const r = s * 0.3;
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * i) / 2;
    ctx.beginPath();
    ctx.arc(cx + r * 0.6 * Math.cos(a), cy + r * 0.6 * Math.sin(a), r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function iconSword(ctx, cx, cy, s) {
  const h = s * 0.6;
  ctx.fillRect(cx - 1, cy - h / 2, 2, h);
  ctx.fillRect(cx - h * 0.3, cy - h * 0.1, h * 0.6, 2);
}

function iconDots(ctx, cx, cy, s) {
  const r = s * 0.1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * s * 0.22, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function iconSkull(ctx, cx, cy, s) {
  const r = s * 0.28;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - r * 0.5, cy + r * 0.5, r, r * 0.5);
}

function iconSpiral(ctx, cx, cy, s) {
  const r = s * 0.3;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 3; a += 0.2) {
    const rad = r * (1 - a / (Math.PI * 4));
    const method = a === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.stroke();
}

function iconBolt(ctx, cx, cy, s) {
  const h = s * 0.35;
  ctx.beginPath();
  ctx.moveTo(cx + h * 0.1, cy - h);
  ctx.lineTo(cx - h * 0.3, cy);
  ctx.lineTo(cx + h * 0.1, cy - h * 0.1);
  ctx.lineTo(cx - h * 0.1, cy + h);
  ctx.lineTo(cx + h * 0.3, cy);
  ctx.lineTo(cx - h * 0.1, cy + h * 0.1);
  ctx.closePath();
  ctx.fill();
}

function iconCross(ctx, cx, cy, s) {
  const h = s * 0.35;
  ctx.fillRect(cx - 1, cy - h, 2, h * 2);
  ctx.fillRect(cx - h * 0.5, cy - h * 0.3, h, 2);
}

function iconBurst(ctx, cx, cy, s) {
  const r = s * 0.25;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * i) / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.stroke();
  }
}

function iconEye(ctx, cx, cy, s) {
  const r = s * 0.28;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function iconTrefoil(ctx, cx, cy, s) {
  const r = s * 0.2;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / 3;
    ctx.beginPath();
    ctx.arc(cx + r * 0.7 * Math.cos(a), cy + r * 0.7 * Math.sin(a), r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function iconWave(ctx, cx, cy, s) {
  const w = s * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.quadraticCurveTo(cx - w * 0.5, cy - w * 0.6, cx, cy);
  ctx.quadraticCurveTo(cx + w * 0.5, cy + w * 0.6, cx + w, cy);
  ctx.stroke();
}

function iconHammer(ctx, cx, cy, s) {
  const h = s * 0.3;
  ctx.fillRect(cx - 1, cy - h * 0.2, 2, h * 1.4);
  ctx.fillRect(cx - h * 0.5, cy - h * 0.6, h, h * 0.5);
}

function iconWind(ctx, cx, cy, s) {
  const w = s * 0.28;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - w, cy + i * w * 0.5);
    ctx.quadraticCurveTo(cx, cy + i * w * 0.5 - w * 0.3, cx + w, cy + i * w * 0.5);
    ctx.stroke();
  }
}

const ICON_DRAWERS = {
  clover: iconClover, sword: iconSword, dots: iconDots, skull: iconSkull,
  spiral: iconSpiral, bolt: iconBolt, cross: iconCross, burst: iconBurst,
  eye: iconEye, trefoil: iconTrefoil, wave: iconWave, hammer: iconHammer,
  wind: iconWind,
};

/**
 * Get the cached sprite canvas for a special gem.
 * @param {string} specialType — e.g. 'lucky_asian_jade'
 * @returns {HTMLCanvasElement|null}
 */
export function getSpecialGemSprite(specialType) {
  const key = `special_${specialType}`;
  const vis = SPECIAL_VISUALS[specialType];
  if (!vis) return null;
  return getOrCreate(key, SPRITE_SIZE, (ctx, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = R;
    const shapeFn = SPECIAL_SHAPES[vis.shape];
    if (!shapeFn) return;
    const tier = vis.tier || 1;

    // Glow — scales with tier
    ctx.save();
    ctx.shadowColor = vis.light;
    ctx.shadowBlur = 5 + (tier - 1) * 3;
    shapeFn(ctx, cx, cy, r);
    ctx.fillStyle = gemGradient(ctx, cx, cy, r, vis.light, vis.dark);
    ctx.fill();
    ctx.restore();

    // Stroke
    shapeFn(ctx, cx, cy, r);
    ctx.strokeStyle = contrastStroke(vis.light);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent ring for tier 2+
    if (tier >= 2) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = vis.light;
      ctx.globalAlpha = tier >= 3 ? 0.6 : 0.4;
      ctx.lineWidth = tier >= 3 ? 1.5 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Icon — brighter at higher tiers
    const iconFn = ICON_DRAWERS[vis.icon];
    if (iconFn) {
      const iconAlpha = 0.5 + tier * 0.1;
      ctx.fillStyle = `rgba(255,255,255,${iconAlpha})`;
      ctx.strokeStyle = `rgba(255,255,255,${iconAlpha})`;
      ctx.lineWidth = 1;
      iconFn(ctx, cx, cy, SPRITE_SIZE);
    }

    // Center sparkle for tier 3
    if (tier >= 3) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }
  });
}

// ---------------------------------------------------------------------------
// Enemy sprites
// ---------------------------------------------------------------------------

const ENEMY_SIZE = 16;

function drawGroundEnemy(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  const bw = 9, bh = 9;
  // Legs
  ctx.fillStyle = '#884400';
  ctx.fillRect(cx - 3, cy + 3, 2, 3);
  ctx.fillRect(cx + 1, cy + 3, 2, 3);
  // Body — rounded rectangle with richer gradient
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + 2, cy - bh / 2 + 1);
  ctx.lineTo(cx + bw / 2 - 2, cy - bh / 2 + 1);
  ctx.quadraticCurveTo(cx + bw / 2, cy - bh / 2 + 1, cx + bw / 2, cy - bh / 2 + 3);
  ctx.lineTo(cx + bw / 2, cy + bh / 2 - 1);
  ctx.quadraticCurveTo(cx + bw / 2, cy + bh / 2, cx + bw / 2 - 2, cy + bh / 2);
  ctx.lineTo(cx - bw / 2 + 2, cy + bh / 2);
  ctx.quadraticCurveTo(cx - bw / 2, cy + bh / 2, cx - bw / 2, cy + bh / 2 - 1);
  ctx.lineTo(cx - bw / 2, cy - bh / 2 + 3);
  ctx.quadraticCurveTo(cx - bw / 2, cy - bh / 2 + 1, cx - bw / 2 + 2, cy - bh / 2 + 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - bw / 2, cy, cx + bw / 2, cy);
  g.addColorStop(0, '#ff9944');
  g.addColorStop(0.35, '#ffbb66');
  g.addColorStop(0.65, '#ffbb66');
  g.addColorStop(1, '#dd6600');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#884400';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Belt/armor line
  ctx.fillStyle = 'rgba(100, 60, 20, 0.5)';
  ctx.fillRect(cx - bw / 2 + 1, cy, bw - 2, 1);
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - bh / 2 - 1, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcc88';
  ctx.fill();
  ctx.strokeStyle = '#884400';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Eyes
  ctx.fillStyle = '#442200';
  ctx.fillRect(cx - 1.5, cy - bh / 2 - 2, 1, 1);
  ctx.fillRect(cx + 0.5, cy - bh / 2 - 2, 1, 1);
}

function drawFlyingEnemy(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  // Tail contrail
  ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy + 3);
  ctx.lineTo(cx + 2, cy + 3);
  ctx.lineTo(cx, cy + 7);
  ctx.closePath();
  ctx.fill();
  // Wings — dynamic V-shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx + 7, cy - 2);
  ctx.lineTo(cx + 5, cy + 1);
  ctx.lineTo(cx + 2, cy + 3);
  ctx.lineTo(cx, cy + 2);
  ctx.lineTo(cx - 2, cy + 3);
  ctx.lineTo(cx - 5, cy + 1);
  ctx.lineTo(cx - 7, cy - 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx, cy - 4, cx, cy + 3);
  g.addColorStop(0, '#88eeff');
  g.addColorStop(0.5, '#44bbee');
  g.addColorStop(1, '#0088cc');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#006699';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // Cockpit
  ctx.beginPath();
  ctx.arc(cx, cy - 1, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Wing accent lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx + 1, cy - 2);
  ctx.lineTo(cx + 5, cy - 1);
  ctx.moveTo(cx - 1, cy - 2);
  ctx.lineTo(cx - 5, cy - 1);
  ctx.stroke();
}

/**
 * Get the cached sprite canvas for an enemy.
 * @param {boolean} isFlying
 * @returns {HTMLCanvasElement}
 */
export function getEnemySprite(isFlying) {
  const key = isFlying ? 'enemy_flying' : 'enemy_ground';
  return getOrCreate(key, ENEMY_SIZE, isFlying ? drawFlyingEnemy : drawGroundEnemy);
}
