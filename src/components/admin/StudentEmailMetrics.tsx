import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── StudentEmailMetrics ─────────────────────────────────────────────────────
// Aparece dentro do card expandido de cada aluno no admin. Mostra:
//   - KPIs: enviados, abertos, clicados, taxa de abertura, taxa de clique, XP ganho
//   - Lista cronológica dos últimos N emails: kind + sent_at + ✉️📬👁️🖱️
//
// Lê da RPC admin_get_student_email_metrics (SECURITY DEFINER, admin only).
// =============================================================================

interface Summary {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribed: number;
  open_rate: number;
  click_rate: number;
  ctor: number;
  xp_from_opens: number;
  xp_from_clicks: number;
  last_sent_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
}

interface EmailRow {
  id: string;
  kind: string;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  unsubscribed_at: string | null;
  xp_open_awarded: boolean;
  xp_click_awarded: boolean;
  product_title: string | null;
}

interface Props {
  userId: string;
}

// Mapeia kind → label legível em PT-BR
const KIND_LABELS: Record<string, string> = {
  first_access: "🎉 Primeiro acesso",
  new_lesson: "📚 Nova aula",
  upsell: "💰 Upsell",
  inactivity: "💔 Sentimos sua falta",
  expiration: "⏰ Acesso expirando",
  course_notification: "📢 Aviso de curso",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return `${dt.toLocaleDateString("pt-BR")} · ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function StudentEmailMetrics({ userId }: Props) {
  const [data, setData] = useState<{ summary: Summary; rows: EmailRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // @ts-ignore — RPC nova, tipos ainda não regenerados
        const { data: res, error: err } = await supabase.rpc("admin_get_student_email_metrics", {
          p_user_id: userId,
          p_limit: 30,
        });
        if (cancelled) return;
        if (err) {
          setError(err.message || "erro ao carregar métricas");
        } else {
          setData(res as unknown as { summary: Summary; rows: EmailRow[] });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "erro inesperado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
          Carregando métricas de email…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-destructive">Erro ao carregar métricas: {error}</p>
      </div>
    );
  }

  if (!data || data.summary.total_sent === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-sm">mail</span>
          Engajamento por email
        </h4>
        <p className="text-xs text-muted-foreground/70 italic">
          Nenhum email enviado ainda pra essa aluna.
        </p>
      </div>
    );
  }

  const { summary, rows } = data;
  const totalXp = (summary.xp_from_opens || 0) + (summary.xp_from_clicks || 0);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-sm">mail</span>
        Engajamento por email
      </h4>

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
        <div className="bg-accent/50 rounded-xl p-2.5 text-center">
          <span className="material-symbols-outlined text-blue-500 text-lg">outbox</span>
          <p className="text-sm font-bold mt-0.5">{summary.total_sent}</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Enviados</p>
        </div>
        <div className="bg-accent/50 rounded-xl p-2.5 text-center">
          <span className="material-symbols-outlined text-cyan-500 text-lg">drafts</span>
          <p className="text-sm font-bold mt-0.5">{summary.total_opened}</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Abertos</p>
        </div>
        <div className="bg-accent/50 rounded-xl p-2.5 text-center">
          <span className="material-symbols-outlined text-emerald-500 text-lg">ads_click</span>
          <p className="text-sm font-bold mt-0.5">{summary.total_clicked}</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Cliques</p>
        </div>
        <div className="bg-accent/50 rounded-xl p-2.5 text-center">
          <span className="material-symbols-outlined text-cyan-500 text-lg">percent</span>
          <p className="text-sm font-bold mt-0.5">{summary.open_rate}%</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Tx abertura</p>
        </div>
        <div className="bg-accent/50 rounded-xl p-2.5 text-center">
          <span className="material-symbols-outlined text-emerald-500 text-lg">percent</span>
          <p className="text-sm font-bold mt-0.5">{summary.click_rate}%</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Tx clique</p>
        </div>
        <div className="bg-accent/50 rounded-xl p-2.5 text-center">
          <span className="material-symbols-outlined text-primary text-lg filled-icon">database</span>
          <p className="text-sm font-bold mt-0.5">+{totalXp}</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">XP de email</p>
        </div>
      </div>

      {/* Bounces / Unsubs (só se tiver) */}
      {(summary.total_bounced > 0 || summary.total_unsubscribed > 0) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {summary.total_bounced > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-destructive/15 text-destructive text-[10px] font-bold">
              <span className="material-symbols-outlined text-xs">error</span>
              {summary.total_bounced} bounces
            </span>
          )}
          {summary.total_unsubscribed > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
              <span className="material-symbols-outlined text-xs">unsubscribe</span>
              {summary.total_unsubscribed} unsub
            </span>
          )}
        </div>
      )}

      {/* Timeline dos últimos envios */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {rows.map((r) => {
          const label = KIND_LABELS[r.kind] || `📨 ${r.kind}`;
          return (
            <div
              key={r.id}
              className="bg-accent/30 rounded-lg p-2.5 text-[11px] flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="font-bold text-foreground">{label}</span>
                  {r.product_title && (
                    <span className="text-muted-foreground text-[10px]">· {r.product_title}</span>
                  )}
                  <span className="text-muted-foreground/70 font-mono text-[10px] ml-auto">
                    {formatDate(r.sent_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      r.opened_at ? "text-cyan-500" : "text-muted-foreground/50"
                    }`}
                    title={r.opened_at ? `Abriu em ${formatDate(r.opened_at)}` : "Não abriu"}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {r.opened_at ? "drafts" : "mail"}
                    </span>
                    {r.opened_at ? "Abriu" : "Não abriu"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 ${
                      r.clicked_at ? "text-emerald-500" : "text-muted-foreground/50"
                    }`}
                    title={r.clicked_at ? `Clicou em ${formatDate(r.clicked_at)}` : "Não clicou"}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {r.clicked_at ? "ads_click" : "mouse"}
                    </span>
                    {r.clicked_at ? "Clicou" : "Sem clique"}
                  </span>
                  {r.bounced_at && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <span className="material-symbols-outlined text-xs">error</span>
                      Bounce
                    </span>
                  )}
                  {r.unsubscribed_at && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <span className="material-symbols-outlined text-xs">unsubscribe</span>
                      Unsub
                    </span>
                  )}
                  {(r.xp_open_awarded || r.xp_click_awarded) && (
                    <span className="inline-flex items-center gap-1 text-primary font-bold ml-auto">
                      <span className="material-symbols-outlined text-xs filled-icon">database</span>
                      +{(r.xp_open_awarded ? 50 : 0) + (r.xp_click_awarded ? 150 : 0)} XP
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
