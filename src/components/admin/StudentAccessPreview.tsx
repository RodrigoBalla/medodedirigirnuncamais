import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// ─── StudentAccessPreview ────────────────────────────────────────────────────
// "Visualizar como aluno" — ESPELHO READ-ONLY do acesso de um aluno.
// Mostra exatamente o que ele vê: status (ativo/expirado/inativo), nível/XP,
// grupos e a grade de cursos (liberados vs trancados, igual à biblioteca dele),
// com progresso por curso. NÃO altera nada e NÃO desloga o admin.
// Dados via RPC admin_get_student_access_snapshot (SECURITY DEFINER, admin-only).
// =============================================================================

interface Course {
  product_id: string;
  title: string;
  image_url: string | null;
  unlocked: boolean;
  lessons_total: number;
  lessons_completed: number;
}
interface Snapshot {
  student: {
    user_id: string;
    display_name: string;
    email: string | null;
    avatar_url: string | null;
    access_status: "active" | "expired";
    is_blocked: boolean;
    total_xp: number;
    streak: number;
    coins: number;
  };
  groups: { id: string; name: string }[];
  courses: Course[];
}

export function StudentAccessPreview({
  userId,
  fallbackName,
  onClose,
}: {
  userId: string;
  fallbackName?: string;
  onClose: () => void;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.rpc(
        "admin_get_student_access_snapshot" as never,
        { p_user_id: userId } as never,
      );
      if (!alive) return;
      if (error) setError(error.message);
      else setSnap(data as unknown as Snapshot);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  const student = snap?.student;
  const level = student ? Math.floor((student.total_xp || 0) / 100) + 1 : 1;
  const unlockedCount = snap?.courses.filter((c) => c.unlocked).length ?? 0;
  const lockedCount = snap?.courses.filter((c) => !c.unlocked).length ?? 0;

  // Estado de acesso (o que ele vê ao logar)
  const state = student?.is_blocked
    ? { cls: "bg-destructive/10 text-destructive border-destructive/30", icon: "block", title: "Conta inativa", desc: "Não consegue logar — vê a tela de bloqueio. Reative pra liberar o acesso." }
    : student?.access_status === "expired"
    ? { cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: "schedule", title: "Matrícula expirada", desc: "Ela loga, mas só vê a tela de RENOVAÇÃO — não acessa os cursos abaixo." }
    : { cls: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]", icon: "check_circle", title: "Acesso ativo", desc: "Entra normal na área de membros e vê os cursos liberados abaixo." };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full sm:max-w-2xl bg-card sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-primary">visibility</span>
            <div className="min-w-0">
              <p className="font-black text-sm leading-tight truncate">
                Visualizando como {student?.display_name || fallbackName || "aluno"}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">Espelho do acesso · somente leitura</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 size-9 rounded-full hover:bg-accent flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
              <p className="text-sm font-bold">Carregando a visão do aluno…</p>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">
              Erro ao carregar: {error}
            </div>
          ) : !student ? (
            <div className="text-center py-16 text-muted-foreground">
              <span className="material-symbols-outlined text-3xl mb-2 block">person_off</span>
              <p className="text-sm font-bold">Aluno não encontrado</p>
            </div>
          ) : (
            <>
              {/* Aviso read-only */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="material-symbols-outlined text-primary text-base">info</span>
                Você está vendo exatamente o que <strong className="text-foreground">{student.display_name}</strong> vê. Nada é alterado e você continua logado como admin.
              </div>

              {/* Estado de acesso */}
              <div className={`rounded-xl p-4 border flex items-start gap-3 ${state.cls}`}>
                <span className="material-symbols-outlined text-2xl shrink-0">{state.icon}</span>
                <div className="min-w-0">
                  <p className="font-black text-sm">{state.title}</p>
                  <p className="text-xs opacity-90 mt-0.5 leading-snug">{state.desc}</p>
                </div>
              </div>

              {/* Stats rápidos */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-accent/40 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-primary">Nv. {level}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{student.total_xp} XP</p>
                </div>
                <div className="bg-accent/40 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-[hsl(var(--success))]">{unlockedCount}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Liberados</p>
                </div>
                <div className="bg-accent/40 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-muted-foreground">{lockedCount}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Trancados</p>
                </div>
              </div>

              {/* Grupos */}
              {snap!.groups.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Grupos de acesso</p>
                  <div className="flex flex-wrap gap-1.5">
                    {snap!.groups.map((g) => (
                      <span key={g.id} className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grade de cursos — igual à biblioteca dele */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Biblioteca dele ({unlockedCount} liberado{unlockedCount === 1 ? "" : "s"} · {lockedCount} trancado{lockedCount === 1 ? "" : "s"})
                </p>
                {snap!.courses.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum curso publicado no catálogo.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {snap!.courses.map((c) => {
                      const pct = c.lessons_total > 0 ? Math.round((c.lessons_completed / c.lessons_total) * 100) : 0;
                      return (
                        <div key={c.product_id} className={`rounded-xl overflow-hidden border ${c.unlocked ? "border-border" : "border-dashed border-border/70"}`}>
                          <div className="relative aspect-[9/16] bg-muted">
                            {c.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c.title}
                                className={`w-full h-full object-cover ${c.unlocked ? "" : "grayscale brightness-75"}`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-border">video_library</span>
                              </div>
                            )}
                            {/* Badge */}
                            <span className={`absolute top-1.5 left-1.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${c.unlocked ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" : "bg-black/70 text-white"}`}>
                              {c.unlocked ? "Liberado" : "Trancado"}
                            </span>
                            {!c.unlocked && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white/80 text-3xl">lock</span>
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-bold leading-tight line-clamp-2" title={c.title}>{c.title}</p>
                            {c.unlocked ? (
                              c.lessons_total > 0 ? (
                                <div className="mt-1.5">
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "hsl(var(--primary))" }} />
                                  </div>
                                  <p className="text-[9px] text-muted-foreground mt-1">{c.lessons_completed}/{c.lessons_total} aulas · {pct}%</p>
                                </div>
                              ) : (
                                <p className="text-[9px] text-muted-foreground mt-1">Sem aulas cadastradas</p>
                              )
                            ) : (
                              <p className="text-[9px] text-muted-foreground mt-1">Vê como "Saiba mais" (página de compra)</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
