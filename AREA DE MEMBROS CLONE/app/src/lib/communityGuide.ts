// ─── communityGuide ──────────────────────────────────────────────────────────
// Progresso do passo a passo da primeira publicação na Comunidade.
// Guardado no localStorage (zero custo de banco): { post, story, done }.
//
//   • done = true  → guia nunca mais aparece (concluiu, ou já publicava antes)
//   • sair no meio NÃO marca done — ela volta a ver o guia na próxima visita
// =============================================================================

export interface GuideState {
  /** Já publicou o post do feed durante o guia. */
  post: boolean;
  /** Já publicou o story durante o guia. */
  story: boolean;
  /** Guia encerrado (recompensa paga ou aluna veterana). */
  done: boolean;
}

const key = (userId: string) => `mddnm:community-guide:${userId}`;

/** null = nunca avaliado pra esta aluna. */
export function getGuideState(userId: string): GuideState | null {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as GuideState) : null;
  } catch {
    return null;
  }
}

export function saveGuideState(userId: string, state: GuideState): GuideState {
  try { localStorage.setItem(key(userId), JSON.stringify(state)); } catch { /* ignora */ }
  return state;
}
