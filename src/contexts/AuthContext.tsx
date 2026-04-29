import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Check is_blocked DEFERRED (setTimeout 0) to avoid Supabase auth lock deadlock
    // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange (warning section)
    const checkBlockedDeferred = (currentSession: Session | null) => {
      if (!currentSession?.user) return;
      setTimeout(async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('is_blocked')
            .eq('user_id', currentSession.user.id)
            .maybeSingle();
          if (data?.is_blocked && mounted) {
            await supabase.auth.signOut();
            window.location.href = "/login?blocked=true";
          }
        } catch (e) {
          console.warn("checkBlocked error (non-fatal):", e);
        }
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
        checkBlockedDeferred(currentSession);
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
      checkBlockedDeferred(currentSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
