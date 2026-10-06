// UI wiring: menus, settings, leaderboard, win flow. Boots the Game.
(function () {
  const { Layouts, Leaderboard, GlobalLeaderboard, Audio, Music } = window.MJ;

  const $ = (sel) => document.querySelector(sel);
  const el = {
    board: $("#board"),
    hud: $("#hud"),
    statTime: $("#statTime"),
    statPairs: $("#statPairs"),
    btnMenu: $("#btnMenu"),
    btnUndo: $("#btnUndo"),
    btnHint: $("#btnHint"),
    btnShuffle: $("#btnShuffle"),
    btnZoomIn: $("#btnZoomIn"),
    btnZoomOut: $("#btnZoomOut"),
    btnFit: $("#btnFit"),
    screenMenu: $("#screenMenu"),
    screenPause: $("#screenPause"),
    screenSettings: $("#screenSettings"),
    screenLeaderboard: $("#screenLeaderboard"),
    screenWin: $("#screenWin"),
    layoutGrid: $("#layoutGrid"),
    difficultySegmented: $("#difficultySegmented"),
    difficultyHint: $("#difficultyHint"),
    btnPlay: $("#btnPlay"),
    btnLeaderboard: $("#btnLeaderboard"),
    btnSettings: $("#btnSettings"),
    continueHint: $("#continueHint"),
    btnResume: $("#btnResume"),
    btnRestartLayout: $("#btnRestartLayout"),
    btnBackToMenu: $("#btnBackToMenu"),
    styleSegmented: $("#styleSegmented"),
    sizeSegmented: $("#sizeSegmented"),
    soundToggle: $("#soundToggle"),
    musicToggle: $("#musicToggle"),
    btnClearBoard: $("#btnClearBoard"),
    btnCloseSettings: $("#btnCloseSettings"),
    lbSourceToggle: $("#lbSourceToggle"),
    lbLayoutTabs: $("#lbLayoutTabs"),
    lbList: $("#lbList"),
    btnCloseLeaderboard: $("#btnCloseLeaderboard"),
    winMessage: $("#winMessage"),
    winSummary: $("#winSummary"),
    winScoreForm: $("#winScoreForm"),
    winName: $("#winName"),
    btnSaveScore: $("#btnSaveScore"),
    btnWinPlayAgain: $("#btnWinPlayAgain"),
    btnWinMenu: $("#btnWinMenu"),
    stuckBanner: $("#stuckBanner"),
    btnStuckShuffle: $("#btnStuckShuffle"),
    btnStuckUndo: $("#btnStuckUndo"),
    updateBanner: $("#updateBanner"),
    btnUpdateReload: $("#btnUpdateReload"),
    versionTag: $("#versionTag"),
  };

  const APP_VERSION = "13"; // keep in sync with VERSION in sw.js
  el.versionTag.textContent = `v${APP_VERSION}`;

  const LAYOUT_GLYPH = { turtle: "🐢", pyramid: "🔺", fortress: "🏰", diamond: "💎", dragongate: "⛩️", hourglass: "⏳" };
  const DIFFICULTY_HINTS = {
    easy: "10 hints · unlimited undo · unlimited reshuffles · blocked tiles dimmed",
    medium: "5 hints · unlimited undo · unlimited reshuffles · blocked tiles dimmed",
    hard: "1 hint · 3 undos · 1 reshuffle · no dimming — figure out what's blocked yourself",
  };

  const prefs = loadPrefs();
  let selectedLayout = prefs.lastLayout || "turtle";
  let selectedDifficulty = prefs.difficulty || "medium";
  let gameStarted = false;
  let pendingWin = null;

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem("mj_prefs_v1")) || {}; } catch (e) { return {}; }
  }
  function savePrefs() {
    try { localStorage.setItem("mj_prefs_v1", JSON.stringify(prefs)); } catch (e) {}
  }

  // ---------- game setup ----------
  const game = new window.MJ.Game(el.board, {
    onChange: updateHud,
    onStuck: showStuckBanner,
    onWin: handleWin,
  });
  window.__MJ_GAME__ = game; // debug/test hook

  const TILE_SIZE_SCALES = { small: 0.92, medium: 1.1, large: 1.3, xl: 1.55 };
  game.renderer.style = prefs.style || "3d";
  game.renderer.sizeScale = TILE_SIZE_SCALES[prefs.tileSize] || TILE_SIZE_SCALES.large;
  Audio.setEnabled(prefs.sound !== false);
  Music.setEnabled(prefs.music !== false);

  function fitCanvas() {
    // On iOS Safari, focusing a text input (e.g. the leaderboard name field)
    // shrinks the visual viewport to make room for the keyboard and fires a
    // "resize" event. If we re-measured and resized the canvas then, the
    // board would permanently shrink to the keyboard-open size — and it
    // would compound every time the player won and typed their name. Skip
    // resizing while any input/textarea has focus; the blur handler below
    // re-fits once the keyboard closes.
    if (document.activeElement && /^(input|textarea)$/i.test(document.activeElement.tagName)) return;
    const rect = el.board.parentElement.getBoundingClientRect();
    const hudRect = el.hud.getBoundingClientRect();
    const zoomRect = $("#zoomControls").getBoundingClientRect();
    game.renderer.topInset = hudRect.bottom + 14;
    game.renderer.bottomInset = rect.height - zoomRect.top + 14;
    game.resizeToContainer(rect.width, rect.height);
  }
  window.addEventListener("resize", fitCanvas);
  window.addEventListener("orientationchange", () => setTimeout(fitCanvas, 200));
  document.addEventListener("focusout", (e) => {
    if (/^(input|textarea)$/i.test(e.target.tagName)) setTimeout(fitCanvas, 200);
  });
  fitCanvas();

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  let hudInterval = null;
  function updateHud() {
    el.statPairs.textContent = game.pairsLeft();
    el.btnUndo.style.opacity = (game.history.length && game.undosUsed < game.maxUndos) ? 1 : 0.4;
    el.btnHint.style.opacity = game.hintsUsed < game.maxHints ? 1 : 0.4;
    el.btnShuffle.style.opacity = game.reshufflesUsed < game.maxReshuffles ? 1 : 0.4;
  }
  function tickTimer() {
    if (!game.paused && gameStarted) el.statTime.textContent = fmtTime(game.elapsedMs());
  }

  function showStuckBanner() { el.stuckBanner.hidden = false; }
  function hideStuckBanner() { el.stuckBanner.hidden = true; }

  // ---------- screens ----------
  function hideAllScreens() {
    [el.screenMenu, el.screenPause, el.screenSettings, el.screenLeaderboard, el.screenWin].forEach((s) => (s.hidden = true));
  }
  function showScreen(s) { hideAllScreens(); s.hidden = false; }
  function showHud(visible) { el.hud.style.display = visible ? "flex" : "none"; document.getElementById("zoomControls").style.display = visible ? "flex" : "none"; }

  function buildLayoutGrid() {
    el.layoutGrid.innerHTML = "";
    Object.keys(Layouts).forEach((key) => {
      const card = document.createElement("button");
      card.className = "layoutCard" + (key === selectedLayout ? " active" : "");
      card.innerHTML = `<span class="glyph">${LAYOUT_GLYPH[key] || "🀄"}</span>${Layouts[key].name}`;
      card.addEventListener("click", () => {
        selectedLayout = key;
        prefs.lastLayout = key; savePrefs();
        buildLayoutGrid();
      });
      el.layoutGrid.appendChild(card);
    });
  }
  buildLayoutGrid();

  function buildDifficultySegmented() {
    Array.from(el.difficultySegmented.querySelectorAll(".segBtn")).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.difficulty === selectedDifficulty);
      btn.onclick = () => {
        selectedDifficulty = btn.dataset.difficulty;
        prefs.difficulty = selectedDifficulty; savePrefs();
        buildDifficultySegmented();
      };
    });
    el.difficultyHint.textContent = DIFFICULTY_HINTS[selectedDifficulty] || "";
  }
  buildDifficultySegmented();

  function openMenu() {
    game.pause();
    showHud(false);
    if (gameStarted && !game.finished) {
      showScreen(el.screenPause);
    } else {
      el.continueHint.hidden = !gameStarted;
      showScreen(el.screenMenu);
    }
  }

  function startNewGame() {
    hideStuckBanner();
    showHud(true);
    hideAllScreens();
    fitCanvas(); // measure HUD/zoom-control insets now that they're visible
    game.newGame(selectedLayout, undefined, selectedDifficulty);
    gameStarted = true;
    updateHud();
    el.statTime.textContent = "00:00";
  }

  el.btnPlay.addEventListener("click", () => {
    Audio.unlock();
    if (gameStarted && game.paused && game.layoutKey === selectedLayout && game.difficulty === selectedDifficulty && !game.finished) {
      showHud(true);
      hideAllScreens();
      fitCanvas();
      game.resume();
    } else {
      startNewGame();
    }
  });

  el.btnMenu.addEventListener("click", openMenu);
  el.btnResume.addEventListener("click", () => { showHud(true); hideAllScreens(); game.resume(); });
  el.btnRestartLayout.addEventListener("click", () => startNewGame());
  el.btnBackToMenu.addEventListener("click", () => { gameStarted = false; openMenu(); });

  el.btnUndo.addEventListener("click", () => game.undo());
  el.btnHint.addEventListener("click", () => game.hint());
  el.btnShuffle.addEventListener("click", () => { game.shuffle(); hideStuckBanner(); });
  el.btnStuckShuffle.addEventListener("click", () => { game.shuffle(); hideStuckBanner(); });
  el.btnStuckUndo.addEventListener("click", () => { game.undo(); hideStuckBanner(); });

  el.btnZoomIn.addEventListener("click", () => game.zoomBy(1.2));
  el.btnZoomOut.addEventListener("click", () => game.zoomBy(0.83));
  el.btnFit.addEventListener("click", () => game.resetView());

  // ---------- settings ----------
  el.btnSettings.addEventListener("click", () => showScreen(el.screenSettings));
  el.btnCloseSettings.addEventListener("click", () => showScreen(el.screenMenu));
  el.soundToggle.checked = prefs.sound !== false;
  el.soundToggle.addEventListener("change", () => {
    prefs.sound = el.soundToggle.checked;
    Audio.setEnabled(prefs.sound);
    savePrefs();
  });
  el.musicToggle.checked = prefs.music !== false;
  el.musicToggle.addEventListener("change", () => {
    prefs.music = el.musicToggle.checked;
    Music.setEnabled(prefs.music);
    savePrefs();
  });
  Array.from(el.styleSegmented.querySelectorAll(".segBtn")).forEach((btn) => {
    if (btn.dataset.style === (prefs.style || "3d")) btn.classList.add("active"); else btn.classList.remove("active");
    btn.addEventListener("click", () => {
      Array.from(el.styleSegmented.querySelectorAll(".segBtn")).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      game.renderer.style = btn.dataset.style;
      prefs.style = btn.dataset.style;
      savePrefs();
      game._draw();
    });
  });
  Array.from(el.sizeSegmented.querySelectorAll(".segBtn")).forEach((btn) => {
    if (btn.dataset.size === (prefs.tileSize || "large")) btn.classList.add("active"); else btn.classList.remove("active");
    btn.addEventListener("click", () => {
      Array.from(el.sizeSegmented.querySelectorAll(".segBtn")).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      game.renderer.sizeScale = TILE_SIZE_SCALES[btn.dataset.size] || 1;
      prefs.tileSize = btn.dataset.size;
      savePrefs();
      // Re-fit so the new size takes effect immediately (a raw redraw
      // would keep the old zoom/pan), then keep the board on screen.
      if (game.tiles.length) { game.renderer.fitToScreen(game.tiles); game._draw(); }
    });
  });
  el.btnClearBoard.addEventListener("click", () => {
    if (confirm("Clear all local leaderboard scores? This cannot be undone.")) {
      Leaderboard.clearAll();
      renderLeaderboard();
    }
  });

  // ---------- leaderboard ----------
  let lbActiveLayout = "turtle";
  let lbSource = "local";
  let lbRequestToken = 0;
  function buildLbTabs() {
    el.lbLayoutTabs.innerHTML = "";
    Object.keys(Layouts).forEach((key) => {
      const btn = document.createElement("button");
      btn.className = "segBtn" + (key === lbActiveLayout ? " active" : "");
      btn.textContent = Layouts[key].name;
      btn.addEventListener("click", () => { lbActiveLayout = key; buildLbTabs(); renderLeaderboard(); });
      el.lbLayoutTabs.appendChild(btn);
    });
  }
  function buildLbSourceToggle() {
    Array.from(el.lbSourceToggle.querySelectorAll(".segBtn")).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.source === lbSource);
      btn.onclick = () => {
        lbSource = btn.dataset.source;
        buildLbSourceToggle();
        renderLeaderboard();
      };
    });
  }
  function renderEntries(entries) {
    el.lbList.innerHTML = "";
    if (!entries.length) {
      el.lbList.innerHTML = `<li class="lbEmpty">No scores yet — be the first!</li>`;
      return;
    }
    entries.forEach((e, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="lbRank">${i + 1}</span><span class="lbName">${escapeHtml(e.name)}</span><span class="lbTime">${fmtTime(e.timeMs)}</span>`;
      el.lbList.appendChild(li);
    });
  }
  function renderLeaderboard() {
    if (lbSource === "local") {
      renderEntries(Leaderboard.getEntries(lbActiveLayout));
      return;
    }
    el.lbList.innerHTML = `<li class="lbEmpty">Loading…</li>`;
    const token = ++lbRequestToken;
    const layoutAtRequest = lbActiveLayout;
    GlobalLeaderboard.getTopEntries(layoutAtRequest)
      .then((entries) => {
        if (token !== lbRequestToken) return; // a newer tab/layout switch already superseded this
        renderEntries(entries);
      })
      .catch(() => {
        if (token !== lbRequestToken) return;
        el.lbList.innerHTML = `<li class="lbEmpty">Couldn't load global scores — check your connection.</li>`;
      });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  el.btnLeaderboard.addEventListener("click", () => {
    // Default to whichever layout is currently selected on the menu (which,
    // right after a win, is still the layout that was just played) instead
    // of always landing on Turtle — otherwise a score saved for any other
    // layout looks "missing" until you manually switch tabs.
    lbActiveLayout = selectedLayout;
    buildLbTabs();
    buildLbSourceToggle();
    renderLeaderboard();
    showScreen(el.screenLeaderboard);
  });
  el.btnCloseLeaderboard.addEventListener("click", () => showScreen(el.screenMenu));

  // ---------- win flow ----------
  const WIN_MESSAGES = {
    record: ["New record! 🏆 Absolutely crushing it.", "🏆 Top of the leaderboard — incredible run!"],
    lightning: ["Lightning fast! ⚡", "Wow, you're fast! 🔥", "Blazing speed — did you even look at the tiles?"],
    great: ["Great clear! Really smooth run.", "Nice pace — well played! 👏"],
    good: ["Board cleared! Solid work.", "Nicely done! 🍵"],
    steady: ["You cleared it — steady and sure.", "Got there in the end, nice work!"],
    chill: ["Board cleared! Every tile down eventually counts.", "Slow and steady — you did it! 🌿"],
  };
  function pickWinMessage(result, isRecord) {
    let tier = "chill";
    if (isRecord) tier = "record";
    else if (result.timeMs < 120000) tier = "lightning";
    else if (result.timeMs < 240000) tier = "great";
    else if (result.timeMs < 420000) tier = "good";
    else if (result.timeMs < 720000) tier = "steady";
    const options = WIN_MESSAGES[tier];
    let msg = options[Math.floor(Math.random() * options.length)];
    if (result.hints === 0 && tier !== "record") msg += " Zero hints used, too.";
    return msg;
  }

  function handleWin(result) {
    showHud(false);
    hideStuckBanner();
    const priorEntries = Leaderboard.getEntries(result.layoutKey);
    const isRecord = priorEntries.length === 0 || result.timeMs < priorEntries[0].timeMs;
    el.winMessage.textContent = pickWinMessage(result, isRecord);
    el.winSummary.textContent = `${Layouts[result.layoutKey].name} · ${fmtTime(result.timeMs)} · ${result.moves} moves · ${result.hints} hints used`;
    const qualifies = Leaderboard.qualifies(result.layoutKey, result.timeMs);
    el.winScoreForm.hidden = !qualifies;
    pendingWin = result;
    if (qualifies) el.winName.value = prefs.lastName || "";
    showScreen(el.screenWin);
  }
  el.btnSaveScore.addEventListener("click", () => {
    const name = (el.winName.value || "Player").trim().slice(0, 16) || "Player";
    prefs.lastName = name; savePrefs();
    const entry = { name, timeMs: pendingWin.timeMs, moves: pendingWin.moves, date: Date.now() };
    Leaderboard.addEntry(pendingWin.layoutKey, entry);
    GlobalLeaderboard.addEntry(pendingWin.layoutKey, entry).catch(() => {});
    el.winScoreForm.hidden = true;
  });
  el.btnWinPlayAgain.addEventListener("click", () => startNewGame());
  el.btnWinMenu.addEventListener("click", () => { gameStarted = false; openMenu(); });

  // ---------- lifecycle ----------
  // Backgrounding the tab pauses the timer, but the board/HUD stay on
  // screen (no pause overlay) — so if nothing un-pauses the game when the
  // tab comes back, tiles look tappable but silently do nothing (selectTile
  // bails out while paused). Track whether *this* handler was the one that
  // paused it, so returning to the tab auto-resumes exactly that case
  // without stealing control from an explicit menu-driven pause.
  let autoPaused = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      game.resetInput();
      if (gameStarted && !game.paused && !game.finished) {
        autoPaused = true;
        game.pause();
      }
    } else if (autoPaused) {
      autoPaused = false;
      game.resume();
    }
  });

  hudInterval = setInterval(tickTimer, 250);
  showHud(false);
  showScreen(el.screenMenu);

  // ---------- PWA service worker + update notification ----------
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        const showUpdateBannerFor = (worker) => {
          el.updateBanner.hidden = false;
          el.btnUpdateReload.onclick = () => {
            el.btnUpdateReload.disabled = true;
            worker.postMessage("SKIP_WAITING");
          };
        };

        // A worker already sitting in "waiting" (e.g. install finished
        // while this tab was in the background) means an update is ready
        // right now.
        if (reg.waiting) showUpdateBannerFor(reg.waiting);

        // A worker installing during this session, once it finishes and
        // there's already an active controller, is also an update (a
        // first-ever install has no controller yet, so that case is
        // correctly skipped here).
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBannerFor(newWorker);
            }
          });
        });

        // Check for a fresher sw.js right away too — register() alone is
        // subject to normal HTTP caching and isn't guaranteed to notice a
        // change immediately, and otherwise the first check wouldn't happen
        // until you background/foreground the tab (or the browser's own
        // periodic ~24h check gets around to it).
        reg.update().catch(() => {});

        // And again whenever the app is reopened/foregrounded, since a
        // long-lived tab wouldn't otherwise recheck.
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      }).catch(() => {});

      // Once the new worker takes control, reload once to run the fresh code.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    });
  }
})();
