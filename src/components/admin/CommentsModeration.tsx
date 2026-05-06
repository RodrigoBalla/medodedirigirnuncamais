import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// =============================================================================
// CommentsModeration — admin aprova/rejeita comentários pendentes nas aulas.
// Mostra TUDO (não filtra por status) e permite filtrar via tab. Trigger no
// banco concede +20 XP automaticamente quando aprova.
// =============================================================================

type Comment = {
  id: string;
  lesson_id: string;
  user_id: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  edited: boolean;
  pinned: boolean;
  xp_awarded: boolean;
  created_at: string;
  // Enriched
  authorName: string;
  lessonTitle: string;
};

const FILTERS = [
  { id: "pending",  label: "Pendentes", color: "amber" },
  { id: "approved", label: "Aprovados", color: "emerald" },
  { id: "rejected", label: "Rejeitados", color: "red" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function CommentsModeration() {
  const [filter, setFilter] = useState<FilterId>("pending");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<FilterId, number>>({ pending: 0, approved: 0, rejected: 0 });

  async function load() {
    setLoading(true);
    try {
      // Count por status (3 queries baratas)
      const [pending, approved, rejected] = await Promise.all([
        supabase.from("lesson_comments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("lesson_comments").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("lesson_comments").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      ]);
      setCounts({
        pending: pending.count ?? 0,
        approved: approved.count ?? 0,
        rejected: rejected.count ?? 0,
      });

      // Lista o filtro atual
      const { data, error } = await supabase
        .from("lesson_comments")
        .select("id, lesson_id, user_id, content, status, edited, pinned, xp_awarded, created_at")
        .eq("status", filter)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as any[];

      // Hidrata authorName + lessonTitle em batches
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const lessonIds = Array.from(new Set(rows.map((r) => r.lesson_id)));
      const [profilesRes, lessonsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        lessonIds.length > 0
          ? supabase.from("lessons").select("id, title").in("id", lessonIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const nameByUser = new Map((profilesRes.data ?? []).map((p: any) => [p.user_id, p.display_name || "Aluna"]));
      const titleByLesson = new Map((lessonsRes.data ?? []).map((l: any) => [l.id, l.title]));

      setComments(
        rows.map((r) => ({
          ...r,
          status: r.status as Comment["status"],
          authorName: nameByUser.get(r.user_id) || "Aluna",
          lessonTitle: titleByLesson.get(r.lesson_id) || "(aula desconhecida)",
        })),
      );
    } catch (err) {
      console.error("[admin/comments] load error:", err);
      toast.error("Erro ao carregar comentários.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Realtime: sem filtro — qualquer mudança recarrega contagens + lista
    const channel = supabase
      .channel("admin_comments_moderation")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lesson_comments" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function setStatus(id: string, status: "approved" | "rejected") {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id)); // optimistic remove da view atual
    try {
      const { error } = await supabase
        .from("lesson_comments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast.success(status === "approved" ? "Aprovado! +20 XP pra aluna 🎯" : "Rejeitado.");
    } catch (err) {
      console.error("[admin/comments] setStatus error:", err);
      toast.error("Erro ao atualizar.");
      setComments(prev);
    }
  }

  async function togglePin(id: string, currentlyPinned: boolean) {
    try {
      const { error } = await supabase
        .from("lesson_comments")
        .update({ pinned: !currentlyPinned })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentlyPinned ? "Desafixado." : "Fixado no topo!");
      load();
    } catch (err) {
      console.error("[admin/comments] pin error:", err);
      toast.error("Erro ao fixar.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir comentário definitivamente?")) return;
    try {
      const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído.");
      load();
    } catch (err) {
      console.error("[admin/comments] delete error:", err);
      toast.error("Erro ao excluir.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-2xl">forum</span>
        <h2 className="text-xl font-black">Moderação de Comentários</h2>
      </div>

      {/* Tabs filtrando por status */}
      <div className="flex gap-2 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              filter === f.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
              f.id === "pending"
                ? "bg-amber-500/15 text-amber-500"
                : f.id === "approved"
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-destructive/15 text-destructive"
            }`}>
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Carregando…</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-primary text-5xl mb-3 block">inbox</span>
            <p className="text-muted-foreground">
              Nenhum comentário {filter === "pending" ? "pendente" : filter === "approved" ? "aprovado" : "rejeitado"}.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {comments.map((c) => (
              <motion.article
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-card border border-border rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-10 rounded-full bg-primary/15 border border-primary/30 text-primary font-black flex items-center justify-center">
                    {c.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{c.authorName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      📚 <span className="font-medium">{c.lessonTitle}</span>
                      <span className="opacity-60 ml-2">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                      {c.edited && <span className="italic ml-2 opacity-60">(editado)</span>}
                    </p>
                  </div>
                  {c.pinned && (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-primary/15 text-primary px-2 py-0.5 rounded">
                      Fixado
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap mb-4 bg-muted/30 p-3 rounded-xl">
                  {c.content}
                </p>

                <div className="flex flex-wrap gap-2">
                  {c.status !== "approved" && (
                    <button
                      onClick={() => setStatus(c.id, "approved")}
                      className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Aprovar (+20 XP)
                    </button>
                  )}
                  {c.status !== "rejected" && (
                    <button
                      onClick={() => setStatus(c.id, "rejected")}
                      className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                      Rejeitar
                    </button>
                  )}
                  {c.status === "approved" && (
                    <button
                      onClick={() => togglePin(c.id, c.pinned)}
                      className="bg-primary/15 text-primary px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">{c.pinned ? "keep_off" : "push_pin"}</span>
                      {c.pinned ? "Desafixar" : "Fixar"}
                    </button>
                  )}
                  <button
                    onClick={() => remove(c.id)}
                    className="text-muted-foreground hover:text-destructive px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ml-auto"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    Excluir
                  </button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
