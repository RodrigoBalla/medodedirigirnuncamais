import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherOnline } from "@/hooks/useTeacherPresence";
import {
  db,
  rowToMessage,
  formatTime,
  safeUrl,
  type DirectMessage,
  type DMButton,
} from "@/lib/directMessages";

// ─── StudentMessenger ────────────────────────────────────────────────────────
// Canal de comunicação direto da aluna com a Carla (admin). Montado no AppLayout
// só pra alunas (admin tem o painel completo em /admin).
//
//   • Mensagem do admin chega → POPUP automático (com botões-link, se houver),
//     em tempo real se a aluna estiver online, ou no próximo login se offline.
//   • FAB (canto inferior esquerdo) com badge de não-lidas abre o painel de chat.
//   • Painel: thread completa + caixa pra RESPONDER a Carla.
//
// Isolamento: a aluna só enxerga/escreve na PRÓPRIA conversa (RLS por student_id).
// Nunca vê a conversa de outra aluna nem consegue mandar pra outra aluna.
// =============================================================================

export function StudentMessenger() {
  const { user } = useAuth();
  const carlaOnline = useTeacherOnline();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [popupQueue, setPopupQueue] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const unreadCount = messages.filter(
    (m) => m.sender === "admin" && !m.read_by_student_at,
  ).length;

  // ─── Carrega thread + subscreve realtime ───────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const { data } = await db
        .from("direct_messages")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: true });
      if (!active) return;
      const msgs: DirectMessage[] = (data || []).map(rowToMessage);
      msgs.forEach((m) => seenIds.current.add(m.id));
      setMessages(msgs);
      const unread = msgs.filter((m) => m.sender === "admin" && !m.read_by_student_at);
      if (unread.length) setPopupQueue(unread);
    })();

    const channel = db
      .channel(`dm:student:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `student_id=eq.${user.id}`,
        },
        (payload: { new: Record<string, any> }) => {
          const m = rowToMessage(payload.new);
          if (seenIds.current.has(m.id)) return;
          seenIds.current.add(m.id);
          setMessages((prev) => [...prev, m]);
          if (m.sender === "admin" && !m.read_by_student_at) {
            setPopupQueue((q) => [...q, m]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `student_id=eq.${user.id}`,
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
  }, [user]);

  // Autoscroll pro fim quando abre o painel ou chega mensagem
  useEffect(() => {
    if (!panelOpen) return;
    requestAnimationFrame(() =>
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    );
  }, [messages, panelOpen]);

  // Marca todas as mensagens do admin como lidas (DB + otimista local)
  const markRead = useCallback(async () => {
    if (!user) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.sender === "admin" && !m.read_by_student_at
          ? { ...m, read_by_student_at: new Date().toISOString() }
          : m,
      ),
    );
    try {
      await db.rpc("dm_student_mark_read");
    } catch {
      /* não-fatal */
    }
  }, [user]);

  const openPanel = () => {
    setPanelOpen(true);
    setPopupQueue([]);
    markRead();
  };

  const dismissPopup = () => {
    setPopupQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) markRead();
      return next;
    });
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !user || sending) return;
    setSending(true);
    const { data, error } = await db
      .from("direct_messages")
      .insert({ student_id: user.id, sender: "student", sender_id: user.id, body })
      .select()
      .single();
    setSending(false);
    if (error) return;
    setDraft("");
    // Append otimista (com dedup pra não duplicar quando o realtime ecoar)
    if (data) {
      const m = rowToMessage(data);
      if (!seenIds.current.has(m.id)) {
        seenIds.current.add(m.id);
        setMessages((prev) => [...prev, m]);
      }
    }
  };

  // Esc fecha popup/painel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popupQueue.length) dismissPopup();
      else if (panelOpen) setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupQueue.length, panelOpen]);

  if (!user) return null;

  const currentPopup = !panelOpen && popupQueue.length > 0 ? popupQueue[0] : null;
  const moreInQueue = popupQueue.length - 1;

  return (
    <>
      {/* ─── FAB (canto inferior esquerdo, não colide com o SOS à direita) ──── */}
      <motion.button
        onClick={openPanel}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-24 left-4 lg:bottom-6 lg:left-6 z-40 size-14 md:size-16 rounded-full bg-gradient-to-br from-primary to-yellow-500 text-primary-foreground shadow-[0_8px_30px_rgba(255,214,10,.35)] flex items-center justify-center"
        aria-label="Mensagens da Carla"
        title="Mensagens da Carla"
      >
        <span className="material-symbols-outlined filled-icon text-2xl md:text-3xl relative z-10">
          forum
        </span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </motion.button>

      {/* ─── Popup de nova mensagem do admin ───────────────────────────────── */}
      <AnimatePresence>
        {currentPopup && (
          <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissPopup}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="relative z-10 w-full max-w-md bg-card border-2 border-primary/30 rounded-3xl shadow-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              <div className="caution-tape h-2" aria-hidden />
              <div className="p-6 md:p-7">
                {/* Carla */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-yellow-500 text-primary-foreground font-black text-2xl flex items-center justify-center shrink-0 shadow-lg">
                    C
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">
                      Mensagem da Carla
                    </p>
                    <h2 className="font-black text-lg text-foreground leading-tight flex items-center gap-2">
                      Carla
                      {carlaOnline && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          online
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-muted-foreground">sua instrutora</p>
                  </div>
                </div>

                {currentPopup.body && (
                  <div className="bg-accent/40 border border-border rounded-2xl p-4 mb-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {currentPopup.body}
                    </p>
                  </div>
                )}

                {/* Botões-link */}
                {currentPopup.buttons.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4">
                    {currentPopup.buttons.map((b: DMButton, i: number) => {
                      const href = safeUrl(b.url);
                      if (!href) return null;
                      return (
                        <a
                          key={i}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markRead()}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide shadow-lg hover:scale-[1.02] active:scale-95 transition-transform"
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span>
                          {b.label}
                        </a>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={openPanel}
                    className="flex-1 py-3 rounded-2xl border border-border bg-background text-foreground font-bold text-sm hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">reply</span>
                    Responder
                  </button>
                  <button
                    onClick={dismissPopup}
                    className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
                  >
                    {moreInQueue > 0 ? `Próxima (${moreInQueue})` : "Ok, entendi"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Painel de chat ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {panelOpen && (
          <div className="fixed inset-0 z-[120] flex items-end md:items-stretch md:justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="relative z-10 w-full md:w-[420px] md:h-full h-[85vh] bg-card md:border-l border-border flex flex-col rounded-t-3xl md:rounded-none overflow-hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="caution-tape h-1.5 shrink-0" aria-hidden />
              <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-yellow-500 text-primary-foreground font-black text-xl flex items-center justify-center shrink-0">
                  C
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground leading-tight">Carla</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {carlaOnline ? (
                      <>
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        online agora
                      </>
                    ) : (
                      "sua instrutora"
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="size-9 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center transition-colors"
                  aria-label="Fechar"
                  title="Fechar (Esc)"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </header>

              {/* Thread */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background/40">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 px-6">
                    <span className="material-symbols-outlined text-4xl text-primary/60">
                      waving_hand
                    </span>
                    <p className="text-sm font-medium">Fale com a Carla por aqui.</p>
                    <p className="text-xs text-muted-foreground/70">
                      Mande sua dúvida que ela responde direto na plataforma.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender === "student";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            mine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-accent text-foreground rounded-bl-md"
                          }`}
                        >
                          {!mine && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 mb-1">
                              Carla
                            </p>
                          )}
                          {m.body && <span>{m.body}</span>}
                          {m.buttons.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-2">
                              {m.buttons.map((b: DMButton, i: number) => {
                                const href = safeUrl(b.url);
                                if (!href) return null;
                                return (
                                  <a
                                    key={i}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-background text-foreground text-xs font-bold border border-border hover:bg-muted transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-sm">
                                      open_in_new
                                    </span>
                                    {b.label}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 mt-1 px-1">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-border p-3 shrink-0 bg-card">
                <div className="flex items-end gap-2">
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
                    placeholder="Escreva sua mensagem…"
                    className="flex-1 resize-none max-h-32 px-3.5 py-2.5 bg-background border border-border rounded-2xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={send}
                    disabled={!draft.trim() || sending}
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
