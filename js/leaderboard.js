// Local leaderboard, persisted in localStorage. Scoped per layout+difficulty
// — an Easy-mode clear (more hints, unlimited undos/reshuffles) isn't a fair
// comparison against a Hard-mode one, so they don't share a list.
window.MJ = window.MJ || {};

(function () {
  const KEY = "mj_leaderboard_v1";
  const MAX_ENTRIES_PER_LAYOUT = 20;

  function scopeKey(layoutKey, difficulty) {
    return `${layoutKey}_${difficulty}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable; ignore */ }
  }

  function addEntry(layoutKey, difficulty, entry) {
    const key = scopeKey(layoutKey, difficulty);
    const data = load();
    if (!data[key]) data[key] = [];
    data[key].push(entry);
    data[key].sort((a, b) => a.timeMs - b.timeMs);
    data[key] = data[key].slice(0, MAX_ENTRIES_PER_LAYOUT);
    save(data);
    return data[key].findIndex((e) => e === entry);
  }

  function getEntries(layoutKey, difficulty) {
    const data = load();
    return data[scopeKey(layoutKey, difficulty)] || [];
  }

  function qualifies(layoutKey, difficulty, timeMs) {
    const entries = getEntries(layoutKey, difficulty);
    if (entries.length < MAX_ENTRIES_PER_LAYOUT) return true;
    return timeMs < entries[entries.length - 1].timeMs;
  }

  function clearAll() {
    save({});
  }

  window.MJ.Leaderboard = { addEntry, getEntries, qualifies, clearAll };
})();
