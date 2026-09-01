import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, UserPlus, Shield, X, Mail, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { InviteMemberDialog } from './components/InviteMemberDialog';

type Member = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
};

export default function TeamManagement() {
  const { business, user: currentUser } = useSession();
  const { can } = usePermissions();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const fetchTeam = async () => {
    if (!business) return;
    
    try {
      setIsLoading(true);
      
      const [membersRes, invitesRes] = await Promise.all([
        supabase
          .from('business_members')
          .select('id, user_id, role, created_at')
          .eq('business_id', business.id),
        supabase
          .from('business_invitations')
          .select('id, email, role, expires_at, created_at')
          .eq('business_id', business.id)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
      ]);

      if (membersRes.error) throw membersRes.error;
      if (invitesRes.error) throw invitesRes.error;

      // Fetch profiles manually to avoid missing FK join error
      const userIds = (membersRes.data || []).map(m => m.user_id);
      let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
          
        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          });
        }
      }

      const membersWithProfiles = (membersRes.data || []).map(m => ({
        ...m,
        profiles: profilesMap[m.user_id] || null
      }));

      setMembers(membersWithProfiles as unknown as Member[]);
      setInvitations(invitesRes.data as Invitation[]);
    } catch (err: any) {
      toast.error('Failed to load team data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [business]);

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      const { error } = await supabase
        .from('business_invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Invitation revoked');
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke');
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === currentUser?.id) {
      toast.error('You cannot remove yourself from here. Use the Settings page to leave the organisation.');
      return;
    }
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    try {
      const { error } = await supabase
        .from('business_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
      toast.success('Member removed');
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  if (!can('member.invite')) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader title="Team & Permissions" />
        <div className="bg-amber-50 p-6 rounded-lg flex items-start gap-4">
          <ShieldAlert className="h-6 w-6 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-amber-900">Access Restricted</h3>
            <p className="text-amber-700 mt-1">You do not have permission to view or manage team members. Please contact an owner or admin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader 
        title="Team & Permissions" 
        description="Manage workspace members, roles, and entity access."
        actions={
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        }
      />

      <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-neutral-900">Active Members</h3>
            <p className="mt-1 text-sm text-neutral-500">People with access to this organisation.</p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-neutral-400" /></div>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {members.map((member) => (
              <li key={member.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-neutral-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {member.profiles?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{member.profiles?.full_name || 'Unknown User'}</p>
                    <p className="text-sm text-neutral-500 capitalize">{member.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <div>
                  {can('member.remove') && member.user_id !== currentUser?.id && member.role !== 'owner' && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveMember(member.id, member.user_id)}>
                      Remove
                    </Button>
                  )}
                  {member.user_id === currentUser?.id && (
                    <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-1 rounded">You</span>
                  )}
                </div>
              </li>
            ))}
            {members.length === 0 && (
              <li className="p-6 text-center text-neutral-500">No active members found.</li>
            )}
          </ul>
        )}
      </div>

      <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200">
          <h3 className="text-lg leading-6 font-medium text-neutral-900">Pending Invitations</h3>
          <p className="mt-1 text-sm text-neutral-500">Sent invitations that have not yet been accepted.</p>
        </div>
        
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-neutral-400" /></div>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {invitations.map((invite) => (
              <li key={invite.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-neutral-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{invite.email}</p>
                    <p className="text-sm text-neutral-500">
                      Invited as <span className="capitalize font-medium">{invite.role.replace('_', ' ')}</span> • Expires {format(new Date(invite.expires_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div>
                  <Button variant="ghost" size="sm" className="text-neutral-500" onClick={() => handleRevoke(invite.id)}>
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
            {invitations.length === 0 && (
              <li className="p-6 text-center text-neutral-500">No pending invitations.</li>
            )}
          </ul>
        )}
      </div>

      {showInviteDialog && (
        <InviteMemberDialog 
          open={showInviteDialog} 
          onOpenChange={setShowInviteDialog} 
          onSuccess={fetchTeam} 
        />
      )}
    </div>
  );
}
