// social.js — Social features: tabs, leaderboard, comments, score modal, gem formulas

import { getScores, submitScore, getComments, submitComment } from './firebase.js';
import { SPECIAL_GEM_DEFS } from './specialgem.js';
import { getGemSprite, getSpecialGemSprite } from './sprites.js';

let lastPlayerName = '';

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

export function initTabs() {
  window.gameTabActive = true;
  const tabs = document.querySelectorAll('#tab-bar .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      document.getElementById('game-wrapper').classList.toggle('hidden', target !== 'game');
      document.getElementById('leaderboard-view').classList.toggle('hidden', target !== 'leaderboard');
      document.getElementById('comments-view').classList.toggle('hidden', target !== 'comments');
      document.getElementById('patchnotes-view').classList.toggle('hidden', target !== 'patchnotes');
      document.getElementById('gemformulas-view').classList.toggle('hidden', target !== 'gemformulas');
      document.getElementById('donate-view').classList.toggle('hidden', target !== 'donate');

      window.gameTabActive = (target === 'game');

      if (target === 'leaderboard') refreshLeaderboard();
      if (target === 'comments') refreshComments();
      if (target === 'gemformulas') renderGemFormulas();
    });
  });
}

// ---------------------------------------------------------------------------
// Gem Formulas tab
// ---------------------------------------------------------------------------

const QUALITY_RANK = { chipped: 0, flawed: 1, standard: 2, flawless: 3, perfect: 4, great: 5 };

// One-line effect summaries, keyed by base special gem id.
const EFFECT_SUMMARY = {
  malachite:           'Multi-target: hits 3 enemies at once',
  silver:              'Splash area damage with slow',
  star_ruby:           'Burn aura — damage over time to all enemies in range',
  jade:                'Poison DoT + slow stacked on every hit',
  red_crystal:         'Anti-air; armor-reduction aura for nearby ground gems',
  uranium_235:         'Slow aura + burn aura together (continuous AoE control)',
  dark_emerald:        'Chance to stun the target on each hit',
  gold:                'Crit chance + armor debuff on hit',
  pink_diamond:        'Ground-only crit on hit',
  black_opal:          '+% damage aura to all nearby gems',
  blood_stone:         'Multi-target hits + burn aura',
  yellow_sapphire:     'Splash + slow + damage aura for nearby gems',
  paraiba_tourmaline:  'On-hit nova proc + armor-reduction aura',
};

let gemFormulasRendered = false;

function recipeDifficulty(def) {
  const ing = def.ingredients || [];
  const sum = ing.reduce((s, i) => s + (QUALITY_RANK[i.quality] ?? 0), 0);
  // Extra ingredients past the usual 3 push the chain toward the hard end.
  return sum + Math.max(0, ing.length - 3) * 2;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function gemIconSrc(type, quality) {
  const canvas = getGemSprite(type, quality);
  return canvas ? canvas.toDataURL() : '';
}

function specialIconSrc(specialType) {
  const canvas = getSpecialGemSprite(specialType);
  return canvas ? canvas.toDataURL() : '';
}

function renderIngredient(ing) {
  const label = `${capitalize(ing.quality)} ${ing.type}`;
  const src   = gemIconSrc(ing.type, ing.quality);
  return `<span class="gf-ingredient">
    <img class="gf-ing-icon" src="${src}" alt="${label}" title="${label}">
    <span class="gf-ing-text">${label}</span>
  </span>`;
}

function renderGemFormulas() {
  if (gemFormulasRendered) return;
  const container = document.getElementById('gemformulas-list');
  if (!container) return;

  const bases = SPECIAL_GEM_DEFS
    .filter(d => Array.isArray(d.ingredients))
    .slice()
    .sort((a, b) => recipeDifficulty(a) - recipeDifficulty(b));

  let html = `<table class="gf-table">
    <thead><tr>
      <th>Special Gem</th><th>Recipe</th><th>Effect</th>
    </tr></thead><tbody>`;

  bases.forEach(def => {
    const specialSrc = specialIconSrc(def.id);
    const ingHtml = def.ingredients
      .map(renderIngredient)
      .join('<span class="gf-plus">+</span>');
    const effect = EFFECT_SUMMARY[def.id] || '';

    html += `<tr>
      <td><div class="gf-gem-cell">
        <img class="gf-gem-icon" src="${specialSrc}" alt="${def.name}">
        <div>
          <span class="gf-gem-name">${def.name}</span>
          <span class="gf-gem-type">${def.attackType}-type</span>
        </div>
      </div></td>
      <td><div class="gf-recipe">${ingHtml}</div></td>
      <td class="gf-effect">${effect}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
  gemFormulasRendered = true;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

async function refreshLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '<p class="social-loading">Loading scores...</p>';

  const scores = await getScores(50);
  console.log('refreshLeaderboard: rendering', scores.length, 'scores', scores);
  if (scores.length === 0) {
    container.innerHTML = '<p class="social-empty">No scores yet. Be the first!</p>';
    return;
  }

  let html = `<table class="leaderboard-table">
    <thead><tr>
      <th>#</th><th>Name</th><th>Wave</th><th>Result</th><th>Kills (Final wave)</th><th>Dmg%</th><th>Leaks</th><th>MVP Gem</th><th>GOpal</th><th>Time</th><th>Maze</th><th>Fill%</th><th>Ver</th><th>Date</th><th>At</th>
    </tr></thead><tbody>`;

  const resultLabels = { win: 'Win', lose: 'Lose', forfeit: 'Forfeit' };
  scores.forEach((s, i) => {
    const time = formatTime(s.defendTime || 0);
    const result = resultLabels[s.endReason] || '—';
    html += `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(s.name || 'Anonymous')}</td>
      <td>${s.wave}</td>
      <td>${result}</td>
      <td>${s.finalWaveKills ?? 0}</td>
      <td>${s.finalWaveDmgPct != null ? s.finalWaveDmgPct.toFixed(1) + '%' : '\u2014'}</td>
      <td>${s.livesLost ?? '\u2014'}</td>
      <td>${s.mvpGem ? `${escapeHtml(s.mvpGem)} (${s.mvpGemKills ?? 0})` : '\u2014'}</td>
      <td>${s.greatOpalWave != null ? s.greatOpalWave : '\u2014'}</td>
      <td>${time}</td>
      <td>${s.mazeLength ?? 0}</td>
      <td>${(s.boardFillPct ?? 0).toFixed(1)}%</td>
      <td>${escapeHtml(s.version || '—')}</td>
      <td>${s.timestamp ? new Date(s.timestamp).toLocaleDateString() : '—'}</td>
      <td>${s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

async function refreshComments() {
  const list = document.getElementById('comments-list');
  list.innerHTML = '<p class="social-loading">Loading comments...</p>';

  const comments = await getComments(100);
  console.log('refreshComments: rendering', comments.length, 'comments', comments);
  if (comments.length === 0) {
    list.innerHTML = '<p class="social-empty">No comments yet.</p>';
    return;
  }

  let html = '';
  comments.forEach(c => {
    const d = new Date(c.timestamp);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    html += `<div class="comment">
      <span class="comment-name">${escapeHtml(c.name || 'Anonymous')}</span>
      <span class="comment-date">${date} ${time}</span>
      <p class="comment-text">${escapeHtml(c.text)}</p>
    </div>`;
  });
  list.innerHTML = html;
}

export function initCommentForm() {
  const btn = document.getElementById('comment-submit');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const nameEl = document.getElementById('comment-name');
    const textEl = document.getElementById('comment-text');
    const name = (nameEl.value || '').trim().slice(0, 15);
    const text = (textEl.value || '').trim().slice(0, 500);
    if (!name) { nameEl.focus(); return; }
    if (!text) return;

    btn.disabled = true;
    btn.textContent = 'Posting...';
    try {
      await submitComment({ name, text });
      lastPlayerName = name;
      nameEl.value = name;
      textEl.value = '';
      refreshComments();
    } catch (e) {
      console.error('Comment submit failed:', e);
    }
    btn.disabled = false;
    btn.textContent = 'Post';
  });
}

// ---------------------------------------------------------------------------
// Score submission modal
// ---------------------------------------------------------------------------

export function showScoreModal(gameState, mazeLength, boardFillPct, endReason = 'lose', mvpGem = '', mvpGemKills = 0, finalWaveDmgPct = 0) {
  const modal = document.getElementById('score-modal');
  if (!modal) return;

  const resultLabels = { win: 'Victory', lose: 'Defeat', forfeit: 'Forfeit' };
  document.getElementById('score-result').textContent = resultLabels[endReason] || 'Game Over';
  document.getElementById('score-wave').textContent = gameState.wave;
  document.getElementById('score-kills').textContent = gameState.finalWaveKills ?? 0;
  document.getElementById('score-time').textContent = formatTime(gameState.defendTime ?? 0);
  document.getElementById('score-maze').textContent = mazeLength;
  document.getElementById('score-fill').textContent = boardFillPct.toFixed(1) + '%';
  document.getElementById('score-leaks').textContent = gameState.livesLost ?? 0;
  document.getElementById('score-mvp').textContent = mvpGem ? `${mvpGem} (${mvpGemKills} kills)` : '\u2014';
  document.getElementById('score-wavedmg').textContent = finalWaveDmgPct.toFixed(1) + '%';

  const nameInput = document.getElementById('score-name');
  nameInput.value = lastPlayerName;

  modal.classList.remove('hidden');

  // Submit handler
  const submitBtn = document.getElementById('score-submit');
  const skipBtn = document.getElementById('score-skip');

  const cleanup = () => {
    modal.classList.add('hidden');
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    skipBtn.replaceWith(skipBtn.cloneNode(true));
  };

  submitBtn.addEventListener('click', async () => {
    const name = (nameInput.value || '').trim().slice(0, 15) || 'Anonymous';
    lastPlayerName = name;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const version = document.getElementById('panel-version')?.textContent || 'unknown';
    await submitScore({
      name,
      wave: gameState.wave,
      finalWaveKills: gameState.finalWaveKills ?? 0,
      mazeLength,
      boardFillPct,
      defendTime: gameState.defendTime ?? 0,
      endReason,
      version,
      livesLost: gameState.livesLost ?? 0,
      mvpGem: mvpGem || '',
      mvpGemKills: mvpGemKills || 0,
      finalWaveDmgPct: Math.round(finalWaveDmgPct * 10) / 10,
      gameId: gameState.gameId,
      greatOpalWave: gameState.greatOpalWave,
    });

    cleanup();
  }, { once: true });

  skipBtn.addEventListener('click', () => cleanup(), { once: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
