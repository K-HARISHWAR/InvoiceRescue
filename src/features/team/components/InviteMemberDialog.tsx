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

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'finance_manager', 'collections_agent', 'viewer']),
  entity_ids: z.array(z.string()).optional(),
});

type InviteForm = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteMemberDialog({ open, onOpenChange, onSuccess }: InviteMemberDialogProps) {
  const { business, entities } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'finance_manager',
      entity_ids: [],
    },
  });

  const watchRole = watch('role');
  const watchEntityIds = watch('entity_ids') || [];

  const handleEntityToggle = (entityId: string) => {
    if (watchEntityIds.includes(entityId)) {
      setValue('entity_ids', watchEntityIds.filter(id => id !== entityId));
    } else {
      setValue('entity_ids', [...watchEntityIds, entityId]);
    }
  };

  const onSubmit = async (data: InviteForm) => {
    if (!business) return;
    
    try {
      setIsSubmitting(true);
      setDevLink(null);
      
      const { data: result, error } = await supabase.functions.invoke('invite-team-member', {
        body: {
          business_id: business.id,
          email: data.email,
          role: data.role,
          entity_ids: data.role === 'admin' ? [] : data.entity_ids, // Admins get all access by policy
        }
      });

      if (error) {
        if (error instanceof Error && 'context' in error) {
          try {
            const errorText = await (error as any).context.text();
            let parsed;
            try { parsed = JSON.parse(errorText); } catch(e) {}
            
            throw new Error((parsed && parsed.error) || errorText || error.message);
          } catch (innerErr) {
            console.error('Failed to parse error context:', innerErr);
            throw error;
          }
        }
        throw error;
      }
      if (result.error) throw new Error(result.error);

      toast.success('Invitation sent successfully!');
      
      if (result._dev_only_link) {
        setDevLink(result._dev_only_link);
      } else {
        reset();
        onSuccess();
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error('Invite error:', err);
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation link to add a new member to your workspace.
          </DialogDescription>
        </DialogHeader>

        {devLink ? (
          <div className="py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md text-sm">
              <p className="font-semibold mb-2">Development Mode:</p>
              <p className="mb-2">Emails are not actually sent in dev mode. Share this link with the invitee:</p>
              <div className="bg-white p-2 border border-blue-100 rounded break-all select-all font-mono text-xs">
                {devLink}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => {
                setDevLink(null);
                reset();
                onSuccess();
                onOpenChange(false);
              }}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="colleague@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register('role')}
              >
                <option value="admin">Admin</option>
                <option value="finance_manager">Finance Manager</option>
                <option value="collections_agent">Collections Agent</option>
                <option value="viewer">Viewer</option>
              </select>
              {errors.role && <p className="text-sm text-red-500">{errors.role.message}</p>}
            </div>

            {watchRole !== 'admin' && entities.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label>Entity Access Restrictions (Optional)</Label>
                <p className="text-xs text-neutral-500 mb-2">
                  Select specific legal entities this user can access. If none are selected, they will have no entity access.
                </p>
                <div className="border border-neutral-200 rounded-md overflow-hidden divide-y divide-neutral-100">
                  {entities.map(entity => (
                    <label key={entity.id} className="flex items-center p-3 hover:bg-neutral-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-600"
                        checked={watchEntityIds.includes(entity.id)}
                        onChange={() => handleEntityToggle(entity.id)}
                      />
                      <span className="ml-3 text-sm font-medium text-neutral-900">{entity.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
