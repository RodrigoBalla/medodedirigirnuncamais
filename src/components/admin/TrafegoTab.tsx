import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── TrafegoTab ──────────────────────────────────────────────────────────────
// Placar da campanha de tráfego dentro do /admin.
// Mesmos dados do painel externo /trafego, mas autenticado pelo login do admin
// (a edge function ads-stats valida o JWT + user_roles.role='admin' — assim a
// chave do painel externo não precisa ir no bundle do app).
// Vendas: banco (tempo real). Meta: cache 60s no servidor. Poll: 15s.
// =============================================================================

const FN_URL = "https://qkvinhzwiptfobdvsdtr.supabase.co/functions/v1/ads-stats";
const POLL_MS = 15_000;

interface MetaBlock {
  gasto: number; impressoes: number; cliques: number; ctr: number; cpm: number;
  compras: number; receita: number;
}
interface AdRow { nome: string; gasto: number; impressoes: number; cliques: number; compras: number }
interface Venda { email: string; nome: string | null; quando: string; valor: number | null }
interface Stats {
  ts?: string;
  inicio?: string;
  vendas?: { hoje: number; receita_hoje: number; total: number; receita_total: number; lista: Venda[]; error?: string };
  meta?: { hoje?: MetaBlock; total?: MetaBlock; anuncios_hoje?: AdRow[]; error?: string };
}

const brl = (n: number | null | undefined) =>
  n == null || isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const intBR = (n: number | null | undefined) =>
  n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("pt-BR");
const dh = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
const isToday = (iso: string) => new Date(iso).toLocaleDateString("pt-BR") === new Date().toLocaleDateString("pt-BR");

export function TrafegoTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("—");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setErr("Sessão expirada — recarregue a página."); return; }
        const r = await fetch(FN_URL, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const j = await r.json();
        if (!alive) return;
        if (j?.error) { setErr(j.error === "forbidden" ? "Acesso negado (precisa ser admin)." : String(j.error)); return; }
        setErr(null);
        setStats(j);
        setUpdatedAt(new Date().toLocaleTimeString("pt-BR"));
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    timer.current = window.setInterval(load, POLL_MS);
    return () => { alive = false; if (timer.current) window.clearInterval(timer.current); };
  }, []);

  const v = stats?.vendas;
  const m = stats?.meta;
  const receitaTotal = v && !v.error ? v.receita_total : null;
  const gastoTotal = m?.total?.gasto ?? null;
  const receitaHoje = v && !v.error ? v.receita_hoje : null;
  const gastoHoje = m?.hoje?.gasto ?? null;
  const roas = receitaTotal != null && gastoTotal != null && gastoTotal > 0 ? receitaTotal / gastoTotal : null;
  const lucro = receitaTotal != null && gastoTotal != null ? receitaTotal - gastoTotal : null;
  const roasHoje = receitaHoje != null && gastoHoje != null && gastoHoje > 0 ? receitaHoje / gastoHoje : null;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[hsl(var(--success))]" />
          </span>
          <h2 className="text-lg font-extrabold">Placar da campanha</h2>
          <span className="text-xs text-muted-foreground">desde {stats?.inicio ? stats.inicio.split("-").reverse().slice(0, 2).join("/") : "21/07"} · atualiza a cada 15s</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">atualizado às {updatedAt}</span>
      </div>

      {err && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>
      )}

      {/* Placar principal */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-background p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <p className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-primary">🏁 Vendas × tráfego</p>
          {lucro != null ? (
            lucro >= 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 px-4 py-1.5 text-sm font-black text-[hsl(var(--success))]">
                ✅ POSITIVO · +{brl(lucro)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-1.5 text-sm font-black text-destructive">
                🔻 NEGATIVO · {brl(lucro)}
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              ⏳ aguardando dados do Meta
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Investido total</p>
            <p className="text-2xl md:text-3xl font-black tabular-nums mt-1">{gastoTotal != null ? brl(gastoTotal) : "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Meta Ads</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Receita total</p>
            <p className="text-2xl md:text-3xl font-black tabular-nums mt-1 text-primary">{receitaTotal != null ? brl(receitaTotal) : "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{v?.total ?? 0} venda{(v?.total ?? 0) === 1 ? "" : "s"} · Eduzz (real)</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">ROAS</p>
            <p className={`text-2xl md:text-3xl font-black tabular-nums mt-1 ${roas == null ? "" : roas >= 1 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
              {roas != null ? roas.toFixed(2) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">receita ÷ investido</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Resultado</p>
            <p className={`text-2xl md:text-3xl font-black tabular-nums mt-1 ${lucro == null ? "" : lucro >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
              {lucro != null ? brl(lucro) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">receita − investido</p>
          </div>
        </div>

        {/* Linha do hoje */}
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase">⚡ Hoje</span>
          <span>Investido <b className="text-foreground tabular-nums">{gastoHoje != null ? brl(gastoHoje) : "—"}</b></span>
          <span>Vendas <b className="text-foreground tabular-nums">{intBR(v?.hoje)}</b></span>
          <span>Receita <b className="text-primary tabular-nums">{receitaHoje != null ? brl(receitaHoje) : "—"}</b></span>
          <span>ROAS <b className={`tabular-nums ${roasHoje == null ? "text-foreground" : roasHoje >= 1 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>{roasHoje != null ? roasHoje.toFixed(2) : "—"}</b></span>
        </div>

        {m?.error === "missing_token" && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
            ⏳ Investimento do Meta aguardando o secret <code className="text-primary">META_ADS_TOKEN</code> no Supabase.
          </div>
        )}
        {m?.error && m.error !== "missing_token" && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">⚠️ Meta indisponível: {m.error}</div>
        )}
      </div>

      {/* Últimas vendas */}
      <div>
        <p className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-primary mb-2">💰 Últimas vendas <span className="text-muted-foreground normal-case font-normal tracking-normal">· banco Eduzz · tempo real</span></p>
        {v?.lista?.length ? (
          <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="text-left px-3 py-2 font-bold">Aluna</th>
                  <th className="text-right px-3 py-2 font-bold">Quando</th>
                  <th className="text-right px-3 py-2 font-bold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {v.lista.map((u, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-bold">
                        {u.nome || "—"}
                        {isToday(u.quando) && (
                          <span className="ml-2 inline-block rounded-full bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] text-[9px] font-extrabold px-2 py-0.5">HOJE</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums whitespace-nowrap">{dh(u.quando)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{u.valor ? brl(u.valor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma venda desde o início da campanha ainda. 🚗
          </div>
        )}
      </div>

      {/* Por anúncio */}
      {m?.anuncios_hoje?.length ? (
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-primary mb-2">📣 Por anúncio · hoje <span className="text-muted-foreground normal-case font-normal tracking-normal">· só quem teve entrega (Meta)</span></p>
          <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="text-left px-3 py-2 font-bold">Anúncio</th>
                  <th className="text-right px-3 py-2 font-bold">Gasto</th>
                  <th className="text-right px-3 py-2 font-bold">Impr.</th>
                  <th className="text-right px-3 py-2 font-bold">Cliques</th>
                  <th className="text-right px-3 py-2 font-bold">Compras</th>
                </tr>
              </thead>
              <tbody>
                {m.anuncios_hoje.map((a, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {a.nome}
                      {a.compras > 0 && (
                        <span className="ml-2 inline-block rounded-full bg-primary text-primary-foreground text-[9px] font-extrabold px-2 py-0.5">
                          {a.compras} venda{a.compras > 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(a.gasto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{intBR(a.impressoes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{intBR(a.cliques)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{intBR(a.compras)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
