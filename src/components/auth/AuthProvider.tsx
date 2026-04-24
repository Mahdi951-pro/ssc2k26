import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    // Then existing
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Heartbeat presence
  useEffect(() => {
    if (!session?.user) return;
    const update = async (online: boolean) => {
      await supabase
        .from("profiles")
        .update({ is_online: online, last_seen: new Date().toISOString() })
        .eq("user_id", session.user.id);
    };
    update(true);
    const interval = setInterval(() => update(true), 30_000);
    const onUnload = () => update(false);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onUnload);
      update(false);
    };
  }, [session?.user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
