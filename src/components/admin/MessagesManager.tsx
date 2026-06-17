import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/directMessages";
import { useOnlineUserIds } from "@/hooks/useOnlineUserIds";
import { AdminStudentChat } from "@/components/admin/AdminStudentChat";

// ─── MessagesManager (aba "Mensagens" do admin) ──────────────────────────────
// Canal direto admin <-> aluna. Coluna esquerda: lista de conversas (não-lidas
// primeiro) + quem está online agora + "nova conversa". Direita: a conversa
// selecionada (AdminStudentChat). Tudo em tempo real.
// =============================================================================

interface InboxRow {
  student_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_sender: "admin" | "student" | null;
  last_at: string;
  unread_from_student: number;
  total_messages: number;
}

interface Recipient {
  user_id: string;
  email: string | null;
  display_name: string;
  access_status: string;
}

function preview(row: InboxRow): string {
  const base = row.last_message?.trim() || "📎 mensagem com botão";
  return row.last_sender === "admin" ? `Você: ${base}` : base;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function MessagesManager() {
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");

  const onlineIds = useOnlineUserIds();
  const refetchTimer = useRef<number | null>(null);

  const fetchInbox = useCallback(async () => {
    const { data, error } = await db.rpc("dm_admin_inbox");
    if (!error && Array.isArray(data)) setInbox(data as InboxRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInbox();
    const channel = db
      .channel("dm:admin:inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => {
          // debounce leve — várias mudanças seguidas viram 1 refetch
          if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
          refetchTimer.current = window.setTimeout(fetchInbox, 400);
        },
      )
      .subscribe();
    return () => {
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
      db.removeChannel(channel);
    };
  }, [fetchInbox]);

  // Carrega a lista de alunas no mount — serve pro seletor de "nova conversa" E
  // pra contar quem está online agora MESMO sem conversa aberta ainda.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("admin_list_notification_recipients");
      if (Array.isArray(data)) setRecipients(data as Recipient[]);
    })();
  }, []);

  const openPicker = () => setShowPicker(true);

  // Conta TODAS as alunas online agora (presença ∩ alunas), não só as que já têm
  // conversa — senão mostrava "0 online" mesmo com gente online na plataforma.
  const onlineStudentsCount = useMemo(() => {
    const ids = new Set<string>();
    recipients.forEach((r) => { if (onlineIds.has(r.user_id)) ids.add(r.user_id); });
    inbox.forEach((r) => { if (onlineIds.has(r.student_id)) ids.add(r.student_id); });
    return ids.size;
  }, [recipients, inbox, onlineIds]);

  const filteredRecipients = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.display_name.toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q),
    );
  }, [recipients, pickerSearch]);

  const totalUnread = useMemo(
    () => inbox.reduce((a, r) => a + (r.unread_from_student || 0), 0),
    [inbox],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary filled-icon">chat</span>
            Mensagens
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              realtime
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Canal direto com cada aluna · {onlineStudentsCount} online agora
            {totalUnread > 0 && ` · ${totalUnread} não-lida(s)`}
          </p>
        </div>
        <button
          onClick={openPicker}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
        >
          <span className="material-symbols-outlined text-base">edit_square</span>
          Nova conversa
        </button>
      </div>

      <div className="grid md:grid-cols-[340px_1fr] gap-4 items-stretch">
        {/* Lista de conversas */}
        <div
          className={`bg-card border border-border rounded-2xl overflow-hidden flex flex-col ${
            selected ? "hidden md:flex" : "flex"
          }`}
          style={{ minHeight: "60vh", maxHeight: "75vh" }}
        >
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Conversas ({inbox.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              </div>
            ) : inbox.length === 0 ? (
              <div className="text-center py-12 px-6 text-muted-foreground">
                <span className="material-symbols-outlined text-4xl mb-2 block text-primary/40">
                  forum
                </span>
                <p className="text-sm font-medium">Nenhuma conversa ainda.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Clique em "Nova conversa" pra mandar a primeira mensagem.
                </p>
              </div>
            ) : (
              inbox.map((r) => {
                const isSel = selected?.id === r.student_id;
                const online = onlineIds.has(r.student_id);
                return (
                  <button
                    key={r.student_id}
                    onClick={() => setSelected({ id: r.student_id, name: r.display_name })}
                    className={`w-full text-left px-3 py-3 flex items-center gap-3 border-b border-border/60 transition-colors ${
                      isSel ? "bg-primary/10" : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="size-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg overflow-hidden">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt="" className="size-full object-cover" />
                        ) : (
                          r.display_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {online && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 border-2 border-card"
                          title="Online agora"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate flex-1">{r.display_name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(r.last_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-xs truncate flex-1 ${
                            r.unread_from_student > 0
                              ? "text-foreground font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {preview(r)}
                        </p>
                        {r.unread_from_student > 0 && (
                          <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">
                            {r.unread_from_student}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Conversa selecionada */}
        <div
          className={`bg-card border border-border rounded-2xl overflow-hidden flex-col ${
            selected ? "flex" : "hidden md:flex"
          }`}
          style={{ minHeight: "60vh", maxHeight: "75vh" }}
        >
          {selected ? (
            <>
              <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                <button
                  onClick={() => setSelected(null)}
                  className="md:hidden size-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                  title="Voltar"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                </button>
                <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground leading-tight truncate">
                    {selected.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {onlineIds.has(selected.id) ? (
                      <>
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        online agora
                      </>
                    ) : (
                      "offline"
                    )}
                  </p>
                </div>
              </header>
              <AdminStudentChat
                key={selected.id}
                userId={selected.id}
                studentName={selected.name}
                onActivity={fetchInbox}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 px-6">
              <span className="material-symbols-outlined text-5xl text-primary/30">forum</span>
              <p className="text-sm font-medium">Selecione uma conversa</p>
              <p className="text-xs text-muted-foreground/70">
                Ou inicie uma nova com qualquer aluna.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Picker de nova conversa */}
      {showPicker && (
        <div
          className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-bold">Nova conversa</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="size-8 rounded-full bg-muted text-muted-foreground hover:bg-accent flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-3 shrink-0">
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Buscar aluna por nome ou email…"
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredRecipients.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Nenhuma aluna encontrada.
                </p>
              ) : (
                filteredRecipients.map((r) => (
                  <button
                    key={r.user_id}
                    onClick={() => {
                      setSelected({ id: r.user_id, name: r.display_name });
                      setShowPicker(false);
                      setPickerSearch("");
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <div className="relative shrink-0">
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {r.display_name.charAt(0).toUpperCase()}
                      </div>
                      {onlineIds.has(r.user_id) && (
                        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-card" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.display_name}</p>
                      {r.email && (
                        <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
