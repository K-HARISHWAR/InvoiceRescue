import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import type { BusinessEntity } from '@/contexts/SessionContext';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const entitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  legal_name: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  currency: z.string().min(3).max(3, 'Currency must be a 3-letter code'),
  timezone: z.string().min(1, 'Timezone is required'),
  gstin: z.string().optional(),
});

type EntityForm = z.infer<typeof entitySchema>;

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity?: BusinessEntity | null;
}

export function EntityDialog({ open, onOpenChange, entity }: EntityDialogProps) {
  const { business, refreshBusinessContext } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntityForm>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      name: entity?.name || '',
      legal_name: entity?.legal_name || '',
      country: entity?.country || 'US',
      currency: entity?.currency || 'USD',
      timezone: entity?.timezone || 'America/New_York',
      gstin: entity?.gstin || '',
    },
  });

  useEffect(() => {
    reset({
      name: entity?.name || '',
      legal_name: entity?.legal_name || '',
      country: entity?.country || 'US',
      currency: entity?.currency || 'USD',
      timezone: entity?.timezone || 'America/New_York',
      gstin: entity?.gstin || '',
    });
  }, [entity, reset]);

  const onSubmit = async (data: EntityForm) => {
    if (!business) return;
    
    try {
      setIsSubmitting(true);
      
      if (entity) {
        // Update existing entity
        const { error } = await supabase
          .from('business_entities')
          .update({
            name: data.name,
            legal_name: data.legal_name || null,
            country: data.country,
            currency: data.currency,
            timezone: data.timezone,
            gstin: data.gstin || null,
          })
          .eq('id', entity.id);

        if (error) throw error;
        toast.success('Legal entity updated successfully');
      } else {
        // Create new entity
        const { error } = await supabase
          .from('business_entities')
          .insert({
            business_id: business.id,
            name: data.name,
            legal_name: data.legal_name || null,
            country: data.country,
            currency: data.currency,
            timezone: data.timezone,
            gstin: data.gstin || null,
            is_primary: false, // Additional entities are not primary by default
          });

        if (error) throw error;
        toast.success('Legal entity added successfully');
      }

      reset();
      await refreshBusinessContext(); // refresh entities
      onOpenChange(false);
    } catch (err: any) {
      console.error('Entity error:', err);
      toast.error(err.message || 'Failed to save entity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{entity ? 'Edit Legal Entity' : 'Add Legal Entity'}</DialogTitle>
          <DialogDescription>
            {entity ? 'Update the details of this legal entity.' : 'Add a new subsidiary or legal entity to your organisation.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" placeholder="e.g. Acme UK" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal_name">Legal Name (Optional)</Label>
            <Input id="legal_name" placeholder="e.g. Acme UK Ltd." {...register('legal_name')} />
            {errors.legal_name && <p className="text-sm text-red-500">{errors.legal_name.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('country')}
            >
              <option value="US">United States (US)</option>
              <option value="IN">India (IN)</option>
              <option value="GB">United Kingdom (GB)</option>
              <option value="CA">Canada (CA)</option>
              <option value="AU">Australia (AU)</option>
              <option value="SG">Singapore (SG)</option>
              <option value="AE">United Arab Emirates (AE)</option>
            </select>
            {errors.country && <p className="text-sm text-red-500">{errors.country.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Base Currency</Label>
            <select
              id="currency"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('currency')}
            >
              <option value="USD">US Dollar (USD)</option>
              <option value="INR">Indian Rupee (INR)</option>
              <option value="GBP">British Pound (GBP)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="CAD">Canadian Dollar (CAD)</option>
              <option value="AUD">Australian Dollar (AUD)</option>
              <option value="SGD">Singapore Dollar (SGD)</option>
              <option value="AED">UAE Dirham (AED)</option>
            </select>
            {errors.currency && <p className="text-sm text-red-500">{errors.currency.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('timezone')}
            >
              <option value="America/New_York">Eastern Time (US/New York)</option>
              <option value="America/Chicago">Central Time (US/Chicago)</option>
              <option value="America/Denver">Mountain Time (US/Denver)</option>
              <option value="America/Los_Angeles">Pacific Time (US/Los Angeles)</option>
              <option value="Asia/Kolkata">India Standard Time (IST)</option>
              <option value="Europe/London">Greenwich Mean Time (London)</option>
              <option value="Asia/Dubai">Gulf Standard Time (Dubai)</option>
              <option value="Asia/Singapore">Singapore Standard Time (SGT)</option>
              <option value="Australia/Sydney">Australian Eastern Time (Sydney)</option>
            </select>
            {errors.timezone && <p className="text-sm text-red-500">{errors.timezone.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gstin">Tax ID / GSTIN (Optional)</Label>
            <Input id="gstin" placeholder="e.g. 27ABCDE1234F1Z5" {...register('gstin')} />
            {errors.gstin && <p className="text-sm text-red-500">{errors.gstin.message}</p>}
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {entity ? 'Save Changes' : 'Add Entity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
