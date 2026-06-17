import { supabase } from "@/integrations/supabase/client";

// ─── Chat direto admin <-> aluno: tipos + helpers compartilhados ─────────────
// Modelo: tabela `direct_messages`, uma linha por mensagem, sempre carregando o
// `student_id` da conversa (o dono = a aluna). RLS garante o isolamento total:
// a aluna só lê/escreve onde student_id = auth.uid(); admin vê/escreve tudo.
// Não existe canal aluna<->aluna — a tabela só liga aluna<->admin.
// =============================================================================

export interface DMButton {
  label: string;
  url: string;
}

export interface DirectMessage {
  id: string;
  student_id: string;
  sender: "admin" | "student";
  sender_id: string | null;
  body: string | null;
  buttons: DMButton[];
  created_at: string;
  read_by_student_at: string | null;
  read_by_admin_at: string | null;
}

// O client tipado ainda não conhece a tabela/RPCs novas (types não regenerados).
// Cast pontual — mesmo padrão que o resto do projeto usa pras RPCs novas
// (ver `// @ts-ignore — RPC nova` em vários componentes admin).
export const db = supabase as unknown as {
  from: (table: string) => any;
  channel: (name: string, opts?: any) => any;
  removeChannel: (ch: any) => void;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export function normalizeButtons(raw: unknown): DMButton[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b) =>
        b &&
        typeof b === "object" &&
        typeof (b as Record<string, unknown>).label === "string" &&
        typeof (b as Record<string, unknown>).url === "string",
    )
    .map((b) => ({
      label: String((b as Record<string, unknown>).label),
      url: String((b as Record<string, unknown>).url),
    }));
}

export function rowToMessage(r: Record<string, any>): DirectMessage {
  return {
    id: r.id,
    student_id: r.student_id,
    sender: r.sender,
    sender_id: r.sender_id ?? null,
    body: r.body ?? null,
    buttons: normalizeButtons(r.buttons),
    created_at: r.created_at,
    read_by_student_at: r.read_by_student_at ?? null,
    read_by_admin_at: r.read_by_admin_at ?? null,
  };
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return hm;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hm}`;
}

// Valida/normaliza a URL de um botão-link (mensagens do admin). Garante http(s)
// pra evitar javascript:/data: e companhia. Retorna null se inválida.
export function safeUrl(url: string): string | null {
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
