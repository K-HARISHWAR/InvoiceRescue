import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { paymentKeys, invoiceKeys } from '@/lib/queryKeys';

export type Payment = {
  id: string;
  business_id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  payment_reference: string | null;
  notes: string | null;
  recorded_by: string | null;
  reconciliation_status: 'unmatched' | 'matched' | 'verified';
  created_at: string;
};

export function usePayments(invoiceId: string | undefined) {
  const { business } = useSession();
  const queryClient = useQueryClient();

  const paymentsQuery = useQuery({
    queryKey: paymentKeys.invoice(invoiceId),
    queryFn: async () => {
      if (!business || !invoiceId) throw new Error('Missing context or invoiceId');
      
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('business_id', business.id)
        .order('paid_at', { ascending: false });
      
      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!business && !!invoiceId,
  });

  const createPayment = useMutation({
    mutationFn: async (newPayment: Partial<Payment>) => {
      if (!business || !invoiceId) throw new Error('Missing context');
      const { data, error } = await supabase
        .from('payments')
        .insert([{ ...newPayment, business_id: business.id, invoice_id: invoiceId }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: paymentKeys.invoice(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(business?.id) });
    },
  });

  const editPayment = useMutation({
    mutationFn: async ({ id, updates, reason }: { id: string; updates: Partial<Payment>; reason: string }) => {
      if (!business || !invoiceId) throw new Error('Missing context');
      
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse.user;
      
      if (!user) throw new Error('Not authenticated');

      // Fetch before_data
      const { data: beforeData, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError || !beforeData) throw new Error('Failed to fetch existing payment for revision logging');

      // Update the payment
      const { data, error } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Get revision number
      const { count } = await supabase
        .from('payment_revisions')
        .select('*', { count: 'exact', head: true })
        .eq('payment_id', id);
        
      const revNum = (count || 0) + 1;
      
      // Insert revision
      await supabase.from('payment_revisions').insert([{
        business_id: business.id,
        payment_id: id,
        revision_number: revNum,
        changed_by: user.id,
        change_reason: reason,
        before_data: beforeData,
        after_data: data,
        changed_fields: Object.keys(updates)
      }]);
      
      // Calculate outstanding
      await supabase.rpc('calculate_payment_state', { target_invoice_id: invoiceId });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.invoice(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(business?.id) });
    },
  });

  const checkDuplicatePayment = async (reference: string | null, amount: number, date: string) => {
    if (!business) return false;
    
    let query = supabase
      .from('payments')
      .select('id')
      .eq('business_id', business.id)
      .eq('amount', amount)
      .eq('paid_at', date);
      
    if (reference) {
      query = query.eq('payment_reference', reference);
    }
    
    const { data } = await query.limit(1);
    return data && data.length > 0;
  };

  return {
    payments: paymentsQuery.data ?? [],
    isLoading: paymentsQuery.isLoading,
    isError: paymentsQuery.isError,
    error: paymentsQuery.error,
    createPayment,
    editPayment,
    checkDuplicatePayment,
  };
}
