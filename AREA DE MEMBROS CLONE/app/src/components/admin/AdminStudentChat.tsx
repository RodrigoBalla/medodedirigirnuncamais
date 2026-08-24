import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  db,
  rowToMessage,
  formatTime,
  safeUrl,
  type DirectMessage,
  type DMButton,
} from "@/lib/directMessages";

// ─── AdminStudentChat ────────────────────────────────────────────────────────
// Painel de conversa do admin com UMA aluna. Reutilizado em dois lugares:
//   1. Aba "Mensagens" do admin (painel da direita da conversa selecionada)
//   2. Card expandido da aluna na aba "Alunos" (mostra o que ela enviou + responder)
//
// Mostra a thread completa e permite ENVIAR mensagem (texto + botões-link).
// Ao montar/receber, marca as mensagens da aluna como lidas pelo admin.
// =============================================================================

interface Props {
  userId: string;
  studentName: string;
  /** Avisa o pai (inbox) que houve atividade/leitura pra atualizar badges. */
  onActivity?: () => void;
  /** Versão compacta (card do aluno) — thread mais baixa. */
  compact?: boolean;
}

export function AdminStudentChat({ userId, studentName, onActivity, compact }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [buttons, setButtons] = useState<DMButton[]>([]);
  const [showButtons, setShowButtons] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  // Marca as mensagens da aluna como lidas pelo admin (não bloqueante).
  const markStudentRead = useCallback(async () => {
    try {
      await db
        .from("direct_messages")
        .update({ read_by_admin_at: new Date().toISOString() })
        .eq("student_id", userId)
        .eq("sender", "student")
        .is("read_by_admin_at", null);
      onActivity?.();
    } catch {
      /* não-fatal */
    }
  }, [userId, onActivity]);

  // ─── Carrega thread + realtime (por aluna) ─────────────────────────────────
  useEffect(() => {
    let active = true;
    seenIds.current = new Set();
    setLoading(true);

    (async () => {
      const { data } = await db
        .from("direct_messages")
        .select("*")
        .eq("student_id", userId)
        .order("created_at", { ascending: true });
      if (!active) return;
      const msgs: DirectMessage[] = (data || []).map(rowToMessage);
      msgs.forEach((m) => seenIds.current.add(m.id));
      setMessages(msgs);
      setLoading(false);
      if (msgs.some((m) => m.sender === "student" && !m.read_by_admin_at)) {
        markStudentRead();
      }
    })();

    const channel = db
      .channel(`dm:admin:chat:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `student_id=eq.${userId}`,
        },
        (payload: { new: Record<string, any> }) => {
          const m = rowToMessage(payload.new);
          if (seenIds.current.has(m.id)) return;
          seenIds.current.add(m.id);
          setMessages((prev) => [...prev, m]);
          if (m.sender === "student") markStudentRead();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `student_id=eq.${userId}`,
        },
        (payload: { new: Record<string, any> }) => {
          const m = rowToMessage(payload.new);
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .subscribe();

    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, [userId, markStudentRead]);

  useEffect(() => {
    requestAnimationFrame(() =>
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    );
  }, [messages]);

  // ─── Construtor de botões-link ─────────────────────────────────────────────
  const addButton = () => setButtons((b) => [...b, { label: "", url: "" }]);
  const updateButton = (i: number, patch: Partial<DMButton>) =>
    setButtons((b) => b.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeButton = (i: number) => setButtons((b) => b.filter((_, idx) => idx !== i));

  const validButtons = buttons
    .map((b) => ({ label: b.label.trim(), url: b.url.trim() }))
    .filter((b) => b.label && safeUrl(b.url));

  const canSend = !!draft.trim() || validButtons.length > 0;

  const send = async () => {
    if (!user || sending || !canSend) return;
    // Valida botões preenchidos mas inválidos (avisa em vez de mandar quebrado)
    const filledButtons = buttons.filter((b) => b.label.trim() || b.url.trim());
    if (filledButtons.length > 0 && filledButtons.length !== validButtons.length) {
      toast.error("Tem botão com label ou link inválido", {
        description: "Cada botão precisa de um texto e uma URL válida (http/https).",
      });
      return;
    }
    setSending(true);
    const { data, error } = await db
      .from("direct_messages")
      .insert({
        student_id: userId,
        sender: "admin",
        sender_id: user.id,
        body: draft.trim() || null,
        buttons: validButtons,
      })
      .select()
      .single();
    setSending(false);
    if (error) {
      toast.error("Não consegui enviar", { description: error.message });
      return;
    }
    setDraft("");
    setButtons([]);
    setShowButtons(false);
    // Append otimista (dedup com seenIds pro realtime não duplicar)
    if (data) {
      const m = rowToMessage(data);
      if (!seenIds.current.has(m.id)) {
        seenIds.current.add(m.id);
        setMessages((prev) => [...prev, m]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Thread */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 bg-background/40 ${
          compact ? "max-h-72" : ""
        }`}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full min-h-32 flex flex-col items-center justify-center text-center text-muted-foreground gap-1.5 px-4">
            <span className="material-symbols-outlined text-3xl text-primary/50">chat</span>
            <p className="text-sm font-medium">Nenhuma mensagem ainda.</p>
            <p className="text-xs text-muted-foreground/70">
              Mande a primeira mensagem pra {studentName.split(" ")[0]}.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const fromAdmin = m.sender === "admin";
            return (
              <div
                key={m.id}
                className={`flex flex-col ${fromAdmin ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    fromAdmin
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-accent text-foreground rounded-bl-md"
                  }`}
                >
                  {!fromAdmin && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground/60 mb-1">
                      {studentName.split(" ")[0]}
                    </p>
                  )}
                  {m.body && <span>{m.body}</span>}
                  {m.buttons.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {m.buttons.map((b: DMButton, i: number) => {
                        const href = safeUrl(b.url);
                        return (
                          <a
                            key={i}
                            href={href || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-background/80 text-foreground text-xs font-bold border border-border hover:bg-muted transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                            {b.label}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5 px-1 flex items-center gap-1">
                  {formatTime(m.created_at)}
                  {fromAdmin && (
                    <span
                      className="material-symbols-outlined text-[13px]"
                      title={m.read_by_student_at ? "Lida pela aluna" : "Entregue"}
                    >
                      {m.read_by_student_at ? "done_all" : "done"}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Construtor de botões (opcional) */}
      {showButtons && (
        <div className="border-t border-border bg-card px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Botões-link
            </p>
            <button
              onClick={addButton}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Adicionar botão
            </button>
          </div>
          {buttons.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic">
              Nenhum botão. Clique em "Adicionar botão" pra incluir um link clicável.
            </p>
          )}
          {buttons.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={b.label}
                onChange={(e) => updateButton(i, { label: e.target.value })}
                placeholder="Texto do botão"
                className="w-32 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
              />
              <input
                value={b.url}
                onChange={(e) => updateButton(i, { url: e.target.value })}
                placeholder="https://link…"
                className="flex-1 min-w-0 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => removeButton(i)}
                className="size-7 shrink-0 rounded-lg bg-muted text-muted-foreground hover:bg-destructive/15 hover:text-destructive flex items-center justify-center transition-colors"
                title="Remover botão"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border p-2.5 shrink-0 bg-card">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowButtons((s) => !s)}
            className={`size-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              showButtons || validButtons.length > 0
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Adicionar botões-link"
          >
            <span className="material-symbols-outlined text-xl">add_link</span>
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Mensagem pra ${studentName.split(" ")[0]}…`}
            className="flex-1 resize-none max-h-32 px-3.5 py-2.5 bg-background border border-border rounded-2xl text-sm focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={send}
            disabled={!canSend || sending}
            className="size-11 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enviar"
            title="Enviar (Enter)"
          >
            {sending ? (
              <span className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-xl">send</span>
            )}
          </button>
        </div>
        {validButtons.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            {validButtons.length} botão(ões) serão enviados junto.
          </p>
        )}
      </div>
    </div>
  );
}
