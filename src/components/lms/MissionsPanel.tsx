import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMissions, type UserMission } from "@/hooks/useMissions";

// ─── MissionsPanel ───────────────────────────────────────────────────────────
// Painel de missões mensais. Mostra:
//   - Header: contagem de dias restantes do ciclo + miniatura "X de Y feitas"
//   - Lista de cards: cada missão tem ícone, título, descrição, barra de
//     progresso (se cumulativa) e botão de ação:
//       • "Resgatar +X 🪙" se completed e !claimed
//       • "Resgatado" se claimed
//       • "Em andamento" + barra se ainda nao completou
//
// Importante: o cap silencioso de moedas/ciclo NÃO é mostrado pro user.
// =============================================================================

const CATEGORY_LABEL: Record<string, string> = {
  login:    "Acesso",
  watch:    "Estudo",
  engage:   "Progresso",
  social:   "Comunidade",
  wellness: "Bem-estar",
  learn:    "Conhecimento",
  practice: "Prática",
};

const CATEGORY_ICON: Record<string, string> = {
  login:    "login",
  watch:    "play_circle",
  engage:   "auto_stories",
  social:   "groups",
  wellness: "spa",
  learn:    "menu_book",
  practice: "directions_car",
};

const CATEGORY_COLOR: Record<string, string> = {
  login:    "text-blue-500",
  watch:    "text-orange-500",
  engage:   "text-primary",
  social:   "text-emerald-500",
  wellness: "text-pink-500",
  learn:    "text-purple-500",
  practice: "text-cyan-500",
};

// Ordem de exibição dos grupos (mais "leves" primeiro pra reduzir fricção)
const CATEGORY_ORDER = ["login", "wellness", "social", "engage", "watch", "learn", "practice"];

type FilterMode = "all" | "ready" | "doing" | "done";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return diff;
}

function MissionCard({
  mission,
  onClaim,
  onSelfReport,
}: {
  mission: UserMission;
  onClaim: () => void;
  onSelfReport: () => void;
}) {
  const isClaimed = !!mission.claimed_at;
  const isReady = !!mission.completed_at && !isClaimed;
  const isSelfReport = mission.trigger_type === "self_report";
  const progress = Math.min(mission.progress_value, mission.trigger_target);
  const pct = mission.trigger_target > 0
    ? Math.round((progress / mission.trigger_target) * 100)
    : 0;
  const colorClass = CATEGORY_COLOR[mission.category] ?? "text-primary";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`relative bg-card border rounded-2xl p-4 transition-all ${
        isReady
          ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30"
          : isClaimed
          ? "border-border opacity-60"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`size-10 rounded-xl bg-accent/40 border border-border flex items-center justify-center shrink-0 ${colorClass}`}>
          <span className="material-symbols-outlined filled-icon text-xl">{mission.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-bold text-sm text-foreground leading-tight">{mission.title}</p>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 shrink-0">
              {CATEGORY_LABEL[mission.category] ?? mission.category}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug mb-2">{mission.description}</p>

          {/* Barra de progresso (só pra missões cumulativas E não self-report) */}
          {mission.trigger_target > 1 && !isClaimed && !isSelfReport && (
            <div className="mb-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isReady ? "bg-primary" : "bg-muted-foreground/40"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                {progress} / {mission.trigger_target}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
              🪙 {mission.reward_coins}
            </span>
            {isClaimed ? (
              <span className="text-[11px] font-bold text-emerald-500 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Resgatado
              </span>
            ) : isSelfReport ? (
              // Botão "Marcar como feita" pra missões manuais
              <button
                onClick={onSelfReport}
                className="px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">check</span>
                Fiz isso
              </button>
            ) : isReady ? (
              <button
                onClick={onClaim}
                className="px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Resgatar
              </button>
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                {DIFFICULTY_LABEL[mission.difficulty] ?? mission.difficulty}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function MissionsPanel() {
  const { missions, cycleEnd, loading, claim, selfReport } = useMissions();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    const total = missions.length;
    const completed = missions.filter((m) => m.completed_at).length;
    const claimed = missions.filter((m) => m.claimed_at).length;
    const ready = missions.filter((m) => m.completed_at && !m.claimed_at).length;
    return { total, completed, claimed, ready };
  }, [missions]);

  // Aplica filtro selecionado
  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (filter === "ready") return m.completed_at && !m.claimed_at;
      if (filter === "doing") return !m.completed_at;
      if (filter === "done")  return m.claimed_at;
      return true;
    });
  }, [missions, filter]);

  // Agrupa por categoria preservando ordem definida
  const grouped = useMemo(() => {
    const map = new Map<string, UserMission[]>();
    for (const m of filtered) {
      if (!map.has(m.category)) map.set(m.category, []);
      map.get(m.category)!.push(m);
    }
    // Ordena dentro do grupo: prontas pra resgatar primeiro, depois fazendo, depois feitas
    map.forEach((arr) => arr.sort((a, b) => {
      const sa = a.claimed_at ? 2 : a.completed_at ? 0 : 1;
      const sb = b.claimed_at ? 2 : b.completed_at ? 0 : 1;
      return sa - sb;
    }));
    // Retorna na ordem definida (categorias sem missões filtradas ficam de fora)
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, items: map.get(cat)! }));
  }, [filtered]);

  const daysLeft = daysUntil(cycleEnd);

  // Inicialmente abre apenas a categoria que tem missões prontas pra resgatar.
  // Se não tem nenhuma pronta, abre a primeira categoria.
  useEffect(() => {
    if (loading || Object.keys(openCats).length > 0) return;
    const initial: Record<string, boolean> = {};
    const firstReady = grouped.find((g) => g.items.some((m) => m.completed_at && !m.claimed_at));
    if (firstReady) initial[firstReady.category] = true;
    else if (grouped[0]) initial[grouped[0].category] = true;
    if (Object.keys(initial).length > 0) setOpenCats(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, grouped]);

  function toggleCat(cat: string) {
    setOpenCats((s) => ({ ...s, [cat]: !s[cat] }));
  }

  async function handleAction(m: UserMission, kind: "claim" | "self") {
    if (claiming) return;
    setClaiming(m.id);
    try {
      const result = kind === "self" ? await selfReport(m.id) : await claim(m.id);
      if (result?.granted_coins && result.granted_coins > 0) {
        toast.success(`+${result.granted_coins} 🪙 moedas!`, {
          description: `Pela missão "${m.title}"`,
          duration: 4000,
        });
      } else {
        // Cap silencioso atingido — toast neutro (não revela o motivo)
        toast.success("Missão concluída!", {
          description: "Continue assim, vem mais por aí.",
          duration: 3500,
        });
      }
    } catch (err: any) {
      console.warn("[missions] action error:", err);
      toast.error("Não foi possível registrar agora", {
        description: "Tenta de novo em instantes.",
      });
    } finally {
      setClaiming(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-[32px] border border-border p-6 mb-6">
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          Carregando missões…
        </div>
      </div>
    );
  }

  if (missions.length === 0) return null;

  const filterTabs: { id: FilterMode; label: string; count: number }[] = [
    { id: "all",   label: "Todas",     count: counts.total },
    { id: "ready", label: "Prontas",   count: counts.ready },
    { id: "doing", label: "Fazendo",   count: counts.total - counts.completed },
    { id: "done",  label: "Resgatadas", count: counts.claimed },
  ];

  return (
    <div className="bg-card rounded-[32px] border border-border p-5 md:p-6 mb-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div>
          <h3 className="font-black text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-primary filled-icon">target</span>
            Missões do Mês
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {counts.claimed} de {counts.total} resgatadas
            {counts.ready > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-bold">
                {counts.ready} pronta{counts.ready > 1 ? "s" : ""} 🎁
              </span>
            )}
            {daysLeft > 0 && <span> · termina em <strong>{daysLeft} dias</strong></span>}
          </p>
        </div>
      </div>

      {/* Filter tabs (mini pílulas) */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 hide-scrollbar">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
              filter === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Grupos por categoria — accordion */}
      <div className="space-y-2">
        {grouped.map(({ category, items }) => {
          const isOpen = !!openCats[category];
          const colorClass = CATEGORY_COLOR[category] ?? "text-primary";
          const readyInGroup = items.filter((m) => m.completed_at && !m.claimed_at).length;
          return (
            <div key={category} className="rounded-2xl border border-border overflow-hidden">
              <button
                onClick={() => toggleCat(category)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left ${
                  isOpen ? "bg-accent/30" : ""
                }`}
              >
                <span className={`material-symbols-outlined ${colorClass} filled-icon text-xl`}>
                  {CATEGORY_ICON[category] ?? "star"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">
                    {CATEGORY_LABEL[category] ?? category}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {items.length} missõ{items.length > 1 ? "es" : "ão"}
                    {readyInGroup > 0 && (
                      <span className="ml-1 text-primary font-bold">· {readyInGroup} pronta{readyInGroup > 1 ? "s" : ""} 🎁</span>
                    )}
                  </p>
                </div>
                <span className={`material-symbols-outlined text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 pt-2 space-y-2 bg-background/40">
                      {items.map((m) => (
                        <MissionCard
                          key={m.id}
                          mission={m}
                          onClaim={() => handleAction(m, "claim")}
                          onSelfReport={() => handleAction(m, "self")}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center mt-4 italic">
        ⚡ Novas missões a cada ciclo. As moedas viram desconto nos próximos cursos.
      </p>
    </div>
  );
}
