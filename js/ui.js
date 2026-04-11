// ui.js — Build panel HUD rendering
// Draws the semi-transparent panel at the bottom of the canvas during 'build' phase.

import { getVisual, getStats, getLeveledStats, GEM_CHANCE_LEVELS, GEM_TYPES, QUALITY_LEVELS } from './gem.js';
import { getGemAttackType } from './combat.js';
import { GRID_ROWS, CELL_SIZE } from './grid.js';
import { getWaveStats, getEnemyResistance } from './enemy.js';
import { SPECIAL_GEM_DEFS, getSpecialGemLeveledStats, getSpecialVisual, findAvailableRecipes } from './specialgem.js';

// ---------------------------------------------------------------------------
// Layout constants (exported so input.js can do hit-testing)
// ---------------------------------------------------------------------------

export const PANEL_H = 78;
export const PANEL_Y = GRID_ROWS * CELL_SIZE; // 752 — directly below grid (HUD moved to left panel)

// Action buttons — row 1 (full width, no gem slots)
export const BTN_COMBINE  = { x: 8,   y: PANEL_Y + 9, w: 72,  h: 28 };
export const BTN_COMBINE4 = { x: 84,  y: PANEL_Y + 9, w: 84,  h: 28 };
export const BTN_KEEP     = { x: 172, y: PANEL_Y + 9, w: 56,  h: 28 };
export const BTN_REPICK   = { x: 232, y: PANEL_Y + 9, w: 90,  h: 28 };
export const BTN_UPGRADE  = { x: 326, y: PANEL_Y + 9, w: 90,  h: 28 };
export const BTN_REMOVE   = { x: 420, y: PANEL_Y + 9, w: 72,  h: 28 };
export const BTN_DOWNGRADE = { x: 8,  y: PANEL_Y + 9, w: 100, h: 28 }; // defend phase only, row 1

// Action buttons — row 2 (special gem actions + restart, separated from Remove)
export const BTN_COMBINE_SPECIAL = { x: 232, y: PANEL_Y + 50, w: 108, h: 24 };
export const BTN_UPGRADE_GEM     = { x: 344, y: PANEL_Y + 50, w: 120, h: 24 };
export const BTN_RESTART         = { x: 476, y: PANEL_Y + 50, w: 84,  h: 24 };
export const BTN_BUY_LIFE       = { x: 564, y: PANEL_Y + 50, w: 100, h: 24 };
export const BTN_FORFEIT        = { x: 496, y: PANEL_Y + 9,  w: 64,  h: 28 };

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
    case 'lucky_jade':
      return wrap(
        _row('Effect', 'Poison + Slow') +
        _row('DoT', `${effect.dps} dps${_lvlNote(effect.dps, b.dps, d => d)} for ${effect.duration}s`) +
        _row('Slow', `-${Math.round(effect.slow * 100)}% for ${effect.duration}s`) +
        _row(`${(effect.critChance * 100).toFixed(1)}% Crit`, `×${effect.critMult.toFixed(1)} damage${_lvlNote(effect.critMult, b.critMult, d => d.toFixed(1) + '×')}`) +
        _row(`${(effect.stunChance * 100).toFixed(1)}% Stun`, `${effect.stunDuration}s`) +
        _row(`${(effect.goldChance * 100).toFixed(1)}% Gold`, `+floor(wave/2) gold`)
      );
    case 'splash_slow':
      return wrap(
        _row('Effect', 'Splash + Slow') +
        _row('Radius', `${(effect.radius / CELL_SIZE).toFixed(1)} tiles${_lvlNote(effect.radius, b.radius, d => (d / CELL_SIZE).toFixed(1) + 't')} · ${Math.round((effect.dmgMod ?? 1) * 100)}% dmg`) +
        _row('Slow', `-${Math.round(effect.slow * 100)}% for ${effect.duration}s`)
      );
    case 'splash_slow_dmg_aura':
      return wrap(
        _row('Effect', 'Splash + Slow') +
        _row('Radius', `${(effect.radius / CELL_SIZE).toFixed(1)} tiles${_lvlNote(effect.radius, b.radius, d => (d / CELL_SIZE).toFixed(1) + 't')} · ${Math.round((effect.dmgMod ?? 1) * 100)}% dmg`) +
        _row('Slow', `-${Math.round(effect.slow * 100)}% for ${effect.duration}s`) +
        _row('Dmg Aura', `+${effect.dmgBonus}%${_lvlNote(effect.dmgBonus, b.dmgBonus, d => d + '%')} to gems in ${(effect.dmgAuraRange / 15).toFixed(1)} tiles`)
      );
    case 'blood_stone':
      return wrap(
        _row('Targets', `${effect.targets} simultaneous`) +
        _row('Burn Aura', `${effect.auraDps} DPS${_lvlNote(effect.auraDps, b.auraDps, d => d)}`) +
        _row('Aura Range', `${(effect.auraRange / 15).toFixed(1)} tiles${_lvlNote(effect.auraRange, b.auraRange, d => (d / 15).toFixed(1) + 't')}`)
      );
    case 'ancient_blood_stone':
      return wrap(
        _row('Crit', `${Math.round(effect.critChance * 100)}%${_lvlNote(effect.critChance, b.critChance, d => Math.round(d * 100) + '%')} · ×${effect.critMult.toFixed(1)}${_lvlNote(effect.critMult, b.critMult, d => d.toFixed(1) + '×')}`) +
        _row('Splash', `${Math.round((effect.splashDmgMod ?? 1) * 100)}% dmg ${(effect.splashRadius / CELL_SIZE).toFixed(1)} tiles${_lvlNote(effect.splashRadius, b.splashRadius, d => (d / CELL_SIZE).toFixed(1) + 't')}`) +
        _row('Burn Aura', `${effect.auraDps} DPS${_lvlNote(effect.auraDps, b.auraDps, d => d)}`) +
        _row('Aura Range', `${(effect.auraRange / 15).toFixed(1)} tiles${_lvlNote(effect.auraRange, b.auraRange, d => (d / 15).toFixed(1) + 't')}`)
      );
    case 'uranium':
      return wrap(
        _row('Slow Aura', `-${Math.round(effect.slowAmount * 100)}% speed to all in range`) +
        _row('Burn Aura', `${effect.auraDps} DPS${_lvlNote(effect.auraDps, b.auraDps, d => d)}`) +
        _row('Aura Range', `${(effect.auraRange / 15).toFixed(1)} tiles${_lvlNote(effect.auraRange, b.auraRange, d => (d / 15).toFixed(1) + 't')}`)
      );
    case 'burn_aura':
      return wrap(
        _row('Effect', 'Burn Aura') +
        _row('DPS', `${effect.auraDps} DPS${_lvlNote(effect.auraDps, b.auraDps, d => d)}`) +
        _row('Aura Range', `${(effect.auraRange / 15).toFixed(1)} tiles${_lvlNote(effect.auraRange, b.auraRange, d => (d / 15).toFixed(1) + 't')}`)
      );
    case 'air_crystal':
      return wrap(
        _row('Targeting', 'Air only') +
        _row('Armor Aura', `−${Math.round(effect.armorAura * 3)}% damage reduction${_lvlNote(effect.armorAura, b.armorAura, d => Math.round(d * 3) + '%')} to flying`) +
        _row('Aura Range', `${(effect.auraRange / 15).toFixed(1)} tiles${_lvlNote(effect.auraRange, b.auraRange, d => (d / 15).toFixed(1) + 't')}`)
      );
    case 'crit_ground':
      return wrap(
        _row('Targeting', 'Ground only') +
        _row('Crit Chance', `${Math.round(effect.critChance * 100)}%${_lvlNote(effect.critChance, b.critChance, d => Math.round(d * 100) + '%')}`) +
        _row('Crit Mult', `×${effect.critMult.toFixed(1)}${_lvlNote(effect.critMult, b.critMult, d => d.toFixed(1) + '×')}`)
      );
    case 'armor_debuff':
      return wrap(
        _row('Crit Chance', `${Math.round(effect.critChance * 100)}%${_lvlNote(effect.critChance, b.critChance, d => Math.round(d * 100) + '%')}`) +
        _row('Crit Mult', `×${effect.critMult.toFixed(1)}${_lvlNote(effect.critMult, b.critMult, d => d.toFixed(1) + '×')}`) +
        _row('Armor Debuff', `−${Math.round(effect.armorDebuff * 3)}% damage reduction${_lvlNote(effect.armorDebuff, b.armorDebuff, d => Math.round(d * 3) + '%')} for ${effect.debuffDuration}s`)
      );
    case 'paraiba_nova':
      return wrap(
        _row('Armor Aura', `−${Math.round(effect.groundArmorAura * 3)}% damage reduction${_lvlNote(effect.groundArmorAura, b.groundArmorAura, d => Math.round(d * 3) + '%')} to ground`) +
        _row('Aura Range', `${(effect.auraRange / 15).toFixed(1)} tiles${_lvlNote(effect.auraRange, b.auraRange, d => (d / 15).toFixed(1) + 't')}`) +
        _row('Nova', `${Math.round(effect.novaChance * 100)}% on hit: ${Math.round((effect.novaDmgMod ?? 1) * 100)}% dmg splash`) +
        _row('Nova Radius', `${(effect.novaRadius / CELL_SIZE).toFixed(1)} tiles${_lvlNote(effect.novaRadius, b.novaRadius, d => (d / CELL_SIZE).toFixed(1) + 't')}`)
      );
    case 'dmg_aura':
      return wrap(
        _row('Effect', 'Damage Aura') +
        _row('Bonus', `+${effect.bonus}%${_lvlNote(effect.bonus, b.bonus, d => d + '%')} damage to all in range`) +
        _row('Radius', `${(effect.auraRange / 15).toFixed(1)} tiles${_lvlNote(effect.auraRange, b.auraRange, d => (d / 15).toFixed(1) + 't')}`)
      );
    case 'stun_chance':
      return wrap(
        _row('Effect', 'Stun') +
        _row('Chance', `${(effect.chance * 100).toFixed(1)}%${_lvlNote(effect.chance, b.chance, d => (d * 100).toFixed(1) + '%')}`) +
        _row('Duration', `${effect.stunDuration}s`)
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
  const totalDmgAura = (gem.dmgBonus ?? 0) + (gem.dmgBonus2 ?? 0);
  const baseStats = getSpecialGemLeveledStats(gem.specialType, 1);
  const lvlPct     = (level - 1) * 0.10;
  const mvpPct     = mvpBonus * 0.01;
  const dmgAuraMult = 1 + totalDmgAura * 0.01;
  const minDmg     = Math.round(baseStats.damageMin * (1 + lvlPct + mvpPct) * dmgAuraMult);
  const maxDmg     = Math.round(baseStats.damageMax * (1 + lvlPct + mvpPct) * dmgAuraMult);
  let dmgHTML = `${minDmg}–${maxDmg}`;
  if (level > 1)       dmgHTML += ` <span class="info-level-note">(+${(level - 1) * 10}% lvl)</span>`;
  if (mvpBonus > 0)    dmgHTML += ` <span class="info-mvp-note">(+${mvpBonus}% MVP)</span>`;
  const dmgAuraNote = totalDmgAura > 0
    ? `<div class="info-aura-note">+${totalDmgAura}% dmg aura</div>`
    : '';

  const spdEff = gem.auraBonus > 0
    ? (ls.attackSpeed * (1 + gem.auraBonus)).toFixed(2)
    : ls.attackSpeed.toFixed(2).replace(/\.?0+$/, '');
  const spdLvlNote = _lvlNote(ls.attackSpeed, baseStats?.attackSpeed,
    d => d.toFixed(3).replace(/\.?0+$/, '') + '/s');
  const spdHTML = gem.auraBonus > 0
    ? `${spdEff}/s${spdLvlNote}<div class="info-aura-note">+${Math.round(gem.auraBonus * 100)}% Opal aura</div>`
    : `${spdEff}/s${spdLvlNote}`;

  const rangeLvlNote = _lvlNote(ls.range, baseStats?.range, d => (d / 15).toFixed(1) + 't');
  let html = `
    <div class="info-section-title">Selected Gem</div>
    <div class="info-gem-name">${gem.name}${levelLabel}</div>
    <div class="info-row"><span class="info-label">Attack</span><span class="info-value">${getGemAttackType(gem)}</span></div>
    <div class="info-row"><span class="info-label">Damage</span><span class="info-value">${dmgHTML}${dmgAuraNote}</span></div>
    <div class="info-row"><span class="info-label">Speed</span><span class="info-value">${spdHTML}</span></div>
    <div class="info-row"><span class="info-label">Range</span><span class="info-value">${(ls.range / 15).toFixed(1)} tiles${rangeLvlNote}</span></div>`;

  if (ls.effect) {
    const baseEffect = level > 1 ? getSpecialGemLeveledStats(gem.specialType, 1)?.effect : null;
    html += _buildEffectHTML(ls.effect, baseEffect);
  }

  if (gem.kills > 0) {
    html += `<div class="info-kills">Kills: ${gem.kills} &nbsp; Dmg: ${Math.round(gem.totalDamage)}</div>`;
  } else if (gem.totalDamage > 0) {
    html += `<div class="info-kills">Dmg: ${Math.round(gem.totalDamage)}</div>`;
  }
  if (gem.goldGenerated > 0) {
    html += `<div class="info-kills">Gold generated: ${gem.goldGenerated}</div>`;
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

  // Damage: show fully-adjusted range (level + MVP additive, then dmg aura multiplicative)
  const mvpBonus = gem.mvpBonus || 0;
  const totalDmgAuraS = (gem.dmgBonus ?? 0) + (gem.dmgBonus2 ?? 0);
  const base = baseStats || ls; // base stats at level 1; falls back to ls when level === 1
  const lvlPctS = (level - 1) * 0.10;
  const mvpPctS = mvpBonus * 0.01;
  const dmgAuraMultS = 1 + totalDmgAuraS * 0.01;
  const minDmg = Math.round(base.damageMin * (1 + lvlPctS + mvpPctS) * dmgAuraMultS);
  const maxDmg = Math.round(base.damageMax * (1 + lvlPctS + mvpPctS) * dmgAuraMultS);
  let dmgHTML = `${minDmg}–${maxDmg}`;
  if (level > 1)         dmgHTML += ` <span class="info-level-note">(+${(level - 1) * 10}% lvl)</span>`;
  if (mvpBonus > 0)      dmgHTML += ` <span class="info-mvp-note">(+${mvpBonus}% MVP)</span>`;
  if (totalDmgAuraS > 0) dmgHTML += `<div class="info-aura-note">+${totalDmgAuraS}% dmg aura</div>`;

  let html = `
    <div class="info-section-title">Selected Gem</div>
    <div class="info-gem-name">${gem.name || gem.quality + ' ' + gem.type}${levelLabel}</div>
    <div class="info-row">
      <span class="info-label">Attack</span>
      <span class="info-value">${getGemAttackType(gem)}</span>
    </div>
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
  } else if (gem.totalDamage > 0) {
    html += `<div class="info-kills">Dmg: ${Math.round(gem.totalDamage)}</div>`;
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
  const auraReduction = (now < (enemy.armorAuraDebuffUntil ?? 0)) ? (enemy.armorAuraDebuff ?? 0) : 0;
  const hitReduction  = (now < (enemy.armorDebuffUntil    ?? 0)) ? (enemy.armorDebuff     ?? 0) : 0;
  const effectiveArmor = Math.max(0, enemy.armor - auraReduction - hitReduction);
  const isDebuffed = auraReduction > 0 || hitReduction > 0;

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
      <span class="info-value">${isDebuffed
        ? `${Math.round(effectiveArmor * 3)}% <span class="info-debuff-note">(base ${Math.round(enemy.armor * 3)}% −${auraReduction + hitReduction})</span>`
        : `${Math.round(enemy.armor * 3)}%`}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Speed</span>
      <span class="info-value">${_enemySpeedHTML(enemy, now)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Weakness</span>
      <span class="info-value">${enemy.weakness ?? '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label"></span>
      <span class="info-value"><span class="info-level-note">+75% ${enemy.weakness} dmg, −10% other</span></span>
    </div>`;

  // Distance-based resistance display
  const resist = getEnemyResistance(enemy);
  if (resist.dmgResist > 0.001 || resist.stunResist > 0.001) {
    html += `
    <div class="info-row">
      <span class="info-label">Resist</span>
      <span class="info-value">${Math.round(resist.dmgResist * 100)}% dmg / ${Math.round(resist.stunResist * 100)}% stun</span>
    </div>`;
  }

  const tags = [];
  if (now < (enemy.stunUntil ?? 0)) tags.push(`<span class="info-status-tag tag-stunned">Stunned</span>`);
  if (now < enemy.slowUntil)   tags.push(`<span class="info-status-tag tag-slowed">Slowed</span>`);
  if (now < enemy.poisonUntil) tags.push(`<span class="info-status-tag tag-poison">Poison ${enemy.poisonDps}dps</span>`);
  if (isDebuffed) tags.push(`<span class="info-status-tag tag-armor-debuff">−${auraReduction + hitReduction} Armor</span>`);
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
    <div class="info-wave-sub">Wave ${state.wave}</div>
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
        ? ''
        : '')
      + _buildLeaderboardHTML(state);
  }

  // — Gem chances section (bottom, always shown) —
  chancesEl.innerHTML = _buildChancesHTML(state);
}

// ---------------------------------------------------------------------------
// Left panel — HUD + trackers
// ---------------------------------------------------------------------------

export function updateLeftPanel(state) {
  const waveEl = document.getElementById('left-wave');
  const hudEl = document.getElementById('left-hud');
  const trackEl = document.getElementById('left-trackers');
  if (!hudEl || !trackEl) return;

  // Wave status section
  if (waveEl) {
    const remaining = 10 - (state.waveEnemiesGone ?? 0);
    const phaseLabel = state.phase === 'defend' ? 'Wave In Progress' : state.phase === 'build' ? 'Build Phase' : 'Between Waves';

    // Compute wave damage dealt % (accumulated + damage on alive enemies)
    let waveDmgPct = 0;
    if (state.phase === 'defend' && state.waveTotalHp > 0) {
      let aliveDmg = 0;
      for (const e of (state.enemies || [])) {
        aliveDmg += Math.max(0, e.maxHp - e.hp);
      }
      waveDmgPct = Math.min(100, ((state.waveDamageDealt + aliveDmg) / state.waveTotalHp) * 100);
    }

    waveEl.innerHTML = `
      <div class="info-section-title">${phaseLabel}</div>
      <div class="info-wave-stat">${state.wave}</div>
      <div class="info-wave-sub">Wave ${state.wave}</div>
      ${state.phase === 'defend' ? `<div class="info-row" style="margin-top:8px">
        <span class="info-label">Enemies left</span>
        <span class="info-value">${remaining}</span>
      </div>
      <div class="info-row" style="margin-top:4px">
        <span class="info-label">Dmg dealt</span>
        <span class="info-value">${waveDmgPct.toFixed(1)}%</span>
      </div>
      <div class="wave-dmg-bar-track">
        <div class="wave-dmg-bar-fill" style="width:${waveDmgPct.toFixed(1)}%"></div>
      </div>` : ''}`;
  }

  // HUD info
  const mins = Math.floor((state.defendTime || 0) / 60);
  const secs = Math.floor((state.defendTime || 0) % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const mazeLen = state.groundPath?.length ?? 0;

  // Weakness for current/next wave
  let weakLabel = '—';
  if (state.phase === 'defend' && state.wave > 0) {
    weakLabel = state.enemies.find(e => !e.dead && !e.exited)?.weakness ?? getWaveStats(state.wave).weakness;
  } else if (state.phase === 'build') {
    weakLabel = getWaveStats(state.wave + 1).weakness;
  }

  hudEl.innerHTML = `
    <div class="hud-row"><span class="hud-label">Lives</span><span class="hud-value">${state.lives}</span></div>
    <div class="hud-row"><span class="hud-label">Leaks</span><span class="hud-value">${state.livesLost || 0}</span></div>
    <div class="hud-row"><span class="hud-label">Gold</span><span class="hud-value">${state.gold}g</span></div>
    <div class="hud-row"><span class="hud-label">Lvl</span><span class="hud-value">${state.gemChanceLevel}</span></div>
    <div class="hud-row"><span class="hud-label">Time</span><span class="hud-value">${timeStr}</span></div>
    <div class="hud-row"><span class="hud-label">Maze</span><span class="hud-value">${mazeLen} tiles</span></div>
    <div class="hud-row"><span class="hud-label">Weakness</span><span class="hud-value weakness">${weakLabel}</span></div>`;

  // Gem trackers — top 5 by kills and MVP
  const gems = Object.values(state.gems || {});
  if (gems.length === 0) { trackEl.innerHTML = ''; return; }

  const byKills = [...gems].sort((a, b) => (b.kills || 0) - (a.kills || 0)).slice(0, 5);
  const byMvp   = [...gems].sort((a, b) => (b.mvpBonus || 0) - (a.mvpBonus || 0)).slice(0, 5);

  let html = '<div class="tracker-title">Top Kills</div>';
  for (const g of byKills) {
    if (!g.kills) break;
    html += `<div class="lb-row"><span class="lb-name">${g.name || '?'}</span><span class="lb-value">${g.kills}</span></div>`;
  }

  html += '<div class="tracker-title">Top MVP Bonus</div>';
  for (const g of byMvp) {
    if (!g.mvpBonus) break;
    html += `<div class="lb-row"><span class="lb-name">${g.name || '?'}</span><span class="lb-value">+${g.mvpBonus}%</span></div>`;
  }

  trackEl.innerHTML = html;
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
    : gem.totalDamage > 0
      ? `Dmg: ${Math.round(gem.totalDamage)}`
      : null;
  const goldLine = gem.goldGenerated > 0 ? `Gold generated: ${gem.goldGenerated}` : null;

  const padding = 6;
  const lineH   = 14;
  const lines    = 2 + (effectLine ? 1 : 0) + (killsLine ? 1 : 0) + (goldLine ? 1 : 0);
  const boxW     = 220;
  const boxH     = padding * 2 + lines * lineH;
  const boxY     = PANEL_Y - boxH - 4;

  // Anchor tooltip at left edge, clamped to canvas
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
    lineIdx++;
  }

  // Gold generated
  if (goldLine) {
    ctx.fillStyle = '#ffd700';
    ctx.fillText(goldLine, boxX + padding, boxY + padding + lineH * lineIdx);
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
  if (effect.type === 'lucky_jade')  return `Poison+Slow / ${(effect.critChance * 100).toFixed(1)}% ×${effect.critMult.toFixed(1)} crit / ${(effect.stunChance * 100).toFixed(1)}% stun / 5% gold`;
  if (effect.type === 'splash_slow') return `Splash+Slow r=${(effect.radius / CELL_SIZE).toFixed(1)}t -${Math.round(effect.slow * 100)}%`;
  if (effect.type === 'splash_slow_dmg_aura') return `Splash+Slow+DmgAura r=${(effect.radius / CELL_SIZE).toFixed(1)}t -${Math.round(effect.slow * 100)}%`;
  if (effect.type === 'burn_aura')   return `Burn aura ${effect.auraDps}dps r=${(effect.auraRange / 15).toFixed(1)}t`;
  if (effect.type === 'blood_stone') return `${effect.targets} targets · Burn aura ${effect.auraDps}dps`;
  if (effect.type === 'ancient_blood_stone') return `Crit+Splash · Burn aura ${effect.auraDps}dps`;
  if (effect.type === 'uranium')     return `Slow aura ${Math.round(effect.slowAmount * 100)}% · Burn ${effect.auraDps}dps`;
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

  // Build instruction — no longer overlays the grid

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

  // Restart — two-click confirm; shows as 'Restart?' in orange during confirm window
  const confirmPending = inputState?.restartConfirmUntil > performance.now();
  const restartLabel  = confirmPending ? 'Restart?' : 'Restart';
  const restartColor  = confirmPending ? '#8a4a00' : '#5a1a1a';
  drawButton(ctx, BTN_RESTART, restartLabel, true, restartColor);

  // Buy Life button — available in both build and defend phases
  const lifeCost = 10 + (state.extraLivesPurchased ?? 0) ** 2;
  const canBuyLife = state.gold >= lifeCost && state.lives < 20;
  drawButton(ctx, BTN_BUY_LIFE, `+Life (${lifeCost}g)`, canBuyLife, '#2a5a6a');

  // Forfeit — double-click to confirm (same pattern as Restart)
  const forfeitPending = inputState?.forfeitConfirmUntil > performance.now();
  const forfeitLabel = forfeitPending ? 'Forfeit?' : 'Forfeit';
  const forfeitColor = forfeitPending ? '#8a2a00' : '#6a1a1a';
  drawButton(ctx, BTN_FORFEIT, forfeitLabel, true, forfeitColor);

  // Downgrade — available during defend phase for the just-kept gem
  if (state.phase === 'defend' && state.downgradeAvailableId) {
    const dgGem = state.gems[state.downgradeAvailableId];
    if (dgGem && dgGem.type !== 'special') {
      const qi = QUALITY_LEVELS.indexOf(dgGem.quality);
      const canDowngrade = qi > 0;
      const targetQ = canDowngrade ? QUALITY_LEVELS[qi - 1] : dgGem.quality;
      drawButton(ctx, BTN_DOWNGRADE, `Downgrade → ${targetQ}`, canDowngrade, '#6a4a2a');
    }
  }

  ctx.restore();

  // Build-only elements (buttons, instruction text)
  if (state.phase !== 'build') return;

  ctx.save();

  // Build instruction text — right side of row 1
  const buildMsg = state.placedThisRound.length < 5
    ? `Place gems (${state.placedThisRound.length}/5)`
    : 'Keep or combine a gem';
  ctx.fillStyle = '#ccddee';
  ctx.font = '11px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(buildMsg, 664, PANEL_Y + 23);

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

  // 4-Combine — active when selected gem has 3+ matching partners and target quality+2 exists
  let combine4Active = false;
  if (selectedGem && state.placedThisRound.includes(inputState.selectedGemId)) {
    const matchCount4 = state.placedThisRound.filter(id => {
      if (id == null || id === inputState.selectedGemId) return false;
      const g = state.gems[id];
      return g && g.type === selectedGem.type && g.quality === selectedGem.quality;
    }).length;
    const qi4 = QUALITY_LEVELS.indexOf(selectedGem.quality);
    combine4Active = matchCount4 >= 3 && qi4 + 2 < QUALITY_LEVELS.length;
  }
  drawButton(ctx, BTN_COMBINE4, '4-Combine', combine4Active, '#2a5a2a');

  // Keep — active if a gem is selected and no gem has been kept yet
  const keepActive = (
    inputState !== null &&
    inputState.selectedGemId !== null &&
    state.keptGemId === null
  );
  drawButton(ctx, BTN_KEEP, 'Keep', keepActive, '#3a6a3a');

  // Repick — active during build phase when gems are placed and player can afford it
  const repickCost = 25 * ((state.repickCount ?? 0) + 1);
  const repickActive = state.placedThisRound.length > 0 && state.gold >= repickCost && state.keptGemId === null;
  drawButton(ctx, BTN_REPICK, `Repick (${repickCost}g)`, repickActive, '#5a4a2a');

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
