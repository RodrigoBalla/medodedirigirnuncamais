import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useMissions ─────────────────────────────────────────────────────────────
// Fluxo:
//   1. No mount, chama bootstrap_user_cycle (RPC) — se não há ciclo ativo,
//      sorteia ~8 missões do pool e cria registros em user_missions
//   2. Carrega lista via list_user_missions
//   3. Expõe claim() pra resgatar missões completadas
//   4. Expõe refresh() pra recarregar (chamado após track de progresso)
//
// Cada user vê APENAS o seu ciclo atual (RLS filtra por auth.uid()).
// =============================================================================

export interface UserMission {
  id: string;
  mission_id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: "login" | "watch" | "engage" | "social" | "wellness" | "learn" | "practice";
  trigger_type: string;
  reward_coins: number;
  difficulty: "easy" | "medium" | "hard";
  trigger_target: number;
  progress_value: number;
  completed_at: string | null;
  claimed_at: string | null;
  cycle_start: string;
  cycle_end: string;
}

export function useMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [cycleEnd, setCycleEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setMissions([]);
      setLoading(false);
      return;
    }
    try {
      // 1. Garante que existe ciclo ativo (idempotente — se já existe, retorna o existente)
      await supabase.rpc("bootstrap_user_cycle");
      // 2. Carrega lista
      const { data, error } = await supabase.rpc("list_user_missions");
      if (error) throw error;
      const list = (data || []) as UserMission[];
      setMissions(list);
      setCycleEnd(list[0]?.cycle_end ?? null);
    } catch (err) {
      console.warn("[missions] refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const claim = useCallback(async (userMissionId: string) => {
    const { data, error } = await supabase.rpc("claim_mission", { p_user_mission_id: userMissionId });
    if (error) throw error;
    const row = (data as Array<{ ok: boolean; granted_coins: number; total_balance: number }>)?.[0];
    await refresh();
    return row;
  }, [refresh]);

  /** Pra missões trigger_type='self_report': marca como feito + claim em 1 chamada. */
  const selfReport = useCallback(async (userMissionId: string) => {
    const { data, error } = await supabase.rpc("self_report_mission", { p_user_mission_id: userMissionId });
    if (error) throw error;
    const row = (data as Array<{ ok: boolean; granted_coins: number; total_balance: number }>)?.[0];
    await refresh();
    return row;
  }, [refresh]);

  return { missions, cycleEnd, loading, refresh, claim, selfReport };
}
