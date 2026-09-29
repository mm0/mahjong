// Synthesized sound effects via Web Audio API — no external audio files,
// so the game works fully offline the instant it's installed.
window.MJ = window.MJ || {};

(function () {
  let ctx = null;
  let enabled = true;
  let unlocked = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function unlock() {
    const c = ensureCtx();
    if (!c || unlocked) return;
    unlocked = true;
    if (c.state === "suspended") c.resume();
  }

  function tone(freq, start, dur, type = "sine", gainPeak = 0.15) {
    const c = ensureCtx();
    if (!c || !enabled) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + start);
    gain.gain.setValueAtTime(0, c.currentTime + start);
    gain.gain.linearRampToValueAtTime(gainPeak, c.currentTime + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime + start);
    osc.stop(c.currentTime + start + dur + 0.02);
  }

  function noiseBurst(start, dur, gainPeak = 0.1, filterFreq = 2000) {
    const c = ensureCtx();
    if (!c || !enabled) return;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(gainPeak, c.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(c.currentTime + start);
  }

  const SFX = {
    tap() { tone(720, 0, 0.06, "sine", 0.08); },
    select() { tone(560, 0, 0.09, "triangle", 0.1); },
    deselect() { tone(420, 0, 0.07, "triangle", 0.06); },
    match() {
      tone(660, 0, 0.12, "sine", 0.16);
      tone(880, 0.06, 0.16, "sine", 0.14);
    },
    invalid() { tone(180, 0, 0.14, "sawtooth", 0.06); },
    shuffle() { noiseBurst(0, 0.35, 0.12, 1500); noiseBurst(0.1, 0.3, 0.08, 2400); },
    hint() { tone(520, 0, 0.08, "sine", 0.08); tone(780, 0.08, 0.1, "sine", 0.08); },
    undo() { tone(400, 0, 0.08, "triangle", 0.08); tone(300, 0.06, 0.08, "triangle", 0.06); },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.11, 0.35, "sine", 0.13));
    },
    stuck() { tone(220, 0, 0.2, "sawtooth", 0.08); tone(160, 0.15, 0.25, "sawtooth", 0.08); },
  };

  window.MJ.Audio = {
    unlock,
    play(name) { if (SFX[name]) SFX[name](); },
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },
  };
})();
