import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";

// ─── useBadgeRules ───────────────────────────────────────────────────────────
// Regras de desbloqueio das 6 medalhas. Verifica condições no banco e
// dispara addBadge() automaticamente quando o aluno cumpre os requisitos.
//
// "Fonte da verdade" das medalhas = user_progress.badges (jsonb array).
// Esse hook só ADICIONA — nunca remove.
//
// Quando uma medalha NOVA é ganha, retorna o catálogo dela em `justUnlocked`
// por 1 render — o consumer (DrivingApp) usa pra abrir o modal celebratório.
// =============================================================================

export interface BadgeMeta {
  id: string;
  name: string;
  icon: string;       // material-symbols
  color: string;      // tailwind text color
  description: string;
}

interface Deps {
  userId: string;
  totalXP: number;
  streak: number;
}

interface BadgeRule extends BadgeMeta {
  check: (deps: Deps) => Promise<boolean>;
}

// CATÁLOGO ÚNICO — usado tanto pelo ProfileScreen (grid de medalhas)
// quanto pelo BadgeUnlockedModal (celebração).
export const BADGES: BadgeRule[] = [
  {
    id: "primeiros_km",
    name: "Primeiros KM",
    icon: "tire_repair",
    color: "text-blue-500",
    description: "Atinja o Nível 2 (100 XP).",
    check: async (deps) => deps.totalXP >= 100,
  },
  {
    id: "corajoso",
    name: "Corajoso",
    icon: "local_fire_department",
    color: "text-orange-500",
    description: "Mantenha um streak de 7 dias seguidos.",
    check: async (deps) => deps.streak >= 7,
  },
  {
    id: "estudioso",
    name: "Estudioso",
    icon: "menu_book",
    color: "text-cyan-500",
    description: "Complete 10 aulas no app.",
    check: async (deps) => {
      const { count } = await supabase
        .from("lesson_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", deps.userId)
        .eq("completed", true);
      return (count ?? 0) >= 10;
    },
  },
  {
    id: "maratonista",
    name: "Maratonista",
    icon: "directions_run",
    color: "text-emerald-500",
    description: "Estude em 30 dias diferentes.",
    check: async (deps) => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("updated_at")
        .eq("user_id", deps.userId);
      const uniqueDays = new Set((data || []).map((r) => (r.updated_at || "").slice(0, 10)));
      uniqueDays.delete("");
      return uniqueDays.size >= 30;
    },
  },
  {
    id: "colecionador",
    name: "Colecionador",
    icon: "redeem",
    color: "text-purple-500",
    description: "Ganhe 5 prêmios na Roleta da Sorte.",
    check: async (deps) => {
      const { count } = await supabase
        .from("daily_wheel_spins")
        .select("*", { count: "exact", head: true })
        .eq("user_id", deps.userId);
      return (count ?? 0) >= 5;
    },
  },
  {
    id: "investidor",
    name: "Investidor",
    icon: "savings",
    color: "text-amber-500",
    description: "Gere seu primeiro cupom de cashback.",
    check: async (deps) => {
      const { count } = await supabase
        .from("discount_coupons")
        .select("*", { count: "exact", head: true })
        .eq("user_id", deps.userId);
      return (count ?? 0) >= 1;
    },
  },
];

export function useBadgeRules() {
  const { user } = useAuth();
  const { totalXP, streak, badges, addBadge } = useUserProgress();
  const [justUnlocked, setJustUnlocked] = useState<BadgeMeta | null>(null);
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastRunRef.current < 5000) return; // debounce 5s
    lastRunRef.current = now;

    let cancelled = false;

    (async () => {
      const deps: Deps = { userId: user.id, totalXP, streak };

      for (const rule of BADGES) {
        if (badges.includes(rule.id)) continue;
        try {
          const ok = await rule.check(deps);
          if (cancelled) return;
          if (ok) {
            await addBadge(rule.id);
            if (!cancelled) {
              const { check: _check, ...meta } = rule;
              setJustUnlocked(meta);
            }
            break; // só 1 por vez
          }
        } catch (err) {
          console.warn(`[badge-rules] check ${rule.id} failed:`, err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, totalXP, streak, badges, addBadge]);

  const clearJustUnlocked = () => setJustUnlocked(null);

  return { justUnlocked, clearJustUnlocked, allBadges: BADGES };
}
