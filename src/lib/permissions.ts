export type Role = 'owner' | 'admin' | 'finance_manager' | 'collections_agent' | 'viewer';

export type Action = 
  | 'invoice.create'
  | 'invoice.edit'
  | 'invoice.void'
  | 'payment.record'
  | 'communication.approve'
  | 'communication.send'
  | 'member.invite'
  | 'member.remove'
  | 'settings.manage'
  | 'workspace.delete'
  | 'analytics.view'
  | 'customers.manage'
  | 'recovery.generate'
  | 'action.manage'
  | 'draft.create'
  | 'notes.add';

const rolePermissions: Record<Role, Set<Action>> = {
  owner: new Set([
    'invoice.create', 'invoice.edit', 'invoice.void', 'payment.record', 
    'communication.approve', 'communication.send', 'member.invite', 'member.remove',
    'settings.manage', 'workspace.delete', 'analytics.view', 'customers.manage',
    'recovery.generate', 'action.manage', 'draft.create', 'notes.add'
  ]),
  admin: new Set([
    'invoice.create', 'invoice.edit', 'invoice.void', 'payment.record', 
    'communication.approve', 'communication.send', 'member.invite', 'member.remove',
    'settings.manage', 'analytics.view', 'customers.manage',
    'recovery.generate', 'action.manage', 'draft.create', 'notes.add'
  ]),
  finance_manager: new Set([
    'invoice.create', 'invoice.edit', 'payment.record', 
    'communication.approve', 'analytics.view', 'customers.manage',
    'recovery.generate', 'action.manage', 'draft.create', 'notes.add'
  ]),
  collections_agent: new Set([
    'communication.send', 'action.manage', 'draft.create', 'notes.add'
  ]),
  viewer: new Set([]) // Viewers have no mutation rights
};

/**
 * Check if a specific role has permission to perform an action.
 */
export function hasPermission(role: Role | null, action: Action): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  return permissions.has(action);
}
