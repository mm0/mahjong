// Canvas renderer: sprite-style tile drawing (two toggleable art styles),
// camera pan/zoom (pinch + drag) so 144 tiles stay usable on an iPhone
// screen, and hit-testing for taps.
window.MJ = window.MJ || {};

(function () {
  const TILE_W = 64, TILE_H = 84;
  const LEVEL_DX = 10, LEVEL_DY = -10;

  // Pip layout patterns (unit square 0..1) reused for dot/bamboo suits.
  const PIP_PATTERNS = {
    1: [[0.5, 0.5]],
    2: [[0.3, 0.3], [0.7, 0.7]],
    3: [[0.3, 0.25], [0.5, 0.5], [0.7, 0.75]],
    4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
    5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
    6: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]],
    7: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.42], [0.3, 0.6], [0.7, 0.6], [0.3, 0.85], [0.7, 0.85]],
    8: [[0.3, 0.16], [0.7, 0.16], [0.3, 0.38], [0.7, 0.38], [0.3, 0.6], [0.7, 0.6], [0.3, 0.82], [0.7, 0.82]],
    9: [[0.3, 0.16], [0.5, 0.16], [0.7, 0.16], [0.3, 0.5], [0.5, 0.5], [0.7, 0.5], [0.3, 0.84], [0.5, 0.84], [0.7, 0.84]],
  };

  function makeGrainPattern(ctx) {
    const c = document.createElement("canvas");
    c.width = 48; c.height = 48;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 48, 48);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(120,95,60,${(Math.random() * 0.06).toFixed(3)})`;
      g.fillRect(Math.random() * 48, Math.random() * 48, 1, 1);
    }
    return ctx.createPattern(c, "repeat");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.style = "flat"; // 'flat' | 'classic' | '3d'
      this.sizeScale = 1; // user "tile size" preference, applied on top of auto-fit
      this.zoom = 1;
      this.minZoom = 0.4;
      this.maxZoom = 2.6;
      this.panX = 0;
      this.panY = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 3);
      this._grain = null;
    }

    grain() {
      if (!this._grain) this._grain = makeGrainPattern(this.ctx);
      return this._grain;
    }

    resize(cssW, cssH) {
      this.cssW = cssW; this.cssH = cssH;
      this.canvas.width = Math.round(cssW * this.dpr);
      this.canvas.height = Math.round(cssH * this.dpr);
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = cssH + "px";
    }

    worldPos(tile) {
      return {
        x: tile.col * TILE_W + tile.level * LEVEL_DX,
        y: tile.row * TILE_H + tile.level * LEVEL_DY,
      };
    }

    boardBounds(tiles) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      tiles.forEach((t) => {
        const p = this.worldPos(t);
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + TILE_W); maxY = Math.max(maxY, p.y + TILE_H);
      });
      return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
    }

    fitToScreen(tiles, padding = 24) {
      const b = this.boardBounds(tiles);
      const zx = (this.cssW - padding * 2) / b.w;
      const zy = (this.cssH - padding * 2) / b.h;
      const fitAllZoom = Math.max(0.28, Math.min(zx, zy));

      // On phone-sized screens, cramming the whole 144-tile board into view
      // makes tiles illegibly tiny. Prefer a legible minimum tile size and
      // let the player pan/pinch to see the rest, like real mobile Mahjong
      // Solitaire apps do — only fall back to "fit everything" on wider
      // screens (tablet/desktop) where that size is already comfortable.
      const isPhone = this.cssW < 700;
      const COMFORTABLE_TILE_W = 64; // CSS px
      const comfortableZoom = COMFORTABLE_TILE_W / TILE_W;
      const z = (isPhone ? Math.max(fitAllZoom, comfortableZoom) : fitAllZoom) * this.sizeScale;

      this.minZoom = Math.min(fitAllZoom, z) * 0.85;
      this.maxZoom = Math.max(2.6, z * 3.2);
      this.zoom = z;

      // Fit within the area actually visible between the HUD bar and the
      // zoom controls, not the full canvas — otherwise on phones the board
      // centers under the header and its top rows are permanently hidden.
      const topInset = isPhone ? this.topInset || 100 : 0;
      const bottomInset = isPhone ? this.bottomInset || 110 : 0;
      const visibleH = Math.max(100, this.cssH - topInset - bottomInset);
      const boardHZoomed = b.h * z;
      this.panX = (this.cssW - b.w * z) / 2 - b.minX * z;
      this.panY = boardHZoomed > visibleH
        ? topInset - b.minY * z // top-align: whole board still reachable by panning down
        : topInset + (visibleH - boardHZoomed) / 2 - b.minY * z;
    }

    clampPan(tiles) {
      const b = this.boardBounds(tiles);
      const margin = 120;
      const minPanX = this.cssW - (b.maxX * this.zoom) - margin;
      const maxPanX = -b.minX * this.zoom + margin;
      const minPanY = this.cssH - (b.maxY * this.zoom) - margin;
      const maxPanY = -b.minY * this.zoom + margin;
      this.panX = Math.min(Math.max(this.panX, Math.min(minPanX, maxPanX)), Math.max(minPanX, maxPanX));
      this.panY = Math.min(Math.max(this.panY, Math.min(minPanY, maxPanY)), Math.max(minPanY, maxPanY));
    }

    screenToWorld(sx, sy) {
      return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
    }

    tileScreenRect(tile) {
      const p = this.worldPos(tile);
      return {
        x: p.x * this.zoom + this.panX,
        y: p.y * this.zoom + this.panY,
        w: TILE_W * this.zoom,
        h: TILE_H * this.zoom,
      };
    }

    hitTest(tiles, sx, sy) {
      const sorted = tiles
        .filter((t) => !t.removed)
        .slice()
        .sort((a, b) => (b.level - a.level) || (b.row - a.row));
      for (const t of sorted) {
        const r = this.tileScreenRect(t);
        if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return t;
      }
      return null;
    }

    drawBackground() {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0f4c3a");
      g.addColorStop(1, "#0a3327");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    render(tiles, opts) {
      const { selectedId, hintIds, freeSet } = opts || {};
      const ctx = this.ctx;
      ctx.save();
      ctx.scale(this.dpr, this.dpr);
      this.drawBackground();

      const visible = tiles.filter((t) => !t.removed);
      visible.sort((a, b) => (a.level - b.level) || (a.row - b.row) || (a.col - b.col));

      for (const t of visible) {
        const r = this.tileScreenRect(t);
        if (r.x + r.w < -20 || r.x > this.cssW + 20 || r.y + r.h < -20 || r.y > this.cssH + 20) continue;
        const state = {
          selected: t.id === selectedId,
          hinted: !!hintIds && hintIds.has(t.id),
          free: !freeSet || freeSet.has(t.id),
        };
        this.drawTile(t, r, state);
      }
      ctx.restore();
    }

    drawTile(tile, r, state) {
      if (this.style === "classic") this.drawTileClassic(tile, r, state);
      else if (this.style === "3d") this.drawTile3D(tile, r, state);
      else this.drawTileFlat(tile, r, state);
    }

    // A raised, blocky look: a darker right face and bottom face give the
    // top face visible thickness, like a real mahjong tile standing on the
    // table rather than a flat sticker.
    drawTile3D(tile, r, state) {
      const ctx = this.ctx;
      const { x, y, w, h } = r;
      const rad = w * 0.1;
      const depth = Math.max(3, h * 0.16);

      ctx.save();
      // drop shadow, cast further than the flatter styles since the block
      // itself now has real height
      ctx.globalAlpha = state.free ? 0.32 : 0.2;
      roundRect(ctx, x + w * 0.08, y + h * 0.1 + depth, w, h, rad);
      ctx.fillStyle = "#00120a";
      ctx.fill();
      ctx.globalAlpha = 1;

      const baseColor = state.free ? "#f2ead6" : "#cfc9ba";
      const sideColor = state.free ? "#b9ae8f" : "#9a9182";
      const frontColor = state.free ? "#a89b78" : "#8a8272";

      // right face
      ctx.beginPath();
      ctx.moveTo(x + w, y + rad * 0.4);
      ctx.lineTo(x + w, y + h - rad * 0.4);
      ctx.lineTo(x + w + depth, y + h - rad * 0.4 + depth * 0.5);
      ctx.lineTo(x + w + depth, y + rad * 0.4 + depth * 0.5);
      ctx.closePath();
      const rightGrad = ctx.createLinearGradient(x + w, y, x + w + depth, y);
      rightGrad.addColorStop(0, sideColor);
      rightGrad.addColorStop(1, frontColor);
      ctx.fillStyle = rightGrad;
      ctx.fill();

      // bottom/front face
      ctx.beginPath();
      ctx.moveTo(x + rad * 0.4, y + h);
      ctx.lineTo(x + w - rad * 0.4, y + h);
      ctx.lineTo(x + w - rad * 0.4 + depth, y + h + depth * 0.5);
      ctx.lineTo(x + rad * 0.4 + depth, y + h + depth * 0.5);
      ctx.closePath();
      const frontGrad = ctx.createLinearGradient(x, y + h, x, y + h + depth * 0.5);
      frontGrad.addColorStop(0, sideColor);
      frontGrad.addColorStop(1, frontColor);
      ctx.fillStyle = frontGrad;
      ctx.fill();

      // top face
      ctx.save();
      roundRect(ctx, x, y, w, h, rad);
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, baseColor);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.strokeStyle = state.selected ? "#ffd23f" : (state.hinted ? "#5fd0ff" : "rgba(40,30,10,0.3)");
      if (state.selected || state.hinted) ctx.lineWidth = Math.max(2.5, w * 0.07);
      ctx.stroke();

      if (!state.free) {
        ctx.save();
        roundRect(ctx, x, y, w, h, rad);
        ctx.fillStyle = "rgba(20,20,20,0.22)";
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      this.drawGlyph(tile, x, y, w, h, "3d");
      ctx.restore();
    }

    drawTileFlat(tile, r, state) {
      const ctx = this.ctx;
      const { x, y, w, h } = r;
      const rad = w * 0.14;

      ctx.save();
      // drop shadow
      ctx.globalAlpha = state.free ? 0.28 : 0.18;
      roundRect(ctx, x + w * 0.06, y + h * 0.08, w, h, rad);
      ctx.fillStyle = "#00120a";
      ctx.fill();
      ctx.globalAlpha = 1;

      const baseColor = state.free ? "#fbf6ea" : "#cfc9ba";
      roundRect(ctx, x, y, w, h, rad);
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, baseColor);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.strokeStyle = state.selected ? "#ffd23f" : (state.hinted ? "#5fd0ff" : "rgba(40,30,10,0.25)");
      if (state.selected || state.hinted) ctx.lineWidth = Math.max(2, w * 0.06);
      ctx.stroke();

      if (!state.free) {
        ctx.save();
        roundRect(ctx, x, y, w, h, rad);
        ctx.fillStyle = "rgba(20,20,20,0.22)";
        ctx.fill();
        ctx.restore();
      }

      this.drawGlyph(tile, x, y, w, h, "flat");
      ctx.restore();
    }

    drawTileClassic(tile, r, state) {
      const ctx = this.ctx;
      const { x, y, w, h } = r;
      const rad = w * 0.1;

      ctx.save();
      ctx.globalAlpha = state.free ? 0.35 : 0.2;
      roundRect(ctx, x + w * 0.07, y + h * 0.09, w, h, rad);
      ctx.fillStyle = "#000000";
      ctx.fill();
      ctx.globalAlpha = 1;

      const ivoryTop = state.free ? "#fffdf4" : "#d9d3c2";
      const ivoryBot = state.free ? "#efe6cd" : "#bdb6a3";
      roundRect(ctx, x, y, w, h, rad);
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, ivoryTop);
      grad.addColorStop(1, ivoryBot);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      roundRect(ctx, x, y, w, h, rad);
      ctx.clip();
      ctx.fillStyle = this.grain();
      ctx.fillRect(x, y, w, h);
      ctx.restore();

      // bevel highlight/shadow
      ctx.save();
      roundRect(ctx, x, y, w, h, rad);
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = Math.max(1, w * 0.035);
      ctx.beginPath(); ctx.moveTo(x + 2, y + h - 2); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + w - 2, y + 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(70,55,25,0.35)";
      ctx.beginPath(); ctx.moveTo(x + w - 2, y + 2); ctx.lineTo(x + w - 2, y + h - 2); ctx.lineTo(x + 2, y + h - 2);
      ctx.stroke();
      ctx.restore();

      ctx.lineWidth = Math.max(1, w * 0.025);
      ctx.strokeStyle = state.selected ? "#ffb400" : (state.hinted ? "#2ab7ff" : "rgba(60,45,20,0.5)");
      if (state.selected || state.hinted) ctx.lineWidth = Math.max(2, w * 0.05);
      roundRect(ctx, x, y, w, h, rad);
      ctx.stroke();

      if (!state.free) {
        ctx.save();
        roundRect(ctx, x, y, w, h, rad);
        ctx.fillStyle = "rgba(20,20,20,0.25)";
        ctx.fill();
        ctx.restore();
      }

      this.drawGlyph(tile, x, y, w, h, "classic");
      ctx.restore();
    }

    drawGlyph(tile, x, y, w, h, style) {
      const ctx = this.ctx;
      const cx = x + w / 2, cy = y + h / 2;

      if (tile.category === "suit") {
        if (tile.suit === "chr") {
          ctx.fillStyle = style === "classic" ? "#1c2e6b" : tile.color;
          ctx.font = `700 ${h * 0.34}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(window.MJ.TilesData.suitGlyph("chr", tile.rank), cx, cy - h * 0.14);
          ctx.font = `400 ${h * 0.2}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
          ctx.fillStyle = style === "classic" ? "#b5311f" : "#c23b3b";
          ctx.fillText("萬", cx, cy + h * 0.24);
        } else {
          this.drawPips(tile, x, y, w, h, style);
        }
        return;
      }

      if (tile.category === "wind" || tile.category === "dragon") {
        ctx.fillStyle = style === "classic"
          ? (tile.type === "dR" ? "#b5311f" : tile.type === "dG" ? "#1d7a45" : "#2b2b2b")
          : tile.color;
        ctx.font = `700 ${h * 0.44}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (tile.category === "dragon" && tile.type === "dW") {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = Math.max(2, w * 0.05);
          roundRect(ctx, x + w * 0.24, y + h * 0.24, w * 0.52, h * 0.52, w * 0.06);
          ctx.stroke();
        } else {
          ctx.fillText(tile.glyph, cx, cy);
        }
        return;
      }

      if (tile.category === "flower" || tile.category === "season") {
        ctx.fillStyle = tile.color;
        ctx.font = `700 ${h * 0.4}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(tile.glyph, cx, cy - h * 0.02);
        ctx.font = `700 ${h * 0.14}px sans-serif`;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillText(tile.category === "flower" ? "F" : "S", x + w * 0.16, y + h * 0.18);
      }
    }

    drawPips(tile, x, y, w, h, style) {
      const ctx = this.ctx;
      const pattern = PIP_PATTERNS[tile.rank] || PIP_PATTERNS[1];
      const pipColor = style === "classic"
        ? (tile.suit === "dot" ? "#1c3e8c" : "#1d7a45")
        : tile.color;
      const size = Math.min(w, h) * (tile.rank >= 7 ? 0.11 : 0.15);

      pattern.forEach(([px, py]) => {
        const cx = x + w * (0.15 + px * 0.7);
        const cy = y + h * (0.15 + py * 0.7);
        if (tile.suit === "dot") {
          ctx.beginPath();
          ctx.arc(cx, cy, size, 0, Math.PI * 2);
          ctx.fillStyle = pipColor;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = style === "classic" ? "#fffdf4" : "#ffffff";
          ctx.fill();
        } else {
          // bamboo: vertical stick with node lines
          ctx.fillStyle = pipColor;
          const bw = size * 0.7, bh = size * 2.1;
          roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, bw * 0.3);
          ctx.fill();
          ctx.strokeStyle = style === "classic" ? "#0d4a26" : "#0e6b3a";
          ctx.lineWidth = Math.max(1, size * 0.15);
          for (let n = -1; n <= 1; n++) {
            const ny = cy + n * bh * 0.32;
            ctx.beginPath(); ctx.moveTo(cx - bw / 2, ny); ctx.lineTo(cx + bw / 2, ny); ctx.stroke();
          }
        }
      });
    }
  }

  window.MJ.Renderer = Renderer;
  window.MJ.TILE_W = TILE_W;
  window.MJ.TILE_H = TILE_H;
})();
