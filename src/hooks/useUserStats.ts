import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useUserStats ────────────────────────────────────────────────────────────
// Stats reais que o aluno realmente afeta hoje (substitui "Fases" estático):
//   - lessonsCompleted: count de lesson_progress.completed=true
//   - coursesUnlocked: count distinct de products acessíveis ao user
//   - daysStudied: distinct date(updated_at) de lesson_progress no histórico
//
// Mantém compat: o componente que usa pode mostrar XP/streak vindos do
// UserProgressContext em paralelo.
// =============================================================================

export interface UserStats {
  lessonsCompleted: number;
  coursesUnlocked: number;
  daysStudied: number;
  loading: boolean;
}

export function useUserStats(): UserStats {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    lessonsCompleted: 0,
    coursesUnlocked: 0,
    daysStudied: 0,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setStats({ lessonsCompleted: 0, coursesUnlocked: 0, daysStudied: 0, loading: false });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        // Aulas concluídas
        const { count: completedCount } = await supabase
          .from("lesson_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("completed", true);

        // Cursos desbloqueados (via access_groups → access_group_products)
        const { data: groups } = await supabase
          .from("access_group_users")
          .select("group_id")
          .eq("user_id", user!.id);
        let courses = 0;
        if (groups && groups.length > 0) {
          const { data: links } = await supabase
            .from("access_group_products")
            .select("product_id")
            .in("group_id", groups.map((g) => g.group_id));
          courses = new Set((links || []).map((l) => l.product_id)).size;
        }

        // Dias estudados — datas distintas em que tocou em alguma aula
        const { data: progressDates } = await supabase
          .from("lesson_progress")
          .select("updated_at")
          .eq("user_id", user!.id);
        const uniqueDays = new Set(
          (progressDates || []).map((r) => (r.updated_at || "").slice(0, 10)),
        );
        uniqueDays.delete("");

        if (!cancelled) {
          setStats({
            lessonsCompleted: completedCount || 0,
            coursesUnlocked: courses,
            daysStudied: uniqueDays.size,
            loading: false,
          });
        }
      } catch (err) {
        console.warn("[user-stats] error:", err);
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  return stats;
}
