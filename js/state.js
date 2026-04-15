// state.js — Game state management

const SLOT_KEY_PREFIX = 'gemtd_slot_';
const OLD_STORAGE_KEY = 'gemtd_save';    // legacy single-save key (pre-v1.9)

export function createInitialState() {
  return {
    phase: 'build',
    wave: 0,
    lives: 10,
    livesLost: 0,
    gold: 10,
    gemChanceLevel: 1,
    grid: null,
    gems: {},
    gemCounters: {},
    placedThisRound: [],
    keptGemId: null,
    enemies: [],
    projectiles: [],
    critNumbers: [],
    extraLivesPurchased: 0,
    repickCount: 0,
    downgradeAvailableId: null,
    defendTime: 0,
    finalWaveKills: 0,
    waveEnemiesGone: 0,
    waveTotalHp: 0,          // total HP pool for current wave (count × maxHp)
    waveDamageDealt: 0,      // accumulated damage to removed enemies (dead + leaked)
    opalAttunement: 0,
    opalAttunementDone: false,
    gameOver: false,
    gameWon: false,
    gameSpeed: 1,
    gameTime: 0,
  };
}

// ---------------------------------------------------------------------------
// Slot-based save/load (3 slots)
// ---------------------------------------------------------------------------

/**
 * Save game state to a numbered slot (1-3).
 * Stores both a lightweight meta object (for display) and the full state.
 */
export function saveToSlot(slot, state) {
  const meta = {
    wave:      state.wave,
    gold:      state.gold,
    lives:     state.lives,
    gemCount:  Object.keys(state.gems || {}).length,
    timestamp: Date.now(),
  };
  // Grid is not serialisable (circular-ish refs), strip it before saving
  const { grid, ...serialisable } = state;
  localStorage.setItem(
    SLOT_KEY_PREFIX + slot,
    JSON.stringify({ meta, data: serialisable }),
  );
}

/**
 * Load game state from a numbered slot (1-3).
 * Returns the migrated state object, or null if the slot is empty / corrupt.
 */
export function loadFromSlot(slot) {
  try {
    const raw = localStorage.getItem(SLOT_KEY_PREFIX + slot);
    if (!raw) return null;
    const wrapper = JSON.parse(raw);
    if (!wrapper || !wrapper.data) return null;
    return migrateState(wrapper.data);
  } catch {
    return null;
  }
}

/**
 * Return just the metadata for a slot (wave, gold, lives, gemCount, timestamp),
 * or null if the slot is empty.  Avoids parsing the full save.
 */
export function getSlotMeta(slot) {
  try {
    const raw = localStorage.getItem(SLOT_KEY_PREFIX + slot);
    if (!raw) return null;
    const wrapper = JSON.parse(raw);
    return wrapper && wrapper.meta ? wrapper.meta : null;
  } catch {
    return null;
  }
}

/** Return an array of 3 slot metas (some may be null). */
export function getAllSlotMetas() {
  return [getSlotMeta(1), getSlotMeta(2), getSlotMeta(3)];
}

/** Delete a single save slot. */
export function clearSlot(slot) {
  localStorage.removeItem(SLOT_KEY_PREFIX + slot);
}

// ---------------------------------------------------------------------------
// Legacy migration — move old single-save key into slot 1 (one-time)
// ---------------------------------------------------------------------------

export function migrateLegacySave() {
  const old = localStorage.getItem(OLD_STORAGE_KEY);
  if (!old) return;
  // Only migrate if slot 1 is empty
  if (localStorage.getItem(SLOT_KEY_PREFIX + '1')) {
    localStorage.removeItem(OLD_STORAGE_KEY);
    return;
  }
  try {
    const parsed = JSON.parse(old);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const meta = {
        wave:      parsed.wave || 0,
        gold:      parsed.gold || 0,
        lives:     parsed.lives || 0,
        gemCount:  Object.keys(parsed.gems || {}).length,
        timestamp: Date.now(),
      };
      const { grid, ...serialisable } = parsed;
      localStorage.setItem(
        SLOT_KEY_PREFIX + '1',
        JSON.stringify({ meta, data: serialisable }),
      );
    }
  } catch { /* ignore corrupt data */ }
  localStorage.removeItem(OLD_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// State migration — ensure fields added after initial release exist
// ---------------------------------------------------------------------------

function migrateState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  if (s.gameOver === undefined) s.gameOver = false;
  if (s.gameWon  === undefined) s.gameWon  = false;
  if (s.livesLost === undefined) s.livesLost = 0;
  for (const e of (s.enemies || [])) {
    if (e.distanceTravelled === undefined) e.distanceTravelled = 0;
    if (e.stunResist === undefined) e.stunResist = 0;
  }
  for (const gem of Object.values(s.gems || {})) {
    if (gem.directDamage === undefined) gem.directDamage = 0;
    if (gem.splashDamage === undefined) gem.splashDamage = 0;
    if (gem.dotDamage    === undefined) gem.dotDamage = 0;
    if (gem.auraDamage   === undefined) gem.auraDamage = 0;
    if (gem.roundDirectDamage === undefined) gem.roundDirectDamage = 0;
    if (gem.roundSplashDamage === undefined) gem.roundSplashDamage = 0;
    if (gem.roundDotDamage    === undefined) gem.roundDotDamage = 0;
    if (gem.roundAuraDamage   === undefined) gem.roundAuraDamage = 0;
  }
  if (s.gameSpeed === undefined) s.gameSpeed = 1;
  if (s.gameTime === undefined) s.gameTime = 0;
  if (s.opalAttunement === undefined) s.opalAttunement = 0;
  if (s.opalAttunementDone === undefined) {
    const hasGreatOpal = Object.values(s.gems || {}).some(
      g => g.type === 'Opal' && g.quality === 'great'
    );
    s.opalAttunementDone = hasGreatOpal;
  }
  return s;
}
