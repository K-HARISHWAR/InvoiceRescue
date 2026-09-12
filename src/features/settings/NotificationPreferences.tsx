import { useNotificationPreferences } from '@/hooks/useNotifications';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const NOTIFICATION_TYPES = [
  { id: 'invoice_overdue', label: 'Invoice became overdue', description: 'When an invoice passes its due date' },
  { id: 'promise_missed', label: 'Promise missed', description: 'When a payment promise date passes without payment' },
  { id: 'risk_critical', label: 'Invoice became critical', description: 'When an invoice risk score reaches critical levels' },
  { id: 'action_assigned', label: 'Action assigned', description: 'When a collection action is assigned to you' },
  { id: 'payment_recorded', label: 'Payment recorded', description: 'When a payment is matched to an invoice' },
  { id: 'gmail_disconnected', label: 'Gmail disconnected', description: 'When your email integration requires reconnection' },
  { id: 'daily_briefing', label: 'Daily briefing', description: 'Morning summary of outstanding actions' },
];

export function NotificationPreferences() {
  const { preferences, isLoading, updatePreference } = useNotificationPreferences();

  const handleToggle = async (eventType: string, channel: 'in_app' | 'email', currentValue: boolean) => {
    try {
      // Find current pref or default to true
      const pref = preferences.find(p => p.event_type === eventType) || { in_app: true, email: true };
      
      await updatePreference({
        event_type: eventType,
        in_app: channel === 'in_app' ? !currentValue : pref.in_app,
        email: channel === 'email' ? !currentValue : pref.email,
      });
      toast.success('Preference updated');
    } catch (err) {
      toast.error('Failed to update preference');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-neutral-900">Notification Preferences</h3>
        <div className="mt-1 max-w-xl text-sm text-neutral-500 mb-6">
          <p>Choose what events you want to be notified about, and where.</p>
        </div>

        <div className="mt-6 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-neutral-300">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-neutral-900 sm:pl-6">Event</th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-neutral-900">In App</th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-neutral-900">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {NOTIFICATION_TYPES.map((type) => {
                      const pref = preferences.find(p => p.event_type === type.id) || { in_app: true, email: true };
                      return (
                        <tr key={type.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                            <div className="text-sm font-medium text-neutral-900">{type.label}</div>
                            <div className="text-xs text-neutral-500">{type.description}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-center">
                            <Switch 
                              checked={pref.in_app} 
                              onCheckedChange={(checked) => handleToggle(type.id, 'in_app', !checked)} 
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-center">
                            <Switch 
                              checked={pref.email} 
                              onCheckedChange={(checked) => handleToggle(type.id, 'email', !checked)} 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
