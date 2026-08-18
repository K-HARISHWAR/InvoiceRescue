import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const settingsSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  timezone: z.string().min(2, 'Timezone is required'),
  currency: z.string().min(3, 'Currency code is required').max(3, 'Must be 3 letter code'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { business, role, refreshBusinessContext } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const canEdit = role === 'owner' || role === 'admin';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      timezone: '',
      currency: '',
    },
  });

  useEffect(() => {
    if (business) {
      reset({
        name: business.name,
        timezone: business.timezone,
        currency: business.default_currency,
      });
    }
  }, [business, reset]);

  const onSubmit = async (data: SettingsFormValues) => {
    if (!business || !canEdit) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: data.name,
          timezone: data.timezone,
          default_currency: data.currency,
        })
        .eq('id', business.id);

      if (error) {
        toast.error('Failed to update business settings.');
        console.error(error);
        return;
      }

      toast.success('Settings updated successfully!');
      await refreshBusinessContext();
      reset(data); // reset form to new values (clears isDirty)
    } catch (err) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!business) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Business Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your business workspace preferences.
        </p>
      </div>

      <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-neutral-900">General Information</h3>
          <div className="mt-2 max-w-xl text-sm text-neutral-500">
            <p>Update your business name and localization settings.</p>
          </div>
          
          <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              
              <div className="sm:col-span-4">
                <Label htmlFor="name">Business Name</Label>
                <div className="mt-1">
                  <Input
                    id="name"
                    disabled={!canEdit || isLoading}
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>
              </div>

              <div className="sm:col-span-3">
                <Label htmlFor="timezone">Timezone</Label>
                <div className="mt-1">
                  <Input
                    id="timezone"
                    disabled={!canEdit || isLoading}
                    {...register('timezone')}
                  />
                  {errors.timezone && (
                    <p className="mt-1 text-sm text-red-600">{errors.timezone.message}</p>
                  )}
                </div>
              </div>

              <div className="sm:col-span-3">
                <Label htmlFor="currency">Default Currency</Label>
                <div className="mt-1">
                  <Input
                    id="currency"
                    disabled={!canEdit || isLoading}
                    {...register('currency')}
                  />
                  {errors.currency && (
                    <p className="mt-1 text-sm text-red-600">{errors.currency.message}</p>
                  )}
                </div>
              </div>

            </div>

            {canEdit && (
              <div className="flex justify-end pt-4 border-t border-neutral-100">
                <Button type="submit" disabled={!isDirty || isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
            
            {!canEdit && (
              <div className="rounded-md bg-amber-50 p-4 mt-6">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">Permission Denied</h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>You do not have permission to edit business settings. Only owners and admins can make changes.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}