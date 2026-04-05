/**
 * wave.js - Wave management and enemy spawning
 * Handles wave definitions, spawning schedules, and progression.
 */

import { spawnEnemy, ENEMY_STATS } from './enemy.js';

/**
 * Wave definitions (index 0 = wave 1).
 * All demo waves send 10 enemies spaced 1 second apart.
 * @type {Array<{wave: number, count: number, intervalSec: number}>}
 */
export const WAVE_DEFS = [
  { wave:  1, count: 10, intervalSec: 1.0 },
  { wave:  2, count: 10, intervalSec: 1.0 },
  { wave:  3, count: 10, intervalSec: 1.0 },
  { wave:  4, count: 10, intervalSec: 1.0 },
  { wave:  5, count: 10, intervalSec: 1.0 },
  { wave:  6, count: 10, intervalSec: 1.0 },
  { wave:  7, count: 10, intervalSec: 1.0 },
  { wave:  8, count: 10, intervalSec: 1.0 },
  { wave:  9, count: 10, intervalSec: 1.0 },
  { wave: 10, count: 10, intervalSec: 1.0 },
  { wave: 11, count: 10, intervalSec: 1.0 },
  { wave: 12, count: 10, intervalSec: 1.0 },
  { wave: 13, count: 10, intervalSec: 1.0 },
  { wave: 14, count: 10, intervalSec: 1.0 },
  { wave: 15, count: 10, intervalSec: 1.0 },
  { wave: 16, count: 10, intervalSec: 1.0 },
  { wave: 17, count: 10, intervalSec: 1.0 },
  { wave: 18, count: 10, intervalSec: 1.0 },
  { wave: 19, count: 10, intervalSec: 1.0 },
  { wave: 20, count: 10, intervalSec: 1.0 },
];

/**
 * Manages enemy spawning for a single wave.
 */
export class WaveSpawner {
  /**
   * @param {number} waveNumber - 1-indexed wave number (1–10)
   * @param {Array<{x:number,y:number}>|null} path - A* ground path (ignored for flying waves)
   */
  constructor(waveNumber, path) {
    this.wave = waveNumber;
    this.path = path;
    this.def = WAVE_DEFS[waveNumber - 1];
    this.spawned = 0;
    this.elapsed = 0;
  }

  /**
   * Advances the spawner by dt seconds.
   * Returns a new enemy object when it is time to spawn one, otherwise null.
   *
   * @param {number} dt - Seconds since last call
   * @returns {Object|null} Newly spawned enemy, or null
   */
  update(dt) {
    this.elapsed += dt;

    if (!this.isComplete() && this.elapsed >= this.spawned * this.def.intervalSec) {
      // Flying waves pass null path — the enemy uses CHECKPOINTS internally
      const isFlying = ENEMY_STATS[this.wave - 1].flying;
      const spawnPath = isFlying ? null : this.path;
      const enemy = spawnEnemy(this.wave, spawnPath);
      this.spawned++;
      return enemy;
    }

    return null;
  }

  /**
   * Returns true when all enemies for this wave have been spawned.
   * @returns {boolean}
   */
  isComplete() {
    return this.spawned >= this.def.count;
  }
}
