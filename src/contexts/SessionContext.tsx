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
  archived_at?: string | null;
};

export type Membership = {
  id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  business_id: string;
  business?: Business;
};

type SessionContextType = {
  session: Session | null;
  user: User | null;
  business: Business | null;
  membership: Membership | null;
  role: Membership['role'] | null;
  availableBusinesses: Business[];
  isLoading: boolean;
  refreshBusinessContext: () => Promise<void>;
  switchBusiness: (businessId: string) => void;
};

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

const ACTIVE_BUSINESS_KEY = 'invoiceRescue_activeBusinessId';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  const [business, setBusiness] = useState<Business | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  const fetchBusinessContext = async (userId: string) => {
    const { data: membersData, error: memberError } = await supabase
      .from('business_members')
      .select('*, business:businesses(*)')
      .eq('user_id', userId);

    if (memberError || !membersData || membersData.length === 0) {
      setBusiness(null);
      setMembership(null);
      setAvailableBusinesses([]);
      return;
    }

    // Filter out archived businesses
    const activeMemberships = membersData.filter(m => m.business && !m.business.archived_at);
    
    if (activeMemberships.length === 0) {
      setBusiness(null);
      setMembership(null);
      setAvailableBusinesses([]);
      return;
    }

    const businesses = activeMemberships.map(m => m.business as Business);
    // Sort businesses by name
    businesses.sort((a, b) => a.name.localeCompare(b.name));
    setAvailableBusinesses(businesses);

    let activeBusinessId = localStorage.getItem(ACTIVE_BUSINESS_KEY);
    let currentMem = activeMemberships.find(m => m.business_id === activeBusinessId);

    // If persisted ID is invalid or missing, default to the first available business
    if (!currentMem) {
      currentMem = activeMemberships[0];
      activeBusinessId = currentMem.business_id;
      if (activeBusinessId) {
        localStorage.setItem(ACTIVE_BUSINESS_KEY, activeBusinessId);
      }
    }

    setMembership(currentMem as Membership);
    setBusiness(currentMem.business as Business);
  };

  const switchBusiness = (businessId: string) => {
    if (business?.id === businessId) return; // already active

    const targetBusiness = availableBusinesses.find(b => b.id === businessId);
    if (!targetBusiness) return;

    localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
    
    // We do a hard reload to the dashboard to instantly wipe all TanStack Query cache 
    // and reset all React state. This is the safest way to prevent cross-org data leaks.
    window.location.href = '/app/dashboard';
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
      setAvailableBusinesses([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'INITIAL_SESSION') return; 

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
        setAvailableBusinesses([]);
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
        availableBusinesses,
        isLoading,
        refreshBusinessContext,
        switchBusiness,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
