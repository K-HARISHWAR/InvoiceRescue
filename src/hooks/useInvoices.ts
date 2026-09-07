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

export type InvoiceFilters = {
  view?: string;
  search?: string;
  status?: PaymentStatus;
  stage?: CollectionStage;
  risk?: RiskLevel;
  page?: number;
  limit?: number;
};

export function useInvoices(filters: InvoiceFilters = {}) {
  const { business, user } = useSession();
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: [...invoiceKeys.list(business?.id), filters],
    queryFn: async () => {
      if (!business) throw new Error('No business context');
      
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, company_name)
        `, { count: 'exact' })
        .eq('business_id', business.id);

      // Search
      if (filters.search) {
        query = query.or(`invoice_number.ilike.%${filters.search}%,po_number.ilike.%${filters.search}%`);
      }

      // Exact matches
      if (filters.status) query = query.eq('payment_status', filters.status);
      if (filters.stage) query = query.eq('collection_stage', filters.stage);
      if (filters.risk) query = query.eq('risk_level', filters.risk);

      // Saved Views Logic
      if (filters.view) {
        switch (filters.view) {
          case 'overdue_30':
            query = query.in('payment_status', ['open', 'partial']).not('due_date', 'is', null).lt('due_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            break;
          case 'critical_large':
            query = query.eq('risk_level', 'critical').gte('outstanding_amount', 100000);
            break;
          case 'my_accounts':
            // Without an assigned_to on the invoice, we can't easily do this unless we check actions.
            // For MVP, if we don't have assigned_to on invoice, we might skip or do a best effort.
            break;
          case 'promises_today':
            query = query.eq('collection_stage', 'promise_pending'); // We'd need to join payment_promises for exact date, keeping it simple for MVP
            break;
          case 'due_soon':
            query = query.eq('collection_stage', 'due_soon');
            break;
          case 'overdue':
            query = query.in('collection_stage', ['overdue', 'escalated', 'recovery_ready']);
            break;
          case 'open':
            query = query.in('payment_status', ['open', 'partial']);
            break;
          case 'promise_pending':
            query = query.eq('collection_stage', 'promise_pending');
            break;
          case 'high_risk':
            query = query.in('risk_level', ['high', 'critical']);
            break;
          case 'paid':
            query = query.eq('payment_status', 'paid');
            break;
          case 'disputed':
            query = query.eq('payment_status', 'disputed');
            break;
        }
      }

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      query = query.order('created_at', { ascending: false }).range(from, to);
      
      const { data, count, error } = await query;
      
      if (error) throw error;
      return { data: data as Invoice[], count: count || 0 };
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

  const exportInvoices = async (filters: InvoiceFilters) => {
    if (!business) return [];
    
    let query = supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(name, company_name)
      `)
      .eq('business_id', business.id);

    // Apply the same filters (except pagination limits)
    if (filters.search) query = query.or(`invoice_number.ilike.%${filters.search}%,po_number.ilike.%${filters.search}%`);
    if (filters.status) query = query.eq('payment_status', filters.status);
    if (filters.stage) query = query.eq('collection_stage', filters.stage);
    if (filters.risk) query = query.eq('risk_level', filters.risk);

    if (filters.view) {
      switch (filters.view) {
        case 'overdue_30':
          query = query.in('payment_status', ['open', 'partial']).not('due_date', 'is', null).lt('due_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
          break;
        case 'critical_large':
          query = query.eq('risk_level', 'critical').gte('outstanding_amount', 100000);
          break;
        case 'due_soon':
          query = query.eq('collection_stage', 'due_soon');
          break;
        case 'overdue':
          query = query.in('collection_stage', ['overdue', 'escalated', 'recovery_ready']);
          break;
        case 'open':
          query = query.in('payment_status', ['open', 'partial']);
          break;
        case 'high_risk':
          query = query.in('risk_level', ['high', 'critical']);
          break;
        case 'paid':
          query = query.eq('payment_status', 'paid');
          break;
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(5000);
    if (error) throw error;
    return data;
  };

  return {
    invoices: invoicesQuery.data?.data ?? [],
    totalCount: invoicesQuery.data?.count ?? 0,
    isLoading: invoicesQuery.isLoading,
    isError: invoicesQuery.isError,
    error: invoicesQuery.error,
    createInvoice,
    updateInvoice,
    voidInvoice,
    exportInvoices,
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
