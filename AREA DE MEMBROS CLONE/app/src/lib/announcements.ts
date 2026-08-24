import { supabase } from "@/integrations/supabase/client";

// ─── Avisos (popup) da área de membros: tipos + helpers ──────────────────────
// Broadcast do admin pras alunas, visto UMA vez (controle server-side). O front
// só pergunta "tem aviso pendente pra mim?" (RPC) e marca como visto ao fechar.
// A elegibilidade (grupo/produto, aluna-que-já-existia, ainda-não-visto) mora
// toda no banco — o front não decide quem vê.
// =============================================================================

export interface Announcement {
  id: string;
  key: string;
  title: string;
  body: string;
  emoji: string;
  cta_label: string | null;
  cta_route: string | null;
  cta_href: string | null;
}

// O client tipado ainda não conhece as RPCs novas (types não regenerados).
// Cast pontual — mesmo padrão do chat (ver src/lib/directMessages.ts).
export const annDb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

// Caminho interno seguro (react-router). Recusa url externa/protocol-relative.
export function safeRoute(route: string | null): string | null {
  const t = (route || "").trim();
  if (!t.startsWith("/")) return null;
  if (t.startsWith("//")) return null; // evita //evil.com
  return t;
}

// URL externa http(s) segura (mesma checagem dos botões-link do chat).
export function safeExternal(url: string | null): string | null {
  const t = (url || "").trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
