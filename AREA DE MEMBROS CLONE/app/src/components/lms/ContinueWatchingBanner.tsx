import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// ─── ContinueWatchingBanner ──────────────────────────────────────────────────
// Banner discreto no topo da home com a última aula assistida pelo aluno.
// Click → navega direto pro curso. Some se não houver progresso.
// =============================================================================

interface LastLesson {
  lessonId: string;
  lessonTitle: string;
  productId: string;
  productTitle: string;
  positionSeconds: number;
  durationSeconds: number | null;
}

export function ContinueWatchingBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [last, setLast] = useState<LastLesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Busca o último lesson_progress do usuário (não-completado, com posição)
        const { data: lp } = await supabase
          .from("lesson_progress")
          .select("lesson_id, position_seconds, duration_seconds, updated_at")
          .eq("user_id", user.id)
          .eq("completed", false)
          .gt("position_seconds", 0)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (!lp || lp.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }
        const row = lp[0];
        // Busca metadata da aula + curso
        const { data: lesson } = await supabase
          .from("lessons")
          .select("id, title, module_id")
          .eq("id", row.lesson_id)
          .single();
        if (!lesson) { if (!cancelled) setLoading(false); return; }

        const { data: mod } = await supabase
          .from("modules")
          .select("product_id")
          .eq("id", lesson.module_id)
          .single();
        if (!mod) { if (!cancelled) setLoading(false); return; }

        const { data: prod } = await supabase
          .from("products")
          .select("id, title")
          .eq("id", mod.product_id)
          .single();
        if (!prod) { if (!cancelled) setLoading(false); return; }

        if (!cancelled) {
          setLast({
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            productId: prod.id,
            productTitle: prod.title,
            positionSeconds: Number(row.position_seconds) || 0,
            durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
          });
          setLoading(false);
        }
      } catch (err) {
        console.warn("[continue-watching] erro:", err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading || !last) return null;

  const pct = last.durationSeconds
    ? Math.min(100, Math.round((last.positionSeconds / last.durationSeconds) * 100))
    : 0;

  return (
    <button
      onClick={() => navigate(`/curso/${last.productId}`)}
      className="group w-full max-w-3xl mx-auto mb-6 flex items-center gap-4 bg-card border border-primary/20 rounded-2xl p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all text-left"
    >
      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <span className="material-symbols-outlined text-primary text-2xl filled-icon">play_arrow</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
          Continue de onde parou
        </p>
        <p className="font-bold text-sm text-foreground line-clamp-1">{last.lessonTitle}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{last.productTitle}</p>
        {last.durationSeconds && (
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <span className="material-symbols-outlined text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all">
        arrow_forward
      </span>
    </button>
  );
}
