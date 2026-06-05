import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// ─── StudentAccessPreview ────────────────────────────────────────────────────
// "Visualizar como aluno" — ESPELHO NAVEGÁVEL e READ-ONLY do acesso de um aluno.
// O admin "anda na conta" do ponto de vista do aluno:
//   • Biblioteca → grade de cursos (liberado vs trancado, igual ele vê)
//   • Clica num curso liberado → módulos + aulas com concluída/pendente
//   • Curso trancado → mostra o estado de compra que o aluno veria
// NÃO altera nada e NÃO desloga o admin. Dados via RPCs SECURITY DEFINER:
//   admin_get_student_access_snapshot + admin_get_student_course_detail.
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
interface LessonD { id: string; title: string; order_index: number; has_video: boolean; completed: boolean; }
interface ModuleD { id: string; title: string; order_index: number; lessons: LessonD[]; }
interface CourseDetail { product: { id: string; title: string; image_url: string | null }; unlocked: boolean; modules: ModuleD[]; }

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

  // Navegação: curso selecionado (null = biblioteca)
  const [selected, setSelected] = useState<Course | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Esc volta pra biblioteca antes de fechar o modal
        if (selected) setSelected(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [onClose, selected]);

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

  async function openCourse(c: Course) {
    setSelected(c);
    setDetail(null);
    if (!c.unlocked) return; // trancado: mostra painel de compra, não busca aulas
    setDetailLoading(true);
    const { data } = await supabase.rpc(
      "admin_get_student_course_detail" as never,
      { p_user_id: userId, p_product_id: c.product_id } as never,
    );
    setDetail(data as unknown as CourseDetail);
    setDetailLoading(false);
  }

  const student = snap?.student;
  const level = student ? Math.floor((student.total_xp || 0) / 100) + 1 : 1;
  const unlockedCount = snap?.courses.filter((c) => c.unlocked).length ?? 0;
  const lockedCount = snap?.courses.filter((c) => !c.unlocked).length ?? 0;

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
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 size-9 -ml-1 rounded-full hover:bg-accent flex items-center justify-center transition-colors"
                title="Voltar pra biblioteca"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            ) : (
              <span className="material-symbols-outlined text-primary">visibility</span>
            )}
            <div className="min-w-0">
              <p className="font-black text-sm leading-tight truncate">
                {selected ? selected.title : `Visualizando como ${student?.display_name || fallbackName || "aluno"}`}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {selected
                  ? `Biblioteca de ${student?.display_name || fallbackName || "aluno"} · somente leitura`
                  : "Espelho do acesso · somente leitura"}
              </p>
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
          ) : selected ? (
            // ─── VIEW: CURSO ───────────────────────────────────────────────
            <CourseView course={selected} detail={detail} loading={detailLoading} />
          ) : (
            // ─── VIEW: BIBLIOTECA ──────────────────────────────────────────
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="material-symbols-outlined text-primary text-base">info</span>
                Você está vendo exatamente o que <strong className="text-foreground">{student.display_name}</strong> vê. Clique num curso pra entrar. Nada é alterado e você continua admin.
              </div>

              <div className={`rounded-xl p-4 border flex items-start gap-3 ${state.cls}`}>
                <span className="material-symbols-outlined text-2xl shrink-0">{state.icon}</span>
                <div className="min-w-0">
                  <p className="font-black text-sm">{state.title}</p>
                  <p className="text-xs opacity-90 mt-0.5 leading-snug">{state.desc}</p>
                </div>
              </div>

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
                        <button
                          key={c.product_id}
                          type="button"
                          onClick={() => openCourse(c)}
                          className={`text-left rounded-xl overflow-hidden border transition hover:ring-2 hover:ring-primary/30 ${c.unlocked ? "border-border" : "border-dashed border-border/70"}`}
                          title={c.unlocked ? `Entrar em "${c.title}"` : `Ver o que ${student.display_name} vê em "${c.title}" (trancado)`}
                        >
                          <div className="relative aspect-[9/16] bg-muted">
                            {c.image_url ? (
                              <img src={c.image_url} alt={c.title} className={`w-full h-full object-cover ${c.unlocked ? "" : "grayscale brightness-75"}`} loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-border">video_library</span>
                              </div>
                            )}
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
                              <p className="text-[9px] text-primary mt-1 font-bold inline-flex items-center gap-0.5">Ver como ela vê <span className="material-symbols-outlined text-[11px]">chevron_right</span></p>
                            )}
                          </div>
                        </button>
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

// ─── Sub-view: dentro de um curso ────────────────────────────────────────────
function CourseView({ course, detail, loading }: { course: Course; detail: CourseDetail | null; loading: boolean }) {
  if (!course.unlocked) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {course.image_url && <img src={course.image_url} alt="" className="w-16 aspect-[9/16] object-cover rounded-lg grayscale brightness-75" />}
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/70 text-white">Trancado</span>
            <p className="font-bold text-sm mt-1">{course.title}</p>
          </div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-700 dark:text-amber-300">
          <p className="font-black text-sm flex items-center gap-2"><span className="material-symbols-outlined text-base">lock</span> Curso trancado pra ela</p>
          <p className="text-xs mt-1.5 leading-snug opacity-90">
            Ao clicar nesse curso, o aluno <strong>não vê as aulas</strong> — vê a página <strong>"Saiba mais"</strong> com o botão de compra (checkout). Esse curso tem <strong>{course.lessons_total} aula{course.lessons_total === 1 ? "" : "s"}</strong> que ficam bloqueadas até ela comprar.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
        <p className="text-sm font-bold">Abrindo o curso…</p>
      </div>
    );
  }

  const modules = detail?.modules ?? [];
  const allLessons = modules.flatMap((m) => m.lessons);
  const doneCount = allLessons.filter((l) => l.completed).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho do curso */}
      <div className="flex items-center gap-3">
        {course.image_url && <img src={course.image_url} alt="" className="w-16 aspect-[9/16] object-cover rounded-lg" />}
        <div className="min-w-0">
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Liberado</span>
          <p className="font-bold text-sm mt-1 line-clamp-2">{course.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{doneCount}/{allLessons.length} aulas concluídas</p>
        </div>
      </div>

      {modules.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Esse curso ainda não tem módulos/aulas cadastrados.</p>
      ) : (
        <div className="space-y-3">
          {modules.map((m, mi) => {
            const mDone = m.lessons.filter((l) => l.completed).length;
            return (
              <div key={m.id} className="border border-border rounded-xl overflow-hidden">
                <div className="bg-accent/40 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">Módulo {mi + 1}</span>
                    <span className="truncate">{m.title}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{mDone}/{m.lessons.length}</span>
                </div>
                {m.lessons.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic px-3 py-2">Sem aulas neste módulo.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-2.5 px-3 py-2.5">
                        <span className={`material-symbols-outlined text-lg shrink-0 ${l.completed ? "text-[hsl(var(--success))]" : "text-muted-foreground/50"}`}>
                          {l.completed ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span className="text-xs flex-1 min-w-0 truncate">{l.title}</span>
                        {l.has_video && <span className="material-symbols-outlined text-sm text-muted-foreground shrink-0" title="Tem vídeo">play_circle</span>}
                        {l.completed && <span className="text-[9px] font-bold text-[hsl(var(--success))] uppercase shrink-0">Concluída</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70 text-center pt-1">
        🔒 Os vídeos são protegidos (DRM) e não tocam aqui no espelho — mas você vê toda a estrutura e o progresso real dela.
      </p>
    </div>
  );
}
