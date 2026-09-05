import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useEntitySettings } from '@/hooks/useEntitySettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmailTemplateSettings } from './EmailTemplateSettings';

const entitySettingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  
  legal_name: z.string().optional(),
  country: z.string().min(2, 'Country code required'),
  gstin: z.string().optional(),
  udyam_number: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state_region: z.string().optional(),
  postal_code: z.string().optional(),

  currency: z.string().min(3),
  default_payment_terms_days: z.coerce.number().min(0),
  invoice_prefix: z.string().optional(),
  invoice_number_format: z.string().optional(),
  financial_year_start_month: z.coerce.number().min(1).max(12),
  default_tax_behavior: z.string(),

  collection_friendly_reminder_days: z.coerce.number().min(0),
  collection_due_date_reminder_days: z.coerce.number().min(0),
  collection_overdue_reminder_days: z.coerce.number().min(0),
  collection_second_reminder_days: z.coerce.number().min(0),
  collection_escalation_days: z.coerce.number().min(0),
  collection_minimum_contact_interval_days: z.coerce.number().min(0),
  weekend_policy: z.string(),
  working_days: z.array(z.number()),

  email_signature: z.string().optional(),
  logo_path: z.string().optional(),
});

type SettingsValues = z.infer<typeof entitySettingsSchema>;

export default function EntitySettings() {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const { settings, isLoading, updateSettings } = useEntitySettings(entityId);
  const [activeTab, setActiveTab] = useState('general');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isDirty, isSubmitting } } = useForm<SettingsValues>({
    resolver: zodResolver(entitySettingsSchema) as any,
    defaultValues: {
      working_days: [1, 2, 3, 4, 5],
      default_tax_behavior: 'exclusive',
      weekend_policy: 'previous_business_day'
    }
  });

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name || '',
        email: settings.email || '',
        phone: settings.phone || '',
        website: settings.website || '',
        legal_name: settings.legal_name || '',
        country: settings.country || 'US',
        gstin: settings.gstin || '',
        udyam_number: settings.udyam_number || '',
        address_line_1: settings.address_line_1 || '',
        address_line_2: settings.address_line_2 || '',
        city: settings.city || '',
        state_region: settings.state_region || '',
        postal_code: settings.postal_code || '',
        currency: settings.currency || 'USD',
        default_payment_terms_days: settings.default_payment_terms_days ?? 30,
        invoice_prefix: settings.invoice_prefix || 'INV',
        invoice_number_format: settings.invoice_number_format || '{{prefix}}-{{number}}',
        financial_year_start_month: settings.financial_year_start_month ?? 1,
        default_tax_behavior: settings.default_tax_behavior || 'exclusive',
        collection_friendly_reminder_days: settings.collection_friendly_reminder_days ?? 5,
        collection_due_date_reminder_days: settings.collection_due_date_reminder_days ?? 0,
        collection_overdue_reminder_days: settings.collection_overdue_reminder_days ?? 3,
        collection_second_reminder_days: settings.collection_second_reminder_days ?? 10,
        collection_escalation_days: settings.collection_escalation_days ?? 30,
        collection_minimum_contact_interval_days: settings.collection_minimum_contact_interval_days ?? 3,
        weekend_policy: settings.weekend_policy || 'previous_business_day',
        working_days: settings.working_days || [1, 2, 3, 4, 5],
        email_signature: settings.email_signature || '',
        logo_path: settings.logo_path || '',
      });
    }
  }, [settings, reset]);

  const onSubmit = async (data: SettingsValues) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success('Entity settings saved');
      reset(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!settings) {
    return <div>Entity not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/settings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{settings.name} Settings</h1>
          <p className="text-sm text-neutral-500">Manage detailed configuration for this legal entity.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start border-b rounded-none px-0 mb-6 bg-transparent h-auto space-x-6">
          <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 font-medium">General</TabsTrigger>
          <TabsTrigger value="legal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 font-medium">Legal Details</TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 font-medium">Invoice Defaults</TabsTrigger>
          <TabsTrigger value="collections" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 font-medium">Collections Policy</TabsTrigger>
          <TabsTrigger value="email" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 font-medium">Email Templates</TabsTrigger>
          <TabsTrigger value="branding" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2 font-medium">Branding</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit(onSubmit)}>
          <TabsContent value="general" className="space-y-6 max-w-2xl mt-0">
            <div className="bg-white rounded-lg border p-6 space-y-6">
              <h3 className="text-lg font-medium">General Information</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Display Name</Label>
                  <Input {...register('name')} />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input {...register('email')} type="email" placeholder="billing@company.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input {...register('phone')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input {...register('website')} placeholder="https://" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="legal" className="space-y-6 max-w-2xl mt-0">
            <div className="bg-white rounded-lg border p-6 space-y-6">
              <h3 className="text-lg font-medium">Legal & Address</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Legal Name</Label>
                  <Input {...register('legal_name')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Country Code (e.g. US, IN)</Label>
                    <Input {...register('country')} maxLength={2} className="uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tax ID / GSTIN</Label>
                    <Input {...register('gstin')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Address Line 1</Label>
                  <Input {...register('address_line_1')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address Line 2</Label>
                  <Input {...register('address_line_2')} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input {...register('city')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State/Region</Label>
                    <Input {...register('state_region')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Postal Code</Label>
                    <Input {...register('postal_code')} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6 max-w-2xl mt-0">
            <div className="bg-white rounded-lg border p-6 space-y-6">
              <h3 className="text-lg font-medium">Invoice Defaults</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label>Default Currency (e.g. USD, INR)</Label>
                  <Input {...register('currency')} maxLength={3} className="uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Terms (Days)</Label>
                  <Input {...register('default_payment_terms_days')} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Invoice Prefix</Label>
                  <Input {...register('invoice_prefix')} placeholder="INV" />
                </div>
                <div className="space-y-1.5">
                  <Label>Invoice Number Format</Label>
                  <Input {...register('invoice_number_format')} placeholder="{{prefix}}-{{number}}" />
                  <p className="text-xs text-neutral-500">e.g. {`{{prefix}}-{{number}}`} generates INV-0001</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Financial Year Start Month (1-12)</Label>
                  <Input {...register('financial_year_start_month')} type="number" min={1} max={12} />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Tax Behavior</Label>
                  <Select 
                    value={watch('default_tax_behavior') || 'exclusive'} 
                    onValueChange={(val) => setValue('default_tax_behavior', val || 'exclusive', { shouldDirty: true })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select tax behavior">
                        {watch('default_tax_behavior') === 'inclusive' ? 'Inclusive' : 
                         watch('default_tax_behavior') === 'zero' ? 'Zero-rated' : 'Exclusive'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                      <SelectItem value="inclusive">Inclusive</SelectItem>
                      <SelectItem value="zero">Zero-rated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="collections" className="space-y-6 max-w-2xl mt-0">
            <div className="bg-white rounded-lg border p-6 space-y-6">
              <h3 className="text-lg font-medium">Collections Timelines</h3>
              <p className="text-sm text-neutral-500">Configure how many days before/after the due date automated reminders are generated.</p>
              
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1.5">
                  <Label>Friendly Reminder (Days before due)</Label>
                  <Input {...register('collection_friendly_reminder_days')} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date Reminder (Days after due)</Label>
                  <Input {...register('collection_due_date_reminder_days')} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>First Overdue Reminder (Days after due)</Label>
                  <Input {...register('collection_overdue_reminder_days')} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Second Overdue Reminder (Days after due)</Label>
                  <Input {...register('collection_second_reminder_days')} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Escalation (Days after due)</Label>
                  <Input {...register('collection_escalation_days')} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cooldown / Minimum Interval (Days)</Label>
                  <Input {...register('collection_minimum_contact_interval_days')} type="number" />
                  <p className="text-xs text-neutral-500">Prevents spamming the customer</p>
                </div>
              </div>

              <div className="pt-6 border-t mt-6">
                <h4 className="text-md font-medium mb-4">Business Days</h4>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Weekend/Holiday Policy</Label>
                    <Select 
                      value={watch('weekend_policy') || 'previous_business_day'} 
                      onValueChange={(val) => setValue('weekend_policy', val || 'previous_business_day', { shouldDirty: true })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select policy">
                          {watch('weekend_policy') === 'next_business_day' 
                            ? 'Send on Next Business Day' 
                            : 'Send on Previous Business Day'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="previous_business_day">Send on Previous Business Day</SelectItem>
                        <SelectItem value="next_business_day">Send on Next Business Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6 max-w-2xl mt-0">
            <div className="bg-white rounded-lg border p-6 space-y-6">
              <h3 className="text-lg font-medium">Branding</h3>
              <div className="space-y-1.5">
                <Label>Email Signature</Label>
                <p className="text-sm text-neutral-500">Appended to all automated emails sent on behalf of this entity.</p>
                <textarea 
                  {...register('email_signature')} 
                  className="w-full min-h-[150px] p-3 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                  placeholder="Accounts Receivable\n{{entity_name}}\nbilling@company.com"
                />
              </div>
            </div>
          </TabsContent>

          {/* Render Save Button only for the tabs that are part of the main form */}
          {activeTab !== 'email' && (
            <div className="mt-8 flex justify-end max-w-2xl">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </div>
          )}
        </form>

        <TabsContent value="email" className="mt-0">
          <EmailTemplateSettings entityId={entityId!} />
        </TabsContent>

      </Tabs>
    </div>
  );
}
