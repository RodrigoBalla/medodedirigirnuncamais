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

export interface LastLesson {
  lesson_id: string;
  title: string;
  product_id: string | null;
  updated_at: string;
}

export interface UserStats {
  lessonsCompleted: number;
  coursesUnlocked: number;
  daysStudied: number;
  lastLesson: LastLesson | null;
  loading: boolean;
}

export function useUserStats(): UserStats {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    lessonsCompleted: 0,
    coursesUnlocked: 0,
    daysStudied: 0,
    lastLesson: null,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setStats({ lessonsCompleted: 0, coursesUnlocked: 0, daysStudied: 0, lastLesson: null, loading: false });
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

        // Última aula que o aluno tocou (pra mostrar "Continue de onde parou")
        let lastLesson: LastLesson | null = null;
        try {
          const { data: lastProg } = await supabase
            .from("lesson_progress")
            .select("lesson_id, updated_at, lessons(title, product_id)")
            .eq("user_id", user!.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastProg) {
            const lessonRel = (lastProg as { lessons?: { title?: string; product_id?: string } }).lessons;
            lastLesson = {
              lesson_id: (lastProg as { lesson_id: string }).lesson_id,
              title: lessonRel?.title ?? "Aula sem título",
              product_id: lessonRel?.product_id ?? null,
              updated_at: (lastProg as { updated_at: string }).updated_at,
            };
          }
        } catch {
          // se a tabela lessons não estiver acessível por RLS, ignora
        }

        if (!cancelled) {
          setStats({
            lessonsCompleted: completedCount || 0,
            coursesUnlocked: courses,
            daysStudied: uniqueDays.size,
            lastLesson,
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
