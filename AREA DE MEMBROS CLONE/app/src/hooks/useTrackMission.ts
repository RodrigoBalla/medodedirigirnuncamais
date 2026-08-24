import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useTrackMission ─────────────────────────────────────────────────────────
// Hook utility que expõe trackProgress(triggerType, value) — chama RPC
// track_mission_progress no Supabase. Use em pontos críticos:
//   - Login: trackProgress('login_streak', currentStreak)
//   - Watch: trackProgress('watch_seconds', seconds)
//   - Aula concluída: trackProgress('lessons_completed', 1)
//   - Comentário: trackProgress('comment_count', 1)
//   - Etc.
//
// O backend atualiza progress_value das missões ATIVAS que escutam esse
// trigger e marca completed_at se atingir target. Best-effort silencioso —
// erros não bloqueiam o fluxo do user.
// =============================================================================

export type MissionTriggerType =
  | "login_streak"
  | "login_count"
  | "comeback"
  | "watch_seconds"
  | "watch_session"
  | "consecutive_lessons"
  | "lessons_completed"
  | "module_completed"
  | "course_completed"
  | "comment_count"
  | "community_post"
  | "community_like"
  | "community_read_time"
  | "community_morning_post"
  | "profile_avatar_uploaded"
  | "profile_name_edited"
  | "report_problem"
  | "early_bird"
  | "night_owl"
  | "weekend_study";

export function useTrackMission() {
  const { user } = useAuth();

  const trackProgress = useCallback(
    async (triggerType: MissionTriggerType, value = 1) => {
      if (!user) return 0;
      try {
        const { data } = await supabase.rpc("track_mission_progress", {
          p_trigger_type: triggerType,
          p_value: value,
        });
        return (data as number) ?? 0;
      } catch (err) {
        // Best-effort — não interrompe o fluxo
        console.warn("[track-mission] error:", err);
        return 0;
      }
    },
    [user],
  );

  return { trackProgress };
}
