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
