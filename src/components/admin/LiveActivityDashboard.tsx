import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, LineSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { supabase } from "@/integrations/supabase/client";

// ─── LiveActivityDashboard ───────────────────────────────────────────────────
// Dashboard ao vivo da area de membros:
//   • 7 KPI cards (hoje vs ontem)
//   • Gráfico CANDLESTICK diário (OHLC de atividade)
//   • 2 séries de linha sobreposta (aulas + spins por dia)
//   • Feed de eventos em tempo real (atualiza a cada 10s + subscription)
//
// Tudo via RPCs SECURITY DEFINER (admin_dashboard_kpis, admin_activity_candles,
// admin_daily_series, admin_recent_events) que só admins podem chamar.
// =============================================================================

interface Kpi {
  metric: string;
  today_count: number;
  yesterday_count: number;
  total_count: number;
}

interface Candle {
  day: string;          // YYYY-MM-DD
  open_count: number;
  high_count: number;
  low_count: number;
  close_count: number;
  total_count: number;
}

interface SeriesPoint { day: string; value: number; }

interface EventRow {
  user_id: string;
  display_name: string | null;
  kind: string;
  at: string;
}

const KPI_META: Record<string, { icon: string; label: string; color: string }> = {
  active_users:  { icon: "group",                label: "Alunos Ativos Hoje",  color: "text-emerald-500" },
  lessons:       { icon: "school",               label: "Aulas Concluídas",    color: "text-blue-500" },
  wheel_spins:   { icon: "casino",               label: "Roletas Giradas",     color: "text-amber-500" },
  coupons:       { icon: "savings",              label: "Cupons Gerados",      color: "text-purple-500" },
  posts:         { icon: "forum",                label: "Posts na Comunidade", color: "text-pink-500" },
  missions_done: { icon: "task_alt",             label: "Missões Concluídas",  color: "text-cyan-500" },
  total_events:  { icon: "bolt",                 label: "Eventos Totais",      color: "text-primary" },
};

const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  lesson:        { icon: "play_circle",          label: "Aula assistida",       color: "text-blue-500" },
  coin_tx:       { icon: "database",             label: "Transação de moedas",  color: "text-yellow-500" },
  wheel_spin:    { icon: "casino",               label: "Girou a Roleta",       color: "text-amber-500" },
  coupon:        { icon: "savings",              label: "Cupom gerado",         color: "text-purple-500" },
  post:          { icon: "forum",                label: "Postou na Comunidade", color: "text-pink-500" },
  like:          { icon: "favorite",             label: "Curtiu um post",       color: "text-rose-500" },
  save:          { icon: "bookmark",             label: "Salvou um post",       color: "text-indigo-500" },
  mission_done:  { icon: "task_alt",             label: "Concluiu missão",      color: "text-cyan-500" },
  page_view:     { icon: "visibility",           label: "Visualizou página",    color: "text-muted-foreground" },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDelta(today: number, yesterday: number): { text: string; up: boolean | null } {
  if (yesterday === 0 && today === 0) return { text: "—", up: null };
  if (yesterday === 0) return { text: "novo!", up: true };
  const diff = today - yesterday;
  const pct = Math.round((diff / yesterday) * 100);
  return { text: `${pct >= 0 ? "+" : ""}${pct}% vs ontem`, up: pct >= 0 };
}

export function LiveActivityDashboard() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lessonsSeries, setLessonsSeries] = useState<SeriesPoint[]>([]);
  const [spinsSeries, setSpinsSeries] = useState<SeriesPoint[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 14 | 30>(14);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lessonsSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const spinsSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // ─── Fetch all ────────────────────────────────────────────────────────────
  async function fetchAll() {
    const [kpiRes, candleRes, lessonsRes, spinsRes, eventsRes] = await Promise.all([
      supabase.rpc("admin_dashboard_kpis"),
      supabase.rpc("admin_activity_candles", { p_days: period }),
      supabase.rpc("admin_daily_series", { p_metric: "lesson", p_days: period }),
      supabase.rpc("admin_daily_series", { p_metric: "wheel_spin", p_days: period }),
      supabase.rpc("admin_recent_events", { p_limit: 30 }),
    ]);

    if (kpiRes.data) setKpis(kpiRes.data as Kpi[]);
    if (candleRes.data) setCandles(candleRes.data as Candle[]);
    if (lessonsRes.data) setLessonsSeries(lessonsRes.data as SeriesPoint[]);
    if (spinsRes.data) setSpinsSeries(spinsRes.data as SeriesPoint[]);
    if (eventsRes.data) setEvents(eventsRes.data as EventRow[]);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  // Refresh automático a cada 30s
  useEffect(() => {
    const id = setInterval(() => fetchAll(), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // ─── Inicialização do chart ────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "Inter, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
        borderColor: "rgba(148, 163, 184, 0.2)",
      },
      rightPriceScale: { borderColor: "rgba(148, 163, 184, 0.2)" },
      crosshair: { mode: 1 },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    const lessonsLine = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "Aulas",
    });
    lessonsSeriesRef.current = lessonsLine;

    const spinsLine = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "Roleta",
    });
    spinsSeriesRef.current = spinsLine;

    chartApiRef.current = chart;

    return () => {
      chart.remove();
      chartApiRef.current = null;
    };
  }, []);

  // ─── Atualiza dados do chart quando arrays mudam ───────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const data = candles.map((c) => ({
      time: c.day,
      open: c.open_count,
      high: c.high_count,
      low: c.low_count,
      close: c.close_count,
    }));
    candleSeriesRef.current.setData(data as never);
    if (data.length > 0 && chartApiRef.current) chartApiRef.current.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    if (!lessonsSeriesRef.current) return;
    lessonsSeriesRef.current.setData(lessonsSeries.map((p) => ({ time: p.day, value: p.value })) as never);
  }, [lessonsSeries]);

  useEffect(() => {
    if (!spinsSeriesRef.current) return;
    spinsSeriesRef.current.setData(spinsSeries.map((p) => ({ time: p.day, value: p.value })) as never);
  }, [spinsSeries]);

  // ─── Realtime subscriptions (atualiza feed quando algo muda) ───────────────
  useEffect(() => {
    const channel = supabase
      .channel("admin-live-dashboard")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lesson_progress" }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "daily_wheel_spins" }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "coin_transactions" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── KPIs ordenados ────────────────────────────────────────────────────────
  const kpiOrdered = useMemo(() => {
    const order = ["active_users", "total_events", "lessons", "wheel_spins", "missions_done", "posts", "coupons"];
    return order.map((m) => kpis.find((k) => k.metric === m)).filter(Boolean) as Kpi[];
  }, [kpis]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined animate-spin text-primary mr-2">progress_activity</span>
        <span className="text-sm text-muted-foreground">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-black text-xl md:text-2xl text-foreground tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined filled-icon text-emerald-500">monitoring</span>
            Dashboard ao Vivo
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              REALTIME
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Eventos atualizam automaticamente — refresh a cada 30s + push via Realtime
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d as 7 | 14 | 30)}
              className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-colors ${
                period === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpiOrdered.map((k) => {
          const meta = KPI_META[k.metric];
          if (!meta) return null;
          const delta = formatDelta(Number(k.today_count), Number(k.yesterday_count));
          return (
            <div key={k.metric} className="bg-card border border-border rounded-2xl p-3 md:p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`material-symbols-outlined ${meta.color} filled-icon text-lg`}>{meta.icon}</span>
                {delta.up !== null && (
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    delta.up ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {delta.up ? "▲" : "▼"}
                  </span>
                )}
              </div>
              <p className="text-2xl md:text-3xl font-black text-foreground leading-none mb-1">{k.today_count}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                {meta.label}
              </p>
              <p className={`text-[10px] font-medium ${
                delta.up === true ? "text-emerald-500" : delta.up === false ? "text-rose-500" : "text-muted-foreground"
              }`}>
                {delta.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Chart container */}
      <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-black text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">candlestick_chart</span>
              Atividade Diária (Candles)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Cada candle = 1 dia · OHLC vem da distribuição de eventos por hora dentro do dia
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1"><span className="size-2 bg-emerald-500 rounded-sm" /> alta</span>
            <span className="flex items-center gap-1"><span className="size-2 bg-rose-500 rounded-sm" /> baixa</span>
            <span className="flex items-center gap-1"><span className="size-2 bg-blue-500 rounded-sm" /> aulas</span>
            <span className="flex items-center gap-1"><span className="size-2 bg-amber-500 rounded-sm" /> roleta</span>
          </div>
        </div>
        <div ref={chartContainerRef} className="w-full h-[360px]" />
      </div>

      {/* Feed Realtime */}
      <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
        <h3 className="font-black text-base text-foreground flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary">rss_feed</span>
          Feed em Tempo Real
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            últimos {events.length}
          </span>
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sem eventos ainda. Quando as alunas começarem a usar, aparece aqui.</p>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {events.map((e, i) => {
              const meta = EVENT_META[e.kind] ?? { icon: "circle", label: e.kind, color: "text-muted-foreground" };
              return (
                <div
                  key={`${e.user_id}-${e.at}-${i}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors"
                >
                  <span className={`material-symbols-outlined filled-icon ${meta.color} text-base shrink-0`}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {e.display_name || "Aluno"} <span className="text-muted-foreground font-medium">{meta.label.toLowerCase()}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">{timeAgo(e.at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
