import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useAdmin } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";
import { ShopModal } from "@/components/lms/ShopModal";
import { CashbackModal } from "@/components/lms/CashbackModal";
import { EmergencyContactFab } from "@/components/EmergencyContactFab";
import { UserAvatar } from "@/components/UserAvatar";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { AccessExpiredScreen } from "@/components/AccessExpiredScreen";
import { CarCursor } from "@/components/CarCursor";
import { useDetectNewModules } from "@/hooks/useDetectNewModules";
import { ModuleUnlockedOverlay } from "@/components/ModuleUnlockedOverlay";
import { StudentMessenger } from "@/components/StudentMessenger";

export type AppTab = "home" | "treinos" | "ranking" | "comunidade" | "biblioteca" | "perfil";

// MVP: tabs/áreas bloqueadas com badge "Em Breve" — ainda visíveis na nav,
// mas não navegáveis pras alunas. Admin SEMPRE consegue acessar (pra
// validar/testar conteúdo antes de liberar pra base inteira).
// Quando o conteúdo dessas áreas estiver pronto, esvaziar este array.
const LOCKED_TABS_FOR_STUDENTS: AppTab[] = ["home", "treinos", "ranking"];

interface AppLayoutProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
  displayName: string;
  confidence: number;
  completedPhases: number;
  streakDays?: number;
}

// NAV completo (mobile bottom + desktop sidebar). Pra alunas, as 3 tabs travadas
// (Trilha, Missões, Ranking) são FILTRADAS abaixo no render — ela só vê o que
// está liberado, sem badge "Em breve" poluindo. Admin continua vendo tudo com
// badge "Preview" cyan.
const NAV_ITEMS_FULL: { tab: AppTab; icon: string; label: string }[] = [
  { tab: "biblioteca", icon: "video_library", label: "Cursos" },
  { tab: "comunidade", icon: "forum", label: "Comunidade" },
  { tab: "perfil", icon: "person", label: "Perfil" },
  // Travadas pra alunas (Em breve), liberadas pra admin:
  { tab: "home", icon: "map", label: "Trilha" },
  { tab: "treinos", icon: "target", label: "Missões" },
  { tab: "ranking", icon: "trophy", label: "Ranking" },
];

const SIDEBAR_ITEMS_FULL: { tab: AppTab; icon: string; label: string }[] = [
  { tab: "biblioteca", icon: "video_library", label: "Meus Cursos" },
  { tab: "comunidade", icon: "forum", label: "Comunidade" },
  // Travadas pra alunas, liberadas pra admin:
  { tab: "home", icon: "map", label: "Trilha" },
  { tab: "treinos", icon: "target", label: "Missões Diárias" },
  { tab: "ranking", icon: "trophy", label: "Rankings" },
];

function getLevel(xp: number) {
  const level = Math.floor(xp / 100) + 1;
  const titles = ["Iniciante", "Aprendiz", "Praticante", "Intermediário", "Avançado", "Expert", "Mestre"];
  const title = titles[Math.min(level - 1, titles.length - 1)];
  return { level, title, current: xp % 100, next: 100 };
}

function getCarInfo(level: number) {
  if (level >= 30) return { icon: "sports_motorsports", name: "Supercarro", color: "bg-yellow-500/10 text-yellow-500", border: "border-yellow-500/30" };
  if (level >= 20) return { icon: "garage_car", name: "SUV Premium", color: "bg-cyan-500/10 text-cyan-500", border: "border-cyan-500/30" };
  if (level >= 10) return { icon: "local_taxi", name: "Sedan Moderno", color: "bg-blue-500/10 text-blue-500", border: "border-blue-500/30" };
  if (level >= 5) return { icon: "directions_car", name: "Hatch", color: "bg-green-500/10 text-green-500", border: "border-green-500/30" };
  return { icon: "minor_crash", name: "Fusca", color: "bg-destructive/10 text-destructive", border: "border-destructive/20" };
}

export function AppLayout({
  activeTab,
  onTabChange,
  children,
  displayName,
  confidence,
  completedPhases,
  streakDays = 1,
}: AppLayoutProps) {
  const { signOut } = useAuth();
  // Nome do user vem do hook (sincronizado com edição no /perfil em tempo real).
  // O `displayName` da prop fica como fallback inicial até o hook resolver.
  const liveName = useDisplayName(displayName);
  // Tema fixo em dark — sem necessidade de toggle

  const { isAdmin } = useAdmin();
  const nav = useNavigate();
  // Status de acesso da aluna (active/expired). Se 'expired' E não for admin,
  // bloqueia TODA navegação interna e mostra só AccessExpiredScreen.
  // Admin sempre passa, mesmo se a flag estiver expired na própria conta.
  const accessStatus = useAccessStatus();
  // Detecta módulo novo desbloqueado (compara grupos da aluna vs localStorage)
  // — dispara animação cinematográfica 1x quando ela ganha acesso a um curso novo
  const { newModule, markSeen } = useDetectNewModules();
  const { lives, coins, totalXP, streak, xpBoostExpiresAt } = useUserProgress();
  const { level, title, current, next } = getLevel(totalXP);
  const car = getCarInfo(level);
  const [showShop, setShowShop] = useState(false);
  const [showCashback, setShowCashback] = useState(false);

  // ─── Sidebar colapsável (só desktop) ──────────────────────────────────────
  // Persiste a preferência no localStorage pra não esquecer entre navegações.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mddnm:sidebar:collapsed") === "1";
  });
  useEffect(() => {
    try { localStorage.setItem("mddnm:sidebar:collapsed", sidebarCollapsed ? "1" : "0"); } catch {}
  }, [sidebarCollapsed]);
  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

  const isXpBoostActive = xpBoostExpiresAt && new Date(xpBoostExpiresAt) > new Date();

  // Tabs bloqueadas DINÂMICAS — admin pode ver tudo, aluna vê só o liberado.
  // Se você é admin e quer simular a experiência da aluna, abra anônimo/incógnito
  // com outra conta. NÃO duplicar essa lógica em outros lugares — toda decisão
  // de "tá em breve?" passa por aqui.
  const LOCKED_TABS: AppTab[] = isAdmin ? [] : LOCKED_TABS_FOR_STUDENTS;

  // Items da nav filtrados: aluna NÃO vê os blocks ("Em breve") na nav, só admin
  // vê os blocks com badge "Preview" cyan. Limpa a UI mobile drasticamente —
  // antes a aluna via 3 cadeados de 5 ícones na bottom nav.
  const NAV_ITEMS = isAdmin
    ? NAV_ITEMS_FULL
    : NAV_ITEMS_FULL.filter((item) => !LOCKED_TABS_FOR_STUDENTS.includes(item.tab));
  const SIDEBAR_ITEMS = isAdmin
    ? SIDEBAR_ITEMS_FULL
    : SIDEBAR_ITEMS_FULL.filter((item) => !LOCKED_TABS_FOR_STUDENTS.includes(item.tab));

  // MVP: clique em tab bloqueada exibe um aviso de "Em Breve" e não navega.
  // Pra admin, LOCKED_TABS é vazio, então essa checagem nunca dispara.
  const handleNavClick = (tab: AppTab) => {
    if (LOCKED_TABS.includes(tab)) {
      toast("🔒 Em breve!", {
        description: "Esta área ainda está em desenvolvimento.",
      });
      return;
    }
    onTabChange(tab);
  };

  // ─── GUARD: acesso expirado bloqueia TODA navegação interna ─────────────
  // Aluna com profiles.access_status = 'expired' só vê a tela de renovação.
  // Admin SEMPRE passa (mesmo se a própria flag estiver expired na conta).
  if (accessStatus === "expired" && !isAdmin) {
    return <AccessExpiredScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background asphalt-texture relative">
      {/* Cursor de carro com rastro de pneus — só na área de membros (skip em
          touch automaticamente). Identidade visual de trânsito. */}
      <CarCursor />

      {/* Animação cinematográfica de "novo módulo desbloqueado" — dispara 1x
          quando a aluna compra outro curso e entra na área de membros.
          Marcado no localStorage por user_id, não aparece de novo pra ela. */}
      {newModule && (
        <ModuleUnlockedOverlay
          courseName={newModule.title}
          coverUrl={newModule.image_url}
          courseId={newModule.product_id}
          onClose={() => markSeen(newModule.product_id)}
        />
      )}

      {/* Fita de advertência fininha no topo absoluto da página — identidade trânsito */}
      <div className="caution-tape h-1.5 w-full" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-6 py-2.5">
        {/* Left: Logo (MVP: leva para Meus Cursos, área principal) */}
        <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => nav("/biblioteca")} title={`Seu carro: ${car.name}`}>
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={`size-9 flex items-center justify-center rounded-xl border ${car.color} ${car.border} transition-colors`}
          >
            <span className="material-symbols-outlined text-xl">{car.icon}</span>
          </motion.div>
          <div className="hidden sm:block">
            <h2 className="text-foreground text-sm font-bold leading-tight tracking-tight">
              Medo de dirigir nunca mais
            </h2>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{car.name} • Nv.{level}</p>
          </div>
        </div>

        {/* Right: Stats + Avatar */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Vidas / Streak / Moedas — aparecem nas abas Missões, Perfil
              e Ranking (onde moedas é critério de desempate). Nas outras
              abas (Cursos, Trilha) ficam ocultos pra não poluir a UI. */}
          {(activeTab === "treinos" || activeTab === "perfil" || activeTab === "ranking") && (
            <>
              {/* Vidas ❤️ */}
              <motion.div
                id="onboarding-lives"
                whileHover={{ scale: 1.05 }}
                className={`flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full border border-border ${lives <= 1 ? 'animate-pulse border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
              >
                <span className={`material-symbols-outlined text-red-500 text-base filled-icon ${lives <= 1 ? 'animate-bounce' : ''}`}>favorite</span>
                <span className="text-xs font-black text-foreground">{lives}</span>
              </motion.div>

              {/* Streak ⚡ — só mostra a partir de 2 dias (1 dia não é "ofensiva"
                  ainda, é só o primeiro login; mostrar 🔥1 confunde a aluna nova) */}
              {streak >= 2 && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-1.5 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/30 group cursor-help"
                  title={`${streak} dias seguidos! Não deixe o fogo apagar.`}
                >
                  <span className="material-symbols-outlined text-orange-500 text-base filled-icon animate-pulse group-hover:scale-125 transition-transform">local_fire_department</span>
                  <span className="text-xs font-black text-orange-600">{streak}</span>
                </motion.div>
              )}

              {/* Moedas 🪙 — clique abre o CashbackModal pra ver/converter
                  o saldo em cupom de desconto. Antes abria o ShopModal
                  (que continua acessível pela loja interna). */}
              <motion.div
                id="onboarding-coins"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCashback(true)}
                title="Ver saldo e converter em cupom de desconto"
                className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full border border-border cursor-pointer group relative"
              >
                <span className="material-symbols-outlined text-yellow-500 text-base filled-icon group-hover:rotate-12 transition-transform">database</span>
                <span className="text-xs font-black text-foreground">{coins}</span>

                {isXpBoostActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 size-4 bg-purple-500 rounded-full border-2 border-background flex items-center justify-center"
                    title="XP Turbo Ativo!"
                  >
                    <span className="material-symbols-outlined text-[8px] text-white filled-icon">rocket_launch</span>
                  </motion.div>
                )}
              </motion.div>
            </>
          )}

          {/* Admin button - only visible for admins */}
          {isAdmin && (
            <button
              onClick={() => nav("/admin")}
              className="size-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Painel Admin"
            >
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            </button>
          )}
          {/* Avatar — mostra a foto que o user subiu (via UserAvatar +
              hook useAvatarUrl). Cada user vê só a sua foto. */}
          <UserAvatar displayName={liveName} size={36} />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar COLAPSÁVEL — w-64 (expandido) ou w-16 (só ícones).
            User pode recolher pra ganhar largura útil pro conteúdo. */}
        <aside
          className={`hidden lg:flex flex-col bg-black p-3 sticky top-[53px] h-[calc(100vh-53px)] relative transition-[width] duration-300 ease-out ${
            sidebarCollapsed ? "w-16" : "w-64"
          }`}
        >
          <div className="caution-tape--vertical absolute top-0 right-0 bottom-0 w-1.5" aria-hidden="true" />

          {/* Botão TOGGLE — escondido/expandido com chevron */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            className="absolute -right-3 top-4 z-30 size-6 rounded-full bg-primary text-primary-foreground border-2 border-background shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[14px]">
              {sidebarCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>

          <div className="flex flex-col gap-4 h-full justify-between overflow-hidden">
            <div className={`flex flex-col ${sidebarCollapsed ? "gap-2 items-center" : "gap-4"}`}>
              {/* Profile mini card — expandido: card completo. Colapsado: só avatar. */}
              <button
                type="button"
                onClick={() => handleNavClick("perfil")}
                className={`flex items-center text-left transition-all group ${
                  sidebarCollapsed
                    ? `justify-center p-1.5 rounded-xl ${activeTab === "perfil" ? "bg-primary/20 ring-2 ring-primary/40" : "hover:bg-white/10"}`
                    : `gap-3 px-3 py-3 rounded-xl border w-full ${
                        activeTab === "perfil"
                          ? "bg-primary/10 border-primary/40 shadow-sm shadow-primary/20"
                          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 cursor-pointer"
                      }`
                }`}
                title={sidebarCollapsed ? `Perfil — ${liveName}` : "Abrir meu perfil"}
                aria-label="Abrir meu perfil"
              >
                <UserAvatar
                  displayName={liveName}
                  size={sidebarCollapsed ? 32 : 44}
                  borderClassName="border-2 border-primary/20 group-hover:border-primary/40 transition-colors"
                />
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate flex items-center gap-1">
                      {liveName || "Motorista"}
                      <span className="material-symbols-outlined text-xs text-muted-foreground/50 group-hover:text-primary transition-colors">
                        chevron_right
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">Nível {level} - {title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(current / next) * 100}%` }}
                          transition={{ type: "spring", stiffness: 50, damping: 15 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-primary">{current}/{next}</span>
                    </div>
                  </div>
                )}
              </button>

              {/* Nav — colapsado: só ícone centralizado. Expandido: ícone + label. */}
              <nav className={`flex flex-col ${sidebarCollapsed ? "gap-1 items-center" : "gap-1"}`}>
                {SIDEBAR_ITEMS.map((item) => {
                  const isLocked = LOCKED_TABS.includes(item.tab);
                  // Admin vê tudo, mas mostra um badge "Preview" nas áreas que
                  // ainda estão ocultas pras alunas (pra lembrar que aquela
                  // área não está liberada na produção).
                  const isAdminPreview = isAdmin && LOCKED_TABS_FOR_STUDENTS.includes(item.tab);
                  return (
                    <button
                      key={item.tab}
                      onClick={() => handleNavClick(item.tab)}
                      title={sidebarCollapsed ? item.label + (isLocked ? " (Em breve)" : isAdminPreview ? " (Preview admin)" : "") : undefined}
                      className={`flex items-center font-medium transition-all text-left ${
                        sidebarCollapsed
                          ? `size-11 rounded-xl justify-center ${
                              activeTab === item.tab
                                ? "bg-primary text-primary-foreground"
                                : isLocked
                                ? "text-muted-foreground/60 hover:bg-accent/50"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`
                          : `gap-3 px-4 py-3 rounded-xl w-full ${
                              activeTab === item.tab
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                : isLocked
                                ? "text-muted-foreground/60 hover:bg-accent/50 cursor-not-allowed"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`
                      }`}
                    >
                      <span className={`material-symbols-outlined text-xl ${activeTab === item.tab ? "filled-icon" : ""}`}>
                        {isLocked ? "lock" : item.icon}
                      </span>
                      {!sidebarCollapsed && (
                        <>
                          <span className="text-sm flex-1">{item.label}</span>
                          {isLocked && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/30">
                              Em breve
                            </span>
                          )}
                          {isAdminPreview && !isLocked && (
                            <span
                              className="text-[9px] font-black uppercase tracking-widest bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded-md border border-cyan-500/30 inline-flex items-center gap-0.5"
                              title="Você vê esta área porque é admin. Pras alunas, segue oculto."
                            >
                              <span className="material-symbols-outlined text-[10px] filled-icon">visibility</span>
                              Preview
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Pro upsell — escondido quando sidebar colapsado pra não inflar */}
              {activeTab === "treinos" && !sidebarCollapsed && (
                <div className="rounded-xl overflow-hidden">
                  <div className="caution-tape h-2" aria-hidden="true" />
                  <div className="bg-gradient-to-br from-primary to-yellow-500 p-4 text-primary-foreground">
                    <p className="font-black text-sm mb-1 uppercase tracking-wider">Desbloqueie o Pro!</p>
                    <p className="text-xs opacity-90 mb-3 leading-relaxed">Acesso ilimitado a simulados e revisões em vídeo.</p>
                    <button
                      onClick={() => setShowShop(true)}
                      className="w-full bg-black text-primary font-black text-xs py-2.5 rounded-lg hover:bg-black/85 transition-colors uppercase tracking-widest"
                    >
                      Ver Planos
                    </button>
                  </div>
                  <div className="caution-tape h-2" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className={`flex flex-col ${sidebarCollapsed ? "gap-1 items-center" : "gap-1"}`}>
              <button
                onClick={() => onTabChange("perfil")}
                title={sidebarCollapsed ? "Perfil" : undefined}
                className={`flex items-center font-medium transition-all ${
                  sidebarCollapsed
                    ? `size-11 rounded-xl justify-center ${
                        activeTab === "perfil"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`
                    : `gap-3 px-4 py-3 rounded-xl text-left ${
                        activeTab === "perfil"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`
                }`}
              >
                <span className="material-symbols-outlined text-xl">person</span>
                {!sidebarCollapsed && <span className="text-sm">Perfil</span>}
              </button>
              <button
                onClick={signOut}
                title={sidebarCollapsed ? "Sair" : undefined}
                className={`flex items-center text-destructive hover:bg-destructive/10 transition-all font-medium ${
                  sidebarCollapsed
                    ? "size-11 rounded-xl justify-center"
                    : "gap-3 px-4 py-3 rounded-xl"
                }`}
              >
                <span className="material-symbols-outlined text-xl">logout</span>
                {!sidebarCollapsed && <span className="text-sm">Sair</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Main content
            NOTA: usa `overflow-x-clip` (não `overflow-x-hidden`). O `hidden`
            força `overflow-y` a computar como `auto`, criando uma segunda
            barra de scroll quando o conteúdo passa da altura. `clip` corta
            no eixo X sem afetar o eixo Y. */}
        <main className="flex-1 pb-20 lg:pb-0 overflow-x-clip min-w-0">
          {children}
        </main>
      </div>

      {/* Shop Modal */}
      <ShopModal isOpen={showShop} onClose={() => setShowShop(false)} />

      {/* Cashback Modal — acionado pelo clique no contador de moedas no header */}
      <CashbackModal open={showCashback} onClose={() => setShowCashback(false)} />

      {/* FAB "Travou? Me chama" — sempre visível em toda tela do app.
          Pra quem tem ataque de pânico no volante, ter contato a 1 clique
          vale mais que gamificação. */}
      <EmergencyContactFab />

      {/* Chat direto com a Carla (admin) — popup de mensagem nova + painel de
          conversa. Só pra alunas; admin tem o painel completo em /admin.
          Canal isolado por aluna (RLS) — ninguém vê a conversa de ninguém. */}
      {!isAdmin && <StudentMessenger />}

      {/* Mobile Bottom Navigation — fita de advertência fininha logo acima.
          Pra alunas só aparecem 3 ícones (Cursos/Comunidade/Perfil) — admin
          vê os 6 com badge "Preview". Mais espaço, área de toque maior. */}
      <div className="caution-tape lg:hidden fixed bottom-[70px] left-0 right-0 h-1 z-50" aria-hidden="true" />
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 px-2 py-2 flex justify-around items-center z-50 safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const isLocked = LOCKED_TABS.includes(item.tab);
          const isAdminPreview = isAdmin && LOCKED_TABS_FOR_STUDENTS.includes(item.tab);
          return (
            <button
              key={item.tab}
              onClick={() => handleNavClick(item.tab)}
              className={`relative flex flex-col items-center gap-1 flex-1 py-2 px-1 rounded-xl transition-colors active:bg-white/5 ${
                activeTab === item.tab
                  ? "text-primary"
                  : isLocked
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground"
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${activeTab === item.tab ? "filled-icon" : ""}`}>
                {isLocked ? "lock" : item.icon}
              </span>
              <span className="text-[11px] font-bold leading-none">{item.label}</span>
              {isLocked && (
                <span className="absolute -top-1 right-1/2 translate-x-[26px] text-[7px] font-black uppercase tracking-widest bg-amber-500/90 text-white px-1 py-px rounded-sm leading-none">
                  Em breve
                </span>
              )}
              {isAdminPreview && !isLocked && (
                <span
                  className="absolute -top-1 right-1/2 translate-x-[26px] text-[7px] font-black uppercase tracking-widest bg-cyan-500/90 text-white px-1 py-px rounded-sm leading-none"
                  title="Preview admin"
                >
                  Preview
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
