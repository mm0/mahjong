// Synthesized sound effects + generative ambient background music via Web
// Audio API — no external audio files, so the game works fully offline the
// instant it's installed.
window.MJ = window.MJ || {};

(function () {
  let ctx = null;
  let sfxEnabled = true;
  let musicEnabled = true;
  let unlocked = false;
  let sfxGain = null;
  let musicGain = null;
  let musicDelay = null;
  let musicPlaying = false;
  let musicTimer = null;
  let chordTimer = null;
  let chordIndex = 0;
  let activePads = [];

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1;
      sfxGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(ctx.destination);

      // Soft feedback delay for a spacious, spa-like ambience.
      musicDelay = ctx.createDelay(2);
      musicDelay.delayTime.value = 0.42;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 1800;
      musicDelay.connect(delayFilter).connect(feedback).connect(musicDelay);
      musicDelay.connect(musicGain);
    }
    return ctx;
  }

  function unlock() {
    const c = ensureCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    if (!unlocked) {
      unlocked = true;
      if (musicEnabled) startMusic();
    }
  }

  function tone(freq, start, dur, type = "sine", gainPeak = 0.15) {
    const c = ensureCtx();
    if (!c || !sfxEnabled) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + start);
    gain.gain.setValueAtTime(0, c.currentTime + start);
    gain.gain.linearRampToValueAtTime(gainPeak, c.currentTime + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    osc.connect(gain).connect(sfxGain);
    osc.start(c.currentTime + start);
    osc.stop(c.currentTime + start + dur + 0.02);
  }

  function noiseBurst(start, dur, gainPeak = 0.1, filterFreq = 2000) {
    const c = ensureCtx();
    if (!c || !sfxEnabled) return;
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
    src.connect(filter).connect(gain).connect(sfxGain);
    src.start(c.currentTime + start);
  }

  const SFX = {
    tap() { tone(720, 0, 0.07, "sine", 0.12); },
    select() { tone(560, 0, 0.1, "triangle", 0.16); tone(840, 0.02, 0.12, "sine", 0.08); },
    deselect() { tone(420, 0, 0.08, "triangle", 0.1); },
    match() {
      tone(660, 0, 0.13, "sine", 0.22);
      tone(880, 0.06, 0.18, "sine", 0.2);
      tone(1320, 0.12, 0.2, "sine", 0.1);
    },
    invalid() { tone(180, 0, 0.16, "sawtooth", 0.1); tone(140, 0.05, 0.18, "sawtooth", 0.08); },
    shuffle() { noiseBurst(0, 0.35, 0.16, 1500); noiseBurst(0.1, 0.3, 0.12, 2400); },
    hint() { tone(520, 0, 0.09, "sine", 0.14); tone(780, 0.08, 0.12, "sine", 0.12); },
    undo() { tone(400, 0, 0.09, "triangle", 0.12); tone(300, 0.06, 0.09, "triangle", 0.1); },
    win() {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, i * 0.1, 0.4, "sine", 0.18));
    },
    stuck() { tone(220, 0, 0.2, "sawtooth", 0.1); tone(160, 0.15, 0.25, "sawtooth", 0.1); },
  };

  // ---------- generative ambient background music ----------
  // A slow i-VI-III-VII pad progression in A minor (four bars, each held
  // ~15s) gives the ambience harmonic motion instead of a static drone.
  // The melody scale is the A minor pentatonic across two octaves, so it's
  // always consonant with whichever chord is currently sounding; melody
  // notes additionally lean toward the current chord's own tones so the
  // two layers feel like one piece of music rather than two random ones.
  const CHORDS = [
    { name: "Am", pad: [110.0, 130.81, 164.81], tones: [220.0, 261.63, 329.63, 440.0] },   // A2 C3 E3
    { name: "F", pad: [87.31, 110.0, 130.81], tones: [174.63, 220.0, 261.63, 349.23] },     // F2 A2 C3
    { name: "C", pad: [130.81, 164.81, 196.0], tones: [261.63, 329.63, 392.0, 523.25] },    // C3 E3 G3
    { name: "G", pad: [98.0, 123.47, 146.83], tones: [196.0, 293.66, 392.0, 440.0] },       // G2 B2 D3
  ];
  const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0];
  const CHORD_HOLD_S = 15;

  function panner(value) {
    if (!ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner();
    p.pan.value = value;
    return p;
  }

  function playAmbientNote(freq, dur, peak, opts) {
    const { bell = false, pan = 0 } = opts || {};
    const c = ctx;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    osc.type = bell ? "sine" : "triangle";
    osc.frequency.value = freq;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = bell ? 4200 : 2200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + (bell ? 0.03 : dur * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0003, t0 + dur);
    const pannerNode = panner(pan);
    osc.connect(filter).connect(gain);
    (pannerNode ? gain.connect(pannerNode) && pannerNode : gain).connect(musicGain);
    const wet = c.createGain();
    wet.gain.value = bell ? 0.32 : 0.5;
    gain.connect(wet).connect(musicDelay);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);

    if (bell) {
      // A brighter, quieter partner an octave + a fifth up gives the pluck
      // a bell-like shimmer instead of a flat sine beep.
      const osc2 = c.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 3;
      const gain2 = c.createGain();
      gain2.gain.setValueAtTime(0, t0);
      gain2.gain.linearRampToValueAtTime(peak * 0.25, t0 + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0002, t0 + dur * 0.6);
      osc2.connect(gain2).connect(musicGain);
      osc2.start(t0);
      osc2.stop(t0 + dur * 0.6 + 0.05);
    }
  }

  function scheduleNextNote() {
    if (!musicPlaying) return;
    const chord = CHORDS[chordIndex];
    const useChordTone = Math.random() < 0.65;
    const freq = useChordTone
      ? chord.tones[Math.floor(Math.random() * chord.tones.length)]
      : SCALE[Math.floor(Math.random() * SCALE.length)];
    const bell = Math.random() < 0.22;
    const dur = bell ? 1.1 + Math.random() * 0.6 : 2.2 + Math.random() * 1.8;
    const pan = (Math.random() - 0.5) * 0.8;
    playAmbientNote(freq, dur, bell ? 0.07 + Math.random() * 0.03 : 0.05 + Math.random() * 0.03, { bell, pan });
    if (!bell && Math.random() < 0.3) {
      const harmonyFreq = chord.tones[Math.floor(Math.random() * chord.tones.length)];
      setTimeout(() => musicPlaying && playAmbientNote(harmonyFreq, dur * 0.9, 0.03, { pan: -pan }), 180);
    }
    musicTimer = setTimeout(scheduleNextNote, 1600 + Math.random() * 1800);
  }

  function fadeInPad(freq, pan) {
    const c = ctx;
    const voices = [1, 1.003]; // two barely-detuned oscillators per note = warm chorus, no beating
    voices.forEach((detune) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * detune;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(0.016, c.currentTime + 4);
      const pannerNode = panner(pan);
      osc.connect(gain);
      (pannerNode ? gain.connect(pannerNode) && pannerNode : gain).connect(musicGain);
      osc.start();
      activePads.push({ osc, gain });
    });
  }

  function fadeOutPads(pads) {
    const c = ctx;
    pads.forEach(({ osc, gain }) => {
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, c.currentTime);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + CHORD_HOLD_S * 0.6);
      osc.stop(c.currentTime + CHORD_HOLD_S * 0.6 + 0.1);
    });
  }

  function advanceChord() {
    if (!musicPlaying) return;
    const outgoing = activePads;
    activePads = [];
    fadeOutPads(outgoing);
    chordIndex = (chordIndex + 1) % CHORDS.length;
    const pans = [-0.35, 0, 0.35];
    CHORDS[chordIndex].pad.forEach((freq, i) => fadeInPad(freq, pans[i] || 0));
    chordTimer = setTimeout(advanceChord, CHORD_HOLD_S * 1000);
  }

  function startMusic() {
    const c = ensureCtx();
    if (!c || musicPlaying) return;
    musicPlaying = true;
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, c.currentTime);
    musicGain.gain.linearRampToValueAtTime(1, c.currentTime + 2);
    chordIndex = 0;
    const pans = [-0.35, 0, 0.35];
    CHORDS[chordIndex].pad.forEach((freq, i) => fadeInPad(freq, pans[i] || 0));
    chordTimer = setTimeout(advanceChord, CHORD_HOLD_S * 1000);
    scheduleNextNote();
  }

  function stopMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    clearTimeout(musicTimer);
    clearTimeout(chordTimer);
    fadeOutPads(activePads);
    activePads = [];
    if (ctx && musicGain) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    }
  }

  window.MJ.Audio = {
    unlock,
    play(name) { if (SFX[name]) SFX[name](); },
    setEnabled(v) { sfxEnabled = v; },
    isEnabled() { return sfxEnabled; },
  };

  window.MJ.Music = {
    setEnabled(v) {
      musicEnabled = v;
      if (!unlocked) return;
      if (v) startMusic(); else stopMusic();
    },
    isEnabled() { return musicEnabled; },
  };
})();
