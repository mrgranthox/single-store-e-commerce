export const systemKeys = {
  all: () => ["admin-system"] as const,

  // Admin users
  adminUsers: () => [...systemKeys.all(), "admin-users"] as const,
  adminUserList: (params: Record<string, unknown>) =>
    [...systemKeys.adminUsers(), "list", params] as const,
  adminUser: (id: string) => [...systemKeys.adminUsers(), id] as const,
  adminUserSessions: (id: string) =>
    [...systemKeys.adminUser(id), "sessions"] as const,
  adminRoleOptions: () => [...systemKeys.adminUsers(), "role-options"] as const,

  // Invitations
  invitations: () => [...systemKeys.all(), "invitations"] as const,
  invitationList: (params: Record<string, unknown>) =>
    [...systemKeys.invitations(), "list", params] as const,

  // Webhooks
  webhooks: () => [...systemKeys.all(), "webhooks"] as const,
  webhookList: (params: Record<string, unknown>) =>
    [...systemKeys.webhooks(), "list", params] as const,
  webhook: (id: string) => [...systemKeys.webhooks(), id] as const,

  // Notifications
  notifications: () => [...systemKeys.all(), "notifications"] as const,
  notificationList: (params: Record<string, unknown>) =>
    [...systemKeys.notifications(), "list", params] as const,
  notification: (id: string) => [...systemKeys.notifications(), id] as const,

  // Jobs
  jobs: () => [...systemKeys.all(), "jobs"] as const,
  jobList: (params: Record<string, unknown>) =>
    [...systemKeys.jobs(), "list", params] as const,
  job: (id: string) => [...systemKeys.jobs(), id] as const,

  // Settings
  settings: () => [...systemKeys.all(), "settings"] as const,
  settingScoped: (scope: string) =>
    [...systemKeys.settings(), scope] as const,

  // Integrations
  integrations: () => [...systemKeys.all(), "integrations"] as const,
  integrationHealth: () =>
    [...systemKeys.integrations(), "health"] as const,
};
