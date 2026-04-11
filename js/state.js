// state.js — Game state management

const STORAGE_KEY = 'gemtd_save';

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
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
    // Ensure fields added after initial release exist on older saves
    if (s.gameOver === undefined) s.gameOver = false;
    if (s.gameWon  === undefined) s.gameWon  = false;
    if (s.livesLost === undefined) s.livesLost = 0;
    for (const e of (s.enemies || [])) {
      if (e.distanceTravelled === undefined) e.distanceTravelled = 0;
      if (e.stunResist === undefined) e.stunResist = 0;
      if (e.dmgResist === undefined) e.dmgResist = 0;
    }
    if (s.opalAttunement === undefined) s.opalAttunement = 0;
    if (s.opalAttunementDone === undefined) {
      const hasGreatOpal = Object.values(s.gems || {}).some(
        g => g.type === 'Opal' && g.quality === 'great'
      );
      s.opalAttunementDone = hasGreatOpal;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
