import React, { createContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export type Business = {
  id: string;
  name: string;
  legal_name: string | null;
  default_currency: string;
  timezone: string;
  country: string;
};

export type Membership = {
  id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  business_id: string;
};

type SessionContextType = {
  session: Session | null;
  user: User | null;
  business: Business | null;
  membership: Membership | null;
  role: Membership['role'] | null;
  isLoading: boolean;
  refreshBusinessContext: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBusinessContext = async (userId: string) => {
    const { data: memberData, error: memberError } = await supabase
      .from('business_members')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (memberError || !memberData) {
      setBusiness(null);
      setMembership(null);
      return;
    }

    setMembership(memberData as Membership);

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', memberData.business_id)
      .maybeSingle();

    if (!businessError && businessData) {
      setBusiness(businessData as Business);
    } else {
      setBusiness(null);
    }
  };

  const initSession = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    
    if (session?.user) {
      await fetchBusinessContext(session.user.id);
    } else {
      setBusiness(null);
      setMembership(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      // Avoid triggering full fetch if only token refreshed
      if (newSession?.user?.id !== user?.id) {
          setIsLoading(true);
      }
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user && newSession.user.id !== user?.id) {
        await fetchBusinessContext(newSession.user.id);
      } else if (!newSession?.user) {
        setBusiness(null);
        setMembership(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const refreshBusinessContext = async () => {
    if (user) {
      await fetchBusinessContext(user.id);
    }
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        user,
        business,
        membership,
        role: membership?.role ?? null,
        isLoading,
        refreshBusinessContext,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
