import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import DrivingApp from "@/components/DrivingApp";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePresenceTracker } from "@/hooks/usePresence";

const Index = () => {
  const { user, loading } = useAuth();
  useActivityTracker();
  usePresenceTracker();

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
