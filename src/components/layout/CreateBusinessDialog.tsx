import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';

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

const createBusinessSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  country: z.string().min(2, 'Country is required'),
  default_currency: z.string().min(3).max(3, 'Currency must be a 3-letter code'),
  timezone: z.string().min(1, 'Timezone is required'),
});

type CreateBusinessForm = z.infer<typeof createBusinessSchema>;

interface CreateBusinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBusinessDialog({ open, onOpenChange }: CreateBusinessDialogProps) {
  const { switchBusiness } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBusinessForm>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: {
      name: '',
      country: 'US',
      default_currency: 'USD',
      timezone: 'America/New_York',
    },
  });

  const onSubmit = async (data: CreateBusinessForm) => {
    try {
      setIsSubmitting(true);
      
      const { data: resultId, error } = await supabase.rpc('create_business_with_owner', {
        p_name: data.name,
        p_legal_name: data.name, // default legal name to name
        p_country: data.country,
        p_default_currency: data.default_currency,
        p_timezone: data.timezone,
        p_gstin: null,
        p_udyam_number: null,
      });

      if (error) throw error;
      
      toast.success('Organisation created successfully');
      reset();
      onOpenChange(false);
      
      if (resultId) {
        // Switch to the new business (will hard-reload)
        switchBusiness(resultId);
      }
    } catch (err: any) {
      console.error('Create business error:', err);
      toast.error(err.message || 'Failed to create organisation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Organisation</DialogTitle>
          <DialogDescription>
            Set up a new organisation workspace. You will be assigned as the owner.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organisation Name</Label>
            <Input id="name" placeholder="e.g. Acme Corp" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
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
            <Label htmlFor="default_currency">Base Currency</Label>
            <select
              id="default_currency"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('default_currency')}
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
            {errors.default_currency && <p className="text-sm text-red-500">{errors.default_currency.message}</p>}
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

          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Workspace
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
