// ─── levels ──────────────────────────────────────────────────────────────────
// FONTE ÚNICA do sistema de níveis (antes havia 4 cálculos espalhados e
// divergentes: `XP/100 + 1`, que colocava a aluna no nível 3 só por abrir e
// clicar no e-mail de boas-vindas — 200 XP + 200 moedas — sem ter feito nada).
//
// Regras (definidas pelo Balla):
//   • Toda aluna COMEÇA no nível 1.
//   • Sobe conforme faz missões e ganha moedas → pontuação = XP + moedas.
//   • Máximo de 33 níveis.
//
// Curva: limiar(L) = 500 * (L-1)^1.5 — cada nível exige mais que o anterior.
//   Nível 1 vai de 0 a 499 (o bônus do e-mail, 400, ainda é nível 1 ✔)
//   Nível 2: 500 · Nível 3: 1.414 · Nível 5: 4.000 · Nível 33: ~90.500
// =============================================================================

export const MAX_LEVEL = 33;

/** Nomes por nível — progressão temática de quem aprende a dirigir. */
const TITLES = [
  "Iniciante",            // 1
  "Primeiro Contato",     // 2
  "Chave na Mão",         // 3
  "Motor Ligado",         // 4
  "Primeira Marcha",      // 5
  "Segunda Marcha",       // 6
  "Terceira Marcha",      // 7
  "Pé na Estrada",        // 8
  "Baliza Iniciante",     // 9
  "Baliza Firme",         // 10
  "Ladeira Leve",         // 11
  "Ladeira Firme",        // 12
  "Trânsito Calmo",       // 13
  "Trânsito Real",        // 14
  "Avenida",              // 15
  "Rodovia",              // 16
  "Garagem Dominada",     // 17
  "Estacionamento Zen",   // 18
  "Noite Tranquila",      // 19
  "Chuva Sem Medo",       // 20
  "Confiança em Marcha",  // 21
  "Rota Própria",         // 22
  "Viagem Curta",         // 23
  "Viagem Longa",         // 24
  "Cidade Grande",        // 25
  "Serra Sem Susto",      // 26
  "Volante Firme",        // 27
  "Piloto Urbana",        // 28
  "Piloto de Estrada",    // 29
  "Mestre do Volante",    // 30
  "Referência da Turma",  // 31
  "Inspiração",           // 32
  "Lenda do Volante",     // 33
];

/** Pontuação mínima pra alcançar o nível L (L de 1 a 33). */
export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  const l = Math.min(level, MAX_LEVEL);
  return Math.round(500 * Math.pow(l - 1, 1.5));
}

export interface LevelInfo {
  /** Nível atual (1 a 33). */
  level: number;
  /** Nome do nível. */
  title: string;
  /** Pontuação = XP + moedas. */
  score: number;
  /** Pontos já feitos DENTRO do nível atual. */
  current: number;
  /** Pontos necessários pra fechar o nível atual. */
  next: number;
  /** 0-100, progresso dentro do nível (100 no nível máximo). */
  pct: number;
  isMax: boolean;
}

/**
 * Nível a partir do XP e das moedas.
 * Passar as moedas é opcional pra telas que ainda não têm o dado — nesses
 * casos o nível sai subestimado, então prefira sempre informar as duas.
 */
export function getLevelInfo(totalXP: number, coins = 0): LevelInfo {
  const score = Math.max(0, Math.floor(totalXP || 0)) + Math.max(0, Math.floor(coins || 0));

  let level = 1;
  while (level < MAX_LEVEL && score >= levelThreshold(level + 1)) level++;

  const base = levelThreshold(level);
  const isMax = level >= MAX_LEVEL;
  const span = isMax ? 0 : levelThreshold(level + 1) - base;

  return {
    level,
    title: TITLES[level - 1] ?? "Iniciante",
    score,
    current: score - base,
    next: span,
    pct: isMax ? 100 : Math.min(100, Math.round(((score - base) / span) * 100)),
    isMax,
  };
}
