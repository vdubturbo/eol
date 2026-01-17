import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'user' | 'admin';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string, accessToken: string): Promise<UserProfile | null> => {
    console.log('[Auth] Fetching profile for:', userId);
    try {
      // Fetch through Express API to bypass RLS issues
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiBase}/admin/users/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        console.error('[Auth] Error fetching profile:', response.status);
        return null;
      }
      const data = await response.json();
      console.log('[Auth] Profile fetched:', data);
      return data as UserProfile;
    } catch (err) {
      console.error('[Auth] Exception fetching profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user && session?.access_token) {
      const profile = await fetchProfile(user.id, session.access_token);
      setProfile(profile);
    }
  };

  useEffect(() => {
    // Get initial session
    console.log('[Auth] Getting initial session...');
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[Auth] Initial session:', session ? 'exists' : 'none');
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && session.access_token) {
        const profile = await fetchProfile(session.user.id, session.access_token);
        setProfile(profile);
      }
      console.log('[Auth] Initial load complete, setting isLoading=false');
      setIsLoading(false);
    }).catch(err => {
      console.error('[Auth] Error getting session:', err);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user && session.access_token) {
          // Small delay to allow trigger to create profile on first sign-in
          if (event === 'SIGNED_IN') {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          const profile = await fetchProfile(session.user.id, session.access_token);
          setProfile(profile);
        } else {
          setProfile(null);
        }
        console.log('[Auth] State change complete, setting isLoading=false');
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      isLoading,
      isAdmin: profile?.role === 'admin',
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
