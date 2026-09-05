import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export type EmailTemplate = {
  id: string;
  entity_id: string;
  template_type: string;
  subject: string;
  body: string;
};

export type EntitySettings = {
  id: string;
  name: string;
  legal_name: string;
  country: string;
  currency: string;
  timezone: string;
  gstin: string;
  udyam_number: string;
  default_payment_terms_days: number;
  invoice_prefix: string;
  invoice_number_format: string;
  financial_year_start_month: number;
  default_tax_behavior: string;
  collection_friendly_reminder_days: number;
  collection_due_date_reminder_days: number;
  collection_overdue_reminder_days: number;
  collection_second_reminder_days: number;
  collection_escalation_days: number;
  collection_minimum_contact_interval_days: number;
  working_days: number[];
  weekend_policy: string;
  email_signature: string;
  logo_path: string;
  email: string;
  phone: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state_region: string;
  postal_code: string;
};

export function useEntitySettings(entityId?: string) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['entitySettings', entityId],
    queryFn: async () => {
      if (!entityId) return null;
      
      const { data, error } = await supabase
        .from('business_entities')
        .select('*')
        .eq('id', entityId)
        .single();
        
      if (error) throw error;
      return data as EntitySettings;
    },
    enabled: !!entityId,
  });

  const templatesQuery = useQuery({
    queryKey: ['emailTemplates', entityId],
    queryFn: async () => {
      if (!entityId) return null;
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('entity_id', entityId);
        
      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: !!entityId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<EntitySettings>) => {
      if (!entityId) throw new Error('No entity ID');
      const { data, error } = await supabase
        .from('business_entities')
        .update(updates)
        .eq('id', entityId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entitySettings', entityId] });
      queryClient.invalidateQueries({ queryKey: ['session'] }); // Since business_entities affects session context
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (template: { template_type: string, subject: string, body: string }) => {
      if (!entityId) throw new Error('No entity ID');
      const { data, error } = await supabase
        .from('email_templates')
        .upsert({
          entity_id: entityId,
          template_type: template.template_type,
          subject: template.subject,
          body: template.body,
        }, { onConflict: 'entity_id, template_type' })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', entityId] });
    },
  });

  return {
    settings: settingsQuery.data,
    templates: templatesQuery.data,
    isLoading: settingsQuery.isLoading || templatesQuery.isLoading,
    updateSettings: updateSettingsMutation,
    updateTemplate: updateTemplateMutation,
  };
}
