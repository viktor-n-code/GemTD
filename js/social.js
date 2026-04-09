// social.js — Social features: tabs, leaderboard, comments, score modal

import { getScores, submitScore, getComments, submitComment } from './firebase.js';

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

      window.gameTabActive = (target === 'game');

      if (target === 'leaderboard') refreshLeaderboard();
      if (target === 'comments') refreshComments();
    });
  });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

async function refreshLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '<p class="social-loading">Loading scores...</p>';

  const scores = await getScores(50);
  if (scores.length === 0) {
    container.innerHTML = '<p class="social-empty">No scores yet. Be the first!</p>';
    return;
  }

  let html = `<table class="leaderboard-table">
    <thead><tr>
      <th>#</th><th>Name</th><th>Wave</th><th>Result</th><th>Kills</th><th>Time</th><th>Maze</th><th>Fill%</th><th>Ver</th>
    </tr></thead><tbody>`;

  const resultLabels = { win: 'Win', lose: 'Lose', forfeit: 'FF' };
  scores.forEach((s, i) => {
    const time = formatTime(s.defendTime || 0);
    const result = resultLabels[s.endReason] || '—';
    html += `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(s.name || 'Anonymous')}</td>
      <td>${s.wave}</td>
      <td>${result}</td>
      <td>${s.finalWaveKills ?? 0}</td>
      <td>${time}</td>
      <td>${s.mazeLength ?? 0}</td>
      <td>${(s.boardFillPct ?? 0).toFixed(1)}%</td>
      <td>${escapeHtml(s.version || '—')}</td>
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
  if (comments.length === 0) {
    list.innerHTML = '<p class="social-empty">No comments yet.</p>';
    return;
  }

  let html = '';
  comments.forEach(c => {
    const date = new Date(c.timestamp).toLocaleDateString();
    html += `<div class="comment">
      <span class="comment-name">${escapeHtml(c.name || 'Anonymous')}</span>
      <span class="comment-date">${date}</span>
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
    const name = (nameEl.value || '').trim().slice(0, 15) || 'Anonymous';
    const text = (textEl.value || '').trim().slice(0, 200);
    if (!text) return;

    btn.disabled = true;
    btn.textContent = 'Posting...';
    await submitComment({ name, text });
    lastPlayerName = name;
    nameEl.value = name;
    textEl.value = '';
    btn.disabled = false;
    btn.textContent = 'Post';
    refreshComments();
  });
}

// ---------------------------------------------------------------------------
// Score submission modal
// ---------------------------------------------------------------------------

export function showScoreModal(gameState, mazeLength, boardFillPct, endReason = 'lose') {
  const modal = document.getElementById('score-modal');
  if (!modal) return;

  const resultLabels = { win: 'Victory', lose: 'Defeat', forfeit: 'Forfeit' };
  document.getElementById('score-result').textContent = resultLabels[endReason] || 'Game Over';
  document.getElementById('score-wave').textContent = gameState.wave;
  document.getElementById('score-kills').textContent = gameState.finalWaveKills ?? 0;
  document.getElementById('score-time').textContent = formatTime(gameState.defendTime ?? 0);
  document.getElementById('score-maze').textContent = mazeLength;
  document.getElementById('score-fill').textContent = boardFillPct.toFixed(1) + '%';

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
