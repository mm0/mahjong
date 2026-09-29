// Core game state/logic + input handling (tap-to-select, drag-to-pan,
// pinch-to-zoom). UI chrome (menus, leaderboard forms) lives in main.js.
window.MJ = window.MJ || {};

(function () {
  const { Dealer, Layouts, TilesData, Renderer, Leaderboard, Audio } = window.MJ;

  class Game {
    constructor(canvas, callbacks) {
      this.canvas = canvas;
      this.renderer = new Renderer(canvas);
      this.cb = callbacks || {};
      this.tiles = [];
      this.selected = null;
      this.hintIds = null;
      this.hintTimeout = null;
      this.history = [];
      this.hintsUsed = 0;
      this.maxHints = 5;
      this.movesCount = 0;
      this.startTime = null;
      this.elapsedBeforePause = 0;
      this.paused = false;
      this.layoutKey = "turtle";
      this.finished = false;

      this._bindInput();
    }

    // ---------- lifecycle ----------

    newGame(layoutKey, seed) {
      this.layoutKey = layoutKey;
      const cssW = this.canvas.clientWidth || window.innerWidth;
      const cssH = this.canvas.clientHeight || window.innerHeight;
      const isPhonePortrait = cssW < 700 && cssH > cssW;
      const positions = isPhonePortrait ? Layouts[layoutKey].positionsTall : Layouts[layoutKey].positions;
      const dealt = Dealer.dealSolvable(positions, seed ?? (Math.random() * 1e9 | 0));
      this.tiles = positions.map((p, i) => Object.assign({ id: i, col: p.col, row: p.row, level: p.level, removed: false }, dealt[i]));
      this.selected = null;
      this.hintIds = null;
      this.history = [];
      this.hintsUsed = 0;
      this.movesCount = 0;
      this.startTime = performance.now();
      this.elapsedBeforePause = 0;
      this.paused = false;
      this.finished = false;
      this.renderer.fitToScreen(this.tiles);
      this._recomputeFree();
      this._draw();
    }

    resizeToContainer(cssW, cssH) {
      this.renderer.resize(cssW, cssH);
      if (this.tiles.length) this.renderer.fitToScreen(this.tiles);
      this._draw();
    }

    elapsedMs() {
      if (!this.startTime) return 0;
      if (this.paused) return this.elapsedBeforePause;
      return this.elapsedBeforePause + (performance.now() - this.startTime);
    }

    pause() {
      if (this.paused || this.finished) return;
      this.elapsedBeforePause = this.elapsedMs();
      this.paused = true;
    }

    resume() {
      if (!this.paused) return;
      this.startTime = performance.now();
      this.paused = false;
    }

    // ---------- core logic ----------

    _byCell() {
      const map = new Map();
      this.tiles.forEach((t) => { if (!t.removed) map.set(`${t.col},${t.row},${t.level}`, t); });
      return map;
    }

    _recomputeFree() {
      const byCell = this._byCell();
      this.freeSet = new Set();
      this.tiles.forEach((t) => {
        if (t.removed) return;
        const above = byCell.get(`${t.col},${t.row},${t.level + 1}`);
        if (above) return;
        const left = byCell.get(`${t.col - 1},${t.row},${t.level}`);
        const right = byCell.get(`${t.col + 1},${t.row},${t.level}`);
        if (left && right) return;
        this.freeSet.add(t.id);
      });
    }

    remainingTiles() { return this.tiles.filter((t) => !t.removed); }
    pairsLeft() { return this.remainingTiles().length / 2; }

    findAnyValidMove() {
      const free = this.remainingTiles().filter((t) => this.freeSet.has(t.id));
      for (let i = 0; i < free.length; i++) {
        for (let j = i + 1; j < free.length; j++) {
          if (TilesData.matches(free[i], free[j])) return [free[i], free[j]];
        }
      }
      return null;
    }

    selectTile(tile) {
      if (this.finished || this.paused) return;
      if (!this.freeSet.has(tile.id)) { Audio.play("invalid"); return; }

      if (!this.selected) {
        this.selected = tile;
        Audio.play("select");
        this._draw();
        return;
      }
      if (this.selected.id === tile.id) {
        this.selected = null;
        Audio.play("deselect");
        this._draw();
        return;
      }
      if (TilesData.matches(this.selected, tile)) {
        this._commitMatch(this.selected, tile);
      } else {
        Audio.play("invalid");
        const prev = this.selected;
        this.selected = tile;
        this._flashInvalid(prev, tile);
      }
    }

    _flashInvalid(a, b) {
      this._draw();
    }

    _commitMatch(a, b) {
      a.removed = true; b.removed = true;
      this.history.push({ aId: a.id, bId: b.id });
      this.selected = null;
      this.hintIds = null;
      this.movesCount++;
      Audio.play("match");
      this._recomputeFree();
      this._draw();

      if (this.pairsLeft() === 0) {
        this._onWin();
        return;
      }
      if (!this.findAnyValidMove()) {
        this.cb.onStuck && this.cb.onStuck();
        Audio.play("stuck");
      }
      this.cb.onChange && this.cb.onChange();
    }

    undo() {
      if (this.finished || !this.history.length) return;
      const last = this.history.pop();
      const a = this.tiles[last.aId], b = this.tiles[last.bId];
      a.removed = false; b.removed = false;
      this.selected = null;
      this.movesCount++;
      Audio.play("undo");
      this._recomputeFree();
      this._draw();
      this.cb.onChange && this.cb.onChange();
    }

    hint() {
      if (this.finished || this.hintsUsed >= this.maxHints) { Audio.play("invalid"); return false; }
      const move = this.findAnyValidMove();
      if (!move) { Audio.play("invalid"); return false; }
      this.hintsUsed++;
      this.hintIds = new Set([move[0].id, move[1].id]);
      Audio.play("hint");
      this._draw();
      clearTimeout(this.hintTimeout);
      this.hintTimeout = setTimeout(() => { this.hintIds = null; this._draw(); }, 1600);
      this.cb.onChange && this.cb.onChange();
      return true;
    }

    shuffle() {
      if (this.finished) return;
      const remaining = this.remainingTiles();
      if (remaining.length < 2) return;
      const positions = remaining.map((t) => ({ col: t.col, row: t.row, level: t.level }));
      const newTiles = Dealer.reshuffleRemaining(positions, remaining, Math.random() * 1e9 | 0);
      if (!newTiles) { Audio.play("invalid"); return; }
      remaining.forEach((t, i) => {
        Object.assign(t, { type: newTiles[i].type, category: newTiles[i].category, glyph: newTiles[i].glyph, suit: newTiles[i].suit, rank: newTiles[i].rank, color: newTiles[i].color, label: newTiles[i].label });
      });
      this.selected = null;
      this.hintIds = null;
      Audio.play("shuffle");
      this._recomputeFree();
      this._draw();
      this.cb.onChange && this.cb.onChange();
    }

    _onWin() {
      this.finished = true;
      const timeMs = Math.round(this.elapsedMs());
      this.cb.onWin && this.cb.onWin({ timeMs, moves: this.movesCount, hints: this.hintsUsed, layoutKey: this.layoutKey });
      Audio.play("win");
    }

    // ---------- rendering ----------

    _draw() {
      this.renderer.render(this.tiles, {
        selectedId: this.selected && this.selected.id,
        hintIds: this.hintIds,
        freeSet: this.freeSet,
      });
    }

    // ---------- input: tap / drag / pinch ----------

    _bindInput() {
      const el = this.canvas;
      const pointers = new Map();
      let dragging = false;
      let dragMoved = false;
      let lastMid = null;
      let lastDist = null;
      let downInfo = null;

      const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const mid = (p1, p2) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });

      const getPos = (e) => {
        const rect = el.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };

      el.addEventListener("pointerdown", (e) => {
        Audio.unlock();
        el.setPointerCapture(e.pointerId);
        const pos = getPos(e);
        pointers.set(e.pointerId, pos);
        dragMoved = false;
        if (pointers.size === 1) {
          downInfo = { pos, time: performance.now() };
          dragging = true;
        } else if (pointers.size === 2) {
          const pts = Array.from(pointers.values());
          lastMid = mid(pts[0], pts[1]);
          lastDist = dist(pts[0], pts[1]);
        }
      });

      el.addEventListener("pointermove", (e) => {
        if (!pointers.has(e.pointerId)) return;
        const pos = getPos(e);
        pointers.set(e.pointerId, pos);

        if (pointers.size === 2) {
          const pts = Array.from(pointers.values());
          const newMid = mid(pts[0], pts[1]);
          const newDist = dist(pts[0], pts[1]);
          const r = this.renderer;
          if (lastDist) {
            const scale = newDist / lastDist;
            const before = r.screenToWorld(lastMid.x, lastMid.y);
            r.zoom = Math.min(r.maxZoom, Math.max(r.minZoom, r.zoom * scale));
            const after = r.screenToWorld(lastMid.x, lastMid.y);
            r.panX += (after.x - before.x) * r.zoom;
            r.panY += (after.y - before.y) * r.zoom;
          }
          r.panX += newMid.x - lastMid.x;
          r.panY += newMid.y - lastMid.y;
          lastMid = newMid;
          lastDist = newDist;
          r.clampPan(this.tiles);
          dragMoved = true;
          this._draw();
          return;
        }

        if (dragging && downInfo) {
          const dx = pos.x - downInfo.pos.x, dy = pos.y - downInfo.pos.y;
          if (Math.hypot(dx, dy) > 6) dragMoved = true;
          const prev = downInfo.lastPos || downInfo.pos;
          this.renderer.panX += pos.x - prev.x;
          this.renderer.panY += pos.y - prev.y;
          downInfo.lastPos = pos;
          if (dragMoved) {
            this.renderer.clampPan(this.tiles);
            this._draw();
          }
        }
      });

      const endPointer = (e) => {
        const pos = pointers.get(e.pointerId) || getPos(e);
        const wasSingle = pointers.size === 1;
        pointers.delete(e.pointerId);
        if (pointers.size < 2) { lastMid = null; lastDist = null; }

        if (wasSingle && dragging && !dragMoved && downInfo) {
          const elapsed = performance.now() - downInfo.time;
          if (elapsed < 500) {
            const tile = this._hitTestWorld(pos);
            if (tile) this.selectTile(tile);
          }
        }
        dragging = pointers.size > 0;
        downInfo = null;
      };
      el.addEventListener("pointerup", endPointer);
      el.addEventListener("pointercancel", endPointer);

      el.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = this.renderer;
        const rect = el.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const before = r.screenToWorld(sx, sy);
        const scale = e.deltaY < 0 ? 1.08 : 0.92;
        r.zoom = Math.min(r.maxZoom, Math.max(r.minZoom, r.zoom * scale));
        const after = r.screenToWorld(sx, sy);
        r.panX += (after.x - before.x) * r.zoom;
        r.panY += (after.y - before.y) * r.zoom;
        r.clampPan(this.tiles);
        this._draw();
      }, { passive: false });
    }

    _hitTestWorld(screenPos) {
      return this.renderer.hitTest(this.tiles, screenPos.x, screenPos.y);
    }

    zoomBy(factor, aroundCenter = true) {
      const r = this.renderer;
      const cx = this.canvas.clientWidth / 2, cy = this.canvas.clientHeight / 2;
      const before = r.screenToWorld(cx, cy);
      r.zoom = Math.min(r.maxZoom, Math.max(r.minZoom, r.zoom * factor));
      const after = r.screenToWorld(cx, cy);
      r.panX += (after.x - before.x) * r.zoom;
      r.panY += (after.y - before.y) * r.zoom;
      r.clampPan(this.tiles);
      this._draw();
    }

    resetView() {
      this.renderer.fitToScreen(this.tiles);
      this._draw();
    }
  }

  window.MJ.Game = Game;
})();
