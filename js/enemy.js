/**
 * enemy.js - Enemy definitions and behavior
 * Handles enemy types, stats, spawning, and movement.
 */

/**
 * Enemy type definitions with base stats
 * @type {Object<string, Object>}
 * @todo Define enemy types with health, speed, gold value, and effects
 */
export const ENEMY_STATS = {
  // TODO: Define enemy types (e.g., weak, normal, strong, boss, etc.)
};

/**
 * Spawns a new enemy of the given type
 * @param {string} enemyType - The type of enemy to spawn
 * @param {number} waveNumber - Current wave number (affects scaling)
 * @returns {Object} Enemy object with position, health, type, etc.
 * @todo Implement enemy spawning with stat scaling based on wave
 */
export function spawnEnemy(enemyType, waveNumber) {
  // TODO: Create enemy instance with scaled stats
  return {
    type: enemyType,
    health: 0,
    maxHealth: 0,
    x: 0,
    y: 0,
    speed: 0,
    pathIndex: 0,
  };
}

/**
 * Moves an enemy along the path
 * @param {Object} enemy - The enemy to move
 * @param {Array<Object>} path - The path waypoints
 * @param {number} deltaTime - Time elapsed since last frame (seconds)
 * @returns {boolean} True if enemy reached the exit
 * @todo Implement enemy movement along path
 */
export function moveEnemy(enemy, path, deltaTime) {
  // TODO: Update enemy position, return true if reached exit
  return false;
}
