// Procedural sound: every effect is a small oscillator envelope built in
// code, so the game ships no audio files and makes no network request.
//
// The AudioContext is created lazily on the first sound call (which only
// ever happens after a key press), so browsers that need a user gesture
// before audio are happy. Everything is wrapped in try/catch: a headless
// browser with no audio device must never break the game.

// One short tone: a sine/triangle voice that slides in pitch and fades out.
function tone(ctx, freq, dur, type, gain, slideTo, delay) {
  const start = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain || 0.12, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

// A burst of filtered noise, for smoke and the EMP crackle.
function noise(ctx, dur, gain, delay) {
  const start = ctx.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain || 0.1, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(amp);
  amp.connect(ctx.destination);
  src.start(start);
}

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function safe(fn) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      fn(c);
    } catch (err) {
      // Silence is better than a crash: the game plays on without sound.
    }
  }

  return {
    toggleMute() {
      muted = !muted;
      return muted;
    },

    isMuted() {
      return muted;
    },

    // UI click: starting the run.
    click() {
      safe((c) => tone(c, 660, 0.09, 'triangle', 0.1, 880));
    },

    // Loot lifted: a bright two-note chime, higher for the diamond.
    pickup(diamond) {
      safe((c) => {
        const base = diamond ? 880 : 620;
        tone(c, base, 0.1, 'sine', 0.12);
        tone(c, base * 1.5, 0.16, 'sine', 0.12, null, 0.07);
      });
    },

    // A guard's suspicion just crossed into a chase: a low warning sting.
    alert() {
      safe((c) => {
        tone(c, 220, 0.22, 'sawtooth', 0.09, 165);
        tone(c, 330, 0.18, 'sawtooth', 0.07, 247, 0.05);
      });
    },

    // The alarm is climbing: a short two-beep siren blip.
    alarmBlip() {
      safe((c) => {
        tone(c, 740, 0.1, 'square', 0.045, 740);
        tone(c, 520, 0.1, 'square', 0.045, 520, 0.12);
      });
    },

    // Smoke bomb: a soft whoosh.
    smoke() {
      safe((c) => noise(c, 0.5, 0.16));
    },

    // EMP burst: a sharp electric crackle.
    emp() {
      safe((c) => {
        noise(c, 0.35, 0.18);
        tone(c, 1400, 0.25, 'square', 0.05, 120);
      });
    },

    // Caught: a short falling sting.
    caught() {
      safe((c) => {
        tone(c, 392, 0.3, 'sawtooth', 0.1, 196);
        tone(c, 196, 0.45, 'sawtooth', 0.1, 98, 0.12);
      });
    },

    // Clean getaway: a little rising fanfare.
    win() {
      safe((c) => {
        tone(c, 523, 0.14, 'triangle', 0.12);
        tone(c, 659, 0.14, 'triangle', 0.12, null, 0.12);
        tone(c, 784, 0.22, 'triangle', 0.12, null, 0.24);
        tone(c, 1047, 0.3, 'triangle', 0.1, null, 0.38);
      });
    },
  };
}
