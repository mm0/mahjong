// Local leaderboard, persisted in localStorage. Scoped per layout.
window.MJ = window.MJ || {};

(function () {
  const KEY = "mj_leaderboard_v1";
  const MAX_ENTRIES_PER_LAYOUT = 20;

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

  function addEntry(layoutKey, entry) {
    const data = load();
    if (!data[layoutKey]) data[layoutKey] = [];
    data[layoutKey].push(entry);
    data[layoutKey].sort((a, b) => a.timeMs - b.timeMs);
    data[layoutKey] = data[layoutKey].slice(0, MAX_ENTRIES_PER_LAYOUT);
    save(data);
    return data[layoutKey].findIndex((e) => e === entry);
  }

  function getEntries(layoutKey) {
    const data = load();
    return data[layoutKey] || [];
  }

  function qualifies(layoutKey, timeMs) {
    const entries = getEntries(layoutKey);
    if (entries.length < MAX_ENTRIES_PER_LAYOUT) return true;
    return timeMs < entries[entries.length - 1].timeMs;
  }

  function clearAll() {
    save({});
  }

  window.MJ.Leaderboard = { addEntry, getEntries, qualifies, clearAll };
})();
