/**
 * enemy.js - Enemy definitions and behavior
 * Handles enemy types, stats, spawning, and movement.
 */

import { CELL_SIZE, ENTRY, CHECKPOINTS } from './grid.js';

// Converts the stat's cell/sec value into pixels/sec.
// e.g. 0.75 cell/sec × (16px × 5) = 60 px/sec
const SPEED_SCALE = CELL_SIZE * 5;

/**
 * Per-wave enemy base stats (index 0 = wave 1).
 * @type {Array<{hp: number, armor: number, speed: number, minSpeed: number, flying: boolean}>}
 */
export const ENEMY_STATS = [
  { hp:  10, armor: 16, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 1
  { hp:  30, armor: 16, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 2 (interpolated)
  { hp:  55, armor: 16, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 3
  { hp:  70, armor: 16, speed: 0.75, minSpeed: 0.75, flying: true  }, // wave 4
  { hp:  90, armor: 16, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 5
  { hp: 120, armor: 16, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 6
  { hp: 178, armor: 16, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 7
  { hp: 240, armor: 16, speed: 0.75, minSpeed: 0.75, flying: true  }, // wave 8
  { hp: 300, armor: 16, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 9
  { hp: 470, armor: 17, speed: 0.75, minSpeed: 0.75, flying: false }, // wave 10
];

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
];

/**
 * Spawns a new enemy for the given wave.
 *
 * @param {number} waveNumber - 1-indexed wave number (1–10)
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
    path: path,           // array of {x,y} grid cells; null for flying enemies
    pathIndex: 0,         // current target index in path (or CHECKPOINTS for flying)
    slowUntil: 0,         // timestamp (ms) when slow expires; 0 = not slowed
    currentSpeed: stats.speed * SPEED_SCALE,
    poisonDps: 0,         // current poison damage per second; 0 = not poisoned
    poisonUntil: 0,       // timestamp (ms) when poison expires
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

  // Update speed based on slow state
  if (now < enemy.slowUntil) {
    enemy.currentSpeed = enemy.minSpeed;
  } else {
    enemy.currentSpeed = enemy.speed;
  }

  // Choose waypoint list
  const waypoints = enemy.flying ? CHECKPOINTS : enemy.path;
  if (!waypoints || waypoints.length === 0) return;

  if (enemy.pathIndex >= waypoints.length) {
    enemy.exited = true;
    return;
  }

  const target = waypoints[enemy.pathIndex];
  const targetX = (target.x - 0.5) * CELL_SIZE;
  const targetY = (target.y - 0.5) * CELL_SIZE;

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
