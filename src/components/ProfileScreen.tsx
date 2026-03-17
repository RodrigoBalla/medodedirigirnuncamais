import { useAuth } from "@/contexts/AuthContext";

interface ProfileScreenProps {
  displayName: string;
  totalXP: number;
  confidence: number;
  completedPhases: number;
  totalPhases: number;
}

export function ProfileScreen({ displayName, totalXP, confidence, completedPhases, totalPhases }: ProfileScreenProps) {
  const { user, signOut } = useAuth();
  const progressPercent = Math.round((completedPhases / totalPhases) * 100);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Profile Header */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center text-3xl font-bold text-primary mx-auto mb-3">
          {displayName ? displayName.charAt(0).toUpperCase() : "?"}
        </div>
        <h1 className="text-xl font-bold">{displayName || "Motorista"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
        
        {/* XP Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-muted-foreground">XP Total</span>
            <span className="text-primary">{totalXP}</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min((totalXP / 500) * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <span className="material-symbols-outlined text-primary text-2xl mb-1">auto_stories</span>
          <p className="text-lg font-bold">{completedPhases}</p>
          <p className="text-xs text-muted-foreground">Fases</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <span className="material-symbols-outlined text-yellow-500 text-2xl mb-1 filled-icon">database</span>
          <p className="text-lg font-bold">{totalXP}</p>
          <p className="text-xs text-muted-foreground">XP</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <span className="material-symbols-outlined text-green-500 text-2xl mb-1">favorite</span>
          <p className="text-lg font-bold">{confidence}/5</p>
          <p className="text-xs text-muted-foreground">Confiança</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-xl p-5 border border-border shadow-sm mb-6">
        <h3 className="font-bold text-sm mb-3">Progresso Geral</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{completedPhases} de {totalPhases} fases completas</span>
          <span className="text-sm font-bold text-primary">{progressPercent}%</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Settings */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <button className="flex items-center gap-3 w-full px-5 py-4 hover:bg-muted/50 transition-colors text-left border-b border-border">
          <span className="material-symbols-outlined text-muted-foreground">settings</span>
          <span className="font-medium text-sm">Configurações</span>
          <span className="material-symbols-outlined ml-auto text-muted-foreground text-lg">chevron_right</span>
        </button>
        <button className="flex items-center gap-3 w-full px-5 py-4 hover:bg-muted/50 transition-colors text-left border-b border-border">
          <span className="material-symbols-outlined text-muted-foreground">help</span>
          <span className="font-medium text-sm">Ajuda e Suporte</span>
          <span className="material-symbols-outlined ml-auto text-muted-foreground text-lg">chevron_right</span>
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-5 py-4 hover:bg-destructive/5 transition-colors text-left text-destructive"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-medium text-sm">Sair da conta</span>
        </button>
      </div>
    </div>
  );
}
