import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProgressProvider } from "@/contexts/UserProgressContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { CompletionScreen } from "./components/CompletionScreen";
import SalesPage from "./pages/SalesPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <UserProgressProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/boas-vindas" element={<Index />} />
                <Route path="/bem-vindo" element={<Index />} />
                <Route path="/treinos" element={<Index />} />
                <Route path="/ranking" element={<Index />} />
                <Route path="/comunidade" element={<Index />} />
                <Route path="/biblioteca" element={<Index />} />
                <Route path="/perfil" element={<Index />} />
                <Route path="/aula/:id" element={<Index />} />
                <Route path="/curso/:id" element={<Index />} />
                <Route path="/conclusao" element={<CompletionScreen />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/vendas" element={<SalesPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </UserProgressProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
