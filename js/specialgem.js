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
 *   'air_crystal'  — Red Crystal: air-only attack; passive armor aura for flying enemies
 *                   (armorAura: reduction amount, auraRange: design units)
 *   'crit_ground' — Pink Diamond: ground-only attack with crit
 *                   (critChance, critMult)
 *   'armor_debuff'— Gold: any-target attack with crit + armor reduction on hit
 *                   (critChance, critMult, armorDebuff: amount, debuffDuration: seconds)
 *   'paraiba_nova'— Paraiba Tourmaline: any-target; passive ground armor aura;
 *                   33% on-hit nova splashes full hit damage within novaRadius px
 *                   (groundArmorAura, auraRange: design units, novaChance, novaRadius: px)
 *   'dmg_aura'    — Black Opal: passive +% damage to all gems in aura range
 *                   (bonus: integer %, auraRange: design units)
 *   'stun_chance'       — Dark Emerald: on-hit stun proc
 *                         (chance, stunDuration: seconds)
 *   'splash_slow'       — (MODIFIED) now supports dmgMod field; splash = damage * (dmgMod ?? 1.0)
 *   'splash_slow_dmg_aura'— Star Yellow Sapphire: splash_slow attack + passive +% dmg aura
 *                         (radius: px, dmgMod, slow, duration, dmgBonus: %, dmgAuraRange: design units)
 *   'blood_stone'       — Blood Stone: multi-target (targets) + passive burn aura; no splash
 *                         (targets, auraDps, auraRange: design units)
 *   'ancient_blood_stone'— Ancient Blood Stone: single target + crit + full splash + burn aura
 *                         (critChance, critMult, splashRadius: px, auraDps, auraRange: design units)
 *   'uranium'           — Uranium: passive slow aura + burn aura simultaneously
 *                         (slowAmount, auraDps, auraRange: design units)
 */
export const SPECIAL_GEM_DEFS = [
  // ── Jade chain ─────────────────────────────────────────────────────────────
  {
    id: 'jade',
    name: 'Jade',
    attackType: 'Aquamarine',
    color: '#3aaa5a',
    ingredients: [
      { type: 'Emerald',  quality: 'standard' },
      { type: 'Opal',     quality: 'standard' },
      { type: 'Sapphire', quality: 'flawed'   },
    ],
    stats: {
      damageMin: 29, damageMax: 35, attackSpeed: 2.0, range: 114,
      effect: { type: 'poison', dps: 5, slow: 0.20, duration: 2 },
    },
    upgradeTo: 'asian_jade',
    upgradeCost: 45,
  },
  {
    id: 'asian_jade',
    name: 'Asian Jade',
    attackType: 'Aquamarine',
    color: '#2a9a4a',
    stats: {
      damageMin: 49, damageMax: 50, attackSpeed: 2.0, range: 114,
      effect: { type: 'poison', dps: 10, slow: 0.30, duration: 3 },
    },
    upgradeTo: 'lucky_asian_jade',
    upgradeCost: 250,
  },
  {
    id: 'lucky_asian_jade',
    name: 'Lucky Asian Jade',
    attackType: 'Aquamarine',
    color: '#1a8a3a',
    stats: {
      damageMin: 54, damageMax: 55, attackSpeed: 2.85, range: 122,
      effect: {
        type: 'lucky_jade',
        // Poison + slow (same as Asian Jade but 4 s)
        dps: 10, slow: 0.40, duration: 4,
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
    attackType: 'Emerald',
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
    attackType: 'Emerald',
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
    attackType: 'Emerald',
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
    attackType: 'Sapphire',
    color: '#aaaacc',
    ingredients: [
      { type: 'Topaz',    quality: 'chipped' },
      { type: 'Sapphire', quality: 'chipped' },
      { type: 'Diamond',  quality: 'chipped' },
    ],
    stats: {
      damageMin: 19, damageMax: 25, attackSpeed: 1.0, range: 86,
      effect: { type: 'splash_slow', radius: 20, dmgMod: 0.30, slow: 0.15, duration: 2 },
    },
    upgradeTo: 'sterling_silver',
    upgradeCost: 100,
  },
  {
    id: 'sterling_silver',
    name: 'Sterling Silver',
    attackType: 'Sapphire',
    color: '#bbbbdd',
    stats: {
      damageMin: 39, damageMax: 40, attackSpeed: 1.0, range: 93,
      effect: { type: 'splash_slow', radius: 30, dmgMod: 0.40, slow: 0.25, duration: 3 },
    },
    upgradeTo: 'silver_knight',
    upgradeCost: 300,
  },
  {
    id: 'silver_knight',
    name: 'Silver Knight',
    attackType: 'Sapphire',
    color: '#ccccee',
    stats: {
      damageMin: 149, damageMax: 150, attackSpeed: 1.0, range: 107,
      effect: { type: 'splash_slow', radius: 30, dmgMod: 0.50, slow: 0.35, duration: 3 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Star Ruby chain ────────────────────────────────────────────────────────
  {
    id: 'star_ruby',
    name: 'Star Ruby',
    attackType: 'Ruby',
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
    attackType: 'Ruby',
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
    attackType: 'Ruby',
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
    attackType: 'Amethyst',
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
    attackType: 'Amethyst',
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
    attackType: 'Amethyst',
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
    attackType: 'Diamond',
    color: '#ff88cc',
    ingredients: [
      { type: 'Diamond', quality: 'perfect'  },
      { type: 'Diamond', quality: 'standard' },
      { type: 'Topaz',   quality: 'standard' },
    ],
    stats: {
      damageMin: 149, damageMax: 175, attackSpeed: 1.0, range: 114,
      effect: { type: 'crit_ground', critChance: 0.15, critMult: 6 },
    },
    upgradeTo: 'great_pink_diamond',
    upgradeCost: 175,
  },
  {
    id: 'great_pink_diamond',
    name: 'Great Pink Diamond',
    attackType: 'Diamond',
    color: '#ff55aa',
    stats: {
      damageMin: 174, damageMax: 195, attackSpeed: 1.538, range: 122,
      effect: { type: 'crit_ground', critChance: 0.15, critMult: 10 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Gold chain ─────────────────────────────────────────────────────────────
  {
    id: 'gold',
    name: 'Gold',
    attackType: 'Amethyst',
    color: '#f5c518',
    ingredients: [
      { type: 'Amethyst', quality: 'perfect'  },
      { type: 'Amethyst', quality: 'flawless' },
      { type: 'Diamond',  quality: 'flawed'   },
    ],
    stats: {
      damageMin: 159, damageMax: 190, attackSpeed: 1.0, range: 114,
      effect: { type: 'armor_debuff', critChance: 0.25, critMult: 3, armorDebuff: 5, debuffDuration: 3 },
    },
    upgradeTo: 'egyptian_gold',
    upgradeCost: 210,
  },
  {
    id: 'egyptian_gold',
    name: 'Egyptian Gold',
    attackType: 'Amethyst',
    color: '#e6a800',
    stats: {
      damageMin: 159, damageMax: 200, attackSpeed: 1.429, range: 114,
      effect: { type: 'armor_debuff', critChance: 0.30, critMult: 3, armorDebuff: 8, debuffDuration: 3 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Paraiba Tourmaline chain ───────────────────────────────────────────────
  {
    id: 'paraiba_tourmaline',
    name: 'Paraiba Tourmaline',
    attackType: 'Aquamarine',
    color: '#4fd1e8',
    ingredients: [
      { type: 'Aquamarine', quality: 'perfect'  },
      { type: 'Opal',       quality: 'flawless' },
      { type: 'Emerald',    quality: 'flawed'   },
      { type: 'Aquamarine', quality: 'flawed'   },
    ],
    stats: {
      damageMin: 25, damageMax: 105, attackSpeed: 1.333, range: 122,
      effect: { type: 'paraiba_nova', groundArmorAura: 4, auraRange: 86, novaChance: 0.33, novaRadius: 30, novaDmgMod: 0.50 },
    },
    upgradeTo: 'paraiba_tourmaline_facet',
    upgradeCost: 350,
  },
  {
    id: 'paraiba_tourmaline_facet',
    name: 'Paraiba Tourmaline Facet',
    attackType: 'Aquamarine',
    color: '#3ab8cf',
    stats: {
      damageMin: 125, damageMax: 204, attackSpeed: 1.667, range: 129,
      effect: { type: 'paraiba_nova', groundArmorAura: 6, auraRange: 93, novaChance: 0.33, novaRadius: 40, novaDmgMod: 0.75 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Black Opal chain ───────────────────────────────────────────────────────
  {
    id: 'black_opal',
    name: 'Black Opal',
    attackType: 'Opal',
    color: '#2a1a3e',
    ingredients: [
      { type: 'Opal',       quality: 'perfect'  },
      { type: 'Diamond',    quality: 'flawless' },
      { type: 'Aquamarine', quality: 'standard' },
    ],
    stats: {
      damageMin: 24, damageMax: 25, attackSpeed: 1.0, range: 114,
      effect: { type: 'dmg_aura', bonus: 30, auraRange: 143 },
    },
    upgradeTo: 'mystic_black_opal',
    upgradeCost: 300,
  },
  {
    id: 'mystic_black_opal',
    name: 'Mystic Black Opal',
    attackType: 'Opal',
    color: '#3d2a5e',
    stats: {
      damageMin: 49, damageMax: 50, attackSpeed: 1.0, range: 143,
      effect: { type: 'dmg_aura', bonus: 40, auraRange: 171 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Dark Emerald chain ─────────────────────────────────────────────────────
  {
    id: 'dark_emerald',
    name: 'Dark Emerald',
    attackType: 'Emerald',
    color: '#1a5c2a',
    ingredients: [
      { type: 'Emerald',  quality: 'perfect'  },
      { type: 'Sapphire', quality: 'flawless' },
      { type: 'Topaz',    quality: 'flawed'   },
    ],
    stats: {
      damageMin: 89, damageMax: 150, attackSpeed: 1.25, range: 79,
      effect: { type: 'stun_chance', chance: 0.125, stunDuration: 1 },
    },
    upgradeTo: 'enchanted_emerald',
    upgradeCost: 250,
  },
  {
    id: 'enchanted_emerald',
    name: 'Enchanted Emerald',
    attackType: 'Emerald',
    color: '#2a7a3a',
    stats: {
      damageMin: 98, damageMax: 200, attackSpeed: 1.429, range: 100,
      effect: { type: 'stun_chance', chance: 0.15, stunDuration: 2 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Yellow Sapphire chain ──────────────────────────────────────────────────
  {
    id: 'yellow_sapphire',
    name: 'Yellow Sapphire',
    attackType: 'Sapphire',
    color: '#ffe066',
    ingredients: [
      { type: 'Sapphire', quality: 'perfect'  },
      { type: 'Topaz',    quality: 'flawless' },
      { type: 'Ruby',     quality: 'flawless' },
    ],
    stats: {
      damageMin: 99, damageMax: 100, attackSpeed: 1.0, range: 114,
      effect: { type: 'splash_slow', radius: 40, dmgMod: 0.50, slow: 0.30, duration: 4 },
    },
    upgradeTo: 'star_yellow_sapphire',
    upgradeCost: 210,
  },
  {
    id: 'star_yellow_sapphire',
    name: 'Star Yellow Sapphire',
    attackType: 'Sapphire',
    color: '#ffd700',
    stats: {
      damageMin: 99, damageMax: 100, attackSpeed: 1.0, range: 114,
      effect: { type: 'splash_slow_dmg_aura', radius: 60, dmgMod: 1.0, slow: 0.40, duration: 5,
                dmgBonus: 5, dmgAuraRange: 171 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Blood Stone chain ──────────────────────────────────────────────────────
  {
    id: 'blood_stone',
    name: 'Blood Stone',
    attackType: 'Ruby',
    color: '#cc2222',
    ingredients: [
      { type: 'Ruby',       quality: 'perfect'  },
      { type: 'Aquamarine', quality: 'flawless' },
      { type: 'Amethyst',   quality: 'standard' },
    ],
    stats: {
      damageMin: 67, damageMax: 68, attackSpeed: 2.0, range: 100,
      effect: { type: 'blood_stone', targets: 5, auraDps: 135, auraRange: 100 },
    },
    upgradeTo: 'ancient_blood_stone',
    upgradeCost: 310,
  },
  {
    id: 'ancient_blood_stone',
    name: 'Ancient Blood Stone',
    attackType: 'Ruby',
    color: '#880000',
    stats: {
      damageMin: 159, damageMax: 240, attackSpeed: 1.333, range: 100,
      effect: { type: 'ancient_blood_stone', critChance: 0.15, critMult: 4,
                splashRadius: 40, splashDmgMod: 0.75, auraDps: 150, auraRange: 100 },
    },
    upgradeTo: null,
    upgradeCost: null,
  },

  // ── Uranium chain ──────────────────────────────────────────────────────────
  {
    id: 'uranium_235',
    name: 'Uranium 235',
    attackType: 'Topaz',
    color: '#aaff44',
    ingredients: [
      { type: 'Topaz',    quality: 'perfect'  },
      { type: 'Sapphire', quality: 'standard' },
      { type: 'Opal',     quality: 'flawed'   },
    ],
    stats: {
      damageMin: 47, damageMax: 48, attackSpeed: 4.0, range: 64,
      effect: { type: 'uranium', slowAmount: 0.40, auraDps: 190, auraRange: 64 },
    },
    upgradeTo: 'uranium_238',
    upgradeCost: 190,
  },
  {
    id: 'uranium_238',
    name: 'Uranium 238',
    attackType: 'Topaz',
    color: '#66cc00',
    stats: {
      damageMin: 64, damageMax: 65, attackSpeed: 4.0, range: 86,
      effect: { type: 'uranium', slowAmount: 0.50, auraDps: 260, auraRange: 86 },
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
 * Damage (damageMin/damageMax) scales +10% per level above 1. All other stats
 * (aura DPS, ranges, slow amounts, etc.) are fixed at their base values.
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

  // Effect parameter scaling (mirrors getLeveledStats pattern in gem.js)
  if (effect) {
    switch (effect.type) {
      case 'poison':
        effect.dps = effect.dps + bonus;
        break;
      case 'lucky_jade':
        effect.dps        = effect.dps        + bonus;
        effect.critMult   = effect.critMult   + bonus * 0.1;
        effect.stunChance = effect.stunChance + bonus * 0.001;
        break;
      case 'multi':
        // No target scaling; gains attackSpeed and range instead (below)
        break;
      case 'splash_slow':
        break;
      case 'burn_aura':
        effect.auraDps   = effect.auraDps   + bonus * 2;
        effect.auraRange = effect.auraRange + bonus * 1.5;
        break;
      case 'air_crystal':
        effect.armorAura = effect.armorAura + bonus * 0.2;
        effect.auraRange = effect.auraRange + bonus * 1.5;
        break;
      case 'crit_ground':
        effect.critMult   = effect.critMult   + bonus * 0.1;
        break;
      case 'armor_debuff':
        effect.critMult    = effect.critMult    + bonus * 0.1;
        effect.armorDebuff = effect.armorDebuff + bonus * 0.2;
        break;
      case 'paraiba_nova':
        effect.groundArmorAura = effect.groundArmorAura + bonus * 0.2;
        effect.auraRange       = effect.auraRange       + bonus * 1.5;
        break;
      case 'dmg_aura':
        effect.bonus     = effect.bonus     + bonus;
        effect.auraRange = effect.auraRange + bonus * 1.5;
        break;
      case 'stun_chance':
        effect.chance = effect.chance + bonus * 0.002;
        break;
      case 'splash_slow_dmg_aura':
        effect.dmgBonus     = effect.dmgBonus     + bonus;
        effect.dmgAuraRange = effect.dmgAuraRange + bonus * 1.5;
        break;
      case 'blood_stone':
        effect.auraDps   = effect.auraDps   + bonus * 2;
        effect.auraRange = effect.auraRange + bonus * 1.5;
        break;
      case 'ancient_blood_stone':
        effect.critMult     = effect.critMult     + bonus * 0.1;
        effect.auraDps      = effect.auraDps      + bonus * 2;
        effect.auraRange    = effect.auraRange    + bonus * 1.5;
        break;
      case 'uranium':
        effect.auraDps   = effect.auraDps   + bonus * 2;
        effect.auraRange = effect.auraRange + bonus * 1.5;
        break;
    }
  }

  // All special gems gain +0.1 tile range per level
  const range = base.range + bonus * 1.5;
  // Malachite chain gains attack speed per level
  const attackSpeed = effect?.type === 'multi'
    ? base.attackSpeed + bonus * 0.02
    : base.attackSpeed;

  return {
    damageMin:   Math.round(base.damageMin * dmgMult),
    damageMax:   Math.round(base.damageMax * dmgMult),
    attackSpeed,
    range,
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
