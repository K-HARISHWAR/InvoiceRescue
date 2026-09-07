import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';

export interface GlobalSearchResult {
  result_type: 'invoice' | 'customer';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export function useGlobalSearch(query: string) {
  const { business } = useSession();

  return useQuery({
    queryKey: ['global_search', business?.id, query],
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      if (!business?.id || !query || query.length < 2) return [];

      const { data, error } = await supabase.rpc('global_search', {
        p_business_id: business.id,
        p_query: query
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id && query.length >= 2,
    staleTime: 1000 * 60, // 1 minute
  });
}
