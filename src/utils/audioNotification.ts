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
