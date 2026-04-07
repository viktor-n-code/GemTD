/**
 * combat.js - Combat and effect system
 * Handles gem attacking, damage calculations, and status effects.
 */

import { CELL_SIZE } from './grid.js';
import { getLeveledStats } from './gem.js';
import { getSpecialGemLeveledStats } from './specialgem.js';

// ---------------------------------------------------------------------------
// getGemStats — unified stat lookup for regular and special gems
// ---------------------------------------------------------------------------

/**
 * Returns leveled stats for any gem, routing to the correct lookup based on
 * whether the gem is a base type or a special gem.
 *
 * @param {Object} gem — gem object with type, quality, specialType, level fields
 * @returns {Object}   — { damageMin, damageMax, attackSpeed, range, effect }
 */
export function getGemStats(gem) {
  if (gem.type === 'special') return getSpecialGemLeveledStats(gem.specialType, gem.level);
  return getLeveledStats(gem.type, gem.quality, gem.level);
}

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

  // Special gem targeting filters
  if (gem.type === 'special') {
    const sStats = getSpecialGemLeveledStats(gem.specialType, gem.level);
    if (sStats?.effect?.type === 'air_crystal' && !enemy.flying) return false;
    if (sStats?.effect?.type === 'crit_ground' &&  enemy.flying) return false;
  }

  const stats = getGemStats(gem);

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
 * @param {Object|null} effect - Effect descriptor from getLeveledStats(), e.g.
 *                               { type:'poison', dps, slow, duration }
 *                               { type:'slow', amount, duration }
 *                               null (Amethyst / air)
 * @param {number}      now    - Current timestamp in ms
 * @param {string|null} gemId  - ID of the gem applying the effect (for kill attribution)
 */
export function applyEffect(enemy, effect, now, gemId) {
  if (enemy.dead || enemy.exited) return;
  if (!effect) return;

  if (effect.type === 'poison') {
    // Poison: only upgrade if the new DPS is higher
    if (effect.dps > enemy.poisonDps) {
      enemy.poisonDps   = effect.dps;
      enemy.poisonUntil = now + effect.duration * 1000;
      enemy.poisonGemId = gemId ?? null;
    }
    // Slow part of poison: apply if stronger or longer
    const newSlowUntil = now + effect.duration * 1000;
    if (effect.slow > enemy.slowAmount || newSlowUntil > enemy.slowUntil) {
      if (effect.slow > enemy.slowAmount) enemy.slowAmount = effect.slow;
      if (newSlowUntil > enemy.slowUntil) enemy.slowUntil = newSlowUntil;
    }
    return;
  }

  if (effect.type === 'slow') {
    const newSlowUntil = now + effect.duration * 1000;
    if (effect.amount > enemy.slowAmount || newSlowUntil > enemy.slowUntil) {
      if (effect.amount > enemy.slowAmount) enemy.slowAmount = effect.amount;
      if (newSlowUntil > enemy.slowUntil) enemy.slowUntil = newSlowUntil;
    }
    return;
  }

  if (effect.type === 'lucky_jade') {
    // Poison part (same no-stack rule as regular poison)
    if (effect.dps > enemy.poisonDps) {
      enemy.poisonDps   = effect.dps;
      enemy.poisonUntil = now + effect.duration * 1000;
      enemy.poisonGemId = gemId ?? null;
    }
    // Slow part
    const newSlowUntil = now + effect.duration * 1000;
    if (effect.slow > enemy.slowAmount || newSlowUntil > enemy.slowUntil) {
      if (effect.slow > enemy.slowAmount) enemy.slowAmount = effect.slow;
      if (newSlowUntil > enemy.slowUntil) enemy.slowUntil = newSlowUntil;
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
  const stats  = getLeveledStats(gem.type, gem.quality, gem.level);
  const radius = stats.effect.radius;
  let splashKills  = 0;
  let splashDamage = 0;

  for (const enemy of enemies) {
    if (enemy === primaryEnemy) continue;
    if (enemy.dead || enemy.exited) continue;

    const dx   = enemy.x - primaryEnemy.x;
    const dy   = enemy.y - primaryEnemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      // Splash deals a fraction of primary damage; no status effects applied to splash targets.
      const splash = primaryDamage * (stats.effect.dmgMod ?? 1);
      enemy.hp -= splash;
      splashDamage += splash;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        splashKills++;
      }
    }
  }

  return { kills: splashKills, damage: splashDamage };
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
  if (gem.type === 'Amethyst' && !enemy.flying) return { damage: 0, crit: false };
  if (gem.type === 'Diamond'   &&  enemy.flying) return { damage: 0, crit: false };

  const stats = getGemStats(gem);

  // Guard: air_crystal only attacks flying; crit_ground only attacks ground
  if (stats.effect?.type === 'air_crystal' && !enemy.flying) return { damage: 0, crit: false, splashKills: 0, splashDamage: 0, goldAmount: 0 };
  if (stats.effect?.type === 'crit_ground' &&  enemy.flying) return { damage: 0, crit: false, splashKills: 0, splashDamage: 0, goldAmount: 0 };

  // 1. Roll damage
  let damage = Math.floor(Math.random() * (stats.damageMax - stats.damageMin + 1)) + stats.damageMin;

  // 1b. MVP bonus — flat % multiplier earned from winning rounds
  if (gem.mvpBonus > 0) damage = Math.round(damage * (1 + gem.mvpBonus * 0.01));

  // 1c. Damage aura bonus from Black Opal / Mystic Black Opal in range
  if (gem.dmgBonus > 0) damage = Math.round(damage * (1 + gem.dmgBonus * 0.01));

  // 1d. Crit chance — Diamond, Lucky Asian Jade, Pink Diamond, or Gold
  let isCrit = false;
  if (stats.effect?.type === 'crit' && Math.random() < stats.effect.chance) {
    damage *= stats.effect.multiplier;
    isCrit = true;
  } else if (stats.effect?.type === 'lucky_jade' && Math.random() < stats.effect.critChance) {
    damage *= stats.effect.critMult;
    isCrit = true;
  } else if ((stats.effect?.type === 'crit_ground' || stats.effect?.type === 'armor_debuff') && Math.random() < stats.effect.critChance) {
    damage *= stats.effect.critMult;
    isCrit = true;
  }

  // 2. Apply armor reduction (3% per armor point); active armor debuff reduces effective armor
  const effectiveArmor = (now < (enemy.armorDebuffUntil ?? 0))
    ? Math.max(0, enemy.armor - enemy.armorDebuff)
    : enemy.armor;
  damage = Math.round(damage * Math.max(0, 1 - effectiveArmor * 0.03));

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
  applyEffect(enemy, stats.effect, now, gem.id);

  // 7. Splash damage (Ruby) or splash + slow (Silver-family special gems)
  let splashKills = 0;
  let splashDamage = 0;
  if (gem.type === 'Ruby') {
    ({ kills: splashKills, damage: splashDamage } = applySplash(gem, enemy, enemies, damage, now));
  } else if (stats.effect?.type === 'splash_slow') {
    // Apply slow to primary target
    applyEffect(enemy, { type: 'slow', amount: stats.effect.slow, duration: stats.effect.duration }, now, gem.id);
    // Full-damage splash + slow to all enemies in radius
    for (const e of enemies) {
      if (e === enemy || e.dead || e.exited) continue;
      const dx = e.x - enemy.x;
      const dy = e.y - enemy.y;
      if (Math.sqrt(dx * dx + dy * dy) <= stats.effect.radius) {
        e.hp -= damage;
        applyEffect(e, { type: 'slow', amount: stats.effect.slow, duration: stats.effect.duration }, now, gem.id);
        splashDamage += damage;
        if (e.hp <= 0 && !e.dead) {
          e.dead = true;
          splashKills++;
        }
      }
    }
  } else if (stats.effect?.type === 'paraiba_nova' && Math.random() < stats.effect.novaChance) {
    // 33% on-hit nova: splash full hit damage to all enemies within novaRadius px
    for (const e of enemies) {
      if (e === enemy || e.dead || e.exited) continue;
      const dx = e.x - enemy.x;
      const dy = e.y - enemy.y;
      if (Math.sqrt(dx * dx + dy * dy) <= stats.effect.novaRadius) {
        e.hp -= damage;
        splashDamage += damage;
        if (e.hp <= 0 && !e.dead) { e.dead = true; splashKills++; }
      }
    }
  }

  // 8. Lucky Asian Jade procs — stun and gold (rolled after damage applied)
  let goldAmount = 0;
  if (stats.effect?.type === 'lucky_jade' && !enemy.dead) {
    if (Math.random() < stats.effect.stunChance) {
      const newStun = now + stats.effect.stunDuration * 1000;
      if (newStun > (enemy.stunUntil ?? 0)) enemy.stunUntil = newStun;
    }
    if (Math.random() < stats.effect.goldChance) {
      goldAmount = Math.floor(gem.level / 2);
    }
  }

  // 8b. Gold/Egyptian Gold: apply armor debuff to target
  if (stats.effect?.type === 'armor_debuff' && !enemy.dead) {
    enemy.armorDebuff      = stats.effect.armorDebuff;
    enemy.armorDebuffUntil = now + stats.effect.debuffDuration * 1000;
  }

  // 8c. Dark Emerald: stun proc
  if (stats.effect?.type === 'stun_chance' && !enemy.dead) {
    if (Math.random() < stats.effect.chance) {
      const newStun = now + stats.effect.stunDuration * 1000;
      if (newStun > (enemy.stunUntil ?? 0)) enemy.stunUntil = newStun;
    }
  }

  // 9. Update attack timing
  gem.lastAttackTime = now;

  // 10. Return damage dealt, crit flag, splash stats, and gold proc
  return { damage, crit: isCrit, splashKills, splashDamage, goldAmount };
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
/**
 * Applies ongoing poison damage to an enemy. Call every frame.
 * Returns { damage, killed } for kill/damage attribution to the source gem.
 *
 * @param {Object} enemy - Enemy object (mutated in place)
 * @param {number} dt    - Delta time in seconds
 * @param {number} now   - Current timestamp in ms
 * @returns {{ damage: number, killed: boolean }}
 */
export function tickPoison(enemy, dt, now) {
  let damage = 0;
  let killed = false;

  if (enemy.poisonDps > 0 && now < enemy.poisonUntil) {
    damage = enemy.poisonDps * dt;
    enemy.hp -= damage;
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      killed = true;
    }
  }

  // Expire poison when duration ends
  if (enemy.poisonDps > 0 && now >= enemy.poisonUntil) {
    enemy.poisonDps   = 0;
    enemy.poisonGemId = null;
  }

  return { damage, killed };
}
