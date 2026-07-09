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
import CourseInfo from "./pages/CourseInfo";
import FirstAccess from "./pages/FirstAccess";
import PreviewUnlock from "./pages/PreviewUnlock";
import PreviewAlert from "./pages/PreviewAlert";
import Pesquisa from "./pages/Pesquisa";
import { CarCursor } from "./components/CarCursor";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* <CarCursor /> — cursor de carro desativado temporariamente; reativar quando quiser */}
        <AuthProvider>
          <UserProgressProvider>
            <BrowserRouter>
              <ErrorBoundary
                label="App"
                fallback={
                  <div className="min-h-screen flex items-center justify-center p-6 bg-background">
                    <div className="max-w-md w-full bg-card border border-destructive/40 rounded-2xl p-6 text-center">
                      <span className="material-symbols-outlined text-destructive text-4xl">error</span>
                      <h2 className="font-black text-lg mt-2 mb-1">Algo quebrou</h2>
                      <p className="text-xs text-muted-foreground mb-3">
                        A página não conseguiu carregar. Abra o console (F12) e nos envie a mensagem de erro pra corrigirmos.
                      </p>
                      <button
                        onClick={() => location.reload()}
                        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
                      >
                        Recarregar página
                      </button>
                    </div>
                  </div>
                }
              >
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
                  <Route path="/curso-info/:id" element={<CourseInfo />} />
                  <Route path="/primeiro-acesso" element={<FirstAccess />} />
                  <Route path="/primeiro-acesso/:token" element={<FirstAccess />} />
                  <Route path="/preview-unlock" element={<PreviewUnlock />} />
                  <Route path="/conclusao" element={<CompletionScreen />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/pesquisa" element={<Pesquisa />} />
                  <Route path="/vendas" element={<SalesPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
            </BrowserRouter>
          </UserProgressProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
