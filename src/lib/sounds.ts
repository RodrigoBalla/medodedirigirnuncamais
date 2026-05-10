// ─── sounds.ts ───────────────────────────────────────────────────────────────
// Audio 100% sintético via Web Audio API.
//
// Antes carregava 12 mp3 do soundjay.com, mas:
//   1) Soundjay bloqueia hotlink (sempre falhava em prod)
//   2) CSP do Netlify bloqueava as URLs externas
//   3) Aumentava o tempo de boot do app por nada
//
// Agora todos os sons são gerados via osciladores. Carrega instantâneo,
// zero rede, zero CSP. Cada função produz um "envelope" característico
// (sino, moeda, fanfarra, etc.) com timing e harmônicos próprios.
// =============================================================================

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    if (!_ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      _ctx = new Ctor();
    }
    return _ctx;
  } catch {
    return null;
  }
}

/** Tom puro com envelope ADSR rápido */
function tone(freq: number, duration = 0.25, gainPeak = 0.18, type: OscillatorType = "sine", delay = 0) {
  const c = ctx();
  if (!c) return;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gainPeak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Toca uma sequência de tons (melodia) */
function sequence(notes: Array<[freq: number, dur: number, type?: OscillatorType, gain?: number]>) {
  let t = 0;
  for (const [f, d, ty = "sine", g = 0.18] of notes) {
    tone(f, d, g, ty, t);
    t += d * 0.7;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const playCorrectSound = () => sequence([
  [880, 0.12, "sine", 0.20],
  [1320, 0.18, "sine", 0.22],
]);

export const playWrongSound = () => sequence([
  [220, 0.18, "sawtooth", 0.16],
  [180, 0.22, "sawtooth", 0.14],
]);

export const playCheckSound = () => tone(660, 0.10, 0.15, "sine");

export const playAllDoneSound = () => sequence([
  [523, 0.10, "triangle", 0.18],
  [659, 0.10, "triangle", 0.18],
  [784, 0.10, "triangle", 0.18],
  [1047, 0.30, "triangle", 0.22],
]);

export const playConquestSound = () => sequence([
  [1760, 0.10, "sine", 0.18],
  [2093, 0.20, "sine", 0.22],
]);

export const playHornSound = () => tone(400, 0.35, 0.20, "square");

export const playCelebrationSound = () => sequence([
  [523, 0.08],
  [659, 0.08],
  [784, 0.08],
  [1047, 0.08],
  [1319, 0.25, "sine", 0.24],
]);

export const playCoinSound = () => sequence([
  [988, 0.06, "square", 0.14],
  [1319, 0.10, "square", 0.16],
]);

export const playComboSound = () => sequence([
  [1500, 0.08, "square", 0.18],
  [1800, 0.12, "square", 0.20],
]);

export const playChestSound = () => sequence([
  [400, 0.10, "triangle", 0.18],
  [800, 0.10, "triangle", 0.18],
  [1200, 0.25, "sine", 0.22],
]);

export const playLevelUpSound = () => sequence([
  [523, 0.10, "triangle", 0.20],
  [784, 0.10, "triangle", 0.20],
  [1047, 0.10, "triangle", 0.20],
  [1568, 0.30, "triangle", 0.24],
]);

export const playStreakSound = () => sequence([
  [880, 0.08, "sine", 0.18],
  [1320, 0.10, "sine", 0.20],
  [1760, 0.15, "sine", 0.22],
]);

/** Tic curto pra simular a roleta girando (tipo "click" de catraca). */
export const playWheelTickSound = () => tone(2400, 0.04, 0.10, "square");

/** Fanfarra mais elaborada pra reveal de prêmio. */
export const playPrizeRevealSound = () => sequence([
  [523, 0.08, "triangle", 0.20],
  [659, 0.08, "triangle", 0.22],
  [784, 0.08, "triangle", 0.24],
  [1047, 0.12, "triangle", 0.26],
  [1568, 0.30, "sine", 0.28],
]);

/** Versão exportada do tom — usada por DrivingApp em sequências custom */
export function createTone(c: AudioContext, type: OscillatorType, freq: number, startTime: number, duration: number, gainPeak = 0.28) {
  const osc = c.createOscillator();
  const gainNode = c.createGain();
  osc.connect(gainNode);
  gainNode.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + startTime);
  gainNode.gain.setValueAtTime(0, c.currentTime + startTime);
  gainNode.gain.linearRampToValueAtTime(gainPeak, c.currentTime + startTime + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startTime + duration);
  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration + 0.05);
}
