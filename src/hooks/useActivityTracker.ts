import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_NAMES: Record<string, string> = {
  "/": "Início",
  "/boas-vindas": "Boas-vindas",
  "/bem-vindo": "Bem-vindo",
  "/treinos": "Treinos",
  "/ranking": "Ranking",
  "/comunidade": "Comunidade",
  "/perfil": "Perfil",
  "/admin": "Admin",
  "/login": "Login",
  "/conclusao": "Conclusão",
};

function getPageName(path: string): string {
  if (path.startsWith("/aula/")) return `Aula ${path.split("/").pop()}`;
  return PAGE_NAMES[path] || path;
}

export function useActivityTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const currentViewId = useRef<string | null>(null);
  const enterTime = useRef<number>(Date.now());
  const clickCount = useRef(0);
  const prevPath = useRef<string | null>(null);

  const flushCurrentView = useCallback(async () => {
    if (!currentViewId.current || !user) return;
    const duration = Math.round((Date.now() - enterTime.current) / 1000);
    if (duration < 1) return;
    
    await supabase
      .from("page_views")
      .update({ duration_seconds: duration, click_count: clickCount.current })
      .eq("id", currentViewId.current);
    
    currentViewId.current = null;
  }, [user]);

  const startNewView = useCallback(async (path: string) => {
    if (!user) return;
    
    const { data } = await supabase
      .from("page_views")
      .insert({
        user_id: user.id,
        page_path: path,
        page_name: getPageName(path),
        referrer_path: prevPath.current,
        entered_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (data) {
      currentViewId.current = data.id;
      enterTime.current = Date.now();
      clickCount.current = 0;
    }
  }, [user]);

  // Track clicks
  useEffect(() => {
    const handleClick = () => { clickCount.current += 1; };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Track page changes
  useEffect(() => {
    if (!user) return;
    
    const path = location.pathname;
    // Skip admin page from being tracked
    if (path === "/admin") return;
    
    flushCurrentView().then(() => {
      startNewView(path);
      prevPath.current = path;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user]);

  // Flush on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!currentViewId.current || !user) return;
      const duration = Math.round((Date.now() - enterTime.current) / 1000);
      // Use sendBeacon for reliability
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/page_views?id=eq.${currentViewId.current}`;
      const body = JSON.stringify({ duration_seconds: duration, click_count: clickCount.current });
      navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" })
      );
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushCurrentView();
    };
  }, [user, flushCurrentView]);
}
