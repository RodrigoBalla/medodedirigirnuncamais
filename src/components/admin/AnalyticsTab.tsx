import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineUsers } from "@/hooks/usePresence";

interface PageView {
  id: string;
  user_id: string;
  page_path: string;
  page_name: string;
  entered_at: string;
  duration_seconds: number;
  click_count: number;
  referrer_path: string | null;
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Início",
  "/boas-vindas": "Boas-vindas",
  "/bem-vindo": "Bem-vindo",
  "/treinos": "Treinos",
  "/ranking": "Ranking",
  "/comunidade": "Comunidade",
  "/perfil": "Perfil",
  "/login": "Login",
  "/conclusao": "Conclusão",
};

type AnalyticsSubTab = "overview" | "pages" | "hours" | "flow" | "online";

export default function AnalyticsTab() {
  const [views, setViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<AnalyticsSubTab>("overview");
  const [days, setDays] = useState(7);
  const onlineUsers = useOnlineUsers();

  useEffect(() => {
    fetchViews();
  }, [days]);

  async function fetchViews() {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const { data } = await supabase
      .from("page_views")
      .select("*")
      .gte("entered_at", since.toISOString())
      .order("entered_at", { ascending: false })
      .limit(1000);

    if (data) setViews(data as PageView[]);
    setLoading(false);
  }

  // ── Computed analytics ──
  const pageStats = useMemo(() => {
    const map = new Map<string, { views: number; totalDuration: number; totalClicks: number }>();
    views.forEach((v) => {
      const existing = map.get(v.page_path) || { views: 0, totalDuration: 0, totalClicks: 0 };
      existing.views += 1;
      existing.totalDuration += v.duration_seconds;
      existing.totalClicks += v.click_count;
      map.set(v.page_path, existing);
    });
    return Array.from(map.entries())
      .map(([path, stats]) => ({
        path,
        name: PAGE_NAMES[path] || path,
        ...stats,
        avgDuration: Math.round(stats.totalDuration / stats.views),
      }))
      .sort((a, b) => b.views - a.views);
  }, [views]);

  const hourlyStats = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    views.forEach((v) => {
      const h = new Date(v.entered_at).getHours();
      hours[h].count += 1;
    });
    return hours;
  }, [views]);

  const maxHourly = Math.max(...hourlyStats.map((h) => h.count), 1);

  const navigationFlow = useMemo(() => {
    const flows = new Map<string, number>();
    views
      .filter((v) => v.referrer_path)
      .forEach((v) => {
        const key = `${v.referrer_path} → ${v.page_path}`;
        flows.set(key, (flows.get(key) || 0) + 1);
      });
    return Array.from(flows.entries())
      .map(([flow, count]) => ({ flow, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [views]);

  const totalViews = views.length;
  const uniqueUsers = new Set(views.map((v) => v.user_id)).size;
  const avgDuration = totalViews > 0 ? Math.round(views.reduce((a, v) => a + v.duration_seconds, 0) / totalViews) : 0;
  const totalClicks = views.reduce((a, v) => a + v.click_count, 0);

  const SUB_TABS: { key: AnalyticsSubTab; icon: string; label: string }[] = [
    { key: "overview", icon: "dashboard", label: "Visão Geral" },
    { key: "pages", icon: "web", label: "Páginas" },
    { key: "hours", icon: "schedule", label: "Horários" },
    { key: "flow", icon: "route", label: "Navegação" },
    { key: "online", icon: "circle", label: `Online (${onlineUsers.length})` },
  ];

  function formatDuration(s: number): string {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Analytics</h2>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {d}d
            </button>
          ))}
          <button onClick={fetchViews} className="ml-2 size-8 rounded-lg bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors">
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              subTab === t.key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Overview ─── */}
      {subTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: "visibility", label: "Visualizações", value: totalViews, color: "text-primary" },
              { icon: "group", label: "Usuários Únicos", value: uniqueUsers, color: "text-[hsl(var(--success))]" },
              { icon: "timer", label: "Tempo Médio", value: formatDuration(avgDuration), color: "text-[hsl(var(--yellow))]" },
              { icon: "touch_app", label: "Total de Cliques", value: totalClicks, color: "text-destructive" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                <span className={`material-symbols-outlined text-2xl ${kpi.color} filled-icon`}>{kpi.icon}</span>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Top pages quick view */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-4">Top 5 Páginas</h3>
            <div className="space-y-3">
              {pageStats.slice(0, 5).map((p) => (
                <div key={p.path} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">web</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">{p.views} views • {formatDuration(p.avgDuration)} média</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((p.views / (pageStats[0]?.views || 1)) * 100)}%`,
                          backgroundColor: "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Online now badge */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="material-symbols-outlined text-3xl text-[hsl(var(--success))] filled-icon">circle</span>
                <span className="absolute inset-0 animate-ping material-symbols-outlined text-3xl text-[hsl(var(--success))] filled-icon opacity-30">circle</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{onlineUsers.length}</p>
                <p className="text-xs text-muted-foreground">Usuários online agora</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Pages ─── */}
      {subTab === "pages" && (
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="grid grid-cols-5 gap-2 p-4 border-b border-border text-xs font-bold text-muted-foreground">
              <span className="col-span-2">Página</span>
              <span>Views</span>
              <span>Tempo Médio</span>
              <span>Cliques</span>
            </div>
            {pageStats.map((p) => (
              <div key={p.path} className="grid grid-cols-5 gap-2 p-4 border-b border-border last:border-0 items-center text-sm">
                <div className="col-span-2">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.path}</p>
                </div>
                <p className="font-bold">{p.views}</p>
                <p className="font-bold">{formatDuration(p.avgDuration)}</p>
                <p className="font-bold">{p.totalClicks}</p>
              </div>
            ))}
            {pageStats.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Sem dados no período selecionado
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Hours ─── */}
      {subTab === "hours" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-4">Atividade por Hora do Dia</h3>
            <div className="flex items-end gap-1 h-48">
              {hourlyStats.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${(h.count / maxHourly) * 100}%`,
                        minHeight: h.count > 0 ? "4px" : "0",
                        backgroundColor:
                          h.count === maxHourly
                            ? "hsl(var(--primary))"
                            : h.count > maxHourly * 0.7
                            ? "hsl(var(--primary) / 0.8)"
                            : h.count > maxHourly * 0.4
                            ? "hsl(var(--primary) / 0.5)"
                            : "hsl(var(--primary) / 0.2)",
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium">{h.hour}h</span>
                </div>
              ))}
            </div>

            {/* Peak hours summary */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(() => {
                const sorted = [...hourlyStats].sort((a, b) => b.count - a.count);
                const peak = sorted[0];
                const offPeak = sorted[sorted.length - 1];
                return [
                  { label: "Horário de Pico", value: `${peak.hour}:00`, count: peak.count, icon: "trending_up", color: "text-[hsl(var(--success))]" },
                  { label: "Menos Ativo", value: `${offPeak.hour}:00`, count: offPeak.count, icon: "trending_down", color: "text-destructive" },
                  { label: "Média/Hora", value: Math.round(totalViews / 24).toString(), count: null, icon: "avg_pace", color: "text-primary" },
                ].map((s) => (
                  <div key={s.label} className="bg-accent/50 rounded-xl p-3 text-center">
                    <span className={`material-symbols-outlined text-xl ${s.color} filled-icon`}>{s.icon}</span>
                    <p className="text-lg font-bold">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    {s.count !== null && <p className="text-[10px] text-muted-foreground">({s.count} views)</p>}
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Day distribution */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-4">Distribuição por Período</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Manhã (6-12h)", range: [6, 12], icon: "wb_sunny" },
                { label: "Tarde (12-18h)", range: [12, 18], icon: "wb_twilight" },
                { label: "Noite (18-6h)", range: [18, 30], icon: "nights_stay" },
              ].map((period) => {
                const count = hourlyStats
                  .filter((h) => {
                    const hour = h.hour;
                    if (period.range[0] < period.range[1]) return hour >= period.range[0] && hour < period.range[1];
                    return hour >= period.range[0] || hour < period.range[1] - 24;
                  })
                  .reduce((a, h) => a + h.count, 0);
                return (
                  <div key={period.label} className="bg-accent/50 rounded-xl p-4 text-center">
                    <span className="material-symbols-outlined text-2xl text-primary filled-icon">{period.icon}</span>
                    <p className="text-xl font-bold mt-1">{count}</p>
                    <p className="text-[10px] text-muted-foreground">{period.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Flow ─── */}
      {subTab === "flow" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-4">Fluxos de Navegação Mais Comuns</h3>
            {navigationFlow.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Dados de navegação ainda estão sendo coletados
              </p>
            ) : (
              <div className="space-y-2">
                {navigationFlow.map((f, i) => (
                  <div key={f.flow} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}.</span>
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      {f.flow.split(" → ").map((page, pi) => (
                        <div key={pi} className="flex items-center gap-1">
                          {pi > 0 && (
                            <span className="material-symbols-outlined text-xs text-muted-foreground">arrow_forward</span>
                          )}
                          <span className="px-2 py-1 bg-accent rounded-md text-xs font-medium">
                            {PAGE_NAMES[page] || page}
                          </span>
                        </div>
                      ))}
                    </div>
                    <span className="text-sm font-bold text-primary">{f.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Entry pages */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-4">Páginas de Entrada (sem referência)</h3>
            <div className="space-y-2">
              {(() => {
                const entries = new Map<string, number>();
                views
                  .filter((v) => !v.referrer_path)
                  .forEach((v) => entries.set(v.page_path, (entries.get(v.page_path) || 0) + 1));
                return Array.from(entries.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([path, count]) => (
                    <div key={path} className="flex items-center justify-between py-1.5">
                      <span className="text-sm font-medium">{PAGE_NAMES[path] || path}</span>
                      <span className="text-xs font-bold text-muted-foreground">{count} entradas</span>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Online Now ─── */}
      {subTab === "online" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="size-3 rounded-full bg-[hsl(var(--success))]" />
                <div className="absolute inset-0 size-3 rounded-full bg-[hsl(var(--success))] animate-ping opacity-40" />
              </div>
              <h3 className="font-bold text-sm">
                {onlineUsers.length} {onlineUsers.length === 1 ? "usuário" : "usuários"} online agora
              </h3>
            </div>

            {onlineUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <span className="material-symbols-outlined text-4xl mb-2 block">person_off</span>
                <p className="text-sm">Nenhum usuário online no momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {onlineUsers.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {u.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[hsl(var(--success))] border-2 border-card" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Em: {PAGE_NAMES[u.page_path] || u.page_path}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(u.last_seen).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
