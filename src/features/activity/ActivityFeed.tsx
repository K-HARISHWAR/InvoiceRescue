import { useState } from 'react';
import { useActivityFeed, type AuditLog } from '@/hooks/useActivityFeed';
import { format } from 'date-fns';
import { FileText, Mail, DollarSign, UserPlus, ShieldAlert, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ActivityFeed() {
  const [userFilter, setUserFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: logs = [], isLoading } = useActivityFeed({
    user_id: userFilter !== 'all' ? userFilter : undefined,
    event_type: typeFilter !== 'all' ? typeFilter : undefined,
  });

  const getUserLabel = (val: string) => {
    if (val === 'all') return 'All Users';
    if (val === 'system') return 'System / AI';
    return val;
  };

  const getTypeLabel = (val: string) => {
    switch(val) {
      case 'all': return 'All Actions';
      case 'invoice_created': return 'Invoice Created';
      case 'invoice_edited': return 'Invoice Edited';
      case 'payment_recorded': return 'Payment Recorded';
      case 'email_sent': return 'Email Sent';
      default: return val.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'invoice_created':
      case 'invoice_edited':
      case 'invoice_voided':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'payment_recorded':
      case 'payment_edited':
        return <DollarSign className="w-5 h-5 text-green-500" />;
      case 'email_sent':
      case 'email_approved':
      case 'gmail_connected':
      case 'gmail_disconnected':
        return <Mail className="w-5 h-5 text-purple-500" />;
      case 'member_invited':
      case 'role_changed':
      case 'member_removed':
        return <UserPlus className="w-5 h-5 text-indigo-500" />;
      case 'recovery_pack_generated':
        return <ShieldAlert className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-neutral-500" />;
    }
  };

  const formatMessage = (log: AuditLog) => {
    const actor = log.actor_name || 'System';
    const metadata = log.metadata || {};

    switch (log.event_type) {
      case 'invoice_created': return `${actor} created invoice ${metadata.invoice_number || log.entity_id}.`;
      case 'invoice_edited': return `${actor} edited invoice ${metadata.invoice_number || log.entity_id}.`;
      case 'invoice_voided': return `${actor} voided invoice ${metadata.invoice_number || log.entity_id}.`;
      case 'payment_recorded': return `${actor} recorded a payment of ${metadata.currency || ''}${metadata.amount || ''}.`;
      case 'email_sent': return `${actor} sent an email to ${metadata.to || 'customer'}.`;
      case 'gmail_connected': return `${actor} connected a Gmail account.`;
      case 'recovery_pack_generated': return `${actor} generated a recovery pack for invoice ${metadata.invoice_number || log.entity_id}.`;
      default: {
        const formattedType = log.event_type
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return `${actor} performed action: ${formattedType}.`;
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity Feed</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A complete audit log of events and actions across your organization.
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="w-48">
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger>
              <span className="flex-1 text-left text-neutral-700">
                {userFilter === 'all' ? 'All Users' : getUserLabel(userFilter)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="system">System / AI</SelectItem>
              {/* Note: In a real app we'd fetch actual users here */}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <span className="flex-1 text-left text-neutral-700">
                {typeFilter === 'all' ? 'All Actions' : getTypeLabel(typeFilter)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="invoice_created">Invoice Created</SelectItem>
              <SelectItem value="invoice_edited">Invoice Edited</SelectItem>
              <SelectItem value="payment_recorded">Payment Recorded</SelectItem>
              <SelectItem value="email_sent">Email Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-neutral-200">
        <ul className="divide-y divide-neutral-200">
          {isLoading ? (
            <li className="p-4 text-center text-sm text-neutral-500">Loading activity...</li>
          ) : logs.length === 0 ? (
            <li className="p-4 text-center text-sm text-neutral-500">No activity found.</li>
          ) : (
            logs.map((log) => (
              <li key={log.id} className="p-4 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(log.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 font-medium truncate">
                      {formatMessage(log)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
