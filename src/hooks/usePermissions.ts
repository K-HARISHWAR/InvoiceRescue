import { useSession } from './useSession';
import { hasPermission, type Action, type Role } from '@/lib/permissions';

export function usePermissions() {
  const { role } = useSession();

  const can = (action: Action) => {
    return hasPermission(role as Role | null, action);
  };

  return { can, role };
}
