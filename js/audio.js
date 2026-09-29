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
  let dronePads = [];

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
  // A minor pentatonic across two octaves, for a calm, spa-like wash of
  // notes that never clashes no matter which are picked or combined.
  const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0];

  function playAmbientNote(freq, dur, peak) {
    const c = ctx;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0003, t0 + dur);
    osc.connect(filter).connect(gain);
    gain.connect(musicGain);
    const wet = c.createGain();
    wet.gain.value = 0.5;
    gain.connect(wet).connect(musicDelay);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function scheduleNextNote() {
    if (!musicPlaying) return;
    const freq = SCALE[Math.floor(Math.random() * SCALE.length)];
    const dur = 2.2 + Math.random() * 1.8;
    playAmbientNote(freq, dur, 0.05 + Math.random() * 0.03);
    if (Math.random() < 0.3) {
      const harmonyIdx = Math.min(SCALE.length - 1, Math.floor(Math.random() * SCALE.length));
      setTimeout(() => musicPlaying && playAmbientNote(SCALE[harmonyIdx], dur * 0.9, 0.03), 180);
    }
    musicTimer = setTimeout(scheduleNextNote, 1600 + Math.random() * 1800);
  }

  function startDrone() {
    const c = ctx;
    [110, 164.81].forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(0.018, c.currentTime + 3 + i);
      osc.connect(gain).connect(musicGain);
      osc.start();
      dronePads.push({ osc, gain });
    });
  }

  function stopDrone() {
    const c = ctx;
    dronePads.forEach(({ osc, gain }) => {
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, c.currentTime);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
      osc.stop(c.currentTime + 1.3);
    });
    dronePads = [];
  }

  function startMusic() {
    const c = ensureCtx();
    if (!c || musicPlaying) return;
    musicPlaying = true;
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, c.currentTime);
    musicGain.gain.linearRampToValueAtTime(1, c.currentTime + 2);
    startDrone();
    scheduleNextNote();
  }

  function stopMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    clearTimeout(musicTimer);
    stopDrone();
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
