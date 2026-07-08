import { supabase } from "@/integrations/supabase/client";

// ─── Pesquisa NPS: perguntas, tipos e helpers ────────────────────────────────
// As perguntas são declaradas aqui e o NpsSurvey renderiza genericamente.
// Os VALUES das opções são chaves estáveis (usadas na agregação do admin);
// os labels são só display. LABELS mapeia valor→texto pra aba do admin.
// =============================================================================

export type NpsQuestionType = "nps" | "text" | "scale5" | "single" | "multi" | "testimonial";

export interface NpsOption {
  v: string;
  l: string;
}

export interface NpsQuestion {
  id: string;
  type: NpsQuestionType;
  title: string;
  subtitle?: string;
  optional?: boolean;
  options?: NpsOption[];
  maxSelect?: number;
  lowLabel?: string;
  highLabel?: string;
  consentLabel?: string;
}

export const NPS_QUESTIONS: NpsQuestion[] = [
  {
    id: "nps_score",
    type: "nps",
    title: "De 0 a 10, o quanto você recomendaria o Medo de Dirigir Nunca Mais pra uma amiga que também sente medo de dirigir?",
  },
  {
    id: "reason",
    type: "text",
    title: "O que mais pesou nessa nota?",
    subtitle: "Pode ser bem rapidinho 💛",
    optional: true,
  },
  {
    id: "fear_before",
    type: "scale5",
    title: "Como era o seu medo de dirigir ANTES do curso?",
    lowLabel: "Me paralisava",
    highLabel: "Tranquila",
  },
  {
    id: "fear_after",
    type: "scale5",
    title: "E como está AGORA?",
    lowLabel: "Ainda travo",
    highLabel: "Tranquila",
  },
  {
    id: "driving_status",
    type: "single",
    title: "Você já está dirigindo hoje?",
    options: [
      { v: "sozinha", l: "Sim, sozinha" },
      { v: "acompanhada", l: "Sim, acompanhada" },
      { v: "quase", l: "Ainda não, mas me sinto muito mais perto" },
      { v: "ainda_nao", l: "Ainda não" },
    ],
  },
  {
    id: "liked_most",
    type: "multi",
    maxSelect: 2,
    title: "O que você MAIS gostou?",
    subtitle: "Pode marcar até 2",
    options: [
      { v: "didatica", l: "A didática da Carla" },
      { v: "videos", l: "As aulas em vídeo" },
      { v: "passo_a_passo", l: "O passo a passo" },
      { v: "comunidade", l: "A comunidade" },
      { v: "plataforma", l: "A plataforma" },
      { v: "outro", l: "Outro" },
    ],
  },
  {
    id: "wants_more",
    type: "multi",
    maxSelect: 2,
    title: "O que você MAIS quer ver na plataforma daqui pra frente?",
    subtitle: "Marque até 2 — isso vira nosso próximo passo",
    options: [
      { v: "mais_praticas", l: "Mais aulas práticas" },
      { v: "ao_vivo", l: "Aulas ao vivo com a Carla" },
      { v: "simulados", l: "Simulados da prova" },
      { v: "balizas", l: "Baliza e manobras" },
      { v: "ansiedade", l: "Ansiedade e pânico no volante" },
      { v: "grupo", l: "Grupo de apoio mais ativo" },
      { v: "mentorias", l: "Mentorias / tira-dúvidas" },
      { v: "outro", l: "Outro" },
    ],
  },
  {
    id: "missing",
    type: "text",
    title: "Faltou ou te travou alguma coisa?",
    subtitle: "Opcional — mas ajuda demais a gente melhorar",
    optional: true,
  },
  {
    id: "testimonial",
    type: "testimonial",
    title: "Se o curso te ajudou, conta em 2-3 linhas o que mudou pra você 💛",
    optional: true,
    consentLabel: "Autorizo a Carla a usar meu depoimento (com meu primeiro nome) pra inspirar outras mulheres.",
  },
  {
    id: "continue_interest",
    type: "single",
    title: "Você teria interesse em continuar com a gente num próximo nível?",
    options: [
      { v: "sim", l: "Sim, com certeza" },
      { v: "talvez", l: "Talvez" },
      { v: "nao", l: "Não" },
    ],
  },
];

// valor → label legível (usado na aba admin pra rótulos dos gráficos)
export const NPS_LABELS: Record<string, string> = {
  // driving_status
  sozinha: "Já dirige sozinha",
  acompanhada: "Dirige acompanhada",
  quase: "Quase lá",
  ainda_nao: "Ainda não",
  // continue_interest
  sim: "Sim, com certeza",
  talvez: "Talvez",
  nao: "Não",
  // liked_most
  didatica: "Didática da Carla",
  videos: "Aulas em vídeo",
  passo_a_passo: "Passo a passo",
  comunidade: "Comunidade",
  plataforma: "Plataforma",
  // wants_more
  mais_praticas: "Mais aulas práticas",
  ao_vivo: "Aulas ao vivo",
  simulados: "Simulados da prova",
  balizas: "Baliza e manobras",
  ansiedade: "Ansiedade no volante",
  grupo: "Grupo de apoio",
  mentorias: "Mentorias",
  outro: "Outro",
  // sentiment (IA)
  positive: "Positivo",
  neutral: "Neutro",
  negative: "Negativo",
  "?": "Sem resposta",
};

export function npsLabel(v: string): string {
  return NPS_LABELS[v] || v;
}

// Client tipado não conhece as RPCs novas — cast pontual (padrão do projeto).
export const npsDb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  from: (t: string) => any;
};

// Extrai o slug do checkout Eduzz de um checkout_url (ex.: .../Q9N2PZZB01 → Q9N2PZZB01)
export function checkoutSlug(url: string | null | undefined): string | null {
  const t = (url || "").trim();
  if (!t) return null;
  const m = t.match(/chk\.eduzz\.com\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  // fallback: último segmento não-vazio
  const seg = t.split("/").filter(Boolean).pop();
  return seg || null;
}

// WhatsApp da equipe pra ativação de desconto (mesmo do cashback)
export const NPS_WHATSAPP = "5521993685289";
