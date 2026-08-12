/**
 * Synthesizes audio notification chimes for POS / KDS / Self-Order events.
 * Uses native Web Audio API with safe autoplay gesture unlock and singleton AudioContext.
 */

let sharedAudioCtx: AudioContext | null = null;

const hasUserGesture = (): boolean => {
  if (typeof window === 'undefined') return false;
  if ('userActivation' in navigator && (navigator as any).userActivation) {
    return (navigator as any).userActivation.hasBeenActive;
  }
  return true;
};

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (sharedAudioCtx.state === 'suspended' && hasUserGesture()) {
    sharedAudioCtx.resume().catch(() => {
      // Quietly ignore if browser autoplay blocks resume
    });
  }

  return sharedAudioCtx;
};

// Global click / keydown / touchstart listener to unlock Web Audio API seamlessly on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true, once: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
}

/**
 * Synthesizes a pleasant 3-tone audio notification chime for new POS / Self-Order events.
 */
export const playNewOrderSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    // Play 3 melodic tones (E5 -> G5 -> C6 chime)
    const notes = [
      { freq: 659.25, time: 0, duration: 0.15 },   // E5
      { freq: 783.99, time: 0.12, duration: 0.15 },  // G5
      { freq: 1046.50, time: 0.24, duration: 0.4 }   // C6
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

      gain.gain.setValueAtTime(0, ctx.currentTime + note.time);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.duration);
    });
  } catch (err) {
    // Suppress console warning for autoplay restriction
  }
};

/**
 * Urgent 2-tone warning alarm sound for overdue kitchen orders (> 15 mins).
 */
export const playWarningAlarmSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    const notes = [
      { freq: 880, time: 0, duration: 0.12 },     // A5
      { freq: 880, time: 0.18, duration: 0.18 }    // A5 beep
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

      gain.gain.setValueAtTime(0, ctx.currentTime + note.time);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + note.time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.duration);
    });
  } catch (err) {
    // Suppress console warning for autoplay restriction
  }
};

/**
 * LOUD, attention-grabbing alert sound for incoming Self-Order from customer phone.
 */
export const playSelfOrderAlertSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    const bursts = [
      { freq: 1200, time: 0, duration: 0.12 },
      { freq: 800, time: 0.14, duration: 0.12 },
      { freq: 1200, time: 0.28, duration: 0.15 },
      { freq: 1400, time: 0.55, duration: 0.12 },
      { freq: 900, time: 0.69, duration: 0.12 },
      { freq: 1400, time: 0.83, duration: 0.15 },
      { freq: 1600, time: 1.1, duration: 0.14 },
      { freq: 1000, time: 1.26, duration: 0.14 },
      { freq: 1600, time: 1.42, duration: 0.35 },
    ];

    bursts.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

      gain.gain.setValueAtTime(0, ctx.currentTime + note.time);
      gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + note.time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.duration);
    });
  } catch (err) {
    // Suppress console warning for autoplay restriction
  }
};
