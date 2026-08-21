import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export type CollectionActionStatus = 'recommended' | 'draft' | 'approved' | 'sent' | 'skipped' | 'completed' | 'failed';
export type CollectionActionType = 'friendly_reminder' | 'due_date_reminder' | 'overdue_reminder' | 'promise_followup' | 'escalation' | 'document_request' | 'recovery_pack';

export interface CollectionAction {
  id: string;
  business_id: string;
  invoice_id: string;
  action_type: CollectionActionType;
  status: CollectionActionStatus;
  recommended_reason: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  scheduled_for: string | null;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  invoices?: {
    invoice_number: string;
    total_amount: number;
    outstanding_amount: number;
    currency: string;
    due_date: string | null;
    risk_score: number | null;
    risk_level: string | null;
    customers?: {
      name: string;
    };
  };
}

export function useCollectionActions(businessId: string | undefined) {
  return useQuery({
    queryKey: ['collection_actions', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from('collection_actions')
        .select(`
          *,
          invoices (
            invoice_number,
            total_amount,
            outstanding_amount,
            currency,
            due_date,
            risk_score,
            risk_level,
            customers (
              name
            )
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching collection actions:', error);
        throw error;
      }

      return data as unknown as CollectionAction[];
    },
    enabled: !!businessId,
  });
}

export function useTriggerEngine(businessId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error('No business selected');
      
      const { error } = await supabase.rpc('recommend_collection_actions', {
        p_business_id: businessId
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Action engine completed');
      queryClient.invalidateQueries({ queryKey: ['collection_actions', businessId] });
    },
    onError: (error) => {
      console.error('Failed to run engine:', error);
      toast.error('Failed to run action engine');
    }
  });
}

export function useDraftAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-collection-draft', {
        body: { action_id: actionId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error?.message || 'Failed to generate draft');
      
      return data;
    },
    onSuccess: () => {
      toast.success('Draft generated successfully');
      // Invalidate both lists and specific items where appropriate
      queryClient.invalidateQueries({ queryKey: ['collection_actions'] });
    },
    onError: (error) => {
      console.error('Draft generation error:', error);
      toast.error('Failed to generate draft: ' + error.message);
    }
  });
}

export function useUpdateActionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionId, status }: { actionId: string; status: CollectionActionStatus }) => {
      const updateData: any = { 
        status, 
        updated_at: new Date().toISOString() 
      };

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        // Depending on setup, approved_by could be set via RLS or explicit user ID.
      }

      const { data, error } = await supabase
        .from('collection_actions')
        .update(updateData)
        .eq('id', actionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection_actions'] });
    },
    onError: (error) => {
      console.error('Failed to update action status:', error);
      toast.error('Failed to update status');
    }
  });
}
