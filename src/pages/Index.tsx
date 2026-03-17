import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import DrivingApp from "@/components/DrivingApp";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-foreground text-lg font-bold">🚘 Carregando...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <DrivingApp />;
};

export default Index;
