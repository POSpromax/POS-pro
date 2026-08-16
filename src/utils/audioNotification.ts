/**
 * Synthesizes audio notification chimes for POS / KDS / Self-Order events.
 * Uses native Web Audio API with safe autoplay gesture unlock and singleton AudioContext.
 */

let sharedAudioCtx: AudioContext | null = null;
let audioUnlockedByGesture = false;

const hasUserGesture = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (audioUnlockedByGesture) return true;
  if ('userActivation' in navigator && (navigator as any).userActivation) {
    return (navigator as any).userActivation.hasBeenActive;
  }
  // Browser lama tanpa UserActivation API tetap harus menunggu listener
  // pointer/keyboard di bawah, jangan menganggap autoplay sudah diizinkan.
  return false;
};

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  // Membuat AudioContext saja sudah cukup untuk memicu warning autoplay di
  // Chrome. Jangan pernah membuatnya saat initial render/realtime bootstrap.
  if (!sharedAudioCtx && !hasUserGesture()) return null;

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
    audioUnlockedByGesture = true;
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', unlockAudio, true);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  // Capture pointerdown berjalan sebelum React onClick (termasuk tombol tes
  // suara), sehingga bunyi pertama dapat dimainkan tanpa warning autoplay.
  window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true, capture: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
}

/**
 * Synthesizes named UI notification presets. Preset names shown in Settings
 * intentionally have different patterns so the Test button reflects the real
 * operational event instead of several labels producing the same chime.
 */
export const playNewOrderSound = (preset = 'Kitchen Order') => {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    const normalized = String(preset || '').trim().toLocaleLowerCase('id-ID');
    const isSiren = normalized.includes('alarm') || normalized.includes('siren');
    const isWarning = normalized.includes('warning') || normalized.includes('beep');
    const isCash = normalized.includes('cash register') || normalized.includes('register');
    const isSuccess = normalized.includes('success');
    const isKitchen = normalized.includes('kitchen');

    type Tone = { freq: number; time: number; duration: number; wave?: OscillatorType; gain?: number };
    let notes: Tone[];

    if (isSiren) {
      notes = [
        { freq: 920, time: 0, duration: 0.16, wave: 'square', gain: 0.32 },
        { freq: 1320, time: 0.2, duration: 0.16, wave: 'square', gain: 0.32 },
        { freq: 920, time: 0.4, duration: 0.16, wave: 'square', gain: 0.32 },
        { freq: 1480, time: 0.6, duration: 0.3, wave: 'square', gain: 0.34 },
      ];
    } else if (isWarning) {
      notes = [
        { freq: 880, time: 0, duration: 0.13, wave: 'square', gain: 0.22 },
        { freq: 880, time: 0.2, duration: 0.2, wave: 'square', gain: 0.22 },
      ];
    } else if (isCash) {
      // Short high-low metallic register cue; intentionally distinct from success.
      notes = [
        { freq: 1567.98, time: 0, duration: 0.08, wave: 'triangle', gain: 0.18 },
        { freq: 1174.66, time: 0.07, duration: 0.09, wave: 'triangle', gain: 0.17 },
        { freq: 1975.53, time: 0.16, duration: 0.2, wave: 'sine', gain: 0.19 },
      ];
    } else if (isSuccess) {
      // Warm ascending confirmation.
      notes = [
        { freq: 523.25, time: 0, duration: 0.13, wave: 'sine', gain: 0.2 },
        { freq: 659.25, time: 0.11, duration: 0.14, wave: 'sine', gain: 0.21 },
        { freq: 783.99, time: 0.23, duration: 0.32, wave: 'sine', gain: 0.2 },
      ];
    } else if (isKitchen) {
      // Crisp double-call that cuts through kitchen noise without sounding urgent.
      notes = [
        { freq: 659.25, time: 0, duration: 0.12, wave: 'triangle', gain: 0.23 },
        { freq: 987.77, time: 0.14, duration: 0.18, wave: 'triangle', gain: 0.24 },
        { freq: 783.99, time: 0.38, duration: 0.12, wave: 'triangle', gain: 0.22 },
        { freq: 1174.66, time: 0.52, duration: 0.24, wave: 'triangle', gain: 0.24 },
      ];
    } else {
      notes = [
        { freq: 659.25, time: 0, duration: 0.15, wave: 'sine', gain: 0.22 },
        { freq: 783.99, time: 0.12, duration: 0.15, wave: 'sine', gain: 0.22 },
        { freq: 1046.5, time: 0.24, duration: 0.36, wave: 'sine', gain: 0.22 },
      ];
    }

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = ctx.currentTime + note.time;
      const peak = note.gain ?? 0.22;

      osc.type = note.wave ?? 'sine';
      osc.frequency.setValueAtTime(note.freq, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(peak, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + note.duration + 0.02);
    });
  } catch {
    // Browser autoplay / unavailable audio should never break POS workflow.
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
export const playSelfOrderAlertSound = (preset = 'Customer Order') => {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    const warningOnly = preset.toLocaleLowerCase('id-ID').includes('warning');
    const bursts = warningOnly ? [
      { freq: 1000, time: 0, duration: 0.18 },
      { freq: 1000, time: 0.24, duration: 0.24 },
    ] : [
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
      gain.gain.linearRampToValueAtTime(warningOnly ? 0.28 : 0.45, ctx.currentTime + note.time + 0.01);
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
