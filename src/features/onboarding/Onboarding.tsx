import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const onboardingSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  legalName: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  currency: z.string().min(3, 'Currency code is required').max(3, 'Must be 3 letter code'),
  timezone: z.string().min(2, 'Timezone is required'),
  gstin: z.string().optional(),
  udyamNumber: z.string().optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function Onboarding() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, business, refreshBusinessContext, isLoading: isSessionLoading } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      legalName: '',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      gstin: '',
      udyamNumber: '',
    },
  });

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If already has a business, redirect to dashboard
  if (business) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('create_business_with_owner', {
        p_name: data.name,
        p_legal_name: data.legalName || null,
        p_country: data.country,
        p_default_currency: data.currency,
        p_timezone: data.timezone,
        p_gstin: data.gstin || null,
        p_udyam_number: data.udyamNumber || null,
      });

      if (error) {
        toast.error('Failed to set up business profile. Please try again.');
        console.error(error);
        return;
      }

      toast.success('Business workspace created successfully!');
      
      // Refresh session context to pick up new business
      await refreshBusinessContext();
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-neutral-900">
            Set up your workspace
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Tell us a bit about your business to get started.
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-neutral-100">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Business Name <span className="text-red-500">*</span></Label>
                <div className="mt-1">
                  <Input
                    id="name"
                    placeholder="E.g. Acme Corp"
                    disabled={isLoading}
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="legalName">Legal Entity Name (Optional)</Label>
                <div className="mt-1">
                  <Input
                    id="legalName"
                    placeholder="Acme Corporation Private Limited"
                    disabled={isLoading}
                    {...register('legalName')}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <div className="mt-1">
                  <Input
                    id="country"
                    disabled={isLoading}
                    {...register('country')}
                  />
                  {errors.country && (
                    <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="currency">Default Currency</Label>
                <div className="mt-1">
                  <Input
                    id="currency"
                    disabled={isLoading}
                    {...register('currency')}
                  />
                  {errors.currency && (
                    <p className="mt-1 text-sm text-red-600">{errors.currency.message}</p>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="timezone">Timezone</Label>
                <div className="mt-1">
                  <Input
                    id="timezone"
                    disabled={isLoading}
                    {...register('timezone')}
                  />
                  {errors.timezone && (
                    <p className="mt-1 text-sm text-red-600">{errors.timezone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="gstin">GSTIN (Optional)</Label>
                <div className="mt-1">
                  <Input
                    id="gstin"
                    disabled={isLoading}
                    {...register('gstin')}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="udyamNumber">Udyam Registration (Optional)</Label>
                <div className="mt-1">
                  <Input
                    id="udyamNumber"
                    disabled={isLoading}
                    {...register('udyamNumber')}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating workspace...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}