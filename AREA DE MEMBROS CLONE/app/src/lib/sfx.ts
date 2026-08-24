// ─── sfx.ts ───────────────────────────────────────────────────────────────────
// Efeitos sonoros de gamificação sintetizados no Web Audio API (sem arquivos).
// Sons curtos e "recompensadores" (dopamina): vitória, moedas, gabarito, quase-lá.
// Precisam de um gesto do usuário pra tocar (ex.: clique de botão) — o AudioContext
// é criado/retomado sob demanda. Falha em silêncio se o navegador bloquear.
// =============================================================================

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (!_ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    }
    if (_ctx.state === "suspended") void _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

/** Prepara o contexto de áudio num gesto do usuário (chamar no clique). */
export function primeSound() {
  ctx();
}

type Wave = OscillatorType;

function tone(freq: number, startAt: number, dur: number, type: Wave = "sine", gain = 0.14) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + startAt;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

/** Fanfarra de vitória (arpejo maior ascendente). */
export function playWin() {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, i * 0.085, 0.32, "triangle", 0.16));
}

/** Gabarito: vitória + brilho extra no topo. */
export function playPerfect() {
  playWin();
  [1318.51, 1567.98, 2093.0].forEach((f, i) => tone(f, 0.36 + i * 0.08, 0.35, "triangle", 0.13));
}

/** Chuva de moedas (blips ascendentes tipo "moedinha"). */
export function playCoins() {
  for (let i = 0; i < 7; i++) {
    tone(740 + i * 130, i * 0.055, 0.13, "square", 0.09);
    tone(1480 + i * 130, i * 0.055, 0.1, "sine", 0.05);
  }
}

/** "Quase lá" — dois tons suaves e encorajadores (não é som de erro/derrota). */
export function playAlmost() {
  tone(392.0, 0, 0.28, "sine", 0.12); // G4
  tone(440.0, 0.16, 0.34, "sine", 0.12); // A4 (sobe → esperança, não punição)
}

/** Blip curto de avanço (ao passar de pergunta). */
export function playTick() {
  tone(880, 0, 0.07, "sine", 0.06);
}
