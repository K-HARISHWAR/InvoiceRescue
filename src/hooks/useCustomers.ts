import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';

export type Customer = {
  id: string;
  business_id: string;
  name: string;
  company_name: string | null;
  primary_email: string | null;
  phone: string | null;
  gstin: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function useCustomers() {
  const { business } = useSession();
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      if (!business) throw new Error('No business context');
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          invoices(*)
        `)
        .eq('business_id', business.id)
        .order('name');
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!business,
  });

  const createCustomer = useMutation({
    mutationFn: async (newCustomer: Partial<Customer>) => {
      if (!business) throw new Error('No business context');
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...newCustomer, business_id: business.id }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', business?.id] });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async (args: { id: string, updates: Partial<Customer> }) => {
      if (!business) throw new Error('No business context');
      const { data, error } = await supabase
        .from('customers')
        .update(args.updates)
        .eq('id', args.id)
        .eq('business_id', business.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers', business?.id] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
    },
  });

  return {
    customers: customersQuery.data ?? [],
    isLoading: customersQuery.isLoading,
    isError: customersQuery.isError,
    error: customersQuery.error,
    createCustomer,
    updateCustomer,
  };
}

export function useCustomer(id: string | undefined) {
  const { business } = useSession();

  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!business || !id) throw new Error('Missing context or id');
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('business_id', business.id)
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!business && !!id,
  });
}
