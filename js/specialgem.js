// specialgem.js — Special gem definitions, recipes, stat lookup, and recipe matching

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/**
 * Complete definitions for all special gems and their upgrade tiers.
 * Only entries with `ingredients` are base combinable gems; upgrade tiers
 * have no ingredients (they require gold via the upgradeSpecial action).
 *
 * Range values use the same design-unit scale as base gems (≈15 units per tile).
 * Effect types:
 *   'poison'      — identical to Emerald poison (dps, slow, duration)
 *   'multi'       — identical to Topaz multi-target (targets)
 *   'splash_slow' — Silver: full-damage splash + slow to all hit enemies
 *   'burn_aura'   — Star Ruby: passive per-frame damage to all enemies in range
 *   'air_crystal' — Red Crystal: air-only attack; passive armor aura for flying enemies
 *                   (armorAura: reduction amount, auraRange: px)
 *   'crit_ground' — Pink Diamond: ground-only attack with crit
 *                   (critChance, critMult)
 *   'armor_debuff'— Gold: any-target attack with crit + armor reduction on hit
 *                   (critChance, critMult, armorDebuff: amount, debuffDuration: seconds)
 */
export const SPECIAL_GEM_DEFS = [
  // ── Jade chain ─────────────────────────────────────────────────────────────
  {
    id: 'jade',
    name: 'Jade',
    color: '#3aaa5a',
    ingredients: [
      { type: 'Emerald',  quality: 'standard' },
      { type: 'Opal',     quality: 'standard' },
      { type: 'Sapphire', quality: 'flawed'   },
    ],
    stats: {
      damageMin: 29, damageMax: 35, attackSpeed: 2.0, range: 114,
      effect: { type: 'poison', dps: 5, slow: 0.50, duration: 2 },
    },
    upgradeTo: 'asian_jade',
    upgradeCost: 45,
  },
  {
    id: 'asian_jade',
    name: 'Asian Jade',
    color: '#2a9a4a',
    stats: {
      damageMin: 49, damageMax: 50, attackSpeed: 2.0, range: 114,
      effect: { type: 'poison', dps: 10, slow: 0.50, duration: 3 },
    },
    upgradeTo: 'lucky_asian_jade',
    upgradeCost: 250,
  },
  {
    id: 'lucky_asian_jade',
    name: 'Lucky Asian Jade',
    color: '#1a8a3a',
    stats: {
      damageMin: 54, damageMax: 55, attackSpeed: 2.85, range: 122,
      effect: {
        type: 'lucky_jade',
        // Poison + slow (same as Asian Jade but 4 s)
        dps: 10, slow: 0.50, duration: 4,
        // Special procs
        critChance: 0.05, critMult: 4,       // 5% × 4
        stunChance: 0.01, stunDuration: 2,   // 1% stun 2 s
        goldChance: 0.05,                    // 5% → floor(level/2) gold
      },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Malachite chain ────────────────────────────────────────────────────────
  {
    id: 'malachite',
    name: 'Malachite',
    color: '#4cae5c',
    ingredients: [
      { type: 'Opal',       quality: 'chipped' },
      { type: 'Aquamarine', quality: 'chipped' },
      { type: 'Emerald',    quality: 'chipped' },
    ],
    stats: {
      damageMin: 5, damageMax: 6, attackSpeed: 2.86, range: 107,
      effect: { type: 'multi', targets: 3 },
    },
    upgradeTo: 'vivid_malachite',
    upgradeCost: 25,
  },
  {
    id: 'vivid_malachite',
    name: 'Vivid Malachite',
    color: '#5abe6c',
    stats: {
      damageMin: 10, damageMax: 11, attackSpeed: 2.86, range: 114,
      effect: { type: 'multi', targets: 4 },
    },
    upgradeTo: 'mighty_malachite',
    upgradeCost: 280,
  },
  {
    id: 'mighty_malachite',
    name: 'Mighty Malachite',
    color: '#6ece7c',
    stats: {
      damageMin: 44, damageMax: 45, attackSpeed: 2.86, range: 114,
      effect: { type: 'multi', targets: 10 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Silver chain ───────────────────────────────────────────────────────────
  {
    id: 'silver',
    name: 'Silver',
    color: '#aaaacc',
    ingredients: [
      { type: 'Topaz',    quality: 'chipped' },
      { type: 'Sapphire', quality: 'chipped' },
      { type: 'Diamond',  quality: 'chipped' },
    ],
    stats: {
      damageMin: 19, damageMax: 25, attackSpeed: 1.0, range: 86,
      effect: { type: 'splash_slow', radius: 20, slow: 0.20, duration: 2 },
    },
    upgradeTo: 'sterling_silver',
    upgradeCost: 100,
  },
  {
    id: 'sterling_silver',
    name: 'Sterling Silver',
    color: '#bbbbdd',
    stats: {
      damageMin: 39, damageMax: 40, attackSpeed: 1.0, range: 93,
      effect: { type: 'splash_slow', radius: 30, slow: 0.30, duration: 3 },
    },
    upgradeTo: 'silver_knight',
    upgradeCost: 300,
  },
  {
    id: 'silver_knight',
    name: 'Silver Knight',
    color: '#ccccee',
    stats: {
      damageMin: 149, damageMax: 150, attackSpeed: 1.0, range: 107,
      effect: { type: 'splash_slow', radius: 30, slow: 0.30, duration: 3 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Star Ruby chain ────────────────────────────────────────────────────────
  {
    id: 'star_ruby',
    name: 'Star Ruby',
    color: '#ff2244',
    ingredients: [
      { type: 'Ruby',     quality: 'flawed'  },
      { type: 'Ruby',     quality: 'chipped' },
      { type: 'Amethyst', quality: 'chipped' },
    ],
    stats: {
      damageMin: 10, damageMax: 11, attackSpeed: 4.0, range: 38,
      effect: { type: 'burn_aura', auraDps: 40, auraRange: 38 },
    },
    upgradeTo: 'blazing_star_ruby',
    upgradeCost: 150,
  },
  {
    id: 'blazing_star_ruby',
    name: 'Blazing Star Ruby',
    color: '#ff5522',
    stats: {
      damageMin: 15, damageMax: 16, attackSpeed: 4.0, range: 44,
      effect: { type: 'burn_aura', auraDps: 65, auraRange: 44 },
    },
    upgradeTo: 'grand_star_ruby',
    upgradeCost: 350,
  },
  {
    id: 'grand_star_ruby',
    name: 'Grand Star Ruby',
    color: '#ff8800',
    stats: {
      damageMin: 24, damageMax: 25, attackSpeed: 4.0, range: 52,
      effect: { type: 'burn_aura', auraDps: 100, auraRange: 52 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Red Crystal chain ──────────────────────────────────────────────────────
  {
    id: 'red_crystal',
    name: 'Red Crystal',
    color: '#e84040',
    ingredients: [
      { type: 'Emerald',  quality: 'flawless' },
      { type: 'Ruby',     quality: 'standard' },
      { type: 'Amethyst', quality: 'flawed'   },
    ],
    stats: {
      damageMin: 49, damageMax: 75, attackSpeed: 1.25, range: 186,
      effect: { type: 'air_crystal', armorAura: 4, auraRange: 200 },
    },
    upgradeTo: 'red_crystal_facet',
    upgradeCost: 100,
  },
  {
    id: 'red_crystal_facet',
    name: 'Red Crystal Facet',
    color: '#d03030',
    stats: {
      damageMin: 74, damageMax: 100, attackSpeed: 1.25, range: 200,
      effect: { type: 'air_crystal', armorAura: 5, auraRange: 200 },
    },
    upgradeTo: 'rose_quartz_crystal',
    upgradeCost: 100,
  },
  {
    id: 'rose_quartz_crystal',
    name: 'Rose Quartz Crystal',
    color: '#ff8099',
    stats: {
      damageMin: 99, damageMax: 125, attackSpeed: 1.25, range: 215,
      effect: { type: 'air_crystal', armorAura: 6, auraRange: 215 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Pink Diamond chain ─────────────────────────────────────────────────────
  {
    id: 'pink_diamond',
    name: 'Pink Diamond',
    color: '#ff88cc',
    ingredients: [
      { type: 'Diamond', quality: 'perfect'  },
      { type: 'Diamond', quality: 'standard' },
      { type: 'Topaz',   quality: 'standard' },
    ],
    stats: {
      damageMin: 149, damageMax: 175, attackSpeed: 1.0, range: 114,
      effect: { type: 'crit_ground', critChance: 0.10, critMult: 5 },
    },
    upgradeTo: 'great_pink_diamond',
    upgradeCost: 175,
  },
  {
    id: 'great_pink_diamond',
    name: 'Great Pink Diamond',
    color: '#ff55aa',
    stats: {
      damageMin: 174, damageMax: 195, attackSpeed: 1.538, range: 122,
      effect: { type: 'crit_ground', critChance: 0.10, critMult: 8 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Gold chain ─────────────────────────────────────────────────────────────
  {
    id: 'gold',
    name: 'Gold',
    color: '#f5c518',
    ingredients: [
      { type: 'Amethyst', quality: 'perfect'  },
      { type: 'Amethyst', quality: 'flawless' },
      { type: 'Diamond',  quality: 'flawed'   },
    ],
    stats: {
      damageMin: 159, damageMax: 190, attackSpeed: 1.0, range: 114,
      effect: { type: 'armor_debuff', critChance: 0.25, critMult: 2, armorDebuff: 5, debuffDuration: 3 },
    },
    upgradeTo: 'egyptian_gold',
    upgradeCost: 210,
  },
  {
    id: 'egyptian_gold',
    name: 'Egyptian Gold',
    color: '#e6a800',
    stats: {
      damageMin: 159, damageMax: 200, attackSpeed: 1.429, range: 114,
      effect: { type: 'armor_debuff', critChance: 0.30, critMult: 2, armorDebuff: 8, debuffDuration: 3 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },
];

// ---------------------------------------------------------------------------
// Stat lookup
// ---------------------------------------------------------------------------

/**
 * Returns leveled stats for a special gem.
 * Damage scales +10% per level above 1. Burn aura DPS scales by the same factor.
 *
 * @param {string} specialType — SPECIAL_GEM_DEFS id
 * @param {number} level       — 1-indexed gem level
 * @returns {Object|null}
 */
export function getSpecialGemLeveledStats(specialType, level) {
  const def = SPECIAL_GEM_DEFS.find(d => d.id === specialType);
  if (!def) return null;

  const base = def.stats;
  const lv   = level && level >= 1 ? level : 1;

  if (lv <= 1) {
    return {
      damageMin:   base.damageMin,
      damageMax:   base.damageMax,
      attackSpeed: base.attackSpeed,
      range:       base.range,
      effect:      base.effect ? { ...base.effect } : null,
    };
  }

  const bonus   = lv - 1;
  const dmgMult = 1 + bonus * 0.10;
  const effect  = base.effect ? { ...base.effect } : null;

  return {
    damageMin:   Math.round(base.damageMin * dmgMult),
    damageMax:   Math.round(base.damageMax * dmgMult),
    attackSpeed: base.attackSpeed,
    range:       base.range,
    effect,
  };
}

// ---------------------------------------------------------------------------
// Visual
// ---------------------------------------------------------------------------

/**
 * Returns color and shape for rendering a special gem.
 * All special gems use the 'hexagon' shape but vary in color.
 *
 * @param {string} specialType
 * @returns {{ color: string, shape: string }}
 */
export function getSpecialVisual(specialType) {
  const def = SPECIAL_GEM_DEFS.find(d => d.id === specialType);
  return { color: def?.color ?? '#888888', shape: 'hexagon' };
}

// ---------------------------------------------------------------------------
// Recipe matching
// ---------------------------------------------------------------------------

/**
 * Given a selected gem as the master, returns all special gem recipes that
 * can be completed using gems available in the current pool.
 *
 * @param {string} selectedGemId    — ID of the gem the player selected (becomes master)
 * @param {Object} allGems          — gameState.gems map
 * @param {string[]} placedThisRound — IDs placed this build phase
 * @param {'build'|'defend'} phase   — restricts pool to placedThisRound when 'build'
 * @returns {Array<{ def, ingredientIds: string[] }>}
 *   ingredientIds[i] corresponds to def.ingredients[i]; master's slot contains selectedGemId.
 */
export function findAvailableRecipes(selectedGemId, allGems, placedThisRound, phase) {
  const master = allGems[selectedGemId];
  if (!master || master.type === 'special') return [];

  // Pool of candidates: all gems except master; special gems can't be ingredients
  const candidateIds = phase === 'build'
    ? placedThisRound.filter(id => id !== selectedGemId)
    : Object.keys(allGems).filter(id => id !== selectedGemId && allGems[id]?.type !== 'special');

  const results = [];

  for (const def of SPECIAL_GEM_DEFS) {
    if (!def.ingredients) continue; // upgrade-only entry

    const ings = def.ingredients;

    // Find the first slot the master satisfies
    const masterSlot = ings.findIndex(
      ing => ing.type === master.type && ing.quality === master.quality
    );
    if (masterSlot === -1) continue;

    // Try to fill remaining slots with the best candidates
    const used       = new Set([selectedGemId]);
    const assigned   = new Array(ings.length);
    assigned[masterSlot] = selectedGemId;

    let valid = true;
    for (let i = 0; i < ings.length; i++) {
      if (i === masterSlot) continue;
      const ing  = ings[i];
      const best = candidateIds
        .filter(id => !used.has(id))
        .map(id => allGems[id])
        .filter(g => g && g.type === ing.type && g.quality === ing.quality && g.type !== 'special')
        .sort((a, b) => b.kills - a.kills || a.id.localeCompare(b.id))[0];

      if (!best) { valid = false; break; }
      assigned[i] = best.id;
      used.add(best.id);
    }

    if (valid) results.push({ def, ingredientIds: assigned });
  }

  return results;
}
