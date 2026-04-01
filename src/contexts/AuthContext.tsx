import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { migrateLocalDataToCloud } from '@/utils/migrateLocalData';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  migrating: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  migrating: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const migrationRan = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Run migration on first sign-in
        if (session?.user && !migrationRan.current) {
          migrationRan.current = true;
          setMigrating(true);
          try {
            await migrateLocalDataToCloud(session.user.id);
          } catch { /* ignore */ }
          setMigrating(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user && !migrationRan.current) {
        migrationRan.current = true;
        setMigrating(true);
        try {
          await migrateLocalDataToCloud(session.user.id);
        } catch { /* ignore */ }
        setMigrating(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, migrating, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
