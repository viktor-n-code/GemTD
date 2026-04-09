// firebase.js — Firebase integration for leaderboard and comments

let db = null;

export function initFirebase() {
  const config = {
    apiKey: 'AIzaSyDoLt16hmVy3b_uzbNHugwvdE_eFDqABX0',
    authDomain: 'gemtd-f925a.firebaseapp.com',
    databaseURL: 'https://gemtd-f925a-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'gemtd-f925a',
    storageBucket: 'gemtd-f925a.firebasestorage.app',
    messagingSenderId: '338773200228',
    appId: '1:338773200228:web:2c0379b38f2b2889e13e71',
  };

  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded — social features disabled');
    return false;
  }

  if (!firebase.apps.length) firebase.initializeApp(config);
  db = firebase.database();
  return true;
}

export async function submitScore(scoreData) {
  if (!db) return null;
  const ref = db.ref('scores').push();
  await ref.set({ ...scoreData, timestamp: Date.now() });
  return ref.key;
}

export async function getScores(limit = 50) {
  if (!db) return [];
  // Read all scores and sort client-side (avoids needing .indexOn rules)
  const snap = await db.ref('scores').limitToLast(limit).once('value');
  const scores = [];
  snap.forEach(child => scores.push({ id: child.key, ...child.val() }));
  // Sort: wave DESC, finalWaveKills DESC, defendTime ASC, mazeLength DESC, boardFillPct DESC
  scores.sort((a, b) => {
    if (b.wave !== a.wave) return b.wave - a.wave;
    if (b.finalWaveKills !== a.finalWaveKills) return b.finalWaveKills - a.finalWaveKills;
    if (a.defendTime !== b.defendTime) return a.defendTime - b.defendTime;
    if (b.mazeLength !== a.mazeLength) return b.mazeLength - a.mazeLength;
    return b.boardFillPct - a.boardFillPct;
  });
  return scores;
}

export async function submitComment(commentData) {
  if (!db) return null;
  const ref = db.ref('comments').push();
  await ref.set({ ...commentData, timestamp: Date.now() });
  return ref.key;
}

export async function getComments(limit = 100) {
  if (!db) return [];
  const snap = await db.ref('comments').limitToLast(limit).once('value');
  const comments = [];
  snap.forEach(child => comments.push({ id: child.key, ...child.val() }));
  comments.sort((a, b) => b.timestamp - a.timestamp); // newest first
  return comments;
}
