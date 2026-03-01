import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import DrivingApp from "@/components/DrivingApp";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
        color: "white",
        fontSize: "1.2rem",
        fontWeight: 700,
      }}>
        🚘 Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <DrivingApp />;
};

export default Index;
