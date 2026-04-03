/**
 * combat.js - Combat and effect system
 * Handles gem attacking, damage calculations, and status effects.
 */

import { CELL_SIZE } from './grid.js';
import { getStats } from './gem.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ADVANTAGE  = 1.5;

// ---------------------------------------------------------------------------
// canAttack
// ---------------------------------------------------------------------------

/**
 * Returns true if the gem's attack cooldown has elapsed.
 *
 * @param {Object} gem - Gem with lastAttackTime and attackCooldown fields
 * @param {number} now - Current timestamp in ms
 * @returns {boolean}
 */
export function canAttack(gem, now) {
  return now - gem.lastAttackTime >= gem.attackCooldown;
}

// ---------------------------------------------------------------------------
// isInRange
// ---------------------------------------------------------------------------

/**
 * Returns true if the enemy is within the gem's attack range.
 *
 * Ground-targeting gems skip flying enemies; Amethyst only targets flying.
 *
 * @param {Object} gem   - Gem object with type, quality, x, y (grid coords)
 * @param {Object} enemy - Enemy object with x, y (pixels), flying flag
 * @returns {boolean}
 */
export function isInRange(gem, enemy) {
  // Amethyst only attacks flying enemies
  if (gem.type === 'Amethyst' && !enemy.flying) return false;
  // Diamond only attacks ground enemies
  if (gem.type === 'Diamond' && enemy.flying) return false;

  const stats = getStats(gem.type, gem.quality);

  // Gem pixel centre: grid coords are top-left of the 2×2 block.
  // Use the same formula as the renderer: gem.x * CELL_SIZE (top-left corner).
  // Centre of a 2×2 block is +1 cell = +CELL_SIZE pixels from top-left.
  const gemPx = gem.x * CELL_SIZE; // centre x — matches renderer.js convention
  const gemPy = gem.y * CELL_SIZE; // centre y

  const dx = enemy.x - gemPx;
  const dy = enemy.y - gemPy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Range values are in design units where 15 units = 1 tile (CELL_SIZE px).
  return dist <= stats.range * (CELL_SIZE / 15);
}

// ---------------------------------------------------------------------------
// applyEffect
// ---------------------------------------------------------------------------

/**
 * Applies a status effect from a gem hit to an enemy.
 * Only the most powerful instance of each effect type applies (no stacking).
 *
 * @param {Object}      enemy  - Enemy object (mutated in place)
 * @param {Object|null} effect - Effect descriptor from getStats(), e.g.
 *                               { type:'poison', dps, slow, duration }
 *                               { type:'slow', amount, duration }
 *                               null (Amethyst / air)
 * @param {number}      now    - Current timestamp in ms
 */
export function applyEffect(enemy, effect, now) {
  if (enemy.dead || enemy.exited) return;
  if (!effect) return;

  if (effect.type === 'poison') {
    // Poison: only upgrade if the new DPS is higher
    if (effect.dps > enemy.poisonDps) {
      enemy.poisonDps   = effect.dps;
      enemy.poisonUntil = now + effect.duration * 1000;
    }
    // Slow part of poison: extend slowUntil if the new expiry is later
    const newSlowUntil = now + effect.duration * 1000;
    if (newSlowUntil > enemy.slowUntil) {
      enemy.slowUntil = newSlowUntil;
    }
    return;
  }

  if (effect.type === 'slow') {
    const newSlowUntil = now + effect.duration * 1000;
    if (newSlowUntil > enemy.slowUntil) {
      enemy.slowUntil = newSlowUntil;
    }
    return;
  }

  // 'splash' effects are handled by applySplash; 'air' has no secondary effect.
}

// ---------------------------------------------------------------------------
// applySplash
// ---------------------------------------------------------------------------

/**
 * Applies splash damage to enemies near the primary target.
 * Called after the primary hit when the attacking gem is a Ruby.
 *
 * @param {Object} gem           - Ruby gem (type, quality)
 * @param {Object} primaryEnemy  - The enemy that was directly hit (excluded from splash)
 * @param {Array}  enemies       - All active enemies
 * @param {number} primaryDamage - Damage dealt to the primary target (post-reductions)
 * @param {number} now           - Current timestamp in ms
 */
export function applySplash(gem, primaryEnemy, enemies, primaryDamage, now) {
  const stats  = getStats(gem.type, gem.quality);
  const radius = stats.effect.radius;

  for (const enemy of enemies) {
    if (enemy === primaryEnemy) continue;
    if (enemy.dead || enemy.exited) continue;

    const dx   = enemy.x - primaryEnemy.x;
    const dy   = enemy.y - primaryEnemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      // Splash deals raw damage only; no status effects applied to splash targets.
      enemy.hp -= primaryDamage;
      if (enemy.hp <= 0) {
        enemy.dead = true;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// attackEnemy
// ---------------------------------------------------------------------------

/**
 * Processes a gem attacking its primary target enemy.
 *
 * @param {Object} gem     - Attacking gem { type, quality, x, y, lastAttackTime, attackCooldown }
 * @param {Object} enemy   - Primary target enemy
 * @param {Array}  enemies - All active enemies (needed for Ruby splash)
 * @param {number} now     - Current timestamp in ms
 * @returns {number} Damage dealt to the primary target (0 if attack was skipped)
 */
export function attackEnemy(gem, enemy, enemies, now) {
  // Amethyst cannot attack ground enemies; Diamond cannot attack flying
  if (gem.type === 'Amethyst' && !enemy.flying) return 0;
  if (gem.type === 'Diamond'   &&  enemy.flying) return 0;

  const stats = getStats(gem.type, gem.quality);

  // 1. Roll damage
  let damage = Math.floor(Math.random() * (stats.damageMax - stats.damageMin + 1)) + stats.damageMin;

  // 1b. Diamond crit — 25% chance to double damage (before armor)
  if (stats.effect?.type === 'crit' && Math.random() < stats.effect.chance) {
    damage *= stats.effect.multiplier;
  }

  // 2. Apply armor reduction (enemy.armor / 50 — e.g. 16 armor → 32% reduction)
  damage = Math.round(damage * (1 - enemy.armor / 50));

  // 3. Apply type advantage: Amethyst vs flying enemies
  if (enemy.flying && gem.type === 'Amethyst') {
    damage = Math.round(damage * TYPE_ADVANTAGE);
  }

  // 4. Apply damage to enemy
  enemy.hp -= damage;

  // 5. Check if enemy is dead
  if (enemy.hp <= 0) {
    enemy.dead = true;
  }

  // 6. Apply gem effect (poison, slow, etc.)
  applyEffect(enemy, stats.effect, now);

  // 7. Ruby splash damage
  if (gem.type === 'Ruby') {
    applySplash(gem, enemy, enemies, damage, now);
  }

  // 8. Update attack timing
  gem.lastAttackTime = now;

  // 9. Return damage dealt
  return damage;
}

// ---------------------------------------------------------------------------
// tickPoison
// ---------------------------------------------------------------------------

/**
 * Applies ongoing poison damage to an enemy. Call every frame.
 *
 * @param {Object} enemy - Enemy object (mutated in place)
 * @param {number} dt    - Delta time in seconds
 * @param {number} now   - Current timestamp in ms
 */
export function tickPoison(enemy, dt, now) {
  if (enemy.poisonDps > 0 && now < enemy.poisonUntil) {
    enemy.hp -= enemy.poisonDps * dt;
    if (enemy.hp <= 0) {
      enemy.dead = true;
    }
  }

  // Expire poison when duration ends
  if (enemy.poisonDps > 0 && now >= enemy.poisonUntil) {
    enemy.poisonDps = 0;
  }
}
