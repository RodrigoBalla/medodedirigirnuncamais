import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ─── NotificationsManager ────────────────────────────────────────────────────
// UI no admin pra DISPARAR email em massa pras alunas avisando sobre uma
// novidade num curso (módulo novo, aula nova, etc.). Cada disparo chama a
// Edge Function send-course-notification que itera em batches de 50 e usa
// a Brevo API. Histórico fica em course_notifications.
// =============================================================================

interface Product {
  id: string;
  title: string;
  status: string;
  image_url: string | null;
}

interface Recipient {
  user_id: string;
  email: string;
  display_name: string;
  access_status: "active" | "expired";
}

interface NotificationLog {
  id: string;
  product_id: string;
  product_title: string;
  title: string;
  body: string;
  sent_at: string;
  recipients_attempted: number;
  recipients_succeeded: number;
  status: "sent" | "partial" | "failed";
}

const SUPABASE_URL = "https://qkvinhzwiptfobdvsdtr.supabase.co";

export default function NotificationsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form
  const [productId, setProductId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [prodRes, recRes, histRes] = await Promise.all([
      supabase.from("products").select("id, title, status, image_url").order("title"),
      // @ts-ignore — RPC nova
      supabase.rpc("admin_list_notification_recipients"),
      // @ts-ignore — RPC nova
      supabase.rpc("admin_list_course_notifications", { p_limit: 30 }),
    ]);
    setProducts((prodRes.data as Product[]) || []);
    setRecipients((recRes.data as unknown as Recipient[]) || []);
    setHistory((histRes.data as unknown as NotificationLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeCount = recipients.filter((r) => r.access_status === "active").length;
  const expiredCount = recipients.filter((r) => r.access_status === "expired").length;
  const canSubmit = !!productId && title.trim().length >= 3 && body.trim().length >= 10 && !sending;

  async function sendNotification() {
    if (!canSubmit) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("sem sessão");

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-course-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          product_id: productId,
          title: title.trim(),
          body: body.trim(),
        }),
      });
      const data = await resp.json();

      if (!resp.ok || !data?.ok) {
        toast.error("Erro ao enviar", { description: data?.error || data?.detail || "falha desconhecida" });
        return;
      }

      toast.success(`Email enviado pra ${data.succeeded}/${data.attempted} alunas`, {
        description: data.failed > 0 ? `${data.failed} falharam — verifica os logs` : "Tudo certo!",
        duration: 6000,
      });

      // Limpa form + recarrega histórico
      setTitle("");
      setBody("");
      await loadAll();
    } catch (e: any) {
      toast.error("Erro de rede", { description: e?.message || "tenta de novo" });
    } finally {
      setSending(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">📢 Notificar alunas sobre novidades</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dispara um email em massa pra todas as alunas (com acesso ou expiradas) avisando sobre módulo novo, aula nova ou qualquer atualização num curso. Quem tem acesso vai direto pra aula; quem não tem cai na página de venda.
        </p>
      </div>

      {/* Form de envio */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            Curso destino
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            disabled={sending}
          >
            <option value="">Selecione…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} {p.status !== "published" ? "(oculto)" : ""}
              </option>
            ))}
          </select>
          {selectedProduct && selectedProduct.status !== "published" && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
              ⚠️ Esse curso está OCULTO pras alunas. Elas verão como "Trancado" no grid e o link levará pra página de venda.
            </p>
          )}
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            Título do email
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Ex: "Adicionei a aula 17 de Ladeiras!"'
            maxLength={120}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            disabled={sending}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Aparece como assunto do email e título grande dentro dele. Máx 120 chars.
          </p>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            Mensagem
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder='Conte rapidamente o que tem de novo. Ex: "Saiu nova aula sobre como fazer baliza em vaga de mercado lotada. Te ensino passo a passo o ângulo certo, quando virar o volante e como sair sem bater no carro do lado. Bora?"'
            maxLength={1500}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:border-primary resize-y"
            disabled={sending}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Quebras de linha funcionam. Máx 1500 chars. Quem ler vai ter 1 botão "Acessar agora →" pra ir direto pro curso.
          </p>
        </div>

        {/* Resumo destinatários */}
        <div className="bg-accent/30 border border-border rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-foreground">
              {loading ? "Carregando alunas…" : `${recipients.length} aluna${recipients.length === 1 ? "" : "s"} vão receber`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {activeCount} com acesso ativo · {expiredCount} com matrícula expirada
            </p>
          </div>
          <span className="material-symbols-outlined text-3xl text-muted-foreground">forward_to_inbox</span>
        </div>

        <button
          onClick={sendNotification}
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3.5 rounded-xl shadow-lg shadow-primary/20 uppercase tracking-widest text-xs hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              Enviando pra {recipients.length} alunas…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">send</span>
              Enviar agora pra {recipients.length} alunas
            </>
          )}
        </button>
      </div>

      {/* Histórico */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">
          Histórico
        </h3>
        {history.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <span className="material-symbols-outlined text-muted-foreground text-3xl mb-2 block">history</span>
            <p className="text-sm font-bold text-muted-foreground">Nenhuma notificação enviada ainda</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Use o form acima pra disparar a primeira.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {history.map((h) => {
                const dt = new Date(h.sent_at);
                const dataFormatada = `${dt.toLocaleDateString("pt-BR")} · ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                return (
                  <motion.div
                    key={h.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
                  >
                    <span
                      className={`shrink-0 size-8 rounded-full flex items-center justify-center ${
                        h.status === "sent"
                          ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]"
                          : h.status === "partial"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {h.status === "sent" ? "check_circle" : h.status === "partial" ? "warning" : "error"}
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-sm line-clamp-1">{h.title}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">{dataFormatada}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        Curso: <strong className="text-foreground">{h.product_title || "—"}</strong>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {h.recipients_succeeded}/{h.recipients_attempted} entregues
                        {h.status === "partial" && ` · ${h.recipients_attempted - h.recipients_succeeded} falharam`}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
