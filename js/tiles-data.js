// Tile type definitions: suits, honors, flowers, seasons.
// Each tile TYPE has a stable id used for matching; category drives sprite + match rules.
window.MJ = window.MJ || {};

(function () {
  const SUITS = [
    { key: "dot", label: "Circles", color: "#2f7fd8" },
    { key: "bam", label: "Bamboo", color: "#2f9e5c" },
    { key: "chr", label: "Characters", color: "#c23b3b" },
  ];

  const WINDS = [
    { key: "wN", glyph: "北", label: "North" },
    { key: "wE", glyph: "東", label: "East" },
    { key: "wS", glyph: "南", label: "South" },
    { key: "wW", glyph: "西", label: "West" },
  ];

  const DRAGONS = [
    { key: "dR", glyph: "中", label: "Red Dragon", color: "#c23b3b" },
    { key: "dG", glyph: "發", label: "Green Dragon", color: "#2f9e5c" },
    { key: "dW", glyph: "", label: "White Dragon", color: "#6b7280" },
  ];

  const FLOWERS = [
    { key: "fPlum", glyph: "梅", label: "Plum" },
    { key: "fOrchid", glyph: "蘭", label: "Orchid" },
    { key: "fBamboo", glyph: "竹", label: "Bamboo Flower" },
    { key: "fChrys", glyph: "菊", label: "Chrysanthemum" },
  ];

  const SEASONS = [
    { key: "sSpring", glyph: "春", label: "Spring" },
    { key: "sSummer", glyph: "夏", label: "Summer" },
    { key: "sAutumn", glyph: "秋", label: "Autumn" },
    { key: "sWinter", glyph: "冬", label: "Winter" },
  ];

  // Build the full 144-tile type pool as "pair tokens": each token yields
  // exactly 2 tile instances that are valid matches for each other.
  function buildPairTokens() {
    const tokens = [];

    // Suits: 9 ranks x 3 suits x 4 copies = 108 tiles = 54 pair tokens.
    SUITS.forEach((suit) => {
      for (let rank = 1; rank <= 9; rank++) {
        const type = `${suit.key}${rank}`;
        for (let p = 0; p < 2; p++) {
          tokens.push({
            a: { type, category: "suit", suit: suit.key, rank, color: suit.color },
            b: { type, category: "suit", suit: suit.key, rank, color: suit.color },
          });
        }
      }
    });

    // Winds: 4 types x 4 copies = 16 tiles = 8 pair tokens.
    WINDS.forEach((w) => {
      for (let p = 0; p < 2; p++) {
        tokens.push({
          a: { type: w.key, category: "wind", glyph: w.glyph, label: w.label, color: "#1f2937" },
          b: { type: w.key, category: "wind", glyph: w.glyph, label: w.label, color: "#1f2937" },
        });
      }
    });

    // Dragons: 3 types x 4 copies = 12 tiles = 6 pair tokens.
    DRAGONS.forEach((d) => {
      for (let p = 0; p < 2; p++) {
        tokens.push({
          a: { type: d.key, category: "dragon", glyph: d.glyph, label: d.label, color: d.color },
          b: { type: d.key, category: "dragon", glyph: d.glyph, label: d.label, color: d.color },
        });
      }
    });

    // Flowers: 4 unique tiles, any flower matches any flower -> 2 pair tokens.
    const flowerShuffled = FLOWERS.slice();
    tokens.push({
      a: { type: flowerShuffled[0].key, category: "flower", glyph: flowerShuffled[0].glyph, label: flowerShuffled[0].label, color: "#e07a3f" },
      b: { type: flowerShuffled[1].key, category: "flower", glyph: flowerShuffled[1].glyph, label: flowerShuffled[1].label, color: "#e07a3f" },
    });
    tokens.push({
      a: { type: flowerShuffled[2].key, category: "flower", glyph: flowerShuffled[2].glyph, label: flowerShuffled[2].label, color: "#e07a3f" },
      b: { type: flowerShuffled[3].key, category: "flower", glyph: flowerShuffled[3].glyph, label: flowerShuffled[3].label, color: "#e07a3f" },
    });

    // Seasons: 4 unique tiles, any season matches any season -> 2 pair tokens.
    const seasonShuffled = SEASONS.slice();
    tokens.push({
      a: { type: seasonShuffled[0].key, category: "season", glyph: seasonShuffled[0].glyph, label: seasonShuffled[0].label, color: "#8a5fc2" },
      b: { type: seasonShuffled[1].key, category: "season", glyph: seasonShuffled[1].glyph, label: seasonShuffled[1].label, color: "#8a5fc2" },
    });
    tokens.push({
      a: { type: seasonShuffled[2].key, category: "season", glyph: seasonShuffled[2].glyph, label: seasonShuffled[2].label, color: "#8a5fc2" },
      b: { type: seasonShuffled[3].key, category: "season", glyph: seasonShuffled[3].glyph, label: seasonShuffled[3].label, color: "#8a5fc2" },
    });

    return tokens; // 72 tokens = 144 tiles
  }

  function suitGlyph(suitKey, rank) {
    if (suitKey === "chr") {
      const numerals = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
      return numerals[rank];
    }
    return String(rank);
  }

  function matches(a, b) {
    if (!a || !b || a.removed || b.removed) return false;
    if (a.category === "flower" && b.category === "flower") return true;
    if (a.category === "season" && b.category === "season") return true;
    return a.category !== "flower" && a.category !== "season" && a.type === b.type;
  }

  window.MJ.TilesData = {
    SUITS, WINDS, DRAGONS, FLOWERS, SEASONS,
    buildPairTokens, suitGlyph, matches,
  };
})();
