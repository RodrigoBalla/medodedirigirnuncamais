export interface Phase {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  steps: string[];
  quizzes: Quiz[];
  conquest: string;
  xp: number;
}

export interface Quiz {
  q: string;
  opts: string[];
  correct: number;
  explain: string;
  gif: string;
  gifAlt: string;
  emoji: string;
}

export interface FuturePhase {
  icon: string;
  title: string;
  desc: string;
}

export interface Achievement {
  icon: string;
  name: string;
  unlocked: boolean;
}

export interface ChecklistTask {
  id: string;
  text: string;
  icon: string;
}

export const PHASES: Phase[] = [
  {
    id: 1,
    title: "Fase 1 — Conhecendo o carro",
    subtitle: "Eliminar ansiedade inicial",
    icon: "🚗",
    iconBg: "blue",
    steps: ["Missão", "Quiz", "Simulação", "Prática"],
    quizzes: [
      {
        q: "Para que serve o pedal mais à esquerda (embreagem)?",
        opts: ["Frear o carro", "Trocar as marchas", "Acelerar o carro", "Ligar o carro"],
        correct: 1,
        explain: "A embreagem desconecta o motor da transmissão, permitindo a troca de marchas!",
        gif: "o5BzNDDFQnepi",
        gifAlt: "Câmbio manual sendo trocado — a embreagem torna isso possível",
        emoji: "⚙️"
      },
      {
        q: "Qual pedal faz o carro parar?",
        opts: ["Embreagem", "Acelerador", "Freio", "Nenhum deles"],
        correct: 2,
        explain: "O freio (pedal do meio) é responsável por desacelerar e parar o carro.",
        gif: "3ohc15JPnJcyGLkZ68",
        gifAlt: "Carro freando animado",
        emoji: "🛑"
      },
      {
        q: "No carro automático, quantos pedais existem?",
        opts: ["1 pedal", "2 pedais", "3 pedais", "4 pedais"],
        correct: 1,
        explain: "No automático há apenas 2 pedais: freio e acelerador. Muito mais simples!",
        gif: "3oz8xyz53y9s8CCctq",
        gifAlt: "Câmbio automático ilustrado",
        emoji: "🚗"
      }
    ],
    conquest: "Você já conhece o carro. Ele não é mais desconhecido.",
    xp: 50
  },
  {
    id: 2,
    title: "Fase 2 — O jogo dos pés",
    subtitle: "Dominar a segunda marcha",
    icon: "⚙️",
    iconBg: "green",
    steps: ["Missão", "Quiz", "Simulação", "Prática"],
    quizzes: [
      {
        q: "Quantos membros do corpo participam da troca de marcha?",
        opts: ["Apenas as mãos", "Apenas os pés", "2 mãos + 2 pés", "Somente 1 pé"],
        correct: 2,
        explain: "A troca de marcha envolve os dois pés e as mãos — por isso treinamos em etapas!",
        gif: "3o6Ztj3gHBKJzWXigM",
        gifAlt: "Personagem trocando marcha com mãos e pés",
        emoji: "🙌"
      },
      {
        q: "O que deve ser automatizado PRIMEIRO?",
        opts: ["Controle do volante", "Olhar para o espelho", "Coordenação dos pés", "Acender os faróis"],
        correct: 2,
        explain: "Os pés vêm primeiro! Quando os pés são automáticos, o volante fica mais fácil.",
        gif: "dfY3e4qb481v9Z3E9d",
        gifAlt: "Animação de troca de marcha - foco nos pés",
        emoji: "🦶"
      },
      {
        q: "Por que treinar em local com pouco movimento?",
        opts: ["Porque é mais rápido", "Para reduzir distrações e focar nos pés", "Por obrigação da lei", "Para economizar gasolina"],
        correct: 1,
        explain: "Menos estímulos = mais foco na coordenação. O cérebro aprende por camadas!",
        gif: "W7BLZTSmCPjIWostvn",
        gifAlt: "Carro em espaço aberto e tranquilo",
        emoji: "🛣️"
      }
    ],
    conquest: "Seus pés já sabem o que fazer. Automatização completa!",
    xp: 75
  },
  {
    id: 3,
    title: "Fase 3 — Fluidez e direção",
    subtitle: "Volante, curvas e terceira marcha",
    icon: "🏁",
    iconBg: "yellow",
    steps: ["Missão", "Quiz", "Simulação", "Prática"],
    quizzes: [
      {
        q: "Como devem estar as mãos no volante?",
        opts: ["Muito apertadas", "Levemente apoiadas", "Uma mão só", "Não importa"],
        correct: 1,
        explain: "Mãos leves = braços relaxados = direção mais fluida e menos cansativa!",
        gif: "5den18Y823Ng2JHeZ1",
        gifAlt: "Piloto com mãos no volante com leveza",
        emoji: "🤲"
      },
      {
        q: "Para onde deve estar o olhar ao dirigir?",
        opts: ["Para o capô do carro", "Para os pedais", "Para longe, à frente", "Para o espelho retrovisor sempre"],
        correct: 2,
        explain: "Olhar longe dá ao cérebro mais tempo para antecipar e reduz a sensação de pressa.",
        gif: "FYMmlTmjZPWukq3u9c",
        gifAlt: "Piloto com olhar focado à frente na pista",
        emoji: "👀"
      },
      {
        q: "Qual marcha você usa após a segunda em velocidade normal?",
        opts: ["Volta pra primeira", "Terceira marcha", "Quarta marcha direto", "Ré"],
        correct: 1,
        explain: "A progressão natural é 1ª → 2ª → 3ª. Cada marcha em seu momento!",
        gif: "5FTe65sKNVfEc",
        gifAlt: "Troca de marcha progressiva no câmbio",
        emoji: "⚙️"
      }
    ],
    conquest: "Você não está mais reagindo. Está controlando.",
    xp: 100
  }
];

export const FUTURE_PHASES: FuturePhase[] = [
  { icon: "🤖", title: "Modo Automático", desc: "Treinamento em câmbio automático" },
  { icon: "🚦", title: "Trânsito Leve", desc: "Primeiros metros no mundo real" },
  { icon: "⛰️", title: "Modo Subida", desc: "Controle de embreagem em rampas" },
  { icon: "📋", title: "Prova do Detran", desc: "Simulado completo para aprovação" },
];

export const ACHIEVEMENTS: Achievement[] = [
  { icon: "🎯", name: "Primeiro Passo", unlocked: true },
  { icon: "🦶", name: "Pés Espertos", unlocked: true },
  { icon: "🏆", name: "Fase 1 Completa", unlocked: true },
  { icon: "⚙️", name: "Marcha Fina", unlocked: false },
  { icon: "🎮", name: "Coordenado", unlocked: false },
  { icon: "⭐", name: "Sem Tranco", unlocked: false },
];

export const CHECKLIST_TASKS: ChecklistTask[][] = [
  [
    { id: "p0t0", text: "Pé no freio — carro não se move", icon: "🦶" },
    { id: "p0t1", text: "Engatar a marcha com pé na embreagem", icon: "⚙️" },
    { id: "p0t2", text: "Soltar embreagem — sentir o ponto", icon: "🎯" },
    { id: "p0t3", text: "Pisar no freio novamente", icon: "🛑" },
    { id: "p0t4", text: "Repetir até se sentir confortável", icon: "🔁" },
  ],
  [
    { id: "p1t0", text: "Partir em primeira marcha", icon: "1️⃣" },
    { id: "p1t1", text: "Trocar para segunda sem tranco", icon: "2️⃣" },
    { id: "p1t2", text: "Parar com suavidade", icon: "🛑" },
    { id: "p1t3", text: "Repetir a sequência 3 vezes", icon: "🔁" },
    { id: "p1t4", text: "Sem se preocupar com a direção", icon: "😌" },
  ],
  [
    { id: "p2t0", text: "Partir em primeira → segunda → terceira", icon: "⬆️" },
    { id: "p2t1", text: "Manter o carro reto na faixa", icon: "📍" },
    { id: "p2t2", text: "Curva leve à direita", icon: "↪️" },
    { id: "p2t3", text: "Curva leve à esquerda", icon: "↩️" },
    { id: "p2t4", text: "Passar no quebra-mola com suavidade", icon: "〰️" },
  ],
];

export const STEPS = [
  { key: 0, label: "Missão", icon: "🎯" },
  { key: 1, label: "Quiz", icon: "❓" },
  { key: 2, label: "Simulação", icon: "🧠" },
  { key: 3, label: "Prática Real", icon: "🚗" },
];
