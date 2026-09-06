import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface ActionComment {
  id: string;
  business_id: string;
  action_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string | null;
  };
}

export const commentKeys = {
  all: ['action_comments'] as const,
  action: (actionId: string) => [...commentKeys.all, actionId] as const,
};

export function useActionComments(actionId: string | undefined) {
  return useQuery({
    queryKey: commentKeys.action(actionId!),
    queryFn: async () => {
      if (!actionId) return [];

      const { data, error } = await supabase
        .from('action_comments')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .eq('action_id', actionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching action comments:', error);
        throw error;
      }

      return data as unknown as ActionComment[];
    },
    enabled: !!actionId,
  });
}

export function useAddActionComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionId, businessId, comment }: { actionId: string; businessId: string; comment: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('action_comments')
        .insert({
          action_id: actionId,
          business_id: businessId,
          comment,
          user_id: userData.user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.action(variables.actionId) });
    },
    onError: (error) => {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    }
  });
}
