// Global leaderboard, shared across all players via Firestore. Mirrors the
// window.MJ.Leaderboard interface (js/leaderboard.js) but async, since it's
// a network call rather than localStorage.
window.MJ = window.MJ || {};

(function () {
  const cfg = window.MJ.FIREBASE_CONFIG;
  const configured = !!(cfg && cfg.apiKey && cfg.apiKey !== "PASTE_ME");
  let db = null;
  if (configured) {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
  } else {
    console.warn("Global leaderboard disabled: fill in js/firebase-config.js");
  }

  function deviceId() {
    try {
      let id = localStorage.getItem("mj_device_id");
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
        localStorage.setItem("mj_device_id", id);
      }
      return id;
    } catch (e) {
      return "unknown";
    }
  }

  async function addEntry(layoutKey, entry) {
    if (!db) return;
    await db.collection(`leaderboard_${layoutKey}`).add({
      name: entry.name,
      timeMs: entry.timeMs,
      moves: entry.moves,
      date: entry.date,
      deviceId: deviceId(),
    });
  }

  async function getTopEntries(layoutKey, max = 20) {
    if (!db) return [];
    const snap = await db.collection(`leaderboard_${layoutKey}`).orderBy("timeMs", "asc").limit(max).get();
    return snap.docs.map((d) => d.data());
  }

  window.MJ.GlobalLeaderboard = { addEntry, getTopEntries, isConfigured: () => configured };
})();
