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

  const LAYOUTS = {
    turtle: { name: "Turtle Cove", build: turtleCove },
    pyramid: { name: "Step Pyramid", build: stepPyramid },
    fortress: { name: "Fortress", build: fortress },
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
