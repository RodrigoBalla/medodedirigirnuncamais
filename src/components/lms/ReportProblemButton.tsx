import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackMission } from "@/hooks/useTrackMission";
import { toast } from "sonner";

// ─── ReportProblemButton ─────────────────────────────────────────────────────
// Botão flutuante "Reportar problema" que abre modal capturando:
//   - lessonId (passado por prop)
//   - timestamp do vídeo (passado por prop, ex: currentTimeRef.current)
//   - descrição do problema
//   - userAgent + URL atual (auto)
//
// Salva em tabela `lesson_reports`. Admin vê depois no dash.
// =============================================================================

interface Props {
  lessonId: string;
  /** Função que retorna a posição atual do vídeo em segundos */
  getCurrentTime: () => number;
  className?: string;
}

export function ReportProblemButton({ lessonId, getCurrentTime, className }: Props) {
  const { user } = useAuth();
  const { trackProgress } = useTrackMission();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function fmtTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }

  async function submit() {
    if (!text.trim() || submitting || !user) return;
    setSubmitting(true);
    const ts = getCurrentTime();
    try {
      const { error } = await supabase.from("lesson_reports").insert({
        user_id: user.id,
        user_email: user.email || null,
        lesson_id: lessonId,
        video_timestamp_seconds: Math.floor(ts),
        description: text.trim().slice(0, 1000),
        user_agent: navigator.userAgent.slice(0, 250),
        page_url: window.location.href.slice(0, 250),
      });
      if (error) throw error;
      trackProgress("report_problem", 1);
      toast.success("📨 Reporte enviado! A Carla vai dar uma olhada.");
      setText("");
      setOpen(false);
    } catch (err) {
      console.warn("[lesson-reports] erro:", err);
      toast.error("Não foi possível enviar. Tenta de novo em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors ${className ?? ""}`}
        title="Reportar um problema nesta aula"
      >
        <span className="material-symbols-outlined text-base">flag</span>
        Reportar problema
      </button>
    );
  }

  const ts = getCurrentTime();

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">flag</span>
            Reportar problema
          </h3>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Posição atual do vídeo: <span className="font-mono text-foreground">{fmtTime(ts)}</span>
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Descreva o que aconteceu (vídeo travou, áudio sumiu, conteúdo confuso, etc.)…"
          rows={4}
          maxLength={1000}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
        <div className="text-[10px] text-muted-foreground text-right mt-1">{text.length}/1000</div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 px-4 py-2 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!text.trim() || submitting}
            className="flex-1 px-4 py-2 text-sm font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
