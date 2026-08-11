/**
 * Synthesizes a pleasant 3-tone audio notification chime for new POS / Self-Order events.
 * Uses native Web Audio API - no external MP3 dependencies.
 */
export const playNewOrderSound = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

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
    console.warn('Audio notification sound could not be played:', err);
  }
};

/**
 * Urgent 2-tone warning alarm sound for overdue kitchen orders (> 15 mins).
 */
export const playWarningAlarmSound = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
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
    console.warn('Warning alarm sound error:', err);
  }
};

/**
 * LOUD, attention-grabbing alert sound for incoming Self-Order from customer phone.
 * Plays a repeating 3-burst siren pattern (high-low-high) at maximum gain.
 * Designed to be unmissable even in a noisy restaurant environment.
 */
export const playSelfOrderAlertSound = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // 3 repeating alert bursts — escalating siren pattern
    const bursts = [
      // Burst 1
      { freq: 1200, time: 0, duration: 0.12 },
      { freq: 800, time: 0.14, duration: 0.12 },
      { freq: 1200, time: 0.28, duration: 0.15 },
      // Burst 2 (louder, higher)
      { freq: 1400, time: 0.55, duration: 0.12 },
      { freq: 900, time: 0.69, duration: 0.12 },
      { freq: 1400, time: 0.83, duration: 0.15 },
      // Burst 3 (final, longest)
      { freq: 1600, time: 1.1, duration: 0.14 },
      { freq: 1000, time: 1.26, duration: 0.14 },
      { freq: 1600, time: 1.42, duration: 0.35 },
    ];

    bursts.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

      // Maximum gain for loud notification
      gain.gain.setValueAtTime(0, ctx.currentTime + note.time);
      gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + note.time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.duration);
    });
  } catch (err) {
    console.warn('Self-order alert sound error:', err);
  }
};
