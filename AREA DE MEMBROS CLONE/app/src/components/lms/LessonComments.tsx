import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackMission } from "@/hooks/useTrackMission";

// =============================================================================
// LessonComments — comentários de uma aula com aprovação do admin
//
// Regras:
//  • Todo aluno autenticado lê os comentários APROVADOS de qualquer um
//  • Aluno também enxerga os PRÓPRIOS pendentes/rejeitados (com badge de status)
//  • Aluno pode editar OU excluir só os próprios; ao editar, volta pra pendente
//  • Admin recebe pendentes pra aprovar (em /admin → aba Comentários)
//  • Cada comentário aprovado dá +20 XP via trigger no banco (boost no ranking)
//  • Realtime: o feed se atualiza quando alguém posta/aprova
//  • Rate limit local: bloqueia "Postar" se vazio ou < 5 chars
//  • Optimistic UI no edit/delete pra resposta instantânea
// =============================================================================

type Comment = {
  id: string;
  lesson_id: string;
  user_id: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  edited: boolean;
  pinned: boolean;
  created_at: string;
  // Enriquecidos por join com profiles
  authorName: string;
  authorInitial: string;
};

interface Props {
  lessonId: string;
  /** Tempo atual do vídeo em segundos — usado pra time-stamp do comentário */
  videoCurrentTime?: number;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function LessonComments({ lessonId }: Props) {
  const { user } = useAuth();
  const { trackProgress } = useTrackMission();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  async function loadComments() {
    setLoading(true);
    try {
      // RLS já filtra: aluno vê aprovados + os próprios
      const { data, error } = await supabase
        .from("lesson_comments")
        .select("id, lesson_id, user_id, content, status, edited, pinned, created_at")
        .eq("lesson_id", lessonId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

      let nameByUser = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name || "Aluna"]));
      }

      setComments(
        rows.map((r) => {
          const name = nameByUser.get(r.user_id) || "Aluna";
          return {
            ...r,
            status: r.status as Comment["status"],
            authorName: name,
            authorInitial: name.charAt(0).toUpperCase(),
          };
        }),
      );
    } catch (err) {
      console.error("[lesson-comments] load error:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadComments();
    // Realtime: recarrega quando alguém posta/aprova/edita comentário desta aula
    const channel = supabase
      .channel(`lesson_comments:${lessonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lesson_comments", filter: `lesson_id=eq.${lessonId}` },
        () => loadComments(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function submit() {
    if (!user) {
      toast.error("Faça login pra comentar.");
      return;
    }
    const content = text.trim();
    if (content.length < 5) {
      toast.error("Escreva pelo menos 5 caracteres 😊");
      return;
    }
    if (content.length > 1000) {
      toast.error("Comentário muito longo (máx. 1000).");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("lesson_comments").insert({
        lesson_id: lessonId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      setText("");
      trackProgress("comment_count", 1);
      toast.success("Comentário enviado! Aguarde a aprovação 🎯");
      // Realtime já vai trazer; redundância garante UI snappy
      loadComments();
    } catch (err) {
      console.error("[lesson-comments] submit error:", err);
      toast.error("Erro ao enviar. Tenta de novo.");
    }
    setSubmitting(false);
  }

  async function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditingText(c.content);
  }

  async function saveEdit() {
    if (!editingId) return;
    const content = editingText.trim();
    if (content.length < 5) {
      toast.error("Escreva pelo menos 5 caracteres.");
      return;
    }
    try {
      const { error } = await supabase
        .from("lesson_comments")
        .update({ content })
        .eq("id", editingId);
      if (error) throw error;
      toast.success("Editado! Vai pra reaprovação.");
      setEditingId(null);
      setEditingText("");
      loadComments();
    } catch (err) {
      console.error("[lesson-comments] edit error:", err);
      toast.error("Erro ao editar.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esse comentário? Essa ação não pode ser desfeita.")) return;
    // Optimistic
    setComments((prev) => prev.filter((c) => c.id !== id));
    try {
      const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
      if (error) throw error;
      toast.success("Comentário excluído.");
    } catch (err) {
      console.error("[lesson-comments] delete error:", err);
      toast.error("Erro ao excluir.");
      loadComments();
    }
  }

  // ── render ────────────────────────────────────────────────────────────
  return (
    <section className="mt-6">
      <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-foreground">
        <span className="material-symbols-outlined text-primary">forum</span>
        Comentários
        <span className="text-xs font-medium text-muted-foreground ml-auto">
          {comments.filter((c) => c.status === "approved").length} aprovado
          {comments.filter((c) => c.status === "approved").length === 1 ? "" : "s"}
        </span>
      </h3>

      {/* FORM DE NOVO COMENTÁRIO */}
      <div className="bg-card border border-border rounded-2xl p-4 md:p-5 mb-5 shadow-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva o que achou desta aula… (5 a 1000 caracteres, emojis liberados 😊)"
          className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-base placeholder:text-muted-foreground resize-none min-h-[64px]"
          maxLength={1000}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {text.trim().length}/1000 · Comentários passam por aprovação ·
            <span className="text-primary font-bold"> +20 XP ao aprovar</span>
          </span>
          <button
            onClick={submit}
            disabled={submitting || text.trim().length < 5}
            className="bg-primary text-primary-foreground px-5 py-2 rounded-xl font-black uppercase text-xs tracking-widest shadow-md shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Enviando…" : "Postar"}
          </button>
        </div>
      </div>

      {/* LISTA DE COMENTÁRIOS */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-primary text-4xl mb-2 block">chat_bubble</span>
            <p className="text-muted-foreground text-sm">Seja a primeira a comentar nesta aula!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {comments.map((c) => {
              const isMine = c.user_id === user?.id;
              const isEditing = editingId === c.id;
              return (
                <motion.article
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`bg-card border rounded-2xl p-4 ${
                    c.pinned ? "border-primary/40 shadow-md shadow-primary/10" : "border-border"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="size-9 rounded-full bg-primary/10 border border-primary/20 text-primary font-black flex items-center justify-center text-sm">
                      {c.authorInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm flex items-center gap-2">
                        {c.authorName}
                        {c.pinned && (
                          <span className="text-[9px] font-black uppercase tracking-widest bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                            <span className="material-symbols-outlined text-[10px] align-middle">push_pin</span> Fixado
                          </span>
                        )}
                        {isMine && c.status === "pending" && (
                          <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded">
                            Aguardando aprovação
                          </span>
                        )}
                        {isMine && c.status === "rejected" && (
                          <span className="text-[9px] font-black uppercase tracking-widest bg-destructive/15 text-destructive px-1.5 py-0.5 rounded">
                            Não aprovado
                          </span>
                        )}
                        {c.edited && (
                          <span className="text-[9px] text-muted-foreground italic">(editado)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelative(c.created_at)}</p>
                    </div>
                  </div>

                  {/* Body / Edit form */}
                  {isEditing ? (
                    <div className="mt-2">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        maxLength={1000}
                        className="w-full bg-muted text-foreground border border-border rounded-xl p-3 text-sm focus:ring-0 focus:outline-none focus:border-primary"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => { setEditingId(null); setEditingText(""); }}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveEdit}
                          className="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {c.content}
                    </p>
                  )}

                  {/* Ações do dono */}
                  {isMine && !isEditing && (
                    <div className="flex gap-3 mt-2 pt-2 border-t border-border/50">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                        Editar
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="text-xs font-bold text-muted-foreground hover:text-destructive flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Excluir
                      </button>
                    </div>
                  )}
                </motion.article>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
