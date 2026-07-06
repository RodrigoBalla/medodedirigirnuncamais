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
import { GroupsManager } from "@/components/admin/GroupsManager";
import { CommentsModeration } from "@/components/admin/CommentsModeration";
import NotificationsManager from "@/components/admin/NotificationsManager";
import StudentEmailMetrics from "@/components/admin/StudentEmailMetrics";
import { PhoneEditor } from "@/components/admin/PhoneEditor";
import { StudentAccessPreview } from "@/components/admin/StudentAccessPreview";
import MessagesManager from "@/components/admin/MessagesManager";
import { AdminStudentChat } from "@/components/admin/AdminStudentChat";

type AdminTab = "dashboard" | "students" | "reports" | "analytics" | "products" | "comments" | "groups" | "notifications" | "messages";

interface AccessGroup {
  id: string;
  name: string;
  description?: string | null;
}

interface StudentData {
  user_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
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
  access_status?: "active" | "expired";
  groups: AccessGroup[];
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
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  // Espelho read-only "Visualizar como aluno"
  const [viewAsUser, setViewAsUser] = useState<{ id: string; name: string } | null>(null);
  // user_id do aluno cujo dropdown "Adicionar a grupo" está aberto
  const [groupMenuFor, setGroupMenuFor] = useState<string | null>(null);
  // Modal de confirmação customizado (substitui confirm() nativo)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "primary";
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  // Fecha o dropdown com ESC + click fora
  useEffect(() => {
    if (!groupMenuFor && !confirmModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGroupMenuFor(null);
        setConfirmModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupMenuFor, confirmModal]);
  
  // States for adding student
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", email: "", password: "" });
  const [isCreating, setIsCreating] = useState(false);

  // KPIs reais da Visão Geral (substituem fases/confiança hardcoded)
  const [overviewKpis, setOverviewKpis] = useState<{
    total_students: number;
    total_lessons_completed: number;
    total_courses: number;
    total_lessons: number;
    total_wheel_spins: number;
    total_coupons: number;
    total_xp_sum: number;
  } | null>(null);
  const [courseCompletion, setCourseCompletion] = useState<Array<{
    product_id: string;
    product_title: string;
    total_lessons: number;
    total_completions: number;
    unique_students_completed: number;
  }>>([]);
  // Lista de produtos com imagem + descrição (usado na aba "Módulos")
  const [productsSummary, setProductsSummary] = useState<Array<{
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
  }>>([]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [kpiRes, courseRes, productsRes] = await Promise.all([
        supabase.rpc("admin_overview_kpis"),
        supabase.rpc("admin_completion_by_course"),
        supabase.from("products").select("id, title, description, image_url").order("title", { ascending: true }),
      ]);
      if (productsRes.data) setProductsSummary(productsRes.data as never);
      if (kpiRes.data && Array.isArray(kpiRes.data) && kpiRes.data[0]) {
        const r = kpiRes.data[0] as Record<string, number | string>;
        setOverviewKpis({
          total_students: Number(r.total_students ?? 0),
          total_lessons_completed: Number(r.total_lessons_completed ?? 0),
          total_courses: Number(r.total_courses ?? 0),
          total_lessons: Number(r.total_lessons ?? 0),
          total_wheel_spins: Number(r.total_wheel_spins ?? 0),
          total_coupons: Number(r.total_coupons ?? 0),
          total_xp_sum: Number(r.total_xp_sum ?? 0),
        });
      }
      if (courseRes.data) setCourseCompletion(courseRes.data as never);
    })();
  }, [isAdmin]);

  // Badge de comentários pendentes — atualiza via RPC + realtime
  const [pendingComments, setPendingComments] = useState<number>(0);
  useEffect(() => {
    if (!isAdmin) return;
    async function loadPending() {
      try {
        const { data } = await supabase.rpc("pending_comments_count");
        setPendingComments(typeof data === "number" ? data : 0);
      } catch {}
    }
    loadPending();
    const channel = supabase
      .channel("admin_pending_count")
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_comments" }, loadPending)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  // Badge de mensagens não-lidas das alunas (chat direto) — realtime
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  useEffect(() => {
    if (!isAdmin) return;
    const sb = supabase as any;
    async function loadUnreadMsgs() {
      try {
        const { count } = await sb
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("sender", "student")
          .is("read_by_admin_at", null);
        setUnreadMessages(typeof count === "number" ? count : 0);
      } catch {}
    }
    loadUnreadMsgs();
    const channel = sb
      .channel("admin_unread_messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, loadUnreadMsgs)
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [isAdmin]);

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
    // Usa RPC consolidada (traz email, phone, grupos de acesso de uma vez,
    // já filtrando admins). Substitui a query antiga em profiles + user_progress.
    const { data, error } = await supabase.rpc("admin_list_students_full");
    if (error) {
      console.warn("[admin] fetchStudents:", error);
      setLoading(false);
      return;
    }
    const rows = (data || []) as Array<{
      user_id: string;
      display_name: string | null;
      email: string | null;
      phone: string | null;
      avatar_url: string | null;
      created_at: string;
      is_blocked: boolean;
      groups: Array<{ id: string; name: string }>;
      total_xp: number; coins: number; lives: number; streak: number;
      completed_phases: number[]; badges: unknown; daily_xp: number; confidence: number;
    }>;
    const merged: StudentData[] = rows.map((r) => ({
      user_id: r.user_id,
      display_name: r.display_name || "Sem nome",
      email: r.email,
      phone: r.phone,
      avatar_url: r.avatar_url,
      created_at: r.created_at,
      is_blocked: r.is_blocked || false,
      groups: r.groups || [],
      completed_phases: r.completed_phases || [],
      total_xp: r.total_xp || 0,
      confidence: r.confidence || 0,
      welcome_video_views: 0,
      progress_updated_at: r.created_at,
      coins: r.coins || 0,
      lives: r.lives ?? 5,
      streak: r.streak || 0,
      badges: Array.isArray(r.badges) ? r.badges as string[] : [],
    }));
    setStudents(merged);
    setLoading(false);
  }

  // Lista de grupos de acesso disponíveis (carregada uma vez)
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    supabase.rpc("admin_list_access_groups").then(({ data }) => {
      if (Array.isArray(data)) setAccessGroups(data as AccessGroup[]);
    });
  }, [isAdmin]);

  async function grantGroup(userId: string, groupId: string) {
    const { error } = await supabase.rpc("admin_grant_access_group", { p_user_id: userId, p_group_id: groupId });
    if (error) { toast.error("Erro ao adicionar ao grupo"); return; }
    toast.success("Grupo adicionado");
    fetchStudents();
  }

  async function revokeGroup(userId: string, groupId: string) {
    const { error } = await supabase.rpc("admin_revoke_access_group", { p_user_id: userId, p_group_id: groupId });
    if (error) { toast.error("Erro ao remover do grupo"); return; }
    toast.success("Grupo removido");
    fetchStudents();
  }

  async function doToggleStudentBlocked(userId: string, newBlocked: boolean) {
    const { error } = await supabase.rpc("admin_toggle_student_blocked", { p_user_id: userId, p_blocked: newBlocked });
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(newBlocked ? "Aluno inativado" : "Aluno reativado");
    fetchStudents();
  }

  function toggleStudentBlocked(userId: string, currentBlocked: boolean, studentName: string) {
    const newBlocked = !currentBlocked;
    if (!newBlocked) {
      // Reativar não precisa de confirmação
      doToggleStudentBlocked(userId, false);
      return;
    }
    setConfirmModal({
      title: "Inativar aluno?",
      message: `${studentName} vai ser deslogado(a) e não vai conseguir acessar a área de membros até você reativar.`,
      confirmLabel: "Inativar",
      variant: "danger",
      onConfirm: () => doToggleStudentBlocked(userId, true),
    });
  }

  // ─── Marcar como expirado / reativar ─────────────────────────────────
  // Diferente do "Inativar" (is_blocked) e do "Excluir definitivamente"
  // (delete_user_by_admin). Aqui o aluno CONTINUA conseguindo logar, mas
  // só vê a tela AccessExpiredScreen com botões "Renovar" e "Suporte".
  // Mantém todos os dados — reativar volta tudo como estava.
  async function doSetAccessStatus(userId: string, newStatus: "active" | "expired") {
    // @ts-ignore — RPC nova, types ainda não regenerados
    const { error } = await supabase.rpc("admin_set_user_access_status", {
      p_user_id: userId,
      p_status: newStatus,
    });
    if (error) {
      toast.error("Erro ao alterar status", { description: error.message });
      return;
    }
    toast.success(
      newStatus === "expired"
        ? "Matrícula marcada como expirada"
        : "Acesso reativado",
      {
        description:
          newStatus === "expired"
            ? "Aluno vai ver tela de renovação ao logar (dados preservados)"
            : "Aluno volta a ter acesso normal aos cursos",
      },
    );
    fetchStudents();
  }

  function toggleAccessStatus(userId: string, currentStatus: string | undefined, studentName: string) {
    const isExpired = currentStatus === "expired";
    if (isExpired) {
      // Reativar não precisa de confirmação
      doSetAccessStatus(userId, "active");
      return;
    }
    setConfirmModal({
      title: "Marcar matrícula como expirada?",
      message: `${studentName} vai conseguir logar mas só verá a tela de renovação. Progresso e dados são MANTIDOS — se renovar, volta tudo.`,
      confirmLabel: "Marcar como expirada",
      variant: "warning",
      onConfirm: () => doSetAccessStatus(userId, "expired"),
    });
  }

  async function resetStudentProgress(userId: string) {
    // Chama a RPC admin_reset_student que zera TUDO transacionalmente:
    // user_progress, lesson_progress, lesson_comments, lesson_reports,
    // community_posts/likes/saves, user_missions, coin_transactions,
    // daily_wheel_spins, discount_coupons, active_sessions (forca logout)
    // e profiles.avatar_url. Aluno vira "novo aluno" de novo.
    const { data, error } = await supabase.rpc("admin_reset_student", {
      p_user_id: userId,
    });

    if (error) {
      console.warn("[admin] reset error:", error);
      toast.error("Erro ao resetar aluno", { description: error.message });
      return;
    }

    const summary = (data as Array<{ ok: boolean; summary: any }>)?.[0]?.summary;
    toast.success("Aluno resetado completamente! 🔄", {
      description: "Aulas, missões, moedas, roleta, comentários, posts e sessão zerados.",
      duration: 6000,
    });
    if (summary) {
      console.info("[admin] reset summary:", summary);
    }
    fetchStudents();
  }

  // ─── Primeiro acesso: copiar link + reenviar email ───────────────────
  // Chama edge function admin-first-access que:
  //   1) Reutiliza token ativo (não usado e não expirado) ou cria um novo
  //   2) Retorna a URL completa (action=get_link) OU envia email via Brevo
  //      reutilizando o mesmo template do webhook Eduzz (action=resend_email)
  // Estado de loading por aluno + por ação pra mostrar spinner no botão certo.
  const [firstAccessBusy, setFirstAccessBusy] = useState<Record<string, "copy" | "email" | "pw" | null>>({});
  // Modal de fallback: aparece quando o copy automático falha (user gesture
  // perdido após await na chamada da edge function). O admin clica "Copiar"
  // dentro do modal — gesture fresco → clipboard.writeText funciona.
  const [firstAccessLinkModal, setFirstAccessLinkModal] = useState<string | null>(null);
  // Modal de senha gerada: mostra a senha nova pro admin ver/copiar + a
  // mensagem pronta pra mandar pro aluno (login + senha + link).
  const [passwordModal, setPasswordModal] = useState<{
    name: string; email: string; password: string; loginUrl: string; message: string;
  } | null>(null);

  // Helper: tenta copiar pro clipboard usando a API moderna primeiro
  // e o fallback via textarea + execCommand depois. Retorna boolean.
  // Antes a função silenciava o `execCommand("copy")` que retornava false
  // (deprecated em browsers modernos) — agora a gente confere e propaga.
  async function tryCopyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;
    // 1) API moderna — pode falhar se user gesture activation expirou
    //    durante o await da edge function
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn("[copyLink] clipboard.writeText falhou:", err);
    }
    // 2) Fallback textarea + execCommand — CHECA o retorno (era o bug)
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok === true;
    } catch (err) {
      console.warn("[copyLink] execCommand falhou:", err);
      return false;
    }
  }

  async function copyFirstAccessLink(userId: string) {
    setFirstAccessBusy((p) => ({ ...p, [userId]: "copy" }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-first-access", {
        body: { action: "get_link", user_id: userId },
      });
      // Valida resposta: precisa de string não vazia
      const link = typeof data?.link === "string" ? data.link.trim() : "";
      if (error || !link) {
        toast.error("Não consegui gerar o link", {
          description: error?.message || data?.error || "Resposta vazia do servidor",
        });
        return;
      }
      const copied = await tryCopyToClipboard(link);
      if (copied) {
        toast.success("Link copiado!", {
          description: "Cole onde quiser. Expira em 7 dias.",
          duration: 4000,
        });
      } else {
        // Clipboard bloqueado (user gesture perdido). Mostra modal com
        // o link visível + botão "Copiar" que dispara com gesture novo.
        setFirstAccessLinkModal(link);
      }
    } finally {
      setFirstAccessBusy((p) => ({ ...p, [userId]: null }));
    }
  }

  async function resendFirstAccessEmail(userId: string, email: string | null) {
    setFirstAccessBusy((p) => ({ ...p, [userId]: "email" }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-first-access", {
        body: { action: "resend_email", user_id: userId },
      });
      if (error || !data?.ok) {
        toast.error("Não consegui reenviar o email", { description: error?.message || data?.reason || "Tente de novo" });
        return;
      }
      toast.success("Email de primeiro acesso reenviado!", {
        description: email ? `Pra ${email}` : "Aluno deve receber em alguns segundos",
        duration: 4500,
      });
    } finally {
      setFirstAccessBusy((p) => ({ ...p, [userId]: null }));
    }
  }

  // ─── Gerar senha + copiar mensagem pronta ─────────────────────────────
  // A senha real do aluno NÃO existe em texto (fica em hash) — então "ver a
  // senha" = gerar uma nova. Isso SUBSTITUI a senha anterior. Copia a
  // mensagem no formato pedido e abre modal pra o admin ver a senha.
  async function generatePasswordAndCopy(userId: string, fallbackName: string) {
    setFirstAccessBusy((p) => ({ ...p, [userId]: "pw" }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-first-access", {
        body: { action: "set_password", user_id: userId },
      });
      const password = typeof data?.password === "string" ? data.password : "";
      const email = typeof data?.email === "string" ? data.email : "";
      const loginUrl = typeof data?.login_url === "string" ? data.login_url : "";
      if (error || !password) {
        toast.error("Não consegui gerar a senha", {
          description: error?.message || data?.error || "Tente de novo",
        });
        return;
      }
      const nome = ((data?.display_name || fallbackName || "aluna").trim().split(/\s+/)[0]) || "aluna";
      const message =
        `Prontinho ${nome}, aqui está o seu login e senha:\n\n` +
        `Login: ${email}\n` +
        `Senha: ${password}\n\n` +
        `Link para acesso: ${loginUrl}`;
      const copied = await tryCopyToClipboard(message);
      if (copied) {
        toast.success("Senha gerada e mensagem copiada!", {
          description: "Cola no WhatsApp da aluna. A senha antiga deixou de valer.",
          duration: 5000,
        });
      }
      // Abre o modal de qualquer forma pra o admin VER a senha e recopiar.
      setPasswordModal({ name: nome, email, password, loginUrl, message });
    } finally {
      setFirstAccessBusy((p) => ({ ...p, [userId]: null }));
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

  async function doDeleteStudent(userId: string) {
    // @ts-ignore
    const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });

    if (error) {
      toast.error("Erro interno ao tentar excluir: " + error.message);
    } else {
      toast.success("A conta do aluno foi extinta do banco de dados!");
      fetchStudents();
    }
  }

  function deleteStudent(userId: string, name: string) {
    setConfirmModal({
      title: "Exclusão DEFINITIVA",
      message: `Isso apaga DE VEZ a conta de "${name}" do banco. Sem volta. O aluno precisará comprar de novo pra entrar.`,
      confirmLabel: "Apagar definitivamente",
      variant: "danger",
      onConfirm: () => doDeleteStudent(userId),
    });
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

  // Busca de alunos: filtra por nome, email ou telefone (case-insensitive,
  // ignora acento). Vazio = mostra todos.
  const studentQuery = studentSearch.trim().toLowerCase();
  const normalize = (v: string | null | undefined) =>
    (v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filteredStudents = studentQuery
    ? students.filter((s) => {
        const q = normalize(studentQuery);
        return (
          normalize(s.display_name).includes(q) ||
          normalize(s.email).includes(q) ||
          normalize(s.phone).includes(q)
        );
      })
    : students;

  const TABS: { key: AdminTab; icon: string; label: string }[] = [
    { key: "dashboard", icon: "dashboard", label: "Dashboard" },
    { key: "analytics", icon: "monitoring", label: "Analytics" },
    { key: "students", icon: "group", label: "Alunos" },
    { key: "products", icon: "video_library", label: "Cursos" },
    { key: "groups", icon: "lock_open", label: "Grupos" },
    { key: "notifications", icon: "campaign", label: "Notificações" },
    { key: "messages", icon: "chat", label: "Mensagens" },
    { key: "comments", icon: "forum", label: "Comentários" },
    { key: "reports", icon: "analytics", label: "Relatórios" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
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
                <span className="flex-1">{t.label}</span>
                {t.key === "comments" && pendingComments > 0 && (
                  <span className="text-[10px] font-black bg-amber-500 text-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {pendingComments}
                  </span>
                )}
                {t.key === "messages" && unreadMessages > 0 && (
                  <span className="text-[10px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {unreadMessages}
                  </span>
                )}
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
              className={`relative flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors ${
                tab === t.key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${tab === t.key ? "filled-icon" : ""}`}>{t.icon}</span>
              <span className="text-[10px] font-bold">{t.label}</span>
              {t.key === "comments" && pendingComments > 0 && (
                <span className="absolute -top-0.5 right-1/2 translate-x-[16px] text-[8px] font-black bg-amber-500 text-black px-1 py-px rounded-full min-w-[14px] text-center leading-none">
                  {pendingComments}
                </span>
              )}
              {t.key === "messages" && unreadMessages > 0 && (
                <span className="absolute -top-0.5 right-1/2 translate-x-[16px] text-[8px] font-black bg-rose-500 text-white px-1 py-px rounded-full min-w-[14px] text-center leading-none">
                  {unreadMessages}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 pb-20 md:pb-6 max-w-full overflow-x-clip">
          {tab === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Visão Geral</h2>
              {/* KPI Cards — dados reais via admin_overview_kpis() */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: "group", label: "Alunos cadastrados", value: overviewKpis?.total_students ?? "—", color: "text-primary" },
                  { icon: "video_library", label: "Cursos no catálogo", value: overviewKpis?.total_courses ?? "—", color: "text-blue-500" },
                  { icon: "school", label: "Aulas cadastradas", value: overviewKpis?.total_lessons ?? "—", color: "text-emerald-500" },
                  { icon: "check_circle", label: "Aulas concluídas", value: overviewKpis?.total_lessons_completed ?? "—", color: "text-amber-500" },
                  { icon: "casino", label: "Roletas giradas", value: overviewKpis?.total_wheel_spins ?? "—", color: "text-yellow-500" },
                  { icon: "savings", label: "Cupons gerados", value: overviewKpis?.total_coupons ?? "—", color: "text-purple-500" },
                  { icon: "database", label: "XP total distribuído", value: overviewKpis?.total_xp_sum ?? "—", color: "text-rose-500" },
                  { icon: "forum", label: "Comentários pendentes", value: pendingComments, color: "text-orange-500" },
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

              {/* Conclusão real por curso (substitui a "Taxa por Fase" antiga
                  que apontava pras 3 fases hardcoded do mock que ninguém usa) */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-1">Conclusão por curso</h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Quantas aulas de cada curso foram concluídas no total (somando todas as alunas).
                </p>
                {courseCompletion.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sem cursos cadastrados ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {courseCompletion.map((c) => {
                      const denominator = c.total_lessons * Math.max(c.unique_students_completed, 1);
                      const pct = denominator > 0
                        ? Math.min(100, Math.round((c.total_completions / denominator) * 100))
                        : 0;
                      return (
                        <div key={c.product_id} className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-blue-500">video_library</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center text-xs mb-1 gap-2">
                              <span className="font-medium truncate">{c.product_title}</span>
                              <span className="text-muted-foreground shrink-0">
                                {c.total_completions} conclusões · {c.unique_students_completed} aluna{c.unique_students_completed === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: "hsl(var(--primary))" }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{c.total_lessons} aula{c.total_lessons === 1 ? "" : "s"} no catálogo</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Alunos recentes — métrica de progresso baseada em XP real */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4">Alunos recentes</h3>
                <div className="space-y-3">
                  {students.filter((s) => s.user_id !== user?.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhum aluno cadastrado ainda. Vai aparecer aqui quando o webhook da Eduzz começar a liberar acessos.</p>
                  ) : (
                    students
                      .filter((s) => s.user_id !== user?.id)
                      .slice(0, 5)
                      .map((s) => {
                        const level = Math.floor(s.total_xp / 100) + 1;
                        const status = s.total_xp >= 100 ? "Em progresso" : s.total_xp > 0 ? "Começando" : "Novo";
                        const statusClass =
                          s.total_xp >= 500
                            ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                            : s.total_xp > 0
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground";
                        return (
                          <div key={s.user_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {s.display_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{s.display_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Nv. {level} · {s.total_xp} XP · 🔥 {s.streak ?? 0} dia{(s.streak ?? 0) === 1 ? "" : "s"}
                                </p>
                              </div>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusClass}`}>
                              {status}
                            </span>
                          </div>
                        );
                      })
                  )}
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

              {/* Busca por nome, email ou telefone — filtra a lista abaixo */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xl pointer-events-none">search</span>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Buscar por nome, email ou telefone…"
                  className="w-full pl-11 pr-10 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
                {studentSearch && (
                  <button
                    onClick={() => setStudentSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Limpar busca"
                    title="Limpar"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  {studentSearch && filteredStudents.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      Nenhum aluno encontrado pra "{studentSearch}".
                    </div>
                  )}
                  {filteredStudents
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
                                {s.is_blocked && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-destructive/10 text-destructive rounded uppercase">Inativo</span>}
                                {s.access_status === "expired" && !s.is_blocked && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded uppercase inline-flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                                    Expirado
                                  </span>
                                )}
                              </div>
                              {/* Linha 1: data de cadastro */}
                              <p className="text-[11px] text-muted-foreground">
                                Cadastro: {new Date(s.created_at).toLocaleDateString("pt-BR")}
                              </p>
                              {/* Linha 2: email + telefone (telefone clicável → abre WhatsApp) */}
                              {(s.email || s.phone) && (
                                <p className="text-[11px] text-muted-foreground/80 truncate">
                                  {s.email && <span title={s.email}>✉ {s.email}</span>}
                                  {s.email && s.phone && <span className="mx-1.5">·</span>}
                                  {s.phone && (
                                    <a
                                      href={`https://wa.me/${s.phone.replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[hsl(var(--success))] hover:underline"
                                      title={`Abrir WhatsApp: ${s.phone}`}
                                    >
                                      <span className="material-symbols-outlined text-[12px]">chat</span>
                                      {s.phone}
                                    </a>
                                  )}
                                </p>
                              )}
                              {/* Linha 3: badges de grupos de acesso */}
                              {s.groups.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {s.groups.map((g) => (
                                    <span
                                      key={g.id}
                                      className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20"
                                    >
                                      {g.name}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); revokeGroup(s.user_id, g.id); }}
                                        className="hover:text-destructive transition-colors -mr-0.5"
                                        title={`Remover do grupo "${g.name}"`}
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Botão único: só expandir/colapsar.
                              As outras ações (ativar/inativar, adicionar a grupo)
                              ficam dentro de uma barra de ações abaixo. */}
                          <button
                            onClick={() => setExpandedStudent(expandedStudent === s.user_id ? null : s.user_id)}
                            className="shrink-0 size-9 rounded-lg bg-accent flex items-center justify-center hover:bg-muted transition-colors"
                            title={expandedStudent === s.user_id ? "Colapsar" : "Ver detalhes"}
                          >
                            <span className={`material-symbols-outlined text-base transition-transform ${expandedStudent === s.user_id ? "rotate-180" : ""}`}>expand_more</span>
                          </button>
                        </div>

                        {/* Barra de ações rápidas — cores do design system */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {/* Visualizar como aluno — espelho read-only do acesso */}
                          <button
                            onClick={() => setViewAsUser({ id: s.user_id, name: s.display_name })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                            title="Ver exatamente o que esse aluno vê (cursos liberados/trancados, status, progresso) — sem alterar nada"
                          >
                            <span className="material-symbols-outlined text-base">visibility</span>
                            Visualizar como aluno
                          </button>

                          {/* Toggle ativo/inativo */}
                          <button
                            onClick={() => toggleStudentBlocked(s.user_id, s.is_blocked, s.display_name)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                              s.is_blocked
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`}
                            title={s.is_blocked ? "Reativar este aluno (libera o acesso)" : "Inativar este aluno (bloqueia o acesso e derruba a sessão)"}
                          >
                            <span className="material-symbols-outlined text-base">
                              {s.is_blocked ? "lock_open" : "lock"}
                            </span>
                            {s.is_blocked ? "Reativar" : "Inativar"}
                          </button>

                          {/* Marcar matrícula como expirada / reativar acesso.
                              Diferente de "Inativar" — aluno LOGA mas vê tela
                              AccessExpiredScreen com botões de renovação. */}
                          <button
                            onClick={() => toggleAccessStatus(s.user_id, s.access_status, s.display_name)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                              s.access_status === "expired"
                                ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.25)]"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                            }`}
                            title={
                              s.access_status === "expired"
                                ? "Reativar acesso (volta como estava)"
                                : "Marcar matrícula como expirada — aluno verá tela de renovação"
                            }
                          >
                            <span className="material-symbols-outlined text-base">
                              {s.access_status === "expired" ? "verified" : "schedule"}
                            </span>
                            {s.access_status === "expired" ? "Reativar acesso" : "Marcar expirada"}
                          </button>

                          {/* Copiar link de primeiro acesso */}
                          <button
                            onClick={() => copyFirstAccessLink(s.user_id)}
                            disabled={firstAccessBusy[s.user_id] === "copy"}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Gera/recupera o token de primeiro acesso e copia a URL pro clipboard (válida por 7 dias)"
                          >
                            {firstAccessBusy[s.user_id] === "copy" ? (
                              <span className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-base">link</span>
                            )}
                            Copiar link
                          </button>

                          {/* Reenviar email de primeiro acesso */}
                          <button
                            onClick={() => resendFirstAccessEmail(s.user_id, s.email)}
                            disabled={firstAccessBusy[s.user_id] === "email"}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Reenvia o email transacional com o link de primeiro acesso"
                          >
                            {firstAccessBusy[s.user_id] === "email" ? (
                              <span className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-base">forward_to_inbox</span>
                            )}
                            Reenviar email
                          </button>

                          {/* Gerar senha + copiar mensagem pronta (login+senha+link) */}
                          <button
                            onClick={() => generatePasswordAndCopy(s.user_id, s.display_name)}
                            disabled={firstAccessBusy[s.user_id] === "pw"}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Gera uma senha nova pro aluno (substitui a anterior) e copia a mensagem pronta com login, senha e link de acesso"
                          >
                            {firstAccessBusy[s.user_id] === "pw" ? (
                              <span className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-base">key</span>
                            )}
                            Senha + copiar
                          </button>

                          {/* Adicionar a grupo — dropdown alinhado ao design system */}
                          {accessGroups.length > 0 && accessGroups.filter((g) => !s.groups.some((sg) => sg.id === g.id)).length > 0 && (
                            <div className="relative">
                              <button
                                onClick={() => setGroupMenuFor(groupMenuFor === s.user_id ? null : s.user_id)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                  groupMenuFor === s.user_id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                                }`}
                                title="Adicionar a um grupo de acesso"
                              >
                                <span className="material-symbols-outlined text-base">group_add</span>
                                Adicionar a grupo
                                <span className={`material-symbols-outlined text-sm transition-transform ${groupMenuFor === s.user_id ? "rotate-180" : ""}`}>expand_more</span>
                              </button>

                              {/* Dropdown — segue padrão do design system (sem border-2 amarelo) */}
                              {groupMenuFor === s.user_id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setGroupMenuFor(null)} />
                                  <div className="absolute top-full left-0 mt-2 min-w-[220px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50">
                                    <div className="px-3 py-2 border-b border-border">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Escolha o grupo
                                      </p>
                                    </div>
                                    <ul className="py-1">
                                      {accessGroups
                                        .filter((g) => !s.groups.some((sg) => sg.id === g.id))
                                        .map((g) => (
                                          <li key={g.id}>
                                            <button
                                              onClick={() => {
                                                grantGroup(s.user_id, g.id);
                                                setGroupMenuFor(null);
                                              }}
                                              className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center gap-2"
                                            >
                                              <span className="material-symbols-outlined text-muted-foreground text-base">add</span>
                                              <span className="text-sm font-medium text-foreground flex-1 truncate">{g.name}</span>
                                            </button>
                                          </li>
                                        ))}
                                    </ul>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Resetar progresso — usa modal customizado */}
                          <button
                            onClick={() => setConfirmModal({
                              title: "Zerar progresso?",
                              message: `Vamos apagar TUDO de ${s.display_name}: aulas, missões, moedas, roleta, comentários, posts, cupons e a sessão ativa (faz logout). O email continua liberado pra entrar de novo. Essa ação não tem volta.`,
                              confirmLabel: "Zerar tudo",
                              variant: "danger",
                              onConfirm: () => resetStudentProgress(s.user_id),
                            })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title="Zera todo o progresso (aulas, missões, etc.)"
                          >
                            <span className="material-symbols-outlined text-base">restart_alt</span>
                            Zerar progresso
                          </button>
                        </div>

                        {/* Stats + Phases + Quick Actions só aparecem quando o card
                            está expandido. No card minimizado, o admin vê só
                            nome/email/telefone/grupos. */}
                        {expandedStudent === s.user_id && (
                        <>
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

                        </>
                        )}

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

                            {/* Editor de telefone — pra preencher manualmente
                                quando o webhook nao trouxe (ou quando o admin
                                quer atualizar). Salva via admin_set_student_phone. */}
                            <PhoneEditor
                              userId={s.user_id}
                              currentPhone={s.phone}
                              onSaved={fetchStudents}
                            />

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
                                onClick={() => setConfirmModal({
                                  title: "Zerar tudo do aluno?",
                                  message: `${s.display_name} volta pro estado de NOVO ALUNO. Apaga: XP, moedas, vidas, ofensiva, medalhas, aulas, missões, roleta, comentários, posts, cupons, avatar e sessão ativa. O email continua liberado.`,
                                  confirmLabel: "Zerar tudo",
                                  variant: "danger",
                                  onConfirm: () => resetStudentProgress(s.user_id),
                                })}
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

                            {/* Métricas de engajamento por email — só carrega quando o card expande */}
                            <StudentEmailMetrics userId={s.user_id} />

                            {/* Conversa direta (chat admin <-> aluna) — mostra o
                                que a aluna enviou e permite responder na hora.
                                Mesmo componente da aba Mensagens. */}
                            <div className="mt-4 pt-4 border-t border-border">
                              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-sm">chat</span>
                                Conversa direta
                              </h4>
                              <div className="bg-background/50 border border-border rounded-2xl overflow-hidden h-[400px] flex flex-col">
                                <AdminStudentChat userId={s.user_id} studentName={s.display_name} />
                              </div>
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
              {/* ConfirmModal — segue o mesmo padrão visual do editModal acima
                  (bg-card + border-border + rounded-2xl + sem caution-tape) */}
              {confirmModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
                  <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="text-center mb-6">
                      <div className={`size-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
                        confirmModal.variant === "danger" ? "bg-destructive/10" : "bg-primary/10"
                      }`}>
                        <span className={`material-symbols-outlined text-2xl ${
                          confirmModal.variant === "danger" ? "text-destructive" : "text-primary"
                        }`}>
                          {confirmModal.variant === "danger" ? "warning" : "help"}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold">{confirmModal.title}</h3>
                      <p className="text-sm text-muted-foreground mt-2 leading-snug">
                        {confirmModal.message}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmModal(null)}
                        className="flex-1 py-3 rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-accent transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          const action = confirmModal.onConfirm;
                          setConfirmModal(null);
                          await action();
                        }}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
                          confirmModal.variant === "danger"
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {confirmModal.confirmLabel}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de fallback do copiar link de primeiro acesso.
                  Aparece quando o copy automático falha (user gesture perdido).
                  O botão "Copiar" aqui dispara com gesture fresco, então funciona. */}
              {firstAccessLinkModal && (
                <div
                  className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
                  onClick={() => setFirstAccessLinkModal(null)}
                >
                  <div
                    className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-center mb-5">
                      <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-primary text-2xl">link</span>
                      </div>
                      <h3 className="text-lg font-bold">Link de primeiro acesso</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clica em "Copiar" abaixo. Expira em 7 dias.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <textarea
                        readOnly
                        value={firstAccessLinkModal}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-mono break-all resize-none focus:outline-none focus:border-primary"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFirstAccessLinkModal(null)}
                          className="flex-1 py-3 rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-accent transition-colors"
                        >
                          Fechar
                        </button>
                        <button
                          onClick={async () => {
                            // Gesture fresco aqui — clipboard funciona
                            const ok = await tryCopyToClipboard(firstAccessLinkModal);
                            if (ok) {
                              toast.success("Link copiado!", {
                                description: "Cole onde quiser. Expira em 7 dias.",
                                duration: 4000,
                              });
                              setFirstAccessLinkModal(null);
                            } else {
                              toast.error("Não consegui copiar automaticamente", {
                                description: "Seleciona o link no campo acima e copia com Ctrl+C.",
                              });
                            }
                          }}
                          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-base">content_copy</span>
                          Copiar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {passwordModal && (
                <div
                  className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
                  onClick={() => setPasswordModal(null)}
                >
                  <div
                    className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-center mb-4">
                      <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-primary text-2xl">key</span>
                      </div>
                      <h3 className="text-lg font-bold">Senha gerada</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mensagem pronta pra mandar pra {passwordModal.name}. Já copiei pro seu clipboard.
                      </p>
                    </div>

                    <div className="flex items-start gap-2 text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 mb-3">
                      <span className="material-symbols-outlined text-sm mt-0.5">warning</span>
                      <span>Essa senha <strong>substitui</strong> qualquer senha anterior da aluna — a antiga deixou de funcionar.</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 mb-3">
                      <div className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2">
                        <span className="text-[11px] text-muted-foreground shrink-0">Login</span>
                        <span className="text-sm font-mono truncate">{passwordModal.email}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2">
                        <span className="text-[11px] text-muted-foreground shrink-0">Senha</span>
                        <span className="text-sm font-mono font-bold text-primary tracking-wide">{passwordModal.password}</span>
                      </div>
                    </div>

                    <textarea
                      readOnly
                      value={passwordModal.message}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs whitespace-pre-wrap resize-none focus:outline-none focus:border-primary mb-3"
                      rows={7}
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => setPasswordModal(null)}
                        className="flex-1 py-3 rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-accent transition-colors"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await tryCopyToClipboard(passwordModal.message);
                          if (ok) toast.success("Mensagem copiada!", { description: "Cola no WhatsApp da aluna.", duration: 4000 });
                          else toast.error("Não consegui copiar", { description: "Seleciona o texto acima e copia com Ctrl+C." });
                        }}
                        className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                        Copiar mensagem
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
              {/* Visualizar como aluno — espelho read-only do acesso */}
              {viewAsUser && (
                <StudentAccessPreview
                  userId={viewAsUser.id}
                  fallbackName={viewAsUser.name}
                  onClose={() => setViewAsUser(null)}
                />
              )}
            </div>
          )}

          {tab === "analytics" && <AnalyticsTab />}

          {tab === "products" && <ProductsManager />}

          {tab === "groups" && <GroupsManager />}

          {tab === "notifications" && <NotificationsManager />}

          {tab === "messages" && <MessagesManager />}

          {tab === "comments" && <CommentsModeration />}

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
