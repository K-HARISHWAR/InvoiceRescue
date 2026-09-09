import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { notificationKeys } from '@/lib/queryKeys';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  business_id: string;
  user_id: string;
  event_type: string;
  in_app: boolean;
  email: boolean;
}

export function useNotifications() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: notificationKeys.user(user?.id),
    queryFn: async (): Promise<Notification[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read_at).length,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate
  };
}

export function useNotificationPreferences() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification_preferences', user?.id, business?.id],
    queryFn: async (): Promise<NotificationPreference[]> => {
      if (!user?.id || !business?.id) return [];

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('business_id', business.id);

      if (error) throw error;
      return data as NotificationPreference[];
    },
    enabled: !!user?.id && !!business?.id,
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ event_type, in_app, email }: { event_type: string, in_app: boolean, email: boolean }) => {
      if (!user?.id || !business?.id) return;
      
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          business_id: business.id,
          event_type,
          in_app,
          email,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, event_type' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences', user?.id, business?.id] });
    }
  });

  return {
    preferences,
    isLoading,
    updatePreference: updatePreferenceMutation.mutateAsync
  };
}
