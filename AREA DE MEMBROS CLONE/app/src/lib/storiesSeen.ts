// ─── storiesSeen ─────────────────────────────────────────────────────────────
// Marca quais stories a aluna já viu — pra bolinha aparecer com anel colorido
// (novidade) ou cinza (já visto), estilo Instagram.
//
// Guardado no localStorage de propósito: é preferência visual de baixo risco e
// zero custo de banco (o projeto já bateu no aviso de I/O do Supabase). Como
// story expira em 24h, a lista é podada e nunca cresce.
// =============================================================================

const key = (userId: string) => `mddnm:stories-seen:${userId}`;

export function getSeenStories(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markStorySeen(userId: string, storyId: string): Set<string> {
  const seen = getSeenStories(userId);
  if (!seen.has(storyId)) {
    seen.add(storyId);
    try { localStorage.setItem(key(userId), JSON.stringify([...seen])); } catch { /* ignora */ }
  }
  return seen;
}

/** Remove das "vistas" os ids que não existem mais (stories que expiraram). */
export function pruneSeenStories(userId: string, activeIds: string[]): Set<string> {
  const active = new Set(activeIds);
  const seen = getSeenStories(userId);
  const next = new Set([...seen].filter((id) => active.has(id)));
  if (next.size !== seen.size) {
    try { localStorage.setItem(key(userId), JSON.stringify([...next])); } catch { /* ignora */ }
  }
  return next;
}
