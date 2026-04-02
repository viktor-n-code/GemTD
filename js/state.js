// state.js — Game state management

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
  };
}

export function saveState(state) {
  localStorage.setItem('gemtd_save', JSON.stringify(state));
}

export function loadState() {
  try {
    const raw = localStorage.getItem('gemtd_save');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearState() {
  localStorage.removeItem('gemtd_save');
}
