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
  console.log('Firebase initialized, db:', db ? 'OK' : 'NULL');
  return true;
}

export async function submitScore(scoreData) {
  if (!db) { console.warn('submitScore: db is null'); return null; }
  try {
    const ref = db.ref('scores').push();
    console.log('submitScore: writing to', ref.key, scoreData);
    await ref.set({ ...scoreData, timestamp: Date.now() });
    console.log('submitScore: success');
    return ref.key;
  } catch (e) {
    console.error('submitScore failed:', e);
    return null;
  }
}

export async function getScores(limit = 50) {
  if (!db) { console.warn('getScores: db is null'); return []; }
  try {
    const snap = await db.ref('scores').limitToLast(limit).once('value');
    console.log('getScores: snap exists:', snap.exists(), 'numChildren:', snap.numChildren());
    const scores = [];
    snap.forEach(child => { scores.push({ id: child.key, ...child.val() }); });
  // Sort: wave DESC, finalWaveKills DESC, defendTime ASC, mazeLength DESC, boardFillPct DESC
  scores.sort((a, b) => {
    if (b.wave !== a.wave) return b.wave - a.wave;
    if (b.finalWaveKills !== a.finalWaveKills) return b.finalWaveKills - a.finalWaveKills;
    if (a.defendTime !== b.defendTime) return a.defendTime - b.defendTime;
    if (b.mazeLength !== a.mazeLength) return b.mazeLength - a.mazeLength;
    return b.boardFillPct - a.boardFillPct;
  });
  return scores;
  } catch (e) {
    console.error('getScores failed:', e);
    return [];
  }
}

export async function submitComment(commentData) {
  if (!db) { console.warn('submitComment: db is null'); return null; }
  try {
    const ref = db.ref('comments').push();
    console.log('submitComment: writing to', ref.key);
    await ref.set({ ...commentData, timestamp: Date.now() });
    console.log('submitComment: success');
    return ref.key;
  } catch (e) {
    console.error('submitComment failed:', e);
    return null;
  }
}

export async function getComments(limit = 100) {
  if (!db) { console.warn('getComments: db is null'); return []; }
  try {
    const snap = await db.ref('comments').limitToLast(limit).once('value');
    console.log('getComments: snap exists:', snap.exists(), 'numChildren:', snap.numChildren());
    const comments = [];
    snap.forEach(child => { comments.push({ id: child.key, ...child.val() }); });
    comments.sort((a, b) => b.timestamp - a.timestamp);
    return comments;
  } catch (e) {
    console.error('getComments failed:', e);
    return [];
  }
}
