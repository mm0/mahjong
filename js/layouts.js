// Board layouts: each returns an array of {col,row,level} positions (144 total).
// Grid uses plain integer (col,row) cells per level; higher levels visually
// step up-and-right at render time. This keeps overlap/free-tile logic simple
// and bug-free while still producing a layered, sculptural look.
window.MJ = window.MJ || {};

(function () {
  function addRow(out, row, colStart, colEndInclusive, level) {
    for (let c = colStart; c <= colEndInclusive; c++) out.push({ col: c, row, level });
  }
  function addRect(out, colStart, colEndInclusive, rowStart, rowEndInclusive, level) {
    for (let r = rowStart; r <= rowEndInclusive; r++) addRow(out, r, colStart, colEndInclusive, level);
  }
  // Solid diamond (rhombus) of the given radius, centered at (centerCol, centerRow).
  function addDiamond(out, centerCol, centerRow, radius, level) {
    for (let dr = -radius; dr <= radius; dr++) {
      const half = radius - Math.abs(dr);
      addRow(out, centerRow + dr, centerCol - half, centerCol + half, level);
    }
  }

  // ---- Layout 1: Turtle Cove (turtle-shaped shell, 3 levels) ----
  function turtleCove() {
    const out = [];
    addRow(out, 0, 8, 9, 0); // head tab
    addRow(out, 1, 5, 12, 0);
    addRow(out, 2, 3, 14, 0);
    out.push({ col: 0, row: 2, level: 0 }); // leg TL
    out.push({ col: 17, row: 2, level: 0 }); // leg TR
    addRow(out, 3, 2, 15, 0);
    addRow(out, 4, 1, 16, 0);
    addRow(out, 5, 1, 16, 0);
    addRow(out, 6, 2, 15, 0);
    addRow(out, 7, 3, 14, 0);
    out.push({ col: 0, row: 7, level: 0 }); // leg BL
    out.push({ col: 17, row: 7, level: 0 }); // leg BR
    addRow(out, 8, 5, 12, 0);
    addRow(out, 9, 8, 9, 0); // tail tab

    addRow(out, 3, 6, 11, 1);
    addRow(out, 4, 5, 12, 1);
    addRow(out, 5, 5, 12, 1);
    addRow(out, 6, 6, 11, 1);

    addRow(out, 4, 7, 10, 2);
    addRow(out, 5, 7, 10, 2);

    return out;
  }

  // ---- Layout 2: Step Pyramid (5 levels, centered rectangles) ----
  function stepPyramid() {
    const out = [];
    const W = 14, H = 8;
    const center = (w, h) => ({ c0: Math.floor((W - w) / 2), r0: Math.floor((H - h) / 2), c1: 0, r1: 0 });
    function level(w, h, lvl) {
      const c0 = Math.floor((W - w) / 2), r0 = Math.floor((H - h) / 2);
      addRect(out, c0, c0 + w - 1, r0, r0 + h - 1, lvl);
    }
    level(12, 6, 0); // 72
    level(10, 4, 1); // 40
    level(8, 2, 2);  // 16
    level(6, 2, 3);  // 12
    level(4, 1, 4);  // 4
    return out;
  }

  // ---- Layout 3: Fortress (walls, corner towers, central keep) ----
  function fortress() {
    const out = [];
    const W = 14, H = 6; // base footprint
    addRect(out, 0, W - 1, 0, H - 1, 0); // solid base courtyard, 84

    // ramparts: border ring of the base rect, one level up
    for (let c = 0; c < W; c++) {
      out.push({ col: c, row: 0, level: 1 });
      out.push({ col: c, row: H - 1, level: 1 });
    }
    for (let r = 1; r < H - 1; r++) {
      out.push({ col: 0, row: r, level: 1 });
      out.push({ col: W - 1, row: r, level: 1 });
    }
    // 36 wall tiles

    // corner towers, one level up from ramparts
    addRect(out, 0, 1, 0, 1, 2);
    addRect(out, W - 2, W - 1, 0, 1, 2);
    addRect(out, 0, 1, H - 2, H - 1, 2);
    addRect(out, W - 2, W - 1, H - 2, H - 1, 2);
    // 16 tower tiles

    // central keep, raised highest
    addRect(out, 5, 8, 2, 3, 3);
    // 8 keep tiles

    return out;
  }

  // ---- Layout 4: Diamond (nested rhombi, 4 levels) ----
  // Solid diamond of taxicab radius r holds 2r²+2r+1 tiles:
  // r6=85, r4=41, r2=13, r1=5 -> sums to exactly 144.
  function diamond() {
    const out = [];
    addDiamond(out, 9, 9, 6, 0);
    addDiamond(out, 9, 9, 4, 1);
    addDiamond(out, 9, 9, 2, 2);
    addDiamond(out, 9, 9, 1, 3);
    return out;
  }

  // ---- Layout 5: Dragon Gate (torii-style arch, 3 levels) ----
  function dragonGate() {
    const out = [];
    addRect(out, 1, 3, 2, 13, 0);   // left pillar, 3x12 = 36
    addRect(out, 14, 16, 2, 13, 0); // right pillar, 3x12 = 36
    addRect(out, 0, 17, 0, 1, 0);   // upper lintel, overhanging the pillars, 18x2 = 36
    addRect(out, 1, 16, 6, 7, 1);   // lower crossbar, 16x2 = 32
    addRow(out, 0, 7, 10, 2);       // small raised finial on top, 4
    return out;
  }

  // ---- Layout 6: Hourglass (twin triangles meeting at a waist) ----
  function hourglass() {
    const out = [];
    const W = 16;
    for (let r = 0; r <= 7; r++) {
      const inset = r; // widest at top (r=0), narrowest at waist (r=7)
      addRow(out, r, inset, W - 1 - inset, 0);
    }
    for (let r = 8; r <= 15; r++) {
      const inset = 15 - r; // narrowest at waist (r=8), widest at bottom (r=15)
      addRow(out, r, inset, W - 1 - inset, 0);
    }
    return out;
  }

  const LAYOUTS = {
    turtle: { name: "Turtle Cove", build: turtleCove },
    pyramid: { name: "Step Pyramid", build: stepPyramid },
    fortress: { name: "Fortress", build: fortress },
    diamond: { name: "Diamond", build: diamond },
    dragongate: { name: "Dragon Gate", build: dragonGate },
    hourglass: { name: "Hourglass", build: hourglass },
  };

  // Every layout above is designed wide (landscape) — a good fit for
  // desktop windows. transposed() swaps col/row so the same board runs
  // tall instead, for phones held in portrait; harmless to do, since the
  // game logic (matching, free-tile checks, the solvable dealer) is
  // entirely axis-agnostic.
  function transposed(positions) {
    return positions.map((p) => ({ col: p.row, row: p.col, level: p.level }));
  }

  Object.keys(LAYOUTS).forEach((key) => {
    const positions = LAYOUTS[key].build();
    if (positions.length !== 144) {
      console.error(`Layout "${key}" has ${positions.length} tiles, expected 144`);
    }
    LAYOUTS[key].positions = positions;
    LAYOUTS[key].positionsTall = transposed(positions);
  });

  window.MJ.Layouts = LAYOUTS;
})();
