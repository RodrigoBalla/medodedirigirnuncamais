// Sound utilities - Professional audio with preloading and fallbacks
const SOUND_URLS = {
  correct: "https://www.soundjay.com/buttons/sounds/button-3.mp3",
  wrong: "https://www.soundjay.com/buttons/sounds/button-10.mp3",
  check: "https://www.soundjay.com/buttons/sounds/button-4.mp3",
  allDone: "https://www.soundjay.com/misc/sounds/success-fanfare-trumpet-1.mp3",
  conquest: "https://www.soundjay.com/misc/sounds/bell-ring-01.mp3",
  cash: "https://www.soundjay.com/misc/sounds/cash-register-05.mp3",
  fanfare: "https://www.soundjay.com/misc/sounds/magic-chime-01.mp3",
  horn: "https://www.soundjay.com/mechanical/sounds/car-horn-1.mp3",
  combo: "https://www.soundjay.com/misc/sounds/fail-trombone-01.mp3",
  chestOpen: "https://www.soundjay.com/misc/sounds/magic-chime-02.mp3",
  levelUp: "https://www.soundjay.com/misc/sounds/success-fanfare-trumpet-2.mp3",
  streak: "https://www.soundjay.com/misc/sounds/bell-ring-01.mp3",
};

const audioCache: Record<string, HTMLAudioElement> = {};

Object.entries(SOUND_URLS).forEach(([key, url]) => {
  try {
    const audio = new Audio(url);
    audio.preload = "auto";
    audioCache[key] = audio;
  } catch (e) {}
});

const playSound = (key: keyof typeof SOUND_URLS, volume = 0.5, fallbackFreq?: number) => {
  try {
    const cached = audioCache[key];
    if (cached) {
      const clone = cached.cloneNode() as HTMLAudioElement;
      clone.volume = volume;
      clone.play().catch(() => { if (fallbackFreq) playSynthetic(fallbackFreq); });
    } else if (fallbackFreq) {
      playSynthetic(fallbackFreq);
    }
  } catch (e) {
    if (fallbackFreq) playSynthetic(fallbackFreq);
  }
};

function playSynthetic(freq: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

export const playCorrectSound = () => playSound("correct", 0.4, 880);
export const playWrongSound = () => playSound("wrong", 0.4, 220);
export const playCheckSound = () => playSound("check", 0.3, 440);
export const playAllDoneSound = () => playSound("allDone", 0.5, 1320);
export const playConquestSound = () => playSound("conquest", 0.5, 1760);
export const playHornSound = () => playSound("horn", 0.4, 400);
export const playCelebrationSound = () => playSound("fanfare", 0.6, 2200);
export const playCoinSound = () => playSound("cash", 0.5, 3300);
export const playComboSound = () => playSound("combo", 0.5, 1500);
export const playChestSound = () => playSound("chestOpen", 0.6, 1800);
export const playLevelUpSound = () => playSound("levelUp", 0.6, 2000);
export const playStreakSound = () => playSound("streak", 0.5, 1200);

export function createTone(ctx: AudioContext, type: OscillatorType, freq: number, startTime: number, duration: number, gainPeak = 0.28) {
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
