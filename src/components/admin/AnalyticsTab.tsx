import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineUsers } from "@/hooks/usePresence";
import { PHASES } from "@/data/driving-data";

/* ─── Types ─── */
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

interface StudentProgress {
  user_id: string;
  display_name?: string;
  total_xp: number;
  coins: number;
  lives: number;
  streak: number;
  confidence: number;
  completed_phases: number[];
  badges: string[];
  daily_xp: number;
  daily_lessons: number;
  updated_at: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  display_name: string;
  created_at: string;
}

interface Product {
  id: string;
  title: string;
  created_at: string;
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Início", "/boas-vindas": "Boas-vindas", "/bem-vindo": "Bem-vindo",
  "/treinos": "Treinos", "/ranking": "Ranking", "/comunidade": "Comunidade",
  "/perfil": "Perfil", "/login": "Login", "/conclusao": "Conclusão",
};

export default function AnalyticsTab() {
  const [views, setViews] = useState<PageView[]>([]);
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const onlineUsers = useOnlineUsers();

  useEffect(() => { fetchAll(); }, [days]);

  async function fetchAll() {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [viewsRes, progressRes, profilesRes, productsRes] = await Promise.all([
      supabase.from("page_views").select("*").gte("entered_at", since.toISOString()).order("entered_at", { ascending: false }).limit(5000),
      supabase.from("user_progress").select("*"),
      supabase.from("profiles").select("user_id, display_name, created_at"),
      supabase.from("products").select("id, title, created_at"),
    ]);

    if (viewsRes.data) setViews(viewsRes.data as PageView[]);
    if (progressRes.data) setProgress(progressRes.data as StudentProgress[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    setLoading(false);
  }

  /* ─── Student Journey Funnel ─── */
  const totalStudents = profiles.length;
  const premiumCourseCount = products.length;

  const journeyFunnel = useMemo(() => {
    const steps = [
      {
        id: "signup",
        label: "Cadastro Gratuito",
        desc: "Se cadastraram na plataforma",
        icon: "person_add",
        color: "from-blue-500 to-blue-600",
        count: totalStudents,
      },
      {
        id: "first_access",
        label: "Primeiro Acesso",
        desc: "Fizeram login e acessaram a plataforma",
        icon: "login",
        color: "from-cyan-500 to-cyan-600",
        count: progress.length,
      },
      ...PHASES.map((phase, i) => ({
        id: `phase_${i}`,
        label: `${phase.icon} ${phase.title.replace("Fase " + (i + 1) + " — ", "")}`,
        desc: phase.subtitle,
        icon: i === 0 ? "directions_car" : i === 1 ? "settings" : "flag",
        color: i === 0 ? "from-green-500 to-green-600" : i === 1 ? "from-emerald-500 to-teal-600" : "from-yellow-500 to-amber-600",
        count: progress.filter(p => p.completed_phases.includes(i)).length,
      })),
    ];

    // Premium courses as final steps
    if (premiumCourseCount > 0) {
      steps.push({
        id: "premium_interest",
        label: "💎 Interesse Premium",
        desc: "Acumularam 100+ moedas para comprar",
        icon: "paid",
        color: "from-purple-500 to-purple-600",
        count: progress.filter(p => p.coins >= 100 || p.total_xp >= 300).length,
      });
    }

    return steps;
  }, [progress, totalStudents, premiumCourseCount]);

  /* ─── Drop-off Analysis ─── */
  const dropOffAnalysis = useMemo(() => {
    return journeyFunnel.slice(1).map((step, i) => {
      const prev = journeyFunnel[i];
      const dropOff = prev.count > 0 ? prev.count - step.count : 0;
      const dropPct = prev.count > 0 ? Math.round((dropOff / prev.count) * 100) : 0;
      return {
        from: prev.label,
        to: step.label,
        dropped: dropOff,
        dropPct,
        severity: dropPct >= 50 ? "critical" : dropPct >= 25 ? "warning" : "healthy",
      };
    });
  }, [journeyFunnel]);

  /* ─── Phase engagement breakdown ─── */
  const phaseEngagement = useMemo(() => {
    return PHASES.map((phase, i) => {
      const studentsInPhase = progress.filter(p => p.completed_phases.includes(i));
      const avgXP = studentsInPhase.length > 0 ? Math.round(studentsInPhase.reduce((a, p) => a + p.total_xp, 0) / studentsInPhase.length) : 0;
      const avgCoins = studentsInPhase.length > 0 ? Math.round(studentsInPhase.reduce((a, p) => a + p.coins, 0) / studentsInPhase.length) : 0;
      return {
        name: phase.title.replace(/Fase \d+ — /, ""),
        icon: phase.icon,
        completionCount: studentsInPhase.length,
        completionRate: totalStudents > 0 ? Math.round((studentsInPhase.length / totalStudents) * 100) : 0,
        avgXP,
        avgCoins,
        xpReward: phase.xp,
      };
    });
  }, [progress, totalStudents]);

  /* ─── Student Segments ─── */
  const studentSegments = useMemo(() => {
    const now = Date.now();
    const segments = {
      powerUsers: [] as { name: string; xp: number; phases: number; coins: number }[],
      atRisk: [] as { name: string; daysSince: number; phases: number }[],
      newbies: [] as { name: string; created: string }[],
    };

    progress.forEach(p => {
      const profile = profiles.find(pr => pr.user_id === p.user_id);
      const name = profile?.display_name || "Anônimo";
      const daysSinceActive = Math.floor((now - new Date(p.updated_at || p.created_at).getTime()) / 86400000);

      if (p.total_xp >= 200 && daysSinceActive <= 3) {
        segments.powerUsers.push({ name, xp: p.total_xp, phases: p.completed_phases.length, coins: p.coins });
      }
      if (daysSinceActive >= 7 && p.completed_phases.length < PHASES.length) {
        segments.atRisk.push({ name, daysSince: daysSinceActive, phases: p.completed_phases.length });
      }
      if (daysSinceActive <= 3 && p.total_xp <= 50) {
        segments.newbies.push({ name, created: profile?.created_at || p.created_at });
      }
    });

    return segments;
  }, [progress, profiles]);

  /* ─── Engagement Heatmap (hourly) ─── */
  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    views.forEach(v => { hours[new Date(v.entered_at).getHours()].count += 1; });
    return hours;
  }, [views]);
  const maxHourly = Math.max(...hourlyActivity.map(h => h.count), 1);

  /* ─── Daily trend ─── */
  const dailyTrend = useMemo(() => {
    const map = new Map<string, { views: number; uniqueUsers: Set<string> }>();
    views.forEach(v => {
      const day = new Date(v.entered_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const entry = map.get(day) || { views: 0, uniqueUsers: new Set<string>() };
      entry.views += 1;
      entry.uniqueUsers.add(v.user_id);
      map.set(day, entry);
    });
    return Array.from(map.entries()).map(([day, d]) => ({ day, views: d.views, users: d.uniqueUsers.size })).reverse().slice(-14);
  }, [views]);
  const maxDaily = Math.max(...dailyTrend.map(d => d.views), 1);

  /* ─── Page engagement ─── */
  const pageEngagement = useMemo(() => {
    const map = new Map<string, { views: number; totalDuration: number; clicks: number }>();
    views.forEach(v => {
      const e = map.get(v.page_path) || { views: 0, totalDuration: 0, clicks: 0 };
      e.views += 1;
      e.totalDuration += v.duration_seconds;
      e.clicks += v.click_count;
      map.set(v.page_path, e);
    });
    return Array.from(map.entries())
      .map(([path, s]) => ({ path, name: PAGE_NAMES[path] || path, ...s, avgDuration: Math.round(s.totalDuration / s.views) }))
      .sort((a, b) => b.views - a.views);
  }, [views]);

  /* ─── Coin economy ─── */
  const coinEconomy = useMemo(() => {
    const total = progress.reduce((a, p) => a + p.coins, 0);
    const avg = progress.length > 0 ? Math.round(total / progress.length) : 0;
    const rich = progress.filter(p => p.coins >= 100).length;
    const broke = progress.filter(p => p.coins === 0).length;
    const median = progress.length > 0 ? [...progress].sort((a, b) => a.coins - b.coins)[Math.floor(progress.length / 2)].coins : 0;
    return { total, avg, rich, broke, median };
  }, [progress]);

  const totalViews = views.length;
  const uniqueViewUsers = new Set(views.map(v => v.user_id)).size;

  function fmt(s: number): string {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h${m % 60}m` : `${m}m`;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando métricas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black">Jornada do Aluno</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Funil completo: do cadastro até a última aula</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
            >{d}d</button>
          ))}
          <button onClick={fetchAll} className="ml-1 size-8 rounded-lg bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors">
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  MAIN JOURNEY FUNNEL  ════════════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary filled-icon text-xl">conversion_path</span>
          <h3 className="font-black text-base">Funil da Jornada Completa</h3>
        </div>

        <div className="space-y-0">
          {journeyFunnel.map((step, i) => {
            const pct = totalStudents > 0 ? Math.round((step.count / totalStudents) * 100) : (step.count > 0 ? 100 : 0);
            const barWidth = Math.max(pct, step.count > 0 ? 8 : 0);
            const isLast = i === journeyFunnel.length - 1;
            const prevCount = i > 0 ? journeyFunnel[i - 1].count : step.count;
            const dropOff = i > 0 && prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;

            return (
              <div key={step.id}>
                {/* Step Row */}
                <div className="flex items-center gap-3 py-3">
                  {/* Step number */}
                  <div className={`size-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shrink-0 shadow-lg`}>
                    <span className="material-symbols-outlined text-white text-lg filled-icon">{step.icon}</span>
                  </div>

                  {/* Info + Bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-sm font-bold leading-tight">{step.label}</p>
                        <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xl font-black leading-none">{step.count}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">{pct}%</p>
                      </div>
                    </div>
                    {/* Funnel bar — tapered shape */}
                    <div className="h-5 bg-muted/50 rounded-lg overflow-hidden">
                      <div
                        className={`h-full rounded-lg bg-gradient-to-r ${step.color} transition-all duration-700 ease-out flex items-center justify-end pr-1`}
                        style={{ width: `${barWidth}%` }}
                      >
                        {pct >= 15 && <span className="text-[9px] text-white/90 font-black">{pct}%</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drop-off indicator between steps */}
                {!isLast && dropOff > 0 && (
                  <div className="flex items-center gap-3 py-1 ml-5">
                    <div className="w-5 flex justify-center">
                      <div className="w-px h-5 bg-border" />
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      dropOff >= 50 ? "bg-red-500/10 text-red-500" : dropOff >= 25 ? "bg-orange-500/10 text-orange-500" : "bg-green-500/10 text-green-500"
                    }`}>
                      <span className="material-symbols-outlined text-xs">
                        {dropOff >= 50 ? "warning" : dropOff >= 25 ? "info" : "check_circle"}
                      </span>
                      -{dropOff}% queda ({prevCount - step.count} {prevCount - step.count === 1 ? "aluno" : "alunos"})
                    </div>
                  </div>
                )}
                {!isLast && dropOff === 0 && (
                  <div className="flex items-center gap-3 py-0.5 ml-5">
                    <div className="w-5 flex justify-center">
                      <div className="w-px h-4 bg-border/50" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  DROP-OFF INSIGHTS  ══════════════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-orange-500 filled-icon text-lg">report</span>
          <h3 className="font-black text-sm">Análise de Abandono</h3>
        </div>
        <div className="space-y-2">
          {dropOffAnalysis.map((d) => (
            <div key={`${d.from}-${d.to}`} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30">
              <div className={`size-8 rounded-lg flex items-center justify-center ${
                d.severity === "critical" ? "bg-red-500/20" : d.severity === "warning" ? "bg-orange-500/20" : "bg-green-500/20"
              }`}>
                <span className={`material-symbols-outlined text-sm filled-icon ${
                  d.severity === "critical" ? "text-red-500" : d.severity === "warning" ? "text-orange-500" : "text-green-500"
                }`}>
                  {d.severity === "critical" ? "error" : d.severity === "warning" ? "warning" : "check_circle"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">
                  <span className="text-muted-foreground">De</span> {d.from} <span className="text-muted-foreground">→</span> {d.to}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-black ${
                  d.severity === "critical" ? "text-red-500" : d.severity === "warning" ? "text-orange-500" : "text-green-500"
                }`}>
                  -{d.dropPct}%
                </p>
                <p className="text-[9px] text-muted-foreground">{d.dropped} saíram</p>
              </div>
            </div>
          ))}
          {dropOffAnalysis.every(d => d.dropped === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum abandono detectado no período 🎉</p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  KPI GRID  ══════════════════════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: "group", label: "Total Cadastrados", value: totalStudents, color: "text-blue-500", bg: "bg-blue-500/10" },
          { icon: "trending_up", label: "Taxa Conversão Geral", value: `${totalStudents > 0 ? Math.round((progress.filter(p => p.completed_phases.length >= PHASES.length).length / totalStudents) * 100) : 0}%`, color: "text-green-500", bg: "bg-green-500/10", sub: "cadastro → conclusão total" },
          { icon: "paid", label: "Economia Moedas", value: coinEconomy.total, color: "text-yellow-500", bg: "bg-yellow-500/10", sub: `Média ${coinEconomy.avg} por aluno` },
          { icon: "visibility", label: "Engajamento", value: totalViews, color: "text-primary", bg: "bg-primary/10", sub: `${uniqueViewUsers} únicos em ${days}d` },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4">
            <div className={`size-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-2`}>
              <span className={`material-symbols-outlined text-lg ${kpi.color} filled-icon`}>{kpi.icon}</span>
            </div>
            <p className="text-2xl font-black">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{kpi.label}</p>
            {(kpi as any).sub && <p className="text-[9px] text-muted-foreground mt-0.5">{(kpi as any).sub}</p>}
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  PHASE ENGAGEMENT DEEP DIVE  ════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary filled-icon text-lg">school</span>
          <h3 className="font-black text-sm">Engajamento por Fase</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {phaseEngagement.map((phase) => (
            <div key={phase.name} className="bg-accent/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{phase.icon}</span>
                <div>
                  <p className="text-sm font-bold">{phase.name}</p>
                  <p className="text-[10px] text-muted-foreground">{phase.completionCount} concluíram ({phase.completionRate}%)</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-3 bg-muted rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${phase.completionRate}%`, minWidth: phase.completionCount > 0 ? "8px" : "0" }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs font-black text-primary">{phase.xpReward}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">XP/FASE</p>
                </div>
                <div>
                  <p className="text-xs font-black">{phase.avgXP}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">XP MÉD</p>
                </div>
                <div>
                  <p className="text-xs font-black text-yellow-500">{phase.avgCoins}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">MOEDAS MÉD</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  STUDENT SEGMENTS  ══════════════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Power Users */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-500 filled-icon text-base">bolt</span>
            </div>
            <div>
              <p className="text-xs font-black">Power Users</p>
              <p className="text-[9px] text-muted-foreground">200+ XP · Ativos 3d</p>
            </div>
            <span className="ml-auto text-lg font-black text-yellow-500">{studentSegments.powerUsers.length}</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {studentSegments.powerUsers.map((u) => (
              <div key={u.name} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-accent/30">
                <span className="font-bold truncate">{u.name}</span>
                <span className="text-muted-foreground shrink-0">⚡{u.xp} 💰{u.coins}</span>
              </div>
            ))}
            {studentSegments.powerUsers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">—</p>}
          </div>
        </div>

        {/* At Risk */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-500 filled-icon text-base">warning</span>
            </div>
            <div>
              <p className="text-xs font-black">Em Risco</p>
              <p className="text-[9px] text-muted-foreground">Inativos 7d+</p>
            </div>
            <span className="ml-auto text-lg font-black text-orange-500">{studentSegments.atRisk.length}</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {studentSegments.atRisk.map((u) => (
              <div key={u.name} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-accent/30">
                <span className="font-bold truncate">{u.name}</span>
                <span className="text-red-500 shrink-0">{u.daysSince}d sem acessar</span>
              </div>
            ))}
            {studentSegments.atRisk.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum 🎉</p>}
          </div>
        </div>

        {/* Newbies */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-500 filled-icon text-base">waving_hand</span>
            </div>
            <div>
              <p className="text-xs font-black">Novatos</p>
              <p className="text-[9px] text-muted-foreground">Cadastrados 3d</p>
            </div>
            <span className="ml-auto text-lg font-black text-green-500">{studentSegments.newbies.length}</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {studentSegments.newbies.map((u) => (
              <div key={u.name} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-accent/30">
                <span className="font-bold truncate">{u.name}</span>
                <span className="text-muted-foreground shrink-0">{new Date(u.created).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
            {studentSegments.newbies.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">—</p>}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  DAILY TREND + HEATMAP  ═════════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Daily activity */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary filled-icon text-lg">show_chart</span>
            <h3 className="font-black text-sm">Atividade Diária</h3>
          </div>
          {dailyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
          ) : (
            <div className="flex items-end gap-[3px] h-36">
              {dailyTrend.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${d.day}: ${d.views} views, ${d.users} usuários`}>
                  <span className="text-[7px] text-muted-foreground font-bold opacity-0 group-hover:opacity-100 transition-opacity">{d.views}</span>
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full rounded-t bg-gradient-to-t from-primary to-primary/50 transition-all group-hover:from-primary group-hover:to-primary/80"
                      style={{ height: `${(d.views / maxDaily) * 100}%`, minHeight: d.views > 0 ? "3px" : "0" }} />
                  </div>
                  <span className="text-[7px] text-muted-foreground leading-none">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hourly heatmap */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary filled-icon text-lg">schedule</span>
            <h3 className="font-black text-sm">Horários de Pico</h3>
          </div>
          <div className="flex items-end gap-[2px] h-36">
            {hourlyActivity.map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${h.hour}h: ${h.count} acessos`}>
                <span className="text-[7px] text-muted-foreground font-bold opacity-0 group-hover:opacity-100 transition-opacity">{h.count}</span>
                <div className="w-full flex-1 flex items-end">
                  <div className="w-full rounded-t transition-all"
                    style={{
                      height: `${(h.count / maxHourly) * 100}%`,
                      minHeight: h.count > 0 ? "3px" : "0",
                      backgroundColor: h.count >= maxHourly * 0.8 ? "hsl(var(--primary))" : h.count >= maxHourly * 0.4 ? "hsl(var(--primary) / 0.6)" : "hsl(var(--primary) / 0.2)",
                    }} />
                </div>
                <span className="text-[7px] text-muted-foreground leading-none">{h.hour}h</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-[10px] text-muted-foreground">
            <span>Pico: <strong className="text-foreground">{[...hourlyActivity].sort((a, b) => b.count - a.count)[0]?.hour}h</strong></span>
            <span>Online agora: <strong className="text-green-500">{onlineUsers.length}</strong></span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  WHERE STUDENTS ENGAGE MOST  ════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary filled-icon text-lg">pin_drop</span>
          <h3 className="font-black text-sm">Onde os Alunos Passam Mais Tempo</h3>
        </div>
        <div className="space-y-2">
          {pageEngagement.slice(0, 8).map((p, i) => (
            <div key={p.path} className="flex items-center gap-3">
              <span className={`text-sm font-black w-6 text-center ${i < 3 ? "text-yellow-500" : "text-muted-foreground"}`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-bold">{p.name}</span>
                  <span className="text-muted-foreground">{p.views} views · {fmt(p.avgDuration)} avg · {p.clicks} cliques</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(p.views / (pageEngagement[0]?.views || 1)) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
          {pageEngagement.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ═══  COINS ECONOMY  ═════════════════ */}
      {/* ═══════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-yellow-500 filled-icon text-lg">account_balance</span>
          <h3 className="font-black text-sm">Economia de Moedas</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Em Circulação", value: coinEconomy.total, color: "text-yellow-500" },
            { label: "Média/Aluno", value: coinEconomy.avg, color: "text-foreground" },
            { label: "Mediana", value: coinEconomy.median, color: "text-foreground" },
            { label: "100+ Moedas", value: coinEconomy.rich, color: "text-green-500" },
            { label: "Sem Moedas", value: coinEconomy.broke, color: "text-red-500" },
          ].map((s) => (
            <div key={s.label} className="bg-accent/30 rounded-xl p-3 text-center">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
