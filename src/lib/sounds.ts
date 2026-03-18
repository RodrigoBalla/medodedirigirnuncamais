// Sound utilities for the driving app
export function createTone(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  startTime: number,
  duration: number,
  gainPeak = 0.28
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
  gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
  gainNode.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + startTime + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);
  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration + 0.05);
}

export function playCorrectSound() {
  try {
    const ctx = new AudioContext();
    createTone(ctx, "sine", 659.25, 0, 0.14, 0.22);
    createTone(ctx, "sine", 830.61, 0.11, 0.22, 0.20);
    createTone(ctx, "triangle", 1046.5, 0.20, 0.35, 0.15);
  } catch {}
}

export function playWrongSound() {
  try {
    const ctx = new AudioContext();
    createTone(ctx, "sine", 220, 0, 0.18, 0.18);
    createTone(ctx, "sine", 185, 0.12, 0.22, 0.12);
  } catch {}
}

export function playCheckSound() {
  try {
    const ctx = new AudioContext();
    createTone(ctx, "sine", 523.25, 0, 0.10, 0.18);
    createTone(ctx, "sine", 659.25, 0.07, 0.16, 0.15);
  } catch {}
}

export function playAllDoneSound() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      createTone(ctx, "sine", freq, i * 0.09, 0.28, 0.20);
    });
    createTone(ctx, "triangle", 2093, 0.30, 0.4, 0.07);
  } catch {}
}

export function playConquestSound() {
  try {
    const ctx = new AudioContext();
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    arp.forEach((freq, i) => {
      createTone(ctx, "sine", freq, i * 0.08, 0.35, 0.18);
    });
    [523.25, 659.25, 783.99].forEach((freq) => {
      createTone(ctx, "triangle", freq, 0.42, 0.8, 0.10);
    });
    createTone(ctx, "sine", 2093, 0.58, 0.5, 0.06);
  } catch {}
}

export function playCelebrationSound() {
  try {
    const ctx = new AudioContext();
    // Firework rising whistle
    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.connect(whistleGain);
    whistleGain.connect(ctx.destination);
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(400, ctx.currentTime);
    whistle.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 0.4);
    whistleGain.gain.setValueAtTime(0.12, ctx.currentTime);
    whistleGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    whistle.start(ctx.currentTime);
    whistle.stop(ctx.currentTime + 0.5);

    // Firework burst - noise simulation with multiple tones
    const burstFreqs = [1200, 1800, 2400, 3000, 800, 1500];
    burstFreqs.forEach((freq, i) => {
      createTone(ctx, "sine", freq, 0.4 + i * 0.03, 0.3, 0.08);
      createTone(ctx, "triangle", freq * 0.5, 0.42 + i * 0.04, 0.25, 0.05);
    });

    // Fanfare melody
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    fanfare.forEach((freq, i) => {
      createTone(ctx, "sine", freq, 0.7 + i * 0.12, 0.25, 0.15);
      createTone(ctx, "triangle", freq, 0.72 + i * 0.12, 0.2, 0.06);
    });

    // Sustained chord (crowd feel)
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      createTone(ctx, "sine", freq, 1.5, 1.5, 0.08);
      createTone(ctx, "triangle", freq * 2, 1.6, 1.2, 0.03);
    });

    // Second burst
    [1600, 2200, 2800, 1000].forEach((freq, i) => {
      createTone(ctx, "sine", freq, 2.0 + i * 0.04, 0.35, 0.06);
    });

    // Final triumphant chord
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq) => {
      createTone(ctx, "sine", freq, 2.5, 1.8, 0.10);
    });
  } catch {}
}
