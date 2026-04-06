// ui.js — Build panel HUD rendering
// Draws the semi-transparent panel at the bottom of the canvas during 'build' phase.

import { getVisual, getStats, getLeveledStats, GEM_CHANCE_LEVELS, GEM_TYPES } from './gem.js';
import { GRID_ROWS, CELL_SIZE } from './grid.js';
import { HUD_HEIGHT } from './renderer.js';
import { SPECIAL_GEM_DEFS, getSpecialGemLeveledStats, getSpecialVisual, findAvailableRecipes } from './specialgem.js';

// ---------------------------------------------------------------------------
// Layout constants (exported so input.js can do hit-testing)
// ---------------------------------------------------------------------------

export const PANEL_H = 78;
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
export const BTN_REMOVE   = { x: 558, y: PANEL_Y + 9, w: 80,  h: 28 };

// Second-row buttons (special gem actions — visible in all phases)
export const BTN_COMBINE_SPECIAL = { x: 232, y: PANEL_Y + 50, w: 108, h: 24 };
export const BTN_UPGRADE_GEM     = { x: 344, y: PANEL_Y + 50, w: 120, h: 24 };

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
function _contrastStroke(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)';
}

function drawShapeInSlot(ctx, shape, color, cx, cy, r) {
  ctx.fillStyle = color;
  ctx.strokeStyle = _contrastStroke(color);
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

    case 'hexagon':
      drawPolygon(ctx, cx, cy, r, 6);
      ctx.fill();
      ctx.stroke();
      // Gold outer ring
      ctx.strokeStyle = 'rgba(255,220,80,0.7)';
      ctx.lineWidth = 1.5;
      drawPolygon(ctx, cx, cy, r + 2, 6);
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

// Returns a level-bonus annotation span if the value has changed from base.
// fmt receives the raw delta and returns a display string (without the leading '+').
function _lvlNote(current, base, fmt) {
  if (base == null) return '';
  const delta = current - base;
  if (Math.abs(delta) < 0.00001) return '';
  return ` <span class="info-level-note">(+${fmt(delta)} lvl)</span>`;
}

function _buildEffectHTML(effect, baseEffect) {
  if (!effect) return '';
  const b    = baseEffect || effect; // base values for delta display
  const wrap = (rows) => `<div class="info-effect">${rows}</div>`;

  switch (effect.type) {
    case 'poison':
      return wrap(
        _row('Effect', 'Poison') +
        _row('DoT', `${effect.dps} dps${_lvlNote(effect.dps, b.dps, d => d)} for ${effect.duration}s`) +
        _row('Slow', `-${Math.round(effect.slow * 100)}%${_lvlNote(effect.slow, b.slow, d => Math.round(d * 100) + '%')} for ${effect.duration}s`)
      );
    case 'slow':
      return wrap(
        _row('Effect', 'Slow') +
        _row('Amount', `-${Math.round(effect.amount * 100)}% speed${_lvlNote(effect.amount, b.amount, d => Math.round(d * 100) + '%')}`) +
        _row('Duration', `${effect.duration.toFixed(1)}s${_lvlNote(effect.duration, b.duration, d => d.toFixed(1) + 's')}`)
      );
    case 'splash':
      return wrap(
        _row('Effect', 'Splash') +
        _row('Radius', `${(effect.radius / CELL_SIZE).toFixed(1)} tiles${_lvlNote(effect.radius, b.radius, d => (d / CELL_SIZE).toFixed(1) + 't')}`) +
        _row('Damage', `${Math.round((effect.dmgMod ?? 1) * 100)}%${_lvlNote(effect.dmgMod, b.dmgMod, d => Math.round(d * 100) + '%')} to all in range`)
      );
    case 'crit':
      return wrap(
        _row('Effect', 'Critical Strike') +
        _row('Chance', `${Math.round(effect.chance * 100)}%${_lvlNote(effect.chance, b.chance, d => Math.round(d * 100) + '%')}`) +
        _row('Multiplier', `×${effect.multiplier.toFixed(1)}${_lvlNote(effect.multiplier, b.multiplier, d => d.toFixed(1) + '×')}`)
      );
    case 'multi':
      return wrap(
        _row('Effect', 'Multi-target') +
        _row('Targets', `${effect.targets} simultaneous${_lvlNote(effect.targets, b.targets, d => d)}`)
      );
    case 'splash_slow':
      return wrap(
        _row('Effect', 'Splash + Slow') +
        _row('Radius', `${(effect.radius / CELL_SIZE).toFixed(1)} tiles`) +
        _row('Slow', `-${Math.round(effect.slow * 100)}% for ${effect.duration}s`)
      );
    case 'burn_aura':
      return wrap(
        _row('Effect', 'Burn Aura') +
        _row('DPS', `${effect.auraDps} to all in range${_lvlNote(effect.auraDps, b.auraDps, d => d)}`) +
        _row('Radius', `${(effect.auraRange / 15).toFixed(1)} tiles`)
      );
    case 'aura':
      return wrap(
        _row('Effect', 'Attack Speed Aura') +
        _row('Bonus', `+${Math.round(effect.bonus * 100)}% atk spd${_lvlNote(effect.bonus, b.bonus, d => Math.round(d * 100) + '%')}`) +
        _row('Radius', `${(effect.auraRange / 15).toFixed(1)} tiles`)
      );
    default:
      return wrap(effect.type);
  }
}

function _buildSpecialGemHTML(gem, state) {
  const level = gem.level || 1;
  const ls    = getSpecialGemLeveledStats(gem.specialType, level);
  if (!ls) return `<div class="info-gem-name">${gem.name}</div>`;

  const def = SPECIAL_GEM_DEFS.find(d => d.id === gem.specialType);

  const levelLabel = level > 1 ? ` <span class="info-gem-level">Lv ${level}</span>` : '';
  const mvpBonus   = gem.mvpBonus || 0;
  const mvpMult    = 1 + mvpBonus * 0.01;
  const minDmg     = mvpBonus > 0 ? Math.round(ls.damageMin * mvpMult) : ls.damageMin;
  const maxDmg     = mvpBonus > 0 ? Math.round(ls.damageMax * mvpMult) : ls.damageMax;
  let dmgHTML = `${minDmg}–${maxDmg}`;
  if (level > 1)    dmgHTML += ` <span class="info-level-note">(+${(level - 1) * 10}% lvl)</span>`;
  if (mvpBonus > 0) dmgHTML += ` <span class="info-mvp-note">(+${mvpBonus}% MVP)</span>`;

  const spdEff = gem.auraBonus > 0
    ? (ls.attackSpeed * (1 + gem.auraBonus)).toFixed(2)
    : ls.attackSpeed.toFixed(2).replace(/\.?0+$/, '');
  const spdHTML = gem.auraBonus > 0
    ? `${spdEff}/s<div class="info-aura-note">+${Math.round(gem.auraBonus * 100)}% Opal aura</div>`
    : `${spdEff}/s`;

  let html = `
    <div class="info-section-title">Selected Gem</div>
    <div class="info-gem-name">${gem.name}${levelLabel}</div>
    <div class="info-row"><span class="info-label">Damage</span><span class="info-value">${dmgHTML}</span></div>
    <div class="info-row"><span class="info-label">Speed</span><span class="info-value">${spdHTML}</span></div>
    <div class="info-row"><span class="info-label">Range</span><span class="info-value">${(ls.range / 15).toFixed(1)} tiles</span></div>`;

  if (ls.effect) html += _buildEffectHTML(ls.effect, null);

  if (gem.kills > 0) {
    html += `<div class="info-kills">Kills: ${gem.kills} &nbsp; Dmg: ${Math.round(gem.totalDamage)}</div>`;
  }
  if (mvpBonus > 0) {
    html += `<div class="info-mvp">MVP wins: ${mvpBonus} &nbsp; (+${mvpBonus}% dmg)</div>`;
  }

  if (def?.upgradeTo) {
    const nextDef    = SPECIAL_GEM_DEFS.find(d => d.id === def.upgradeTo);
    const canAfford  = state && state.gold >= def.upgradeCost;
    const costColor  = canAfford ? '#ffcc44' : '#ff6644';
    html += `<div class="info-note" style="color:${costColor}">Upgrade → ${nextDef?.name ?? def.upgradeTo} (${def.upgradeCost}g)</div>`;
  } else {
    html += `<div class="info-note">Max tier</div>`;
  }

  return html;
}

function _buildGemHTML(gem, state) {
  if (gem.type === 'special') return _buildSpecialGemHTML(gem, state);

  const level     = gem.level || 1;
  const ls        = getLeveledStats(gem.type, gem.quality, level);
  const baseStats = level > 1 ? getStats(gem.type, gem.quality) : null;

  // Range row
  const tiles         = (ls.range / 15).toFixed(1);
  const rangeLvlNote  = _lvlNote(ls.range, baseStats?.range, d => (d / 15).toFixed(1) + 't');

  // Speed row — level note on the base speed; aura note shown separately below it
  const spdBase    = ls.attackSpeed;
  const spdEff     = gem.auraBonus > 0
    ? (spdBase * (1 + gem.auraBonus)).toFixed(2)
    : spdBase.toFixed(2).replace(/\.?0+$/, '');
  const spdLvlNote = _lvlNote(ls.attackSpeed, baseStats?.attackSpeed,
    d => d.toFixed(3).replace(/\.?0+$/, '') + '/s');
  const spdHTML    = gem.auraBonus > 0
    ? `${spdEff}/s${spdLvlNote}<div class="info-aura-note">+${Math.round(gem.auraBonus * 100)}% Opal aura</div>`
    : `${spdEff}/s${spdLvlNote}`;

  const levelLabel = level > 1
    ? ` <span class="info-gem-level">Lv ${level}</span>`
    : '';

  // Damage: show MVP-adjusted range so the bonus is visible in the tooltip
  const mvpBonus = gem.mvpBonus || 0;
  const mvpMult  = 1 + mvpBonus * 0.01;
  const minDmg   = mvpBonus > 0 ? Math.round(ls.damageMin * mvpMult) : ls.damageMin;
  const maxDmg   = mvpBonus > 0 ? Math.round(ls.damageMax * mvpMult) : ls.damageMax;
  let dmgHTML = `${minDmg}–${maxDmg}`;
  if (level > 1)    dmgHTML += ` <span class="info-level-note">(+${(level - 1) * 10}% lvl)</span>`;
  if (mvpBonus > 0) dmgHTML += ` <span class="info-mvp-note">(+${mvpBonus}% MVP)</span>`;

  let html = `
    <div class="info-section-title">Selected Gem</div>
    <div class="info-gem-name">${gem.name || gem.quality + ' ' + gem.type}${levelLabel}</div>
    <div class="info-row">
      <span class="info-label">Damage</span>
      <span class="info-value">${dmgHTML}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Speed</span>
      <span class="info-value">${spdHTML}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Range</span>
      <span class="info-value">${tiles} tiles${rangeLvlNote}</span>
    </div>`;

  const typeNote = GEM_TYPES[gem.type]?.note;
  if (typeNote) {
    html += `<div class="info-note">${typeNote}</div>`;
  }

  if (ls.effect) {
    const baseEffect = level > 1 ? baseStats.effect : null;
    html += _buildEffectHTML(ls.effect, baseEffect);
  }

  if (gem.kills > 0) {
    html += `<div class="info-kills">Kills: ${gem.kills} &nbsp; Dmg: ${Math.round(gem.totalDamage)}</div>`;
  }
  if (mvpBonus > 0) {
    html += `<div class="info-mvp">MVP wins: ${mvpBonus} &nbsp; (+${mvpBonus}% dmg)</div>`;
  }

  // Show available special gem recipes for this gem
  if (state) {
    const phase = state.phase === 'build' ? 'build' : 'defend';
    const recipes = findAvailableRecipes(gem.id, state.gems, state.placedThisRound, phase);
    for (const { def } of recipes) {
      html += `<div class="info-note">Can combine: <em>${def.name}</em></div>`;
    }
  }

  return html;
}

function _enemySpeedHTML(enemy, now) {
  const tileBase = (enemy.speed / CELL_SIZE).toFixed(1);
  if (now >= enemy.slowUntil) return `${tileBase} t/s`;
  const tileCur  = (enemy.currentSpeed / CELL_SIZE).toFixed(1);
  const tileDiff = ((enemy.speed - enemy.currentSpeed) / CELL_SIZE).toFixed(1);
  return `${tileCur} t/s <span class="info-slowed-speed">(-${tileDiff})</span>`;
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
      <span class="info-value">${Math.round(enemy.armor * 3)}%</span>
    </div>
    <div class="info-row">
      <span class="info-label">Speed</span>
      <span class="info-value">${_enemySpeedHTML(enemy, now)}</span>
    </div>`;

  const tags = [];
  if (now < enemy.slowUntil)   tags.push(`<span class="info-status-tag tag-slowed">Slowed</span>`);
  if (now < enemy.poisonUntil) tags.push(`<span class="info-status-tag tag-poison">Poison ${enemy.poisonDps}dps</span>`);
  if (tags.length > 0) html += `<div class="info-status-tags">${tags.join('')}</div>`;

  return html;
}

function _buildChancesHTML(state) {
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
  return `<div class="info-section-title">Gem Chances — Lvl ${state.gemChanceLevel}</div>`
    + qualities.map(([name, val]) =>
        `<div class="chance-row"><span class="chance-label">${name}</span><span class="chance-value">${val}%</span></div>`
      ).join('');
}

function _buildWaveHTML(state) {
  const remaining = state.enemies.filter(e => !e.dead && !e.exited).length;
  return `
    <div class="info-section-title">Wave In Progress</div>
    <div class="info-wave-stat">${state.wave}</div>
    <div class="info-wave-sub">Wave ${state.wave} of 20</div>
    <div class="info-row" style="margin-top:14px">
      <span class="info-label">Enemies left</span>
      <span class="info-value">${remaining}</span>
    </div>`;
}

function _buildLeaderboardHTML(state) {
  const gems = Object.values(state.gems);
  if (gems.length === 0) return '';

  const renderRows = (list, key) =>
    list.map((g, i) =>
      `<div class="lb-row">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name">${g.name || g.type}</span>
        <span class="lb-value">${Math.round(g[key]).toLocaleString()}</span>
      </div>`
    ).join('');

  // Round leaderboard: show once any defend phase has run (wave > 0)
  const showRound = state.wave > 0;
  const top5round = [...gems].sort((a, b) => b.roundDamage - a.roundDamage).slice(0, 5);
  const top5all   = [...gems].sort((a, b) => b.totalDamage  - a.totalDamage ).slice(0, 5);

  return (showRound
    ? `<div class="info-section-title lb-title">Round Damage</div>${renderRows(top5round, 'roundDamage')}`
    : '')
    + `<div class="info-section-title lb-title">All-Time Damage</div>${renderRows(top5all, 'totalDamage')}`;
}

/**
 * Updates the DOM info panel to the right of the canvas.
 * Called every frame from gameloop.js.
 */
export function updateInfoPanel(state, inputState) {
  const selEl     = document.getElementById('panel-selection');
  const chancesEl = document.getElementById('panel-chances');
  if (!selEl || !chancesEl) return;

  // — Selection section (top) —
  const gemId = inputState?.selectedGemId;
  if (gemId && state.gems[gemId]) {
    selEl.innerHTML = _buildGemHTML(state.gems[gemId], state) + _buildLeaderboardHTML(state);
  } else {
    const enemyId = inputState?.selectedEnemyId;
    const enemy = enemyId && state.phase === 'defend'
      ? state.enemies.find(e => e.id === enemyId && !e.dead && !e.exited)
      : null;
    selEl.innerHTML = (enemy
      ? _buildEnemyHTML(enemy, state)
      : (state.phase === 'defend' || state.phase === 'between')
        ? _buildWaveHTML(state)
        : '')
      + _buildLeaderboardHTML(state);
  }

  // — Gem chances section (bottom, always shown) —
  chancesEl.innerHTML = _buildChancesHTML(state);
}

// ---------------------------------------------------------------------------
// Tooltip drawing helper
// ---------------------------------------------------------------------------

function drawTooltip(ctx, gem, state, inputState) {
  const level = gem.level || 1;
  const stats = gem.type === 'special'
    ? getSpecialGemLeveledStats(gem.specialType, level)
    : getLeveledStats(gem.type, gem.quality, level);

  if (!stats) return;

  // Build text lines
  const titleLine = gem.type === 'special'
    ? (level > 1 ? `${gem.name}  Lv ${level}` : gem.name)
    : (level > 1 ? `${gem.quality} ${gem.type}  Lv ${level}` : `${gem.quality} ${gem.type}`);
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
  if (effect.type === 'multi')       return `Hits ${effect.targets} targets`;
  if (effect.type === 'aura')        return `Aura +${Math.round(effect.bonus * 100)}% atk spd`;
  if (effect.type === 'splash_slow') return `Splash+Slow r=${(effect.radius / CELL_SIZE).toFixed(1)}t -${Math.round(effect.slow * 100)}%`;
  if (effect.type === 'burn_aura')   return `Burn aura ${effect.auraDps}dps r=${(effect.auraRange / 15).toFixed(1)}t`;
  return effect.type;
}

export function drawUI(ctx, state, inputState) {

  // Range circle around selected gem (any phase)
  if (inputState?.selectedGemId) {
    const gem = state.gems[inputState.selectedGemId];
    if (gem) {
      const ls     = gem.type === 'special'
        ? getSpecialGemLeveledStats(gem.specialType, gem.level || 1)
        : getLeveledStats(gem.type, gem.quality, gem.level || 1);
      if (!ls) return;
      const cx     = gem.x * CELL_SIZE;
      const cy     = gem.y * CELL_SIZE;
      const radius = ls.range * (CELL_SIZE / 15);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Opal: draw a separate green dashed circle showing the aura range
      if (ls.effect?.type === 'aura') {
        const auraRadius = ls.effect.auraRange * (CELL_SIZE / 15);
        ctx.strokeStyle = 'rgba(100,255,100,0.65)';
        ctx.beginPath();
        ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // Rock highlights — build phase only
  if (state.phase === 'build') {
    // Selected rock: orange dashed border
    if (inputState?.selectedRockPos) {
      const { x: gx, y: gy } = inputState.selectedRockPos;
      const px = (gx - 1) * CELL_SIZE;
      const py = (gy - 1) * CELL_SIZE;
      ctx.save();
      ctx.fillStyle = 'rgba(255,160,60,0.20)';
      ctx.fillRect(px, py, CELL_SIZE * 2, CELL_SIZE * 2);
      ctx.strokeStyle = 'rgba(255,160,60,0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(px + 0.5, py + 0.5, CELL_SIZE * 2 - 1, CELL_SIZE * 2 - 1);
      ctx.restore();
    }
    // Hovered rock (not already selected): subtle red hint
    if (inputState?.hoveredCell) {
      const { x: gx, y: gy } = inputState.hoveredCell;
      const cell = state.grid?.[gy]?.[gx];
      const alreadySelected = inputState.selectedRockPos?.x === gx && inputState.selectedRockPos?.y === gy;
      if (cell?.type === 'rock' && !alreadySelected) {
        const px = (gx - 1) * CELL_SIZE;
        const py = (gy - 1) * CELL_SIZE;
        ctx.save();
        ctx.fillStyle = 'rgba(255,80,80,0.18)';
        ctx.fillRect(px, py, CELL_SIZE * 2, CELL_SIZE * 2);
        ctx.strokeStyle = 'rgba(255,100,100,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, CELL_SIZE * 2 - 1, CELL_SIZE * 2 - 1);
        ctx.restore();
      }
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

  // Second-row buttons: Combine Special + Upgrade Gem
  const selGemForSpecial = inputState?.selectedGemId ? state.gems[inputState.selectedGemId] : null;

  // Combine Special — active when selected base gem has completable recipes
  let combineSpecialActive = false;
  if (selGemForSpecial && selGemForSpecial.type !== 'special') {
    const phase = state.phase === 'build' ? 'build' : 'defend';
    const recipes = findAvailableRecipes(
      inputState.selectedGemId, state.gems, state.placedThisRound, phase
    );
    combineSpecialActive = recipes.length > 0;
  }
  drawButton(ctx, BTN_COMBINE_SPECIAL, 'Combine Special', combineSpecialActive, '#4a6a2a');

  // Upgrade Gem — active when selected special gem has an affordable upgrade
  let upgradeGemActive = false;
  let upgradeGemLabel  = 'Upgrade Gem';
  if (selGemForSpecial?.type === 'special') {
    const def = SPECIAL_GEM_DEFS.find(d => d.id === selGemForSpecial.specialType);
    if (def?.upgradeTo && def.upgradeCost != null) {
      upgradeGemLabel = `Upgrade (${def.upgradeCost}g)`;
      upgradeGemActive = state.gold >= def.upgradeCost;
    }
  }
  drawButton(ctx, BTN_UPGRADE_GEM, upgradeGemLabel, upgradeGemActive, '#3a4a6a');

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
        const visual = gem.type === 'special'
          ? { color: getSpecialVisual(gem.specialType).color, shape: 'hexagon' }
          : getVisual(gem.type, gem.quality);

        // Slot background (slightly darkened gem colour via the fill)
        ctx.fillStyle = visual.color;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
        ctx.globalAlpha = 1;

        // Gem shape
        drawShapeInSlot(ctx, visual.shape, visual.color, cx, cy - 6, 14);

        // Gem name label below the shape
        const slotLabel = gem.type === 'special' ? gem.name : `${gem.quality} ${gem.type}`;
        ctx.fillStyle = '#ffffff';
        ctx.font      = '8px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(slotLabel, cx, slot.y + slot.h - 2);

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

  // Remove — active when a rock is selected
  const removeActive = inputState?.selectedRockPos !== null && inputState?.selectedRockPos !== undefined;
  drawButton(ctx, BTN_REMOVE, 'Remove', removeActive, '#6a1a1a');

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
