import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';

export interface DailyActionItem {
  id: string; // Could be invoice id or promise id
  type: 'missed_promise' | 'overdue' | 'due_soon';
  customerName: string;
  amount: number;
  description: string;
  invoiceId: string;
}

export interface DailyBriefingData {
  outstandingAmount: number;
  actions: DailyActionItem[];
}

export function useDailyBriefing() {
  const { business: currentBusiness } = useSession();

  return useQuery({
    queryKey: ['daily-briefing', currentBusiness?.id],
    queryFn: async (): Promise<DailyBriefingData> => {
      if (!currentBusiness?.id) throw new Error('No business context');

      // Fetch outstanding amount (all open/partial/disputed invoices)
      const { data: outstandingData, error: outstandingError } = await supabase
        .from('invoices')
        .select('outstanding_amount')
        .eq('business_id', currentBusiness.id)
        .in('payment_status', ['open', 'partial', 'disputed', 'draft']);

      if (outstandingError) throw outstandingError;

      const outstandingAmount = outstandingData.reduce((sum, inv) => sum + Number(inv.outstanding_amount), 0);

      // Fetch missed promises action items
      const { data: promises, error: promisesError } = await supabase
        .from('payment_promises')
        .select(`
          id,
          status,
          invoice_id,
          invoices!inner(
            customer_id,
            customers(name)
          )
        `)
        .eq('business_id', currentBusiness.id)
        .eq('status', 'missed');

      if (promisesError) throw promisesError;

      // Fetch invoices that need attention (overdue, due_soon)
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          outstanding_amount,
          due_date,
          collection_stage,
          customers(name)
        `)
        .eq('business_id', currentBusiness.id)
        .in('payment_status', ['open', 'partial', 'disputed'])
        .in('collection_stage', ['overdue', 'escalated', 'due_soon']);

      if (invoicesError) throw invoicesError;

      const actions: DailyActionItem[] = [];

      // Add missed promises
      promises.forEach(p => {
        actions.push({
          id: `promise_${p.id}`,
          type: 'missed_promise',
          // @ts-expect-error - nested join typing
          customerName: p.invoices.customers?.name || 'Unknown Customer',
          amount: 0, // Not explicitly tracked on promise summary in briefing
          description: 'Missed payment promise.',
          invoiceId: p.invoice_id
        });
      });

      // Add overdue/due_soon
      invoices.forEach(inv => {
        if (inv.collection_stage === 'overdue' || inv.collection_stage === 'escalated') {
          // Calculate days overdue
          const due = new Date(inv.due_date);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - due.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          actions.push({
            id: `inv_${inv.id}`,
            type: 'overdue',
            // @ts-expect-error - nested join typing
            customerName: inv.customers?.name || 'Unknown Customer',
            amount: Number(inv.outstanding_amount),
            description: `${diffDays} days overdue and no response.`,
            invoiceId: inv.id
          });
        } else if (inv.collection_stage === 'due_soon') {
          const due = new Date(inv.due_date);
          const now = new Date();
          const diffTime = due.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          actions.push({
            id: `inv_${inv.id}`,
            type: 'due_soon',
            // @ts-expect-error - nested join typing
            customerName: inv.customers?.name || 'Unknown Customer',
            amount: Number(inv.outstanding_amount),
            description: `Due in ${diffDays} days.`,
            invoiceId: inv.id
          });
        }
      });

      return {
        outstandingAmount,
        actions: actions.sort((a, b) => {
          // Sort priorities: missed_promise > overdue > due_soon
          const priority = { 'missed_promise': 3, 'overdue': 2, 'due_soon': 1 };
          return priority[b.type] - priority[a.type];
        })
      };
    },
    enabled: !!currentBusiness?.id,
  });
}
