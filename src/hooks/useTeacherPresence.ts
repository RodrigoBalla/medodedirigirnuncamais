import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";

// ─── useTeacherPresence ──────────────────────────────────────────────────────
// Canal Realtime dedicado pra detectar se "a professora" (qualquer admin) está
// online. Aluno chama `useTeacherOnline()` pra exibir badge "🟢 Carla online".
//
// Implementação:
//   - Admin loga → `useTrackTeacherPresence()` faz `track()` no canal "teacher-presence"
//   - Aluno loga → `useTeacherOnline()` escuta o canal e retorna count > 0
// =============================================================================

const CHANNEL = "teacher-presence";

/** Hook chamado UMA vez no DrivingApp / Index — se o user logado for admin,
 *  registra presença no canal. Se não for, não faz nada. */
export function useTrackTeacherPresence() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!user || !isAdmin) return;
    const ch = supabase.channel(CHANNEL, {
      config: { presence: { key: user.id } },
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: user.id, online_at: new Date().toISOString() });
      }
    });
    const interval = window.setInterval(() => {
      ch.track({ user_id: user.id, online_at: new Date().toISOString() });
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [user, isAdmin]);
}

/** Hook chamado em qualquer tela onde o aluno deve ver o status. */
export function useTeacherOnline(): boolean {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const ch = supabase.channel(`${CHANNEL}-watch`);
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const count = Object.keys(state).length;
      setOnline(count > 0);
    });
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return online;
}
