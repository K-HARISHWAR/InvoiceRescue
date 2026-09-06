import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface SavedView {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  view_type: string;
  filters: any;
  created_at: string;
}

export const viewKeys = {
  all: ['saved_views'] as const,
  business: (businessId: string) => [...viewKeys.all, businessId] as const,
  type: (businessId: string, type: string) => [...viewKeys.business(businessId), type] as const,
};

export function useSavedViews(businessId: string | undefined, viewType: string = 'action') {
  return useQuery({
    queryKey: viewKeys.type(businessId!, viewType),
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('business_id', businessId)
        .eq('view_type', viewType)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching saved views:', error);
        throw error;
      }

      return data as SavedView[];
    },
    enabled: !!businessId,
  });
}

export function useCreateSavedView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ businessId, name, viewType, filters }: { businessId: string; name: string; viewType: string; filters: any }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('saved_views')
        .insert({
          business_id: businessId,
          user_id: userData.user.id,
          name,
          view_type: viewType,
          filters
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.type(variables.businessId, variables.viewType) });
      toast.success('View saved successfully');
    },
    onError: (error) => {
      console.error('Failed to save view:', error);
      toast.error('Failed to save view');
    }
  });
}
