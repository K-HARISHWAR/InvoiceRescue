import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { communicationKeys } from '@/lib/queryKeys';

export interface Communication {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body_text: string | null;
  sent_at: string;
  category: string | null;
  ai_summary: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
}

export function useCommunications(invoiceId: string | undefined) {
  return useQuery({
    queryKey: communicationKeys.invoice(invoiceId),
    queryFn: async () => {
      if (!invoiceId) return [];

      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error fetching communications:', error);
        throw error;
      }

      return data as Communication[];
    },
    enabled: !!invoiceId,
  });
}
