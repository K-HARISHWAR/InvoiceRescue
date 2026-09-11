import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from './useSession';

export interface OnboardingStatus {
  hasOrganisation: boolean;
  hasEntity: boolean;
  hasCustomer: boolean;
  hasInvoice: boolean;
  hasGmail: boolean;
  hasTeam: boolean;
  isComplete: boolean;
}

export function useOnboardingStatus() {
  const { business } = useSession();

  return useQuery({
    queryKey: ['onboarding-status', business?.id],
    queryFn: async (): Promise<OnboardingStatus> => {
      if (!business?.id) {
        return {
          hasOrganisation: false,
          hasEntity: false,
          hasCustomer: false,
          hasInvoice: false,
          hasGmail: false,
          hasTeam: false,
          isComplete: false
        };
      }

      // Check for customers
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id);

      // Check for invoices
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id);

      // Check for team members
      const { count: memberCount } = await supabase
        .from('business_members')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id);

      // Check for gmail connection
      const { data: gmailConnection } = await supabase
        .from('gmail_connections')
        .select('status')
        .eq('business_id', business.id)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      const status = {
        hasOrganisation: true, // Always true if they have a business context
        hasEntity: true,       // Created automatically on business creation
        hasCustomer: (customerCount || 0) > 0,
        hasInvoice: (invoiceCount || 0) > 0,
        hasTeam: (memberCount || 0) > 1, // > 1 because owner is always there
        hasGmail: !!gmailConnection
      };

      // Gmail and Team are technically optional, but for the checklist "isComplete" we 
      // might just care about the core requirements, or we can say all are completed
      // Let's say core requirements are Organisation, Entity, Customer, and Invoice.
      // We will show the checklist if anything is missing, but they can dismiss it manually in the UI.
      const isComplete = status.hasCustomer && status.hasInvoice && status.hasTeam && status.hasGmail;

      return {
        ...status,
        isComplete
      };
    },
    enabled: !!business?.id,
  });
}
