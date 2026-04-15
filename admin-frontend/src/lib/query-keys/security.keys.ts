export const securityKeys = {
  all: () => ["admin-security"] as const,

  // Audit logs
  auditLogs: () => [...securityKeys.all(), "audit-logs"] as const,
  auditLog: (params: Record<string, unknown>) =>
    [...securityKeys.auditLogs(), params] as const,

  // Admin action logs
  actionLogs: () => [...securityKeys.all(), "action-logs"] as const,
  actionLog: (params: Record<string, unknown>) =>
    [...securityKeys.actionLogs(), params] as const,

  // Login events
  loginEvents: () => [...securityKeys.all(), "login-events"] as const,
  loginEvent: (params: Record<string, unknown>) =>
    [...securityKeys.loginEvents(), params] as const,

  // Security events
  events: () => [...securityKeys.all(), "events"] as const,
  event: (params: Record<string, unknown>) =>
    [...securityKeys.events(), params] as const,

  // Incidents
  incidents: () => [...securityKeys.all(), "incidents"] as const,
  incidentList: (params: Record<string, unknown>) =>
    [...securityKeys.incidents(), "list", params] as const,
  incident: (id: string) => [...securityKeys.incidents(), id] as const,

  // Alerts
  alerts: () => [...securityKeys.all(), "alerts"] as const,
  alertList: (params: Record<string, unknown>) =>
    [...securityKeys.alerts(), "list", params] as const,
  alert: (id: string) => [...securityKeys.alerts(), id] as const,

  // Risk signals
  riskSignals: () => [...securityKeys.all(), "risk-signals"] as const,
  riskSignal: (params: Record<string, unknown>) =>
    [...securityKeys.riskSignals(), params] as const,

  // User activity
  userActivity: (userId: string) =>
    [...securityKeys.all(), "user-activity", userId] as const,
};
