import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Plus, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

import { EntityDialog } from './EntityDialog';
import type { BusinessEntity } from '@/contexts/SessionContext';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { usePermissions } from '@/hooks/usePermissions';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const settingsSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { business, role, entities, refreshBusinessContext } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [showEntityDialog, setShowEntityDialog] = useState(false);
  const [editingEntity, setEditingEntity] = useState<BusinessEntity | null>(null);

  const { data: gmailConnection, isLoading: isCheckingGmail } = useGmailConnection(business?.id);
  const { can } = usePermissions();

  const canEdit = can('settings.manage');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (business) {
      reset({
        name: business.name,
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

  const handleArchive = async () => {
    if (!business) return;
    if (!confirm('Are you absolutely sure you want to archive this organisation? This action will disable automation and remove it from the switcher.')) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('archive_business', { p_business_id: business.id });
      if (error) throw error;
      toast.success('Organisation archived successfully');
      window.location.href = '/app/dashboard'; // full reload to trigger fetch of remaining available businesses
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive organisation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!business) return;
    if (!confirm('Are you sure you want to leave this organisation? You will lose access immediately.')) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('leave_business', { p_business_id: business.id });
      if (error) throw error;
      toast.success('You have left the organisation');
      window.location.href = '/app/dashboard'; // full reload to trigger fetch of remaining available businesses
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave organisation');
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
            <p>Update your business name.</p>
          </div>
          
          <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              
              <div className="sm:col-span-4">
                <Label htmlFor="name">Workspace Name</Label>
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

      <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium leading-6 text-neutral-900">Legal Entities</h3>
              <div className="mt-1 max-w-xl text-sm text-neutral-500">
                <p>Manage the legal entities and subsidiaries for this workspace.</p>
              </div>
            </div>
            {canEdit && (
              <Button 
                onClick={() => {
                  setEditingEntity(null);
                  setShowEntityDialog(true);
                }}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Entity
              </Button>
            )}
          </div>
          
          <div className="mt-6 flex flex-col">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-neutral-300">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-neutral-900 sm:pl-6">Display Name</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-neutral-900">Legal Name</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-neutral-900">Country</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-neutral-900">Currency</th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Edit</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {entities.map((entity) => (
                        <tr key={entity.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-neutral-900 sm:pl-6">
                            {entity.name}
                            {entity.is_primary && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                Primary
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">{entity.legal_name || '-'}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">{entity.country}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">{entity.currency}</td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEntity(entity);
                                  setShowEntityDialog(true);
                                }}
                                className="text-primary hover:text-primary/80 flex items-center justify-end w-full"
                              >
                                <Edit2 className="h-4 w-4 mr-1" /> Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-neutral-900">Integrations</h3>
          <div className="mt-2 max-w-xl text-sm text-neutral-500">
            <p>Connect third-party services to enhance InvoiceRescue.</p>
          </div>
          
          <div className="mt-6 border-t border-neutral-100 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-neutral-900">Google Workspace (Gmail)</h4>
                <p className="text-sm text-neutral-500 mt-1">
                  Connect your business Gmail account to automatically send collection emails and sync customer replies.
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                {isCheckingGmail ? (
                  <Button variant="outline" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </Button>
                ) : gmailConnection?.status === 'connected' ? (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('gmail-sync', {
                            body: { business_id: business.id }
                          });
                          if (error) throw error;
                          if (!data.success) throw new Error(data.message || data.error || 'Failed to sync');
                          toast.success(`Sync complete! ${data.synced} emails synced.`);
                        } catch (e: any) {
                          toast.error(e.message || 'Error syncing emails');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={!canEdit || isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sync Now
                    </Button>
                    <Button 
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={async () => {
                        if (!confirm('Are you sure you want to disconnect Gmail?')) return;
                        setIsLoading(true);
                        try {
                          const { error } = await supabase.rpc('disconnect_gmail', { p_business_id: business.id });
                          if (error) throw error;
                          toast.success('Gmail disconnected successfully');
                          window.location.reload();
                        } catch (e: any) {
                          toast.error(e.message);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={!canEdit || isLoading}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        const { data, error } = await supabase.functions.invoke('gmail-oauth-start', {
                          body: { business_id: business.id }
                        });
                        
                        if (error) throw error;
                        
                        if (data?.url) {
                          window.location.href = data.url;
                        } else {
                          toast.error(data?.error || 'Failed to start Gmail connection');
                        }
                      } catch (error: any) {
                        toast.error(error.message || 'An error occurred connecting to Gmail');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={!canEdit || isLoading}
                    variant="outline"
                  >
                    Connect Gmail
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg border border-red-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-red-600">Danger Zone</h3>
          <div className="mt-2 max-w-xl text-sm text-neutral-500">
            <p>Irreversible actions for this organisation workspace.</p>
          </div>
          
          <div className="mt-6 border-t border-red-100 pt-6 space-y-4">
            {can('workspace.delete') && (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-neutral-900">Archive Organisation</h4>
                  <p className="text-sm text-neutral-500 mt-1">
                    Mark this workspace as archived. It will stop all automations and disappear from the switcher.
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <Button 
                    variant="outline" 
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={handleArchive}
                    disabled={isLoading}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-neutral-900">Leave Organisation</h4>
                <p className="text-sm text-neutral-500 mt-1">
                  Remove yourself from this workspace. You will instantly lose access to all data.
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <Button 
                  variant="outline" 
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={handleLeave}
                  disabled={isLoading}
                >
                  Leave
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EntityDialog 
        open={showEntityDialog}
        onOpenChange={setShowEntityDialog}
        entity={editingEntity}
      />
    </div>
  );
}