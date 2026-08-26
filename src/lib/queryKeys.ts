/**
 * Centralized TanStack Query keys to ensure consistent caching and invalidation.
 */

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (businessId: string | undefined) => [...invoiceKeys.lists(), businessId] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...invoiceKeys.details(), id] as const,
};

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (businessId: string | undefined) => [...customerKeys.lists(), businessId] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...customerKeys.details(), id] as const,
  intelligence: (id: string | undefined) => [...customerKeys.all, 'intelligence', id] as const,
};

export const paymentKeys = {
  all: ['payments'] as const,
  invoice: (invoiceId: string | undefined) => [...paymentKeys.all, 'invoice', invoiceId] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  metrics: (businessId: string | undefined) => [...dashboardKeys.all, 'metrics', businessId] as const,
  attention: (businessId: string | undefined) => [...dashboardKeys.all, 'attention', businessId] as const,
  cashInflow: (businessId: string | undefined) => [...dashboardKeys.all, 'cashInflow', businessId] as const,
  paymentBehaviour: (businessId: string | undefined) => [...dashboardKeys.all, 'paymentBehaviour', businessId] as const,
  collectionSuccess: (businessId: string | undefined) => [...dashboardKeys.all, 'collectionSuccess', businessId] as const,
};

export const communicationKeys = {
  all: ['communications'] as const,
  invoice: (invoiceId: string | undefined) => [...communicationKeys.all, 'invoice', invoiceId] as const,
};

export const actionKeys = {
  all: ['collection_actions'] as const,
  business: (businessId: string | undefined) => [...actionKeys.all, 'business', businessId] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  user: (userId: string | undefined) => [...notificationKeys.all, 'user', userId] as const,
};

export const recoveryKeys = {
  all: ['recovery-invoices'] as const,
  business: (businessId: string | undefined) => [...recoveryKeys.all, 'business', businessId] as const,
  timeline: (invoiceId: string | undefined) => [...recoveryKeys.all, 'timeline', invoiceId] as const,
};

export const gmailKeys = {
  all: ['gmail_connection'] as const,
  business: (businessId: string | undefined) => [...gmailKeys.all, 'business', businessId] as const,
};

export const dailyBriefingKeys = {
  all: ['daily-briefing'] as const,
  business: (businessId: string | undefined) => [...dailyBriefingKeys.all, 'business', businessId] as const,
};
