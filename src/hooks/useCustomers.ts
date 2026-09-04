import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { customerKeys } from '@/lib/queryKeys';
import { type Invoice } from '@/hooks/useInvoices';

export type ContactRole = 'accounts_payable' | 'finance' | 'procurement' | 'owner' | 'management' | 'general';

export type CustomerContact = {
  id: string;
  business_id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  role: ContactRole;
  is_primary: boolean;
  receives_collection_emails: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerNote = {
  id: string;
  business_id: string;
  customer_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type Customer = {
  id: string;
  business_id: string;
  name: string;
  company_name: string | null;
  primary_email: string | null;
  phone: string | null;
  gstin: string | null;
  notes: string | null;
  default_payment_terms_days: number | null;
  preferred_currency: string | null;
  default_entity_id: string | null;
  collection_notes: string | null;
  tags: string[];
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useCustomers() {
  const { business } = useSession();
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: [...customerKeys.list(business?.id), { activeOnly: true }],
    queryFn: async () => {
      if (!business) throw new Error('No business context');
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          invoices(*)
        `)
        .eq('business_id', business.id)
        .is('archived_at', null)
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
      queryClient.invalidateQueries({ queryKey: customerKeys.list(business?.id) });
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
      queryClient.invalidateQueries({ queryKey: customerKeys.list(business?.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(data.id) });
    },
  });

  const archiveCustomer = useMutation({
    mutationFn: async (id: string) => {
      if (!business) throw new Error('No business context');
      const { data, error } = await supabase
        .from('customers')
        .update({ 
          archived_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', business.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.list(business?.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(data.id) });
    },
  });

  const mergeCustomers = useMutation({
    mutationFn: async ({ targetId, sourceId }: { targetId: string, sourceId: string }) => {
      if (!business) throw new Error('No business context');
      const { data, error } = await supabase.rpc('merge_customers', {
        p_target_customer_id: targetId,
        p_source_customer_id: sourceId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.list(business?.id) });
      if (data?.target_id) queryClient.invalidateQueries({ queryKey: customerKeys.detail(data.target_id) });
      if (data?.source_id) queryClient.invalidateQueries({ queryKey: customerKeys.detail(data.source_id) });
      // Invalidate invoices since they might have moved
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  return {
    customers: customersQuery.data ?? [],
    isLoading: customersQuery.isLoading,
    isError: customersQuery.isError,
    error: customersQuery.error,
    createCustomer,
    updateCustomer,
    archiveCustomer,
    mergeCustomers,
  };
}

export function useCustomer(id: string | undefined) {
  const { business } = useSession();

  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      if (!business || !id) throw new Error('Missing context or id');
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          invoices(*),
          customer_contacts(*),
          customer_notes(*, profiles(full_name, avatar_url))
        `)
        .eq('id', id)
        .eq('business_id', business.id)
        .single();
      
      if (error) throw error;
      return data as Customer & { 
        invoices: Invoice[];
        customer_contacts: CustomerContact[];
        customer_notes: CustomerNote[];
      };
    },
    enabled: !!business && !!id,
  });
}

export function useCustomerContacts(customerId: string | undefined) {
  const { business } = useSession();
  const queryClient = useQueryClient();

  const createContact = useMutation({
    mutationFn: async (newContact: Partial<CustomerContact>) => {
      if (!business || !customerId) throw new Error('Missing context');
      
      // If this is set to primary, we might want to unset others. The server could do it, or we do it here.
      // For MVP, we just insert.
      const { data, error } = await supabase
        .from('customer_contacts')
        .insert([{ ...newContact, business_id: business.id, customer_id: customerId }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
    },
  });

  const updateContact = useMutation({
    mutationFn: async (args: { id: string, updates: Partial<CustomerContact> }) => {
      if (!business) throw new Error('Missing context');
      const { data, error } = await supabase
        .from('customer_contacts')
        .update(args.updates)
        .eq('id', args.id)
        .eq('business_id', business.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      if (!business) throw new Error('Missing context');
      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', id)
        .eq('business_id', business.id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
    },
  });

  return {
    createContact,
    updateContact,
    deleteContact,
  };
}

export function useCustomerNotes(customerId: string | undefined) {
  const { business, user } = useSession();
  const queryClient = useQueryClient();

  const createNote = useMutation({
    mutationFn: async (noteText: string) => {
      if (!business || !customerId || !user) throw new Error('Missing context');
      
      const { data, error } = await supabase
        .from('customer_notes')
        .insert([{ 
          business_id: business.id, 
          customer_id: customerId,
          user_id: user.id,
          note_text: noteText
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
    },
  });

  return {
    createNote,
  };
}

export type CustomerIntelligence = {
  totalInvoices: number;
  totalPaid: number;
  openBalance: number;
  averageDaysLate: number;
  onTimeRate: number;
  missedPromises: number;
  currentHighRiskInvoices: number;
  recentCommunication: {
    id: string;
    subject: string;
    created_at: string;
    channel: string;
    direction: string;
  } | null;
};

export function useCustomerIntelligence(id: string | undefined) {
  const { business } = useSession();

  return useQuery({
    queryKey: customerKeys.intelligence(id),
    queryFn: async () => {
      if (!business || !id) throw new Error('Missing context or id');
      const { data, error } = await supabase
        .rpc('get_customer_intelligence', { target_customer_id: id });
        
      if (error) throw error;
      return data as CustomerIntelligence;
    },
    enabled: !!business && !!id,
  });
}

