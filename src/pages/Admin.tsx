import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useTheme } from "@/contexts/ThemeContext";
import { PHASES } from "@/data/driving-data";
import { toast } from "sonner";
import AnalyticsTab from "@/components/admin/AnalyticsTab";
import ProductsManager from "@/components/admin/lms/ProductsManager";

type AdminTab = "dashboard" | "students" | "modules" | "reports" | "analytics" | "products";

interface StudentData {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  completed_phases: number[];
  total_xp: number;
  confidence: number;
  welcome_video_views: number;
  progress_updated_at: string;
  coins: number;
  lives: number;
  streak: number;
  badges: string[];
  is_blocked: boolean;
}

interface EditModal {
  userId: string;
  studentName: string;
  field: "coins" | "total_xp" | "lives" | "streak" | "confidence";
  currentValue: number;
}

export default function Admin() {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  
  // States for adding student
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", email: "", password: "" });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) fetchStudents();
  }, [isAdmin]);

  async function fetchStudents() {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: progress } = await supabase.from("user_progress").select("*");

    if (profiles && progress) {
      const merged: StudentData[] = profiles.map((p) => {
        const prog = progress.find((pr) => pr.user_id === p.user_id);
        return {
          user_id: p.user_id,
          display_name: p.display_name || "Sem nome",
          is_blocked: p.is_blocked || false,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          completed_phases: prog?.completed_phases || [],
          total_xp: prog?.total_xp || 0,
          confidence: prog?.confidence || 0,
          welcome_video_views: prog?.welcome_video_views || 0,
          progress_updated_at: prog?.updated_at || p.created_at,
          coins: prog?.coins || 0,
          lives: prog?.lives || 5,
          streak: prog?.streak || 0,
          badges: prog?.badges || [],
        };
      });
      setStudents(merged);
    }
    setLoading(false);
  }

  async function resetStudentProgress(userId: string) {
    const { error } = await supabase
      .from("user_progress")
      .update({
        completed_phases: [],
        total_xp: 0,
        confidence: 0,
        welcome_video_views: 0,
        coins: 0,
        lives: 5,
        streak: 0,
        badges: [],
        daily_xp: 0,
        daily_lessons: 0,
      })
      .eq("user_id", userId);

    if (error) {
      toast.error("Erro ao resetar progresso");
    } else {
      toast.success("Progresso zerado completamente! 🔄");
      fetchStudents();
    }
  }

  async function updateStudentField(userId: string, field: string, value: any) {
    const { error } = await supabase
      .from("user_progress")
      .update({ [field]: value })
      .eq("user_id", userId);

    if (error) {
      toast.error(`Erro ao atualizar ${field}`);
    } else {
      toast.success(`${field} atualizado com sucesso!`);
      fetchStudents();
    }
  }

  async function toggleBlockStudent(userId: string, currentState: boolean) {
    const { error } = await supabase.from('profiles').update({ is_blocked: !currentState }).eq('user_id', userId);
    if (error) { toast.error("Erro ao alterar acesso"); }
    else { toast.success(!currentState ? "Acesso bloqueado com sucesso!" : "Acesso liberado com sucesso!"); fetchStudents(); }
  }

  async function deleteStudent(userId: string, name: string) {
    if (!window.confirm(`⚠️ EXCLUSÃO FATAL! ⚠️\n\nIsto apagará DE VEZ a conta e todo o progresso de "${name}" do banco de dados (Auth).\nNão tem como desfazer.\n\nDeseja prosseguir?`)) return;
    
    // @ts-ignore
    const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
    
    if (error) { 
      toast.error("Erro interno ao tentar excluir: " + error.message); 
    } else { 
      toast.success("A conta do aluno foi extinta do banco de dados!"); 
      fetchStudents(); 
    }
  }

  function openEditModal(s: StudentData, field: EditModal["field"]) {
    const valueMap = { coins: s.coins, total_xp: s.total_xp, lives: s.lives, streak: s.streak, confidence: s.confidence };
    setEditModal({ userId: s.user_id, studentName: s.display_name, field, currentValue: valueMap[field] });
    setEditValue(String(valueMap[field]));
  }

  async function handleEditSubmit() {
    if (!editModal) return;
    const numVal = parseInt(editValue);
    if (isNaN(numVal) || numVal < 0) { toast.error("Valor inválido"); return; }
    await updateStudentField(editModal.userId, editModal.field, numVal);
    setEditModal(null);
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newStudent.name || !newStudent.email || !newStudent.password) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (newStudent.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsCreating(true);
    try {
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { error } = await tempClient.auth.signUp({
        email: newStudent.email,
        password: newStudent.password,
        options: {
          data: { display_name: newStudent.name },
        },
      });

      if (error) throw error;

      toast.success("Aluno criado com sucesso!");
      setShowAddModal(false);
      setNewStudent({ name: "", email: "", password: "" });
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar aluno");
    } finally {
      setIsCreating(false);
    }
  }

  async function unlockPhaseForStudent(userId: string, phaseIndex: number) {
    const student = students.find((s) => s.user_id === userId);
    if (!student) return;

    const newPhases = [...new Set([...student.completed_phases, phaseIndex])].sort();
    const { error } = await supabase
      .from("user_progress")
      .update({ completed_phases: newPhases })
      .eq("user_id", userId);

    if (error) {
      toast.error("Erro ao liberar fase");
    } else {
      toast.success(`Fase ${phaseIndex + 1} liberada!`);
      fetchStudents();
    }
  }

  if (adminLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Stats
  const totalStudents = students.filter((s) => s.user_id !== user?.id).length;
  const avgXP = totalStudents > 0
    ? Math.round(students.filter((s) => s.user_id !== user?.id).reduce((a, s) => a + s.total_xp, 0) / totalStudents)
    : 0;
  const avgConfidence = totalStudents > 0
    ? (students.filter((s) => s.user_id !== user?.id).reduce((a, s) => a + s.confidence, 0) / totalStudents).toFixed(1)
    : "0";
  const completionRates = PHASES.map((_, i) => {
    const completed = students.filter((s) => s.completed_phases.includes(i)).length;
    return totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0;
  });

  const TABS: { key: AdminTab; icon: string; label: string }[] = [
    { key: "dashboard", icon: "dashboard", label: "Dashboard" },
    { key: "analytics", icon: "monitoring", label: "Analytics" },
    { key: "students", icon: "group", label: "Alunos" },
    { key: "modules", icon: "school", label: "Módulos" },
    { key: "products", icon: "video_library", label: "Cursos" },
    { key: "reports", icon: "analytics", label: "Relatórios" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="size-9 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <h1 className="text-lg font-bold">Painel Admin</h1>
            <p className="text-xs text-muted-foreground">Gestão de alunos e módulos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="size-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="material-symbols-outlined text-lg">{isDark ? "light_mode" : "dark_mode"}</span>
          </button>
          <button onClick={() => { signOut(); navigate("/login"); }} className="size-9 rounded-full border border-border bg-card flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors">
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card p-3 sticky top-[57px] h-[calc(100vh-57px)]">
          <nav className="flex flex-col gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left text-sm ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${tab === t.key ? "filled-icon" : ""}`}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-1.5 flex justify-between z-50">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors ${
                tab === t.key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${tab === t.key ? "filled-icon" : ""}`}>{t.icon}</span>
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {tab === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Visão Geral</h2>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: "group", label: "Total de Alunos", value: totalStudents, color: "text-primary" },
                  { icon: "database", label: "XP Médio", value: avgXP, color: "text-[hsl(var(--success))]" },
                  { icon: "speed", label: "Confiança Média", value: `${avgConfidence}/5`, color: "text-[hsl(var(--yellow))]" },
                  { icon: "school", label: "Módulos Ativos", value: PHASES.length, color: "text-destructive" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-2xl ${kpi.color} filled-icon`}>{kpi.icon}</span>
                    </div>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* Completion rates */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4">Taxa de Conclusão por Fase</h3>
                <div className="space-y-3">
                  {PHASES.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-lg">{p.icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{p.title.replace(/Fase \d+ — /, "")}</span>
                          <span className="text-muted-foreground">{completionRates[i]}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${completionRates[i]}%`,
                              backgroundColor: "hsl(var(--primary))",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent students */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4">Alunos Recentes</h3>
                <div className="space-y-3">
                  {students
                    .filter((s) => s.user_id !== user?.id)
                    .slice(0, 5)
                    .map((s) => (
                      <div key={s.user_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {s.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{s.display_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.completed_phases.length}/{PHASES.length} fases • {s.total_xp} XP
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          s.completed_phases.length === PHASES.length
                            ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                            : s.completed_phases.length > 0
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {s.completed_phases.length === PHASES.length ? "Completo" : s.completed_phases.length > 0 ? "Em progresso" : "Novo"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {tab === "students" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Alunos ({totalStudents})</h2>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
                    <span className="material-symbols-outlined text-base">person_add</span>
                    Adicionar Aluno
                  </button>
                  <button onClick={fetchStudents} className="flex items-center gap-1.5 px-3 py-2 bg-accent rounded-lg text-sm font-medium hover:bg-accent/80 transition-colors">
                    <span className="material-symbols-outlined text-base">refresh</span>
                    Atualizar
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  {students
                    .map((s) => (
                      <div key={s.user_id} className="bg-card border border-border rounded-2xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="size-11 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-lg relative">
                              {s.display_name.charAt(0).toUpperCase()}
                              {s.is_blocked && (
                                <span className="absolute -bottom-1 -right-1 size-4 bg-destructive rounded-full flex items-center justify-center border-2 border-card" title="Conta bloqueada">
                                  <span className="material-symbols-outlined text-[10px] text-destructive-foreground">block</span>
                                </span>
                              )}
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                <p className={`font-bold ${s.is_blocked ? "text-destructive line-through opacity-70" : ""}`}>{s.display_name}</p>
                                {s.is_blocked && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-destructive/10 text-destructive rounded uppercase">Bloqueado</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Cadastro: {new Date(s.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedStudent(expandedStudent === s.user_id ? null : s.user_id)}
                            className="size-8 rounded-lg bg-accent flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <span className={`material-symbols-outlined text-base transition-transform ${expandedStudent === s.user_id ? "rotate-180" : ""}`}>expand_more</span>
                          </button>
                        </div>

                        {/* Stats - clickable to edit */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                          {[
                            { field: "total_xp" as const, icon: "database", label: "XP", value: s.total_xp, color: "text-primary" },
                            { field: "coins" as const, icon: "paid", label: "Moedas", value: s.coins, color: "text-yellow-500" },
                            { field: "lives" as const, icon: "favorite", label: "Vidas", value: s.lives, color: "text-red-500" },
                            { field: "streak" as const, icon: "local_fire_department", label: "Ofensiva", value: s.streak, color: "text-orange-500" },
                            { field: "confidence" as const, icon: "speed", label: "Confiança", value: s.confidence, color: "text-green-500" },
                            { field: null as any, icon: "military_tech", label: "Medalhas", value: s.badges.length, color: "text-purple-500" },
                          ].map((stat) => (
                            <button
                              key={stat.label}
                              onClick={() => stat.field && openEditModal(s, stat.field)}
                              className={`bg-accent/50 rounded-xl p-2.5 text-center transition-all ${stat.field ? "hover:bg-accent hover:ring-1 hover:ring-primary/20 cursor-pointer" : "cursor-default"}`}
                              title={stat.field ? `Editar ${stat.label}` : undefined}
                            >
                              <span className={`material-symbols-outlined ${stat.color} text-lg filled-icon`}>{stat.icon}</span>
                              <p className="text-sm font-bold mt-0.5">{stat.value}</p>
                              <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">{stat.label}</p>
                            </button>
                          ))}
                        </div>

                        {/* Phase progress */}
                        <div className="flex gap-2 mb-4">
                          {PHASES.map((p, i) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                if (!s.completed_phases.includes(i)) {
                                  unlockPhaseForStudent(s.user_id, i);
                                }
                              }}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                s.completed_phases.includes(i)
                                  ? "text-[hsl(var(--success-foreground))]"
                                  : "bg-muted text-muted-foreground hover:bg-accent cursor-pointer"
                              }`}
                              style={
                                s.completed_phases.includes(i)
                                  ? { backgroundColor: "hsl(var(--success))" }
                                  : undefined
                              }
                              title={s.completed_phases.includes(i) ? "Fase concluída" : `Liberar ${p.title}`}
                            >
                              {p.icon} F{i + 1}
                            </button>
                          ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2 flex-wrap mb-2">
                          <button
                            onClick={() => { updateStudentField(s.user_id, "coins", s.coins + 50); }}
                            className="flex items-center gap-1 px-3 py-2 bg-yellow-500/10 text-yellow-500 rounded-xl text-xs font-bold hover:bg-yellow-500/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            +50 Moedas
                          </button>
                          <button
                            onClick={() => { updateStudentField(s.user_id, "total_xp", s.total_xp + 100); }}
                            className="flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            +100 XP
                          </button>
                          <button
                            onClick={() => { updateStudentField(s.user_id, "lives", 5); }}
                            className="flex items-center gap-1 px-3 py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm filled-icon">favorite</span>
                            Max Vidas
                          </button>
                          <button
                            onClick={() => {
                              const nextPhase = s.completed_phases.length;
                              if (nextPhase < PHASES.length) {
                                unlockPhaseForStudent(s.user_id, nextPhase);
                              } else {
                                toast.info("Todas as fases já foram concluídas!");
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">lock_open</span>
                            Próxima Fase
                          </button>
                        </div>

                        {/* Expanded Management Panel */}
                        {expandedStudent === s.user_id && (
                          <div className="mt-4 pt-4 border-t border-border space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                              Painel de Controle
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => openEditModal(s, "coins")}
                                className="flex items-center gap-2 p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left"
                              >
                                <span className="material-symbols-outlined text-yellow-500 filled-icon">paid</span>
                                <div>
                                  <p className="text-xs font-bold">Editar Moedas</p>
                                  <p className="text-[10px] text-muted-foreground">Atual: {s.coins}</p>
                                </div>
                              </button>
                              <button
                                onClick={() => openEditModal(s, "total_xp")}
                                className="flex items-center gap-2 p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left"
                              >
                                <span className="material-symbols-outlined text-primary filled-icon">database</span>
                                <div>
                                  <p className="text-xs font-bold">Editar XP</p>
                                  <p className="text-[10px] text-muted-foreground">Atual: {s.total_xp}</p>
                                </div>
                              </button>
                              <button
                                onClick={() => openEditModal(s, "lives")}
                                className="flex items-center gap-2 p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left"
                              >
                                <span className="material-symbols-outlined text-red-500 filled-icon">favorite</span>
                                <div>
                                  <p className="text-xs font-bold">Editar Vidas</p>
                                  <p className="text-[10px] text-muted-foreground">Atual: {s.lives}</p>
                                </div>
                              </button>
                              <button
                                onClick={() => openEditModal(s, "streak")}
                                className="flex items-center gap-2 p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-left"
                              >
                                <span className="material-symbols-outlined text-orange-500 filled-icon">local_fire_department</span>
                                <div>
                                  <p className="text-xs font-bold">Editar Ofensiva</p>
                                  <p className="text-[10px] text-muted-foreground">Atual: {s.streak}d</p>
                                </div>
                              </button>
                            </div>
                            
                            <div className="flex flex-col gap-2 pt-2">
                              {/* Action Buttons Zone */}
                              <button
                                onClick={() => toggleBlockStudent(s.user_id, s.is_blocked)}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-bold transition-colors border ${
                                  s.is_blocked 
                                    ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" 
                                    : "bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20"
                                }`}
                              >
                                <span className="material-symbols-outlined text-base">{s.is_blocked ? "how_to_reg" : "person_off"}</span>
                                {s.is_blocked ? "Desbloquear Acesso" : "Bloquear Acesso"}
                              </button>

                              <button
                                onClick={() => {
                                  if (confirm(`⚠️ ATENÇÃO! Isso vai ZERAR TUDO de ${s.display_name}:\n\n• XP → 0\n• Moedas → 0\n• Vidas → 5\n• Ofensiva → 0\n• Fases → 0\n• Medalhas → 0\n\nDeseja continuar?`)) {
                                    resetStudentProgress(s.user_id);
                                  }
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-muted text-muted-foreground rounded-xl text-sm font-bold hover:bg-muted/80 transition-colors border border-border"
                              >
                                <span className="material-symbols-outlined text-base">restart_alt</span>
                                Zerar Todo o Progresso
                              </button>

                              <button
                                onClick={() => deleteStudent(s.user_id, s.display_name)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-destructive text-destructive-foreground rounded-xl text-sm font-bold hover:bg-destructive/90 transition-colors shadow-md shadow-destructive/20 mt-2"
                              >
                                <span className="material-symbols-outlined text-base">delete_forever</span>
                                Excluir Conta Definitivamente
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  {students.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <span className="material-symbols-outlined text-4xl mb-2 block">group_off</span>
                      <p className="font-medium">Nenhum aluno cadastrado ainda</p>
                    </div>
                  )}
                </div>
              )}

              {/* Edit Modal */}
              {editModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="text-center mb-6">
                      <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-primary text-2xl">edit</span>
                      </div>
                      <h3 className="text-lg font-bold">Editar {editModal.field === "total_xp" ? "XP" : editModal.field === "coins" ? "Moedas" : editModal.field === "lives" ? "Vidas" : editModal.field === "streak" ? "Ofensiva" : "Confiança"}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Aluno: <strong>{editModal.studentName}</strong></p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">Valor atual: {editModal.currentValue}</label>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          min="0"
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-center text-2xl font-bold transition-all"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        {[0, 50, 100, 500, 1000].map((val) => (
                          <button
                            key={val}
                            onClick={() => setEditValue(String(val))}
                            className="flex-1 py-2 rounded-lg bg-accent text-xs font-bold hover:bg-muted transition-colors"
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setEditModal(null)}
                          className="flex-1 py-3 rounded-xl font-bold text-sm border border-border hover:bg-muted transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleEditSubmit}
                          className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Student Modal */}
              {showAddModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="text-center mb-6">
                      <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                      </div>
                      <h3 className="text-lg font-bold">Adicionar Novo Aluno</h3>
                      <p className="text-xs text-muted-foreground mt-1">Crie um acesso manualmente para um aluno</p>
                    </div>

                    <form onSubmit={handleCreateStudent} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">Nome Completo</label>
                        <input
                          type="text"
                          required
                          value={newStudent.name}
                          onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-all text-sm"
                          placeholder="Ex: João da Silva"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">E-mail</label>
                        <input
                          type="email"
                          required
                          value={newStudent.email}
                          onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-all text-sm"
                          placeholder="joao@exemplo.com"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">Senha Provisória</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={newStudent.password}
                          onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-all text-sm"
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddModal(false)}
                          className="flex-1 py-3 rounded-xl font-bold text-sm border border-border hover:bg-muted transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isCreating}
                          className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isCreating ? "Criando..." : "Criar Aluno"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "modules" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Módulos Cadastrados</h2>
              <div className="space-y-4">
                {PHASES.map((p, i) => {
                  const enrolled = students.filter((s) => s.completed_phases.includes(i)).length;
                  return (
                    <div key={p.id} className="bg-card border border-border rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="size-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `hsl(var(--${p.iconBg === "blue" ? "primary" : p.iconBg === "green" ? "success" : "yellow"}) / 0.15)` }}>
                            {p.icon}
                          </div>
                          <div>
                            <p className="font-bold">{p.title}</p>
                            <p className="text-xs text-muted-foreground">{p.subtitle}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-full">{p.xp} XP</span>
                      </div>

                      {/* Module details */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <div className="bg-accent/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Etapas</p>
                          <p className="font-bold">{p.steps.length}</p>
                        </div>
                        <div className="bg-accent/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Perguntas Quiz</p>
                          <p className="font-bold">{p.quizzes.length}</p>
                        </div>
                        <div className="bg-accent/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Alunos Concluíram</p>
                          <p className="font-bold">{enrolled}</p>
                        </div>
                        <div className="bg-accent/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Taxa Conclusão</p>
                          <p className="font-bold">{totalStudents > 0 ? Math.round((enrolled / totalStudents) * 100) : 0}%</p>
                        </div>
                      </div>

                      {/* Quiz preview */}
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-medium text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-base group-open:rotate-90 transition-transform">chevron_right</span>
                          Ver perguntas do quiz
                        </summary>
                        <div className="mt-3 space-y-2">
                          {p.quizzes.map((q, qi) => (
                            <div key={qi} className="bg-accent/30 rounded-lg p-3">
                              <p className="text-sm font-medium">{q.emoji} {q.q}</p>
                              <p className="text-xs text-[hsl(var(--success))] mt-1">✓ {q.opts[q.correct]}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "analytics" && <AnalyticsTab />}

          {tab === "products" && <ProductsManager />}

          {tab === "reports" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Relatórios</h2>

              {/* Engagement overview */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary filled-icon">trending_up</span>
                  Engajamento Geral
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-accent/50 rounded-xl">
                    <p className="text-2xl font-bold text-primary">{students.filter((s) => s.welcome_video_views > 0 && s.user_id !== user?.id).length}</p>
                    <p className="text-xs text-muted-foreground">Viram o vídeo</p>
                  </div>
                  <div className="text-center p-3 bg-accent/50 rounded-xl">
                    <p className="text-2xl font-bold">{students.filter((s) => s.completed_phases.length > 0 && s.user_id !== user?.id).length}</p>
                    <p className="text-xs text-muted-foreground">Iniciaram</p>
                  </div>
                  <div className="text-center p-3 bg-accent/50 rounded-xl">
                    <p className="text-2xl font-bold text-[hsl(var(--success))]">{students.filter((s) => s.completed_phases.length === PHASES.length && s.user_id !== user?.id).length}</p>
                    <p className="text-xs text-muted-foreground">Completaram tudo</p>
                  </div>
                  <div className="text-center p-3 bg-accent/50 rounded-xl">
                    <p className="text-2xl font-bold text-destructive">{students.filter((s) => s.completed_phases.length === 0 && s.user_id !== user?.id).length}</p>
                    <p className="text-xs text-muted-foreground">Inativos</p>
                  </div>
                </div>
              </div>

              {/* Confidence distribution */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[hsl(var(--yellow))] filled-icon">speed</span>
                  Distribuição de Confiança
                </h3>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const count = students.filter((s) => s.confidence === level && s.user_id !== user?.id).length;
                    const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <span className="text-sm font-bold w-8">Nv {level}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: `hsl(var(--${level >= 4 ? "success" : level >= 2 ? "yellow" : "destructive"}))` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* XP Ranking */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary filled-icon">leaderboard</span>
                  Ranking de XP
                </h3>
                <div className="space-y-2">
                  {students
                    .filter((s) => s.user_id !== user?.id)
                    .sort((a, b) => b.total_xp - a.total_xp)
                    .slice(0, 10)
                    .map((s, i) => (
                      <div key={s.user_id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <span className={`text-lg font-bold w-8 text-center ${i < 3 ? "text-[hsl(var(--yellow))]" : "text-muted-foreground"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                        </span>
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {s.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{s.display_name}</p>
                        </div>
                        <span className="text-sm font-bold text-primary">{s.total_xp} XP</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Export */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-3">Exportar Dados</h3>
                <p className="text-xs text-muted-foreground mb-4">Exporte todos os dados dos alunos em formato CSV</p>
                <button
                  onClick={() => {
                    const headers = "Nome,XP,Fases Concluídas,Confiança,Cadastro\n";
                    const rows = students
                      .filter((s) => s.user_id !== user?.id)
                      .map((s) =>
                        `"${s.display_name}",${s.total_xp},${s.completed_phases.length},${s.confidence},"${new Date(s.created_at).toLocaleDateString("pt-BR")}"`
                      )
                      .join("\n");
                    const blob = new Blob([headers + rows], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "alunos-relatorio.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Relatório exportado!");
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Baixar CSV
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
