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

  return {
    payments: paymentsQuery.data ?? [],
    isLoading: paymentsQuery.isLoading,
    isError: paymentsQuery.isError,
    error: paymentsQuery.error,
    createPayment,
  };
}
