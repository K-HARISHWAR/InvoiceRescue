import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';

export type DashboardMetrics = {
  metrics: {
    outstanding: number;
    overdue: number;
    atRisk: number;
    collectedThisMonth: number;
    averageDaysToPay: number;
    averageDaysLate: number;
    onTimePaymentRate: number;
    openInvoiceCount: number;
  };
  aging: {
    notDue: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
  };
  pipeline: Record<string, number>;
};

export function useDashboardMetrics() {
  const { business } = useSession();

  return useQuery({
    queryKey: ['dashboardMetrics', business?.id],
    queryFn: async () => {
      if (!business?.id) return null;
      
      const { data, error } = await supabase
        .rpc('get_dashboard_metrics', { target_business_id: business.id });
        
      if (error) throw error;
      return data as DashboardMetrics;
    },
    enabled: !!business?.id,
  });
}

export function useInvoicesRequiringAttention() {
  const { business } = useSession();

  return useQuery({
    queryKey: ['invoicesRequiringAttention', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      // Fetch high/critical risk invoices, ordered by outstanding_amount descending
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          due_date,
          outstanding_amount,
          payment_status,
          risk_level,
          customers ( name, company_name )
        `)
        .eq('business_id', business.id)
        .in('payment_status', ['open', 'partial', 'disputed'])
        .in('risk_level', ['high', 'critical'])
        .order('outstanding_amount', { ascending: false })
        .limit(5);
        
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });
}

export function useExpectedCashInflow() {
  const { business } = useSession();

  return useQuery({
    queryKey: ['expectedCashInflow', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .rpc('get_expected_cash_inflow', { target_business_id: business.id });
        
      if (error) throw error;
      return data as { week_start: string, amount: number }[];
    },
    enabled: !!business?.id,
  });
}

export function useCustomerPaymentBehaviour() {
  const { business } = useSession();

  return useQuery({
    queryKey: ['customerPaymentBehaviour', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .rpc('get_customer_payment_behaviour', { target_business_id: business.id });
        
      if (error) throw error;
      return data as { customer_name: string, avg_days_late: number }[];
    },
    enabled: !!business?.id,
  });
}

export function useCollectionSuccess() {
  const { business } = useSession();

  return useQuery({
    queryKey: ['collectionSuccess', business?.id],
    queryFn: async () => {
      if (!business?.id) return null;
      
      const { data, error } = await supabase
        .rpc('get_collection_success', { target_business_id: business.id });
        
      if (error) throw error;
      return data as { afterReminder: number, afterPromise: number, afterEscalation: number };
    },
    enabled: !!business?.id,
  });
}
