import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ─── NotificationsManager ────────────────────────────────────────────────────
// Admin dispara email em massa com:
//   • SEGMENTAÇÃO POR REGRAS — "alunas do grupo X que ainda não têm o grupo Y"
//     (incluir grupos + excluir grupos + status de acesso) com contagem ao vivo.
//   • CORPO em TEXTO (template bonito) ou HTML PERSONALIZADO (com variáveis
//     {{NOME}} {{LINK}} {{CURSO}} {{EMAIL}}) + pré-visualização.
// Chama a Edge Function send-course-notification (v2). Histórico em course_notifications.
// =============================================================================

interface Product { id: string; title: string; status: string; image_url: string | null; }
interface Group { id: string; name: string; }
interface NotificationLog {
  id: string; product_id: string | null; product_title: string | null;
  title: string; body: string; sent_at: string;
  recipients_attempted: number; recipients_succeeded: number;
  status: "sent" | "partial" | "failed";
}

type AccessStatus = "all" | "active" | "expired";
type Mode = "text" | "html";

interface Template {
  id: string; name: string; subject: string; mode: Mode;
  product_id: string | null; title: string | null; body: string | null; html: string | null;
  include_group_ids: string[] | null; exclude_group_ids: string[] | null;
  access_status: AccessStatus; updated_at: string;
}

const SUPABASE_URL = "https://qkvinhzwiptfobdvsdtr.supabase.co";

const HTML_PLACEHOLDER = `<div style="font-family:Arial,sans-serif;background:#0B1A38;color:#fff;padding:32px;border-radius:16px;max-width:560px;margin:0 auto">
  <h1 style="color:#FFD60A;margin:0 0 12px">Oi {{NOME}}! 👋</h1>
  <p style="font-size:15px;line-height:1.6;color:#C5C8D1">
    Escreva aqui sua mensagem. Use as variáveis pra personalizar.
  </p>
  <p style="text-align:center;margin:28px 0">
    <a href="{{LINK}}" style="background:#FFD60A;color:#0B1A38;padding:16px 28px;border-radius:12px;text-decoration:none;font-weight:900">Quero esse curso →</a>
  </p>
</div>`;

export default function NotificationsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);

  // ── Segmentação ──
  const [includeGroups, setIncludeGroups] = useState<string[]>([]);
  const [excludeGroups, setExcludeGroups] = useState<string[]>([]);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("all");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // ── Conteúdo ──
  const [mode, setMode] = useState<Mode>("text");
  const [subject, setSubject] = useState("");
  const [productId, setProductId] = useState<string>(""); // opcional (link/imagem)
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [html, setHtml] = useState(HTML_PLACEHOLDER);
  const [showPreview, setShowPreview] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [prodRes, grpRes, histRes, tplRes] = await Promise.all([
      supabase.from("products").select("id, title, status, image_url").order("title"),
      supabase.from("access_groups").select("id, name").order("name"),
      // @ts-ignore — RPC
      supabase.rpc("admin_list_course_notifications", { p_limit: 30 }),
      // @ts-ignore — RPC
      supabase.rpc("admin_list_notification_templates"),
    ]);
    setProducts((prodRes.data as Product[]) || []);
    setGroups((grpRes.data as Group[]) || []);
    setHistory((histRes.data as unknown as NotificationLog[]) || []);
    setTemplates((tplRes.data as unknown as Template[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Contagem de destinatários ao vivo (debounced) ──
  const countTimer = useRef<number | null>(null);
  useEffect(() => {
    if (countTimer.current) window.clearTimeout(countTimer.current);
    setCountLoading(true);
    countTimer.current = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("admin_list_recipients_by_rules", {
        p_include_group_ids: includeGroups.length ? includeGroups : null,
        p_exclude_group_ids: excludeGroups.length ? excludeGroups : null,
        p_access_status: accessStatus,
      } as never);
      setRecipientCount(error ? null : ((data as unknown[] | null)?.length ?? 0));
      setCountLoading(false);
    }, 400);
    return () => { if (countTimer.current) window.clearTimeout(countTimer.current); };
  }, [includeGroups, excludeGroups, accessStatus]);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  // ── Templates ──
  function loadTemplate(t: Template) {
    setSubject(t.subject || "");
    setMode(t.mode === "html" ? "html" : "text");
    setProductId(t.product_id || "");
    setTitle(t.title || "");
    setBody(t.body || "");
    if (t.mode === "html" && t.html) setHtml(t.html);
    setIncludeGroups(t.include_group_ids || []);
    setExcludeGroups(t.exclude_group_ids || []);
    setAccessStatus((t.access_status as AccessStatus) || "all");
    toast.success(`Template "${t.name}" carregado`, { description: "Ajuste o que quiser e dispare." });
  }

  async function refreshTemplates() {
    const { data } = await supabase.rpc("admin_list_notification_templates" as never);
    setTemplates((data as unknown as Template[]) || []);
  }

  async function saveTemplate(opts?: { silent?: boolean }) {
    const name = subject.trim();
    if (name.length < 3) {
      if (!opts?.silent) toast.error("Preencha o assunto", { description: "O assunto vira o nome do template." });
      return;
    }
    setSavingTpl(true);
    try {
      const { error } = await supabase.rpc("admin_save_notification_template", {
        p_name: name,
        p_subject: name,
        p_mode: mode,
        p_product_id: productId || null,
        p_title: mode === "text" ? title.trim() : null,
        p_body: mode === "text" ? body.trim() : null,
        p_html: mode === "html" ? html : null,
        p_include_group_ids: includeGroups.length ? includeGroups : null,
        p_exclude_group_ids: excludeGroups.length ? excludeGroups : null,
        p_access_status: accessStatus,
      } as never);
      if (error) {
        if (!opts?.silent) toast.error("Erro ao salvar template", { description: error.message });
        return;
      }
      if (!opts?.silent) toast.success("Template salvo!", { description: `"${name}" disponível pra reusar.` });
      await refreshTemplates();
    } finally {
      setSavingTpl(false);
    }
  }

  async function deleteTemplate(id: string, name: string) {
    const { error } = await supabase.rpc("admin_delete_notification_template", { p_id: id } as never);
    if (error) { toast.error("Erro ao excluir template"); return; }
    setTemplates((ts) => ts.filter((t) => t.id !== id));
    toast.success(`Template "${name}" excluído`);
  }

  const canSubmit = useMemo(() => {
    if (sending || !recipientCount) return false;
    if (mode === "text") return subject.trim().length >= 3 && title.trim().length >= 3 && body.trim().length >= 10;
    return subject.trim().length >= 3 && html.trim().length >= 20;
  }, [sending, recipientCount, mode, subject, title, body, html]);

  // Preview do HTML com variáveis de exemplo
  const previewHtml = useMemo(() => {
    const link = productId ? `${SUPABASE_URL.replace("qkvinhzwiptfobdvsdtr.supabase.co", "")}` : "#";
    return html
      .replace(/\{\{\s*NOME\s*\}\}/g, "Maria")
      .replace(/\{\{\s*EMAIL\s*\}\}/g, "maria@email.com")
      .replace(/\{\{\s*CURSO\s*\}\}/g, products.find((p) => p.id === productId)?.title || "Seu curso")
      .replace(/\{\{\s*LINK\s*\}\}/g, "#");
  }, [html, productId, products]);

  async function send() {
    if (!canSubmit) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("sem sessão");

      const payload: Record<string, unknown> = {
        include_group_ids: includeGroups.length ? includeGroups : undefined,
        exclude_group_ids: excludeGroups.length ? excludeGroups : undefined,
        access_status: accessStatus,
        subject: subject.trim(),
        mode,
        product_id: productId || undefined,
      };
      if (mode === "text") { payload.title = title.trim(); payload.body = body.trim(); }
      else { payload.html = html; }

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-course-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        toast.error("Erro ao enviar", { description: data?.error || data?.detail || "falha desconhecida" });
        return;
      }
      toast.success(`Email enviado pra ${data.succeeded}/${data.attempted} alunas`, {
        description: data.failed > 0 ? `${data.failed} falharam — verifica os logs` : "Salvo como template ✓",
        duration: 6000,
      });
      await saveTemplate({ silent: true }); // todo envio vira template reutilizável
      setTitle(""); setBody(""); setSubject("");
      await loadAll();
    } catch (e: any) {
      toast.error("Erro de rede", { description: e?.message || "tenta de novo" });
    } finally {
      setSending(false);
    }
  }

  const STATUS_OPTS: { v: AccessStatus; label: string }[] = [
    { v: "all", label: "Todas" },
    { v: "active", label: "Acesso ativo" },
    { v: "expired", label: "Expiradas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">📢 Notificar alunas</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dispare email em massa com <strong>regras de segmentação</strong> (ex: alunas do grupo X que ainda não têm o Y) e corpo em <strong>texto</strong> ou <strong>HTML personalizado</strong>.
        </p>
      </div>

      {/* ── TEMPLATES SALVOS ── */}
      {templates.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-3">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">bookmark</span> Templates salvos
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Clique pra carregar no formulário. Todo e-mail enviado é salvo aqui automaticamente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <div key={t.id} className="inline-flex items-center gap-1 bg-background border border-border rounded-lg pl-3 pr-1 py-1 hover:border-primary/40 transition">
                <button type="button" onClick={() => loadTemplate(t)} className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <span className="material-symbols-outlined text-sm text-muted-foreground">{t.mode === "html" ? "code" : "description"}</span>
                  <span className="max-w-[220px] truncate">{t.name}</span>
                </button>
                <button type="button" onClick={() => deleteTemplate(t.id, t.name)} aria-label="Excluir template"
                  className="shrink-0 size-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PÚBLICO / REGRAS ── */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-5">
        <p className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">filter_alt</span> Quem vai receber
        </p>

        {/* Incluir */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
            Incluir alunas dos grupos <span className="text-muted-foreground/60 normal-case font-normal">(nenhum = todas)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const on = includeGroups.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => toggle(includeGroups, setIncludeGroups, g.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}>
                  {on ? "✓ " : ""}{g.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Excluir */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
            Excluir quem já tem <span className="text-muted-foreground/60 normal-case font-normal">(ex: "que ainda não compraram X")</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const on = excludeGroups.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => toggle(excludeGroups, setExcludeGroups, g.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${on ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background border-border text-muted-foreground hover:border-destructive/40"}`}>
                  {on ? "✕ " : ""}{g.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Status de acesso</label>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {STATUS_OPTS.map((o) => (
              <button key={o.v} type="button" onClick={() => setAccessStatus(o.v)}
                className={`text-xs font-bold px-4 py-2 transition ${accessStatus === o.v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contagem ao vivo */}
        <div className="bg-accent/30 border border-border rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-black text-foreground flex items-center gap-2">
              {countLoading ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="text-primary">{recipientCount ?? 0}</span>}
              <span className="text-sm font-bold">aluna{recipientCount === 1 ? "" : "s"} nessa regra</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Atualiza automático conforme você muda as regras.</p>
          </div>
          <span className="material-symbols-outlined text-3xl text-muted-foreground">group</span>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4">
        <p className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">mail</span> Conteúdo
        </p>

        {/* Assunto */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Assunto do email</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140}
            placeholder='Ex: "Liberamos uma novidade pra você 🚗"'
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" disabled={sending} />
        </div>

        {/* Curso (link opcional) */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            Curso do link <span className="text-muted-foreground/60 normal-case font-normal">(opcional — vira o {"{{LINK}}"} / botão "Acessar")</span>
          </label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" disabled={sending}>
            <option value="">Sem curso específico (link pra plataforma)</option>
            {products.map((p) => (<option key={p.id} value={p.id}>{p.title}{p.status !== "published" ? " (oculto)" : ""}</option>))}
          </select>
        </div>

        {/* Modo */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Formato</label>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => setMode("text")}
              className={`text-xs font-bold px-4 py-2 transition ${mode === "text" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}>📝 Texto (template)</button>
            <button type="button" onClick={() => setMode("html")}
              className={`text-xs font-bold px-4 py-2 transition ${mode === "html" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}>{"</>"} HTML personalizado</button>
          </div>
        </div>

        {mode === "text" ? (
          <>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Título (grande dentro do email)</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                placeholder='Ex: "Adicionei a aula 17 de Ladeiras!"'
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" disabled={sending} />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Mensagem</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={1500}
                placeholder="Conte rapidamente o que tem de novo. Quebras de linha funcionam."
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:border-primary resize-y" disabled={sending} />
              <p className="text-[10px] text-muted-foreground mt-1">Embrulhado no template bonito (cabeçalho amarelo + botão "Acessar agora").</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">HTML do email</label>
                <button type="button" onClick={() => setShowPreview((s) => !s)} className="text-[11px] font-bold text-primary hover:underline">
                  {showPreview ? "Ocultar prévia" : "Ver prévia"}
                </button>
              </div>
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={12}
                spellCheck={false}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-xs font-mono leading-relaxed focus:outline-none focus:border-primary resize-y" disabled={sending} />
              <p className="text-[10px] text-muted-foreground mt-1">
                Variáveis: <code className="text-primary">{"{{NOME}}"}</code> <code className="text-primary">{"{{LINK}}"}</code> <code className="text-primary">{"{{CURSO}}"}</code> <code className="text-primary">{"{{EMAIL}}"}</code> — são trocadas por aluna no envio.
              </p>
            </div>
            {showPreview && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Prévia</p>
                <iframe title="Prévia do email" srcDoc={previewHtml} className="w-full h-[420px] rounded-lg border border-border bg-white" />
              </div>
            )}
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => saveTemplate()} disabled={savingTpl || subject.trim().length < 3}
            className="sm:w-auto inline-flex items-center justify-center gap-2 bg-background border border-border text-foreground font-bold px-5 py-3.5 rounded-xl text-xs hover:border-primary/40 transition disabled:opacity-40 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined text-base">{savingTpl ? "progress_activity" : "bookmark_add"}</span>
            {savingTpl ? "Salvando…" : "Salvar como template"}
          </button>
          <button onClick={send} disabled={!canSubmit}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3.5 rounded-xl shadow-lg shadow-primary/20 uppercase tracking-widest text-xs hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {sending ? (
              <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span> Enviando pra {recipientCount} alunas…</>
            ) : (
              <><span className="material-symbols-outlined text-base">send</span> Enviar pra {recipientCount ?? 0} aluna{recipientCount === 1 ? "" : "s"}</>
            )}
          </button>
        </div>
      </div>

      {/* ── HISTÓRICO ── */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">Histórico</h3>
        {history.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <span className="material-symbols-outlined text-muted-foreground text-3xl mb-2 block">history</span>
            <p className="text-sm font-bold text-muted-foreground">Nenhuma notificação enviada ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {history.map((h) => {
                const dt = new Date(h.sent_at);
                const data = `${dt.toLocaleDateString("pt-BR")} · ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                return (
                  <motion.div key={h.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                    <span className={`shrink-0 size-8 rounded-full flex items-center justify-center ${h.status === "sent" ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" : h.status === "partial" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-destructive/15 text-destructive"}`}>
                      <span className="material-symbols-outlined text-base">{h.status === "sent" ? "check_circle" : h.status === "partial" ? "warning" : "error"}</span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-sm line-clamp-1">{h.title}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">{data}</span>
                      </div>
                      {h.product_title && (<p className="text-xs text-muted-foreground line-clamp-1 mb-1">Curso: <strong className="text-foreground">{h.product_title}</strong></p>)}
                      <p className="text-[11px] text-muted-foreground">{h.recipients_succeeded}/{h.recipients_attempted} entregues{h.status === "partial" && ` · ${h.recipients_attempted - h.recipients_succeeded} falharam`}</p>
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
