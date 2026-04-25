// analytics.js — thin wrapper around GoatCounter's count() API.
// Falls back to a no-op when the script is blocked (ad-blockers) or not yet
// loaded, so analytics calls never break the game.

export function track(eventName) {
  if (typeof window === 'undefined') return;
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== 'function') return;
  gc.count({ path: eventName, event: true });
}
