import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { gmailKeys } from '@/lib/queryKeys';

export function useGmailConnection(businessId: string | undefined) {
  return useQuery({
    queryKey: gmailKeys.business(businessId),
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase.rpc('get_gmail_connection_status', {
        p_business_id: businessId
      });

      if (error) {
        console.error('Error fetching gmail connection status:', error);
        throw error;
      }

      return data?.[0] || { is_connected: false };
    },
    enabled: !!businessId,
  });
}
