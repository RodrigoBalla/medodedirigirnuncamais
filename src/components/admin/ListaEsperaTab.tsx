import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── ListaEsperaTab ──────────────────────────────────────────────────────────
// A área de membros não tem mais checkout: todo CTA de compra virou inscrição
// na lista de espera (`waitlist_signups`). Esta aba é onde o admin acompanha
// quem levantou a mão, por qual curso, e marca o andamento do contato.
// =============================================================================

type Status = "pending" | "contacted" | "converted" | "dismissed";

type Row = {
  id: string;
  user_id: string | null;
  product_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  created_at: string;
  productTitle: string;
  displayName: string;
  contactPhone: string | null;
};

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pending: { label: "Aguardando", cls: "bg-amber-500/15 text-amber-500" },
  contacted: { label: "Contatada", cls: "bg-primary/15 text-primary" },
  converted: { label: "Convertida", cls: "bg-emerald-500/15 text-emerald-500" },
  dismissed: { label: "Dispensada", cls: "bg-muted text-muted-foreground" },
};

const SOURCE_LABEL: Record<string, string> = {
  library: "Biblioteca",
  "course-info": "Página do curso",
  banner: "Barra de oferta",
  "access-expired": "Acesso expirado",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function ListaEsperaTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");

  async function load() {
    setLoading(true);
    try {
      const { data: signups, error } = await supabase
        .from("waitlist_signups")
        .select("id, user_id, product_id, name, email, phone, source, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = signups ?? [];
      const productIds = [...new Set(list.map((s) => s.product_id).filter(Boolean))] as string[];
      const userIds = [...new Set(list.map((s) => s.user_id).filter(Boolean))] as string[];

      // Enriquecimento: título do curso desejado + nome/telefone da aluna.
      const [prodRes, profRes] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id, title").in("id", productIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        userIds.length
          ? supabase.from("profiles").select("user_id, display_name, phone").in("user_id", userIds)
          : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; phone: string | null }[] }),
      ]);

      const prodMap = new Map((prodRes.data ?? []).map((p) => [p.id, p.title]));
      const profMap = new Map((profRes.data ?? []).map((p) => [p.user_id, p]));

      setRows(
        list.map((s) => {
          const prof = s.user_id ? profMap.get(s.user_id) : undefined;
          return {
            ...s,
            productTitle: s.product_id ? (prodMap.get(s.product_id) ?? "Curso removido") : "Acesso completo à plataforma",
            displayName: s.name || prof?.display_name || "Aluna",
            contactPhone: s.phone || prof?.phone || null,
          };
        }),
      );
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: Status) {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase
      .from("waitlist_signups")
      .update({ status, contacted_at: status === "contacted" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      setRows(prev);
      toast.error("Não deu pra atualizar o status.");
      return;
    }
    toast.success(`Marcada como ${STATUS_META[status].label.toLowerCase()}.`);
  }

  const kpis = useMemo(() => {
    const by = (s: Status) => rows.filter((r) => r.status === s).length;
    return { total: rows.length, pending: by("pending"), contacted: by("contacted"), converted: by("converted") };
  }, [rows]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  function exportCsv() {
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const headers = "Nome,Email,Telefone,Curso desejado,Origem,Status,Data\n";
    const body = visible
      .map((r) =>
        [
          esc(r.displayName),
          esc(r.email),
          esc(r.contactPhone),
          esc(r.productTitle),
          esc(SOURCE_LABEL[r.source] ?? r.source),
          esc(STATUS_META[(r.status as Status)]?.label ?? r.status),
          esc(fmtDate(r.created_at)),
        ].join(","),
      )
      .join("\n");
    // BOM pro Excel pt-BR não quebrar acento.
    const blob = new Blob(["﻿" + headers + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-de-espera.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lista exportada!");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Erro: {err}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">hourglass_top</span>
          Lista de espera
        </h2>
        {rows.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Baixar CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total" value={String(kpis.total)} />
        <Kpi label="Aguardando" value={String(kpis.pending)} accent />
        <Kpi label="Contatadas" value={String(kpis.contacted)} />
        <Kpi label="Convertidas" value={String(kpis.converted)} />
      </div>

      <div className="flex rounded-xl border border-border overflow-hidden text-xs font-bold w-fit">
        {([
          ["all", "Todas"],
          ["pending", "Aguardando"],
          ["contacted", "Contatadas"],
          ["converted", "Convertidas"],
          ["dismissed", "Dispensadas"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 ${
              filter === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">⏳</div>
          <h3 className="font-black text-lg">
            {rows.length === 0 ? "Ninguém na lista ainda" : "Nada com esse filtro"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length === 0
              ? "Quando uma aluna clicar pra entrar na lista de espera, ela aparece aqui na hora."
              : "Tente outro filtro pra ver as demais inscrições."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="text-left px-3 py-2 font-bold">Aluna</th>
                <th className="text-left px-3 py-2 font-bold">Quer</th>
                <th className="text-left px-3 py-2 font-bold hidden md:table-cell">Origem</th>
                <th className="text-left px-3 py-2 font-bold hidden sm:table-cell">Data</th>
                <th className="text-left px-3 py-2 font-bold">Status</th>
                <th className="text-right px-3 py-2 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const meta = STATUS_META[r.status as Status] ?? STATUS_META.pending;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2">
                      <div className="font-bold">{r.displayName}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                      {r.contactPhone && (
                        <div className="text-xs text-muted-foreground/70">{r.contactPhone}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {r.productTitle}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-xs text-muted-foreground tabular-nums">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {r.contactPhone && (
                          <a
                            href={`https://wa.me/${r.contactPhone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chamar no WhatsApp"
                            className="size-8 rounded-lg flex items-center justify-center hover:bg-accent text-[#25D366]"
                          >
                            <span className="material-symbols-outlined text-base">chat</span>
                          </a>
                        )}
                        {r.status !== "contacted" && (
                          <button
                            onClick={() => setStatus(r.id, "contacted")}
                            title="Marcar como contatada"
                            className="size-8 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground"
                          >
                            <span className="material-symbols-outlined text-base">forward_to_inbox</span>
                          </button>
                        )}
                        {r.status !== "converted" && (
                          <button
                            onClick={() => setStatus(r.id, "converted")}
                            title="Marcar como convertida"
                            className="size-8 rounded-lg flex items-center justify-center hover:bg-accent text-emerald-500"
                          >
                            <span className="material-symbols-outlined text-base">check_circle</span>
                          </button>
                        )}
                        {r.status !== "dismissed" && (
                          <button
                            onClick={() => setStatus(r.id, "dismissed")}
                            title="Dispensar"
                            className="size-8 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground"
                          >
                            <span className="material-symbols-outlined text-base">do_not_disturb_on</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-1 ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
