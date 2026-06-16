import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import DrivingApp from "@/components/DrivingApp";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePresenceTracker } from "@/hooks/usePresence";
import { useTrackTeacherPresence } from "@/hooks/useTeacherPresence";
import { useSessionGuard } from "@/hooks/useSessionGuard";

const Index = () => {
  const { user, loading } = useAuth();
  useActivityTracker();
  usePresenceTracker();
  // Se o user logado for admin (Carla), faz track no canal "teacher-presence"
  // pra que os alunos vejam o badge "Carla online" no header do player.
  useTrackTeacherPresence();
  // Sessão única (1 device): registra esta sessão e escuta sinal de logout
  // de Realtime — derruba este browser se outro device logar com a mesma conta.
  useSessionGuard();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-foreground text-lg font-bold">🚘 Carregando...</span>
      </div>
    );
  }

  if (!user) {
    // Visitante (não logada) na RAIZ vê a página de vendas (o "site principal"),
    // não a tela de login. Em rotas internas (/biblioteca, /perfil, etc.) ela
    // continua indo pro /login pra poder entrar na conta.
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      window.location.replace("/vendas");
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <span className="text-foreground text-lg font-bold">🚘 Carregando...</span>
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  return <DrivingApp />;
};

export default Index;
