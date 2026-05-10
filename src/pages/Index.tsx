import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import DrivingApp from "@/components/DrivingApp";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePresenceTracker } from "@/hooks/usePresence";
import { useTrackTeacherPresence } from "@/hooks/useTeacherPresence";

const Index = () => {
  const { user, loading } = useAuth();
  useActivityTracker();
  usePresenceTracker();
  // Se o user logado for admin (Carla), faz track no canal "teacher-presence"
  // pra que os alunos vejam o badge "Carla online" no header do player.
  useTrackTeacherPresence();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-foreground text-lg font-bold">🚘 Carregando...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <DrivingApp />;
};

export default Index;
