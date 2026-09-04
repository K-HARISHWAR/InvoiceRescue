import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { invoiceKeys } from '@/lib/queryKeys';

export type PaymentStatus = 'draft' | 'open' | 'partial' | 'paid' | 'disputed' | 'void' | 'cancelled';
export type CollectionStage = 'monitoring' | 'due_soon' | 'overdue' | 'promise_pending' | 'promise_missed' | 'escalated' | 'recovery_ready' | 'closed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type Invoice = {
  id: string;
  business_id: string;
  entity_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  payment_terms_days: number | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  payment_status: PaymentStatus;
  collection_stage: CollectionStage;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  source: string;
  extraction_status: string | null;
  extraction_confidence: number | null;
  created_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  
  // Joined relation
  customer?: {
    id: string;
    name: string;
    company_name: string | null;
  };
};

export function useInvoices() {
  const { business } = useSession();
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: invoiceKeys.list(business?.id),
    queryFn: async () => {
      if (!business) throw new Error('No business context');
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, company_name)
        `)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!business,
  });

  const createInvoice = useMutation({
    mutationFn: async (newInvoice: Partial<Invoice>) => {
      if (!business) throw new Error('No business context');
      const { data, error } = await supabase
        .from('invoices')
        .insert([{ ...newInvoice, business_id: business.id }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(business?.id) });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async (args: { id: string, updates: Partial<Invoice>, expectedVersion: number, reason?: string }) => {
      if (!business) throw new Error('No business context');

      // Drafts can be updated directly without revisions, but using the RPC handles both securely.
      const { data, error } = await supabase.rpc('update_invoice_with_revision', {
        p_invoice_id: args.id,
        p_updates: args.updates,
        p_expected_version: args.expectedVersion,
        p_reason: args.reason || null
      });
      
      if (error) {
        if (error.message.includes('CONCURRENCY_ERROR')) {
          throw new Error('This invoice was updated by another user while you were editing it.');
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(business?.id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(data.id) });
    },
  });

  const voidInvoice = useMutation({
    mutationFn: async (args: { id: string, reason: string }) => {
      if (!business) throw new Error('No business context');

      const { data, error } = await supabase.rpc('void_invoice', {
        p_invoice_id: args.id,
        p_reason: args.reason
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(business?.id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(data.id) });
    },
  });

  return {
    invoices: invoicesQuery.data ?? [],
    isLoading: invoicesQuery.isLoading,
    isError: invoicesQuery.isError,
    error: invoicesQuery.error,
    createInvoice,
    updateInvoice,
    voidInvoice,
  };
}

export function useInvoice(id: string | undefined) {
  const { business } = useSession();

  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async () => {
      if (!business || !id) throw new Error('Missing context or id');
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', id)
        .eq('business_id', business.id)
        .single();
      
      if (error) throw error;
      return data as Invoice;
    },
    enabled: !!business && !!id,
  });
}
