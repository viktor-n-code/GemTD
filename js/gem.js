// gem.js — Gem definitions, rolling, and stat lookup

export const GEM_TYPES = {
  Emerald: {
    color: '#2d8a4e',
    effect: 'poison',
    stats: {
      chipped:  { damageMin: 3,   damageMax: 7,   attackSpeed: 1.25, range: 72,  effect: { type: 'poison', dps: 2,  slow: 0.10, duration: 3 } },
      flawed:   { damageMin: 9,   damageMax: 13,  attackSpeed: 1.0,  range: 79,  effect: { type: 'poison', dps: 3,  slow: 0.15, duration: 4 } },
      standard: { damageMin: 14,  damageMax: 25,  attackSpeed: 1.0,  range: 86,  effect: { type: 'poison', dps: 5,  slow: 0.20, duration: 5 } },
      flawless: { damageMin: 29,  damageMax: 38,  attackSpeed: 1.0,  range: 100, effect: { type: 'poison', dps: 8,  slow: 0.25, duration: 6 } },
      perfect:  { damageMin: 79,  damageMax: 90,  attackSpeed: 1.0,  range: 114, effect: { type: 'poison', dps: 16, slow: 0.30, duration: 8 } },
    },
  },
  Ruby: {
    color: '#c0392b',
    effect: 'splash',
    stats: {
      chipped:  { damageMin: 7,   damageMax: 9,   attackSpeed: 1.0, range: 114, effect: { type: 'splash', radius: 20, dmgMod: 0.20 } },
      flawed:   { damageMin: 12,  damageMax: 16,  attackSpeed: 1.0, range: 114, effect: { type: 'splash', radius: 25, dmgMod: 0.25 } },
      standard: { damageMin: 17,  damageMax: 22,  attackSpeed: 1.0, range: 114, effect: { type: 'splash', radius: 28, dmgMod: 0.30 } },
      flawless: { damageMin: 37,  damageMax: 45,  attackSpeed: 1.0, range: 114, effect: { type: 'splash', radius: 30, dmgMod: 0.35 } },
      perfect:  { damageMin: 96,  damageMax: 126, attackSpeed: 1.0, range: 129, effect: { type: 'splash', radius: 35, dmgMod: 0.50 } },
    },
  },
  Sapphire: {
    color: '#2980b9',
    effect: 'slow',
    stats: {
      chipped:  { damageMin: 4,   damageMax: 8,   attackSpeed: 1.0, range: 72,  effect: { type: 'slow', amount: 0.20, duration: 5 } },
      flawed:   { damageMin: 8,   damageMax: 14,  attackSpeed: 1.0, range: 93,  effect: { type: 'slow', amount: 0.25, duration: 5 } },
      standard: { damageMin: 15,  damageMax: 21,  attackSpeed: 1.0, range: 114, effect: { type: 'slow', amount: 0.30, duration: 5 } },
      flawless: { damageMin: 29,  damageMax: 40,  attackSpeed: 1.0, range: 122, effect: { type: 'slow', amount: 0.35, duration: 5 } },
      perfect:  { damageMin: 59,  damageMax: 75,  attackSpeed: 1.0, range: 180, effect: { type: 'slow', amount: 0.40, duration: 5 } },
    },
  },
  Amethyst: {
    color: '#8e44ad',
    effect: 'air',
    note: 'Targets air units only',
    stats: {
      chipped:  { damageMin: 8,   damageMax: 13,  attackSpeed: 1.25, range: 143, effect: null },
      flawed:   { damageMin: 17,  damageMax: 25,  attackSpeed: 1.0,  range: 161, effect: null },
      standard: { damageMin: 29,  damageMax: 40,  attackSpeed: 1.0,  range: 179, effect: null },
      flawless: { damageMin: 59,  damageMax: 75,  attackSpeed: 1.0,  range: 186, effect: null },
      perfect:  { damageMin: 139, damageMax: 150, attackSpeed: 1.0,  range: 215, effect: null },
    },
  },
  Diamond: {
    color: '#c8f0ff',
    effect: 'crit',
    note: 'Targets ground units only',
    stats: {
      chipped:  { damageMin: 7,   damageMax: 12,  attackSpeed: 1.25, range: 72,  effect: { type: 'crit', chance: 0.25, multiplier: 2.0 } },
      flawed:   { damageMin: 15,  damageMax: 18,  attackSpeed: 1.0,  range: 79,  effect: { type: 'crit', chance: 0.25, multiplier: 2.5 } },
      standard: { damageMin: 29,  damageMax: 37,  attackSpeed: 1.0,  range: 86,  effect: { type: 'crit', chance: 0.25, multiplier: 3.0 } },
      flawless: { damageMin: 57,  damageMax: 65,  attackSpeed: 1.0,  range: 93,  effect: { type: 'crit', chance: 0.30, multiplier: 3.0 } },
      perfect:  { damageMin: 115, damageMax: 138, attackSpeed: 1.0,  range: 107, effect: { type: 'crit', chance: 0.33, multiplier: 3.5 } },
    },
  },
  Topaz: {
    color: '#e8a000',
    effect: 'multi',
    stats: {
      chipped:  { damageMin: 3,  damageMax: 4,  attackSpeed: 1.25, range: 72, effect: { type: 'multi', targets: 2 } },
      flawed:   { damageMin: 7,  damageMax: 8,  attackSpeed: 1.0,  range: 72, effect: { type: 'multi', targets: 3 } },
      standard: { damageMin: 13, damageMax: 14, attackSpeed: 1.0,  range: 72, effect: { type: 'multi', targets: 3 } },
      flawless: { damageMin: 24, damageMax: 25, attackSpeed: 1.0,  range: 72, effect: { type: 'multi', targets: 4 } },
      perfect:  { damageMin: 67, damageMax: 68, attackSpeed: 1.0,  range: 80, effect: { type: 'multi', targets: 5 } },
    },
  },
  Aquamarine: {
    color: '#44ddaa',
    effect: null,
    note: 'Very fast attack speed',
    stats: {
      chipped:  { damageMin: 5,  damageMax: 8,   attackSpeed: 2.70, range: 50, effect: null },
      flawed:   { damageMin: 11, damageMax: 15,  attackSpeed: 2.75, range: 52, effect: null },
      standard: { damageMin: 23, damageMax: 30,  attackSpeed: 2.80, range: 54, effect: null },
      flawless: { damageMin: 47, damageMax: 55,  attackSpeed: 2.85, range: 61, effect: null },
      perfect:  { damageMin: 94, damageMax: 114, attackSpeed: 2.90, range: 79, effect: null },
    },
  },
  Opal: {
    color: '#ffaa77',
    effect: 'aura',
    stats: {
      chipped:  { damageMin: 4,  damageMax: 5,  attackSpeed: 1.25, range: 86,  effect: { type: 'aura', bonus: 0.10, auraRange: 86  } },
      flawed:   { damageMin: 9,  damageMax: 10, attackSpeed: 1.0,  range: 100, effect: { type: 'aura', bonus: 0.15, auraRange: 100 } },
      standard: { damageMin: 19, damageMax: 20, attackSpeed: 1.0,  range: 114, effect: { type: 'aura', bonus: 0.20, auraRange: 115 } },
      flawless: { damageMin: 39, damageMax: 40, attackSpeed: 1.0,  range: 129, effect: { type: 'aura', bonus: 0.25, auraRange: 129 } },
      perfect:  { damageMin: 84, damageMax: 85, attackSpeed: 1.0,  range: 143, effect: { type: 'aura', bonus: 0.35, auraRange: 143 } },
    },
  },
};

export const QUALITY_LEVELS = ['chipped', 'flawed', 'standard', 'flawless', 'perfect'];

export const GEM_CHANCE_LEVELS = [
  { cost: 0,   chances: { chipped: 99, flawed: 1,  standard: 0,  flawless: 0,  perfect: 0  } },
  { cost: 30,  chances: { chipped: 69, flawed: 30, standard: 1,  flawless: 0,  perfect: 0  } },
  { cost: 50,  chances: { chipped: 59, flawed: 30, standard: 10, flawless: 1,  perfect: 0  } },
  { cost: 80,  chances: { chipped: 49, flawed: 30, standard: 20, flawless: 1,  perfect: 0  } },
  { cost: 110, chances: { chipped: 39, flawed: 30, standard: 20, flawless: 10, perfect: 1  } },
  { cost: 140, chances: { chipped: 29, flawed: 30, standard: 30, flawless: 10, perfect: 1  } },
  { cost: 170, chances: { chipped: 19, flawed: 30, standard: 30, flawless: 20, perfect: 1  } },
  { cost: 200, chances: { chipped: 9,  flawed: 30, standard: 30, flawless: 30, perfect: 1  } },
  { cost: 230, chances: { chipped: 0,  flawed: 30, standard: 30, flawless: 30, perfect: 10 } },
];

const SHAPES = {
  chipped:  'circle',
  flawed:   'square',
  standard: 'diamond',
  flawless: 'pentagon',
  perfect:  'star',
};

const TYPE_NAMES = Object.keys(GEM_TYPES);

// chanceLevel is 1-indexed; index into GEM_CHANCE_LEVELS is chanceLevel - 1
export function rollGem(chanceLevel) {
  const entry = GEM_CHANCE_LEVELS[chanceLevel - 1];
  if (!entry) throw new RangeError(`Invalid chanceLevel: ${chanceLevel}`);
  const chances = entry.chances;

  let roll = Math.random() * 100;
  let quality = 'chipped';
  for (const q of QUALITY_LEVELS) {
    if (roll < chances[q]) { quality = q; break; }
    roll -= chances[q];
  }

  const type = TYPE_NAMES[Math.floor(Math.random() * TYPE_NAMES.length)];
  return { type, quality };
}

// getVisual(type, quality) — both are strings; type is a GEM_TYPES key, quality is a QUALITY_LEVELS entry
export function getVisual(type, quality) {
  return {
    color: GEM_TYPES[type].color,
    shape: SHAPES[quality],
  };
}

export function getStats(type, quality) {
  const s = GEM_TYPES[type].stats[quality];
  return {
    damageMin:   s.damageMin,
    damageMax:   s.damageMax,
    attackSpeed: s.attackSpeed,
    range:       s.range,
    effect:      s.effect,
  };
}

/**
 * Returns stats for a gem at the given level (1-indexed).
 * Level 1 is identical to getStats(). Each level above 1 adds +10% damage
 * and scales per-gem effects.
 */
export function getLeveledStats(type, quality, level) {
  const base = getStats(type, quality);
  if (!level || level <= 1) return base;

  const bonus = level - 1; // levels gained above base
  const dmgMult = 1 + bonus * 0.10;

  // Deep-clone effect so we don't mutate the shared definition
  let effect = base.effect ? { ...base.effect } : null;

  if (effect) {
    switch (type) {
      case 'Emerald':
        effect.dps      = effect.dps  + bonus;
        effect.slow     = effect.slow + bonus * 0.01;
        break;
      case 'Ruby':
        effect.dmgMod   = effect.dmgMod + bonus * 0.01;
        effect.radius   = effect.radius + bonus * 1.6; // 0.1 tile × 16px
        break;
      case 'Sapphire':
        effect.amount   = effect.amount   + bonus * 0.01;
        effect.duration = effect.duration + bonus * 0.1;
        break;
      case 'Diamond':
        effect.chance     = effect.chance     + bonus * 0.01;
        effect.multiplier = effect.multiplier + bonus * 0.1;
        break;
      case 'Topaz':
        effect.targets  = effect.targets + Math.floor(bonus / 5);
        break;
      case 'Opal':
        effect.bonus    = effect.bonus + bonus * 0.01;
        break;
    }
  }

  let attackSpeed = base.attackSpeed;
  let range       = base.range;

  if (type === 'Aquamarine') {
    attackSpeed = base.attackSpeed + bonus * 0.025;
    range       = base.range       + bonus * 1.5; // 0.1 tile × 15 units/tile
  }
  if (type === 'Amethyst') {
    range = base.range + bonus * 7.5; // 0.5 tiles × 15 units/tile
  }

  return {
    damageMin:   Math.round(base.damageMin * dmgMult),
    damageMax:   Math.round(base.damageMax * dmgMult),
    attackSpeed,
    range,
    effect,
  };
}
