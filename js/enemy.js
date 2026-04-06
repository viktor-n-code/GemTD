/**
 * enemy.js - Enemy definitions and behavior
 * Handles enemy types, stats, spawning, and movement.
 */

import { CELL_SIZE, ENTRY, CHECKPOINTS, EXIT } from './grid.js';

// Converts the stat's cell/sec value into pixels/sec.
// e.g. 0.75 cell/sec × (16px × 5) = 60 px/sec
const SPEED_SCALE = CELL_SIZE * 4;

/**
 * Per-wave enemy base stats (index 0 = wave 1).
 * @type {Array<{hp: number, armor: number, speed: number, minSpeed: number, flying: boolean}>}
 */
export const ENEMY_STATS = [
  { hp:  10, armor: 10, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 1
  { hp:  30, armor: 10, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 2
  { hp:  55, armor: 10, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 3
  { hp:  70, armor: 10, speed: 0.75, minSpeed: 0.25, flying: true  }, // wave 4
  { hp:  90, armor: 11, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 5
  { hp: 120, armor: 11, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 6
  { hp: 178, armor: 11, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 7
  { hp: 240, armor: 11, speed: 0.75, minSpeed: 0.25, flying: true  }, // wave 8
  { hp:  300, armor: 12, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 9
  { hp:  470, armor: 12, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 10
  { hp:  650, armor: 12, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 11
  { hp:  550, armor: 12, speed: 0.75, minSpeed: 0.25, flying: true  }, // wave 12
  { hp:  800, armor: 13, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 13
  { hp:  925, armor: 13, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 14
  { hp: 1350, armor: 13, speed: 0.75, minSpeed: 0.25, flying: false }, // wave 15
  { hp:  850, armor: 13, speed: 0.75, minSpeed: 0.25, flying: true  }, // wave 16
  { hp: 1650, armor: 14, speed: 0.75, minSpeed: 0.38, flying: false }, // wave 17
  { hp: 2000, armor: 14, speed: 0.75, minSpeed: 0.42, flying: false }, // wave 18
  { hp: 2500, armor: 14, speed: 0.75, minSpeed: 0.45, flying: false }, // wave 19
  { hp: 1300, armor: 14, speed: 0.75, minSpeed: 0.38, flying: true  }, // wave 20
];
// Armor formula: min(10 + floor((wave - 1) / 4), 25)

/**
 * Per-wave gold rewards (index 0 = wave 1).
 * @type {Array<{killGold: number, bonusGold: number}>}
 */
export const GOLD_PER_WAVE = [
  { killGold: 1.25, bonusGold:  9 }, // wave 1
  { killGold: 1.5,  bonusGold: 11 }, // wave 2
  { killGold: 1.75, bonusGold: 13 }, // wave 3
  { killGold: 2.0,  bonusGold: 15 }, // wave 4
  { killGold: 2.25, bonusGold: 17 }, // wave 5
  { killGold: 2.5,  bonusGold: 19 }, // wave 6
  { killGold: 2.75, bonusGold: 21 }, // wave 7
  { killGold: 3.0,  bonusGold: 23 }, // wave 8
  { killGold: 3.25, bonusGold: 25 }, // wave 9
  { killGold: 3.5,  bonusGold: 27 }, // wave 10
  { killGold: 3.75, bonusGold: 29 }, // wave 11
  { killGold: 4.0,  bonusGold: 31 }, // wave 12
  { killGold: 4.25, bonusGold: 33 }, // wave 13
  { killGold: 4.5,  bonusGold: 35 }, // wave 14
  { killGold: 4.75, bonusGold: 37 }, // wave 15
  { killGold: 5.0,  bonusGold: 41 }, // wave 16
  { killGold: 5.25, bonusGold: 43 }, // wave 17  (extrapolated)
  { killGold: 5.5,  bonusGold: 45 }, // wave 18  (extrapolated)
  { killGold: 5.75, bonusGold: 47 }, // wave 19  (extrapolated)
  { killGold: 6.0,  bonusGold: 49 }, // wave 20  (extrapolated)
];

/**
 * Spawns a new enemy for the given wave.
 *
 * @param {number} waveNumber - 1-indexed wave number (1–20)
 * @param {Array<{x:number,y:number}>|null} path - A* ground path, or null for flying enemies
 * @returns {Object} Enemy instance
 */
export function spawnEnemy(waveNumber, path) {
  const stats = ENEMY_STATS[waveNumber - 1];

  // Entry cell centre in pixels
  const entryPixelX = (ENTRY.x - 0.5) * CELL_SIZE;
  const entryPixelY = (ENTRY.y - 0.5) * CELL_SIZE;

  return {
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    wave: waveNumber,
    hp: stats.hp,
    maxHp: stats.hp,
    armor: stats.armor,
    speed: stats.speed * SPEED_SCALE,
    minSpeed: stats.minSpeed * SPEED_SCALE,
    flying: stats.flying,
    x: entryPixelX,
    y: entryPixelY,
    path: stats.flying ? [...CHECKPOINTS, EXIT] : path,
    pathIndex: 0,         // current target index in path (or CHECKPOINTS for flying)
    slowUntil: 0,         // timestamp (ms) when slow expires; 0 = not slowed
    slowAmount: 0,        // fraction of speed removed (0–1); 0 = not slowed
    currentSpeed: stats.speed * SPEED_SCALE,
    poisonDps: 0,         // current poison damage per second; 0 = not poisoned
    poisonUntil: 0,       // timestamp (ms) when poison expires
    poisonGemId: null,    // id of the gem that applied the current poison instance
    stunUntil: 0,         // timestamp (ms) when stun expires; 0 = not stunned
    dead: false,
    exited: false,
  };
}

/**
 * Moves an enemy one frame along its path (ground) or CHECKPOINTS (flying).
 * Mutates the enemy object in place.
 *
 * @param {Object} enemy - The enemy to move
 * @param {number} dt    - Delta time in seconds
 * @param {number} now   - Current timestamp in ms (for slow/poison checks)
 */
export function moveEnemy(enemy, dt, now) {
  if (enemy.dead || enemy.exited) return;

  // Stun: fully frozen
  if (now < (enemy.stunUntil ?? 0)) return;

  // Update speed based on slow state
  if (now < enemy.slowUntil) {
    enemy.currentSpeed = Math.max(enemy.minSpeed, enemy.speed * (1 - enemy.slowAmount));
  } else {
    enemy.slowAmount    = 0;
    enemy.currentSpeed  = enemy.speed;
  }

  // Choose waypoint list (flying enemies have path pre-populated with CHECKPOINTS+EXIT)
  const waypoints = enemy.path;
  if (!waypoints || waypoints.length === 0) return;

  if (enemy.pathIndex >= waypoints.length) {
    enemy.exited = true;
    return;
  }

  const target = waypoints[enemy.pathIndex];
  // Both flying and ground enemies aim for the corner between the 4 centre
  // tiles when the current waypoint is a checkpoint (x * CELL_SIZE).
  // For all other A* path cells, ground enemies navigate to the cell centre
  // ((x - 0.5) * CELL_SIZE) so they walk smoothly through the grid.
  const isCP = CHECKPOINTS.some(cp => cp.x === target.x && cp.y === target.y);
  const useCorner = enemy.flying || isCP;
  const targetX = useCorner ? target.x * CELL_SIZE : (target.x - 0.5) * CELL_SIZE;
  const targetY = useCorner ? target.y * CELL_SIZE : (target.y - 0.5) * CELL_SIZE;

  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const step = enemy.currentSpeed * dt;

  if (step >= dist) {
    // Snap to waypoint and advance
    enemy.x = targetX;
    enemy.y = targetY;
    enemy.pathIndex++;
    if (enemy.pathIndex >= waypoints.length) {
      enemy.exited = true;
    }
  } else {
    enemy.x += (dx / dist) * step;
    enemy.y += (dy / dist) * step;
  }
}
