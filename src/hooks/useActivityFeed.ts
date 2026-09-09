import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';

export interface AuditLog {
  id: string;
  business_id: string;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: any;
  created_at: string;
  actor_name?: string; // We'll join this
}

export function useActivityFeed(filters?: { user_id?: string, event_type?: string }) {
  const { business } = useSession();

  return useQuery({
    queryKey: ['activity_feed', business?.id, filters],
    queryFn: async (): Promise<AuditLog[]> => {
      if (!business?.id) return [];

      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          actor:profiles(full_name)
        `)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.user_id) {
        if (filters.user_id === 'system') {
          query = query.is('actor_user_id', null);
        } else {
          query = query.eq('actor_user_id', filters.user_id);
        }
      }

      if (filters?.event_type) {
        query = query.eq('event_type', filters.event_type);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((log: any) => ({
        ...log,
        actor_name: log.actor?.full_name || 'System'
      })) as AuditLog[];
    },
    enabled: !!business?.id,
  });
}
