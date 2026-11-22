// Procedural sound, no audio files: a handful of WebAudio oscillator
// blips for the pickup chime, the alarm, the caught sting and the getaway
// jingle. Everything is guarded, so a browser with no audio — or a headless
// screenshot run — just plays silent. M mutes.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, seconds, type, gainValue, when = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const start = ctx.currentTime + when;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.05);
    } catch {
      // Audio is decoration: it must never be able to break the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'sine', 0.08);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.12);
      tone(1320, 0.18, 'sine', 0.1, 0.09);
    },
    diamond() {
      tone(784, 0.14, 'triangle', 0.14);
      tone(1047, 0.16, 'triangle', 0.14, 0.11);
      tone(1568, 0.3, 'triangle', 0.12, 0.22);
    },
    gadget() {
      tone(320, 0.2, 'sawtooth', 0.06);
      tone(180, 0.25, 'sawtooth', 0.05, 0.08);
    },
    spotted() {
      tone(220, 0.16, 'square', 0.07);
      tone(220, 0.16, 'square', 0.07, 0.2);
    },
    alarmTick() {
      tone(980, 0.09, 'square', 0.045);
    },
    caught() {
      tone(392, 0.25, 'sawtooth', 0.12);
      tone(311, 0.25, 'sawtooth', 0.12, 0.2);
      tone(233, 0.5, 'sawtooth', 0.12, 0.4);
    },
    escaped() {
      tone(523, 0.16, 'triangle', 0.13);
      tone(659, 0.16, 'triangle', 0.13, 0.14);
      tone(784, 0.16, 'triangle', 0.13, 0.28);
      tone(1047, 0.4, 'triangle', 0.13, 0.42);
    },
  };
}
