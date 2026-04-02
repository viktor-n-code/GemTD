// state.js — Game state management

const STORAGE_KEY = 'gemtd_save';

export function createInitialState() {
  return {
    phase: 'build',
    wave: 0,
    lives: 10,
    gold: 10,
    gemChanceLevel: 1,
    grid: null,
    gems: {},
    placedThisRound: [],
    keptGemId: null,
    enemies: [],
    projectiles: [],
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
    return s;
  } catch {
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
