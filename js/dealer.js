// Guaranteed-solvable dealing: simulate valid PAIR removals over the board
// geometry (each pair's two tiles must be simultaneously free at the moment
// they're removed — mirrors real gameplay exactly), then assign shuffled
// matching tile-type tokens to those pairs. Replaying the same pair order
// is therefore always a legal solve.
window.MJ = window.MJ || {};

(function () {
  function isFree(pos, occupiedSet, byCell) {
    const above = byCell.get(`${pos.col},${pos.row},${pos.level + 1}`);
    if (above && occupiedSet.has(above.id)) return false;
    const left = byCell.get(`${pos.col - 1},${pos.row},${pos.level}`);
    const right = byCell.get(`${pos.col + 1},${pos.row},${pos.level}`);
    const leftBlocked = left && occupiedSet.has(left.id);
    const rightBlocked = right && occupiedSet.has(right.id);
    return !(leftBlocked && rightBlocked);
  }

  function buildIndex(positions) {
    const byCell = new Map();
    positions.forEach((p, id) => byCell.set(`${p.col},${p.row},${p.level}`, { id }));
    return byCell;
  }

  // Returns an array of [idA, idB] pairs: at the moment each pair is
  // removed, both idA and idB were free simultaneously (with all earlier
  // pairs already removed, and everything else still on the board).
  function randomPairOrder(positions, rng) {
    const byCell = buildIndex(positions);
    const occupied = new Set(positions.map((_, id) => id));
    const pairs = [];
    let remaining = positions.map((_, id) => id);

    while (remaining.length) {
      const freeIds = remaining.filter((id) => isFree(positions[id], occupied, byCell));
      if (freeIds.length < 2) return null; // stuck; caller retries with a new shuffle
      shuffleArray(freeIds, rng);
      const a = freeIds[0], b = freeIds[1];
      occupied.delete(a);
      occupied.delete(b);
      pairs.push([a, b]);
      remaining = remaining.filter((id) => id !== a && id !== b);
    }
    return pairs;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleArray(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Full deal: positions (144 {col,row,level}) -> array of tile instances
  // aligned by index to positions, each with {type, category, ...visual}.
  function dealSolvable(positions, seed) {
    const rng = mulberry32(seed >>> 0 || (Date.now() & 0xffffffff));
    let pairs = null;
    for (let attempt = 0; attempt < 200 && !pairs; attempt++) {
      pairs = randomPairOrder(positions, rng);
    }
    if (!pairs) throw new Error("Failed to compute a valid pair removal order");

    const tokens = shuffleArray(window.MJ.TilesData.buildPairTokens(), rng);
    const tiles = new Array(positions.length);
    for (let i = 0; i < tokens.length; i++) {
      const [posA, posB] = pairs[i];
      tiles[posA] = Object.assign({}, tokens[i].a);
      tiles[posB] = Object.assign({}, tokens[i].b);
    }
    dealSolvable._lastPairs = pairs; // exposed for tests
    return tiles;
  }

  // Re-shuffle only currently-remaining tiles across their existing
  // positions, still guaranteeing solvability from this point forward.
  function reshuffleRemaining(remainingPositions, remainingTiles, seed) {
    const rng = mulberry32(seed >>> 0 || (Date.now() & 0xffffffff));
    let pairs = null;
    for (let attempt = 0; attempt < 200 && !pairs; attempt++) {
      pairs = randomPairOrder(remainingPositions, rng);
    }
    if (!pairs) return null;

    // Group remaining tiles into matching pairs (safe: counts per exact
    // type, or per wildcard category, are always even during normal play).
    // Store independent snapshots (not live tile references!) — callers
    // apply the result via in-place Object.assign over the same array the
    // groups were built from, and live references would alias and corrupt
    // each other as that mutation proceeds.
    const groups = new Map(); // key -> array of tile-data snapshots
    remainingTiles.forEach((t) => {
      const key = (t.category === "flower" || t.category === "season") ? t.category : t.type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ type: t.type, category: t.category, glyph: t.glyph, suit: t.suit, rank: t.rank, color: t.color, label: t.label });
    });

    const pairTokens = [];
    groups.forEach((arr) => {
      shuffleArray(arr, rng);
      for (let i = 0; i + 1 < arr.length; i += 2) pairTokens.push([arr[i], arr[i + 1]]);
    });
    shuffleArray(pairTokens, rng);

    const out = new Array(remainingPositions.length);
    for (let i = 0; i < pairTokens.length; i++) {
      out[pairs[i][0]] = pairTokens[i][0];
      out[pairs[i][1]] = pairTokens[i][1];
    }
    reshuffleRemaining._lastPairs = pairs; // exposed for tests
    return out;
  }

  window.MJ.Dealer = { dealSolvable, reshuffleRemaining, isFree, buildIndex, mulberry32, shuffleArray };
})();
