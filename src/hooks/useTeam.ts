import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export interface TeamMember {
  id: string;
  business_id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export function useTeam(businessId: string | undefined) {
  return useQuery({
    queryKey: ['team', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from('business_members')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching team members:', error);
        throw error;
      }

      return data as unknown as TeamMember[];
    },
    enabled: !!businessId,
  });
}
