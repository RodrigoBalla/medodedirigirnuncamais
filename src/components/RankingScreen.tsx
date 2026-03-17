interface RankingScreenProps {
  displayName: string;
  totalXP: number;
}

const MOCK_RANKINGS = [
  { name: "Sarah J.", xp: 15200, level: "Mestre", avatar: "S" },
  { name: "Marco R.", xp: 12450, level: "Avançado", avatar: "M" },
  { name: "Leo K.", xp: 10800, level: "Avançado", avatar: "L" },
  { name: "Julian P.", xp: 9240, level: "Intermediário", avatar: "J" },
  { name: "Elena V.", xp: 8950, level: "Intermediário", avatar: "E" },
  { name: "Thomas W.", xp: 8100, level: "Intermediário", avatar: "T" },
  { name: "Mia K.", xp: 7680, level: "Iniciante", avatar: "K" },
];

export function RankingScreen({ displayName, totalXP }: RankingScreenProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <span className="material-symbols-outlined text-primary text-3xl">sports_score</span>
        <h1 className="text-2xl font-bold tracking-tight">Ranking</h1>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-3 mb-10 px-4">
        {/* 2nd */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative mb-2">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-muted bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
              {MOCK_RANKINGS[1].avatar}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-muted-foreground text-card rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs">2</div>
          </div>
          <p className="font-bold text-sm text-center">{MOCK_RANKINGS[1].name}</p>
          <p className="text-primary text-xs font-medium">{MOCK_RANKINGS[1].xp.toLocaleString()} XP</p>
          <div className="w-full mt-3 h-20 bg-gradient-to-t from-muted to-muted/50 rounded-t-xl border-x border-t border-border flex items-center justify-center">
            <span className="material-symbols-outlined text-muted-foreground text-3xl">emoji_events</span>
          </div>
        </div>

        {/* 1st */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative mb-3">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-500">
              <span className="material-symbols-outlined filled-icon text-2xl">workspace_premium</span>
            </div>
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-primary bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shadow-lg">
              {MOCK_RANKINGS[0].avatar}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm">1</div>
          </div>
          <p className="font-bold text-base text-center">{MOCK_RANKINGS[0].name}</p>
          <p className="text-primary text-sm font-bold">{MOCK_RANKINGS[0].xp.toLocaleString()} XP</p>
          <div className="w-full mt-3 h-28 bg-gradient-to-t from-primary/20 to-primary/10 rounded-t-xl border-x border-t border-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-4xl">military_tech</span>
          </div>
        </div>

        {/* 3rd */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative mb-2">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-accent bg-accent flex items-center justify-center text-xl font-bold text-accent-foreground">
              {MOCK_RANKINGS[2].avatar}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-accent-foreground text-accent rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs">3</div>
          </div>
          <p className="font-bold text-sm text-center">{MOCK_RANKINGS[2].name}</p>
          <p className="text-primary text-xs font-medium">{MOCK_RANKINGS[2].xp.toLocaleString()} XP</p>
          <div className="w-full mt-3 h-16 bg-gradient-to-t from-accent to-accent/50 rounded-t-xl border-x border-t border-border flex items-center justify-center">
            <span className="material-symbols-outlined text-accent-foreground opacity-60 text-2xl">emoji_events</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2 mb-3">Classificação</h3>
        {MOCK_RANKINGS.slice(3).map((r, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
            <span className="w-8 text-center font-bold text-muted-foreground">{i + 4}</span>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {r.avatar}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{r.name}</h4>
              <p className="text-xs text-muted-foreground">{r.level}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-primary">{r.xp.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">XP</p>
            </div>
          </div>
        ))}
      </div>

      {/* Current user position */}
      <div className="sticky bottom-20 lg:bottom-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <span className="w-8 text-center font-bold text-primary-foreground/70">--</span>
          <div className="w-10 h-10 rounded-full border-2 border-primary-foreground/30 bg-primary-foreground/20 flex items-center justify-center font-bold">
            {displayName ? displayName.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm">{displayName || "Você"} <span className="text-xs font-normal opacity-70">(Você)</span></h4>
            <p className="text-xs text-primary-foreground/70">Estudante</p>
          </div>
          <div className="text-right">
            <p className="font-black text-lg">{totalXP.toLocaleString()}</p>
            <p className="text-[10px] uppercase font-bold opacity-70">XP</p>
          </div>
        </div>
      </div>
    </div>
  );
}
