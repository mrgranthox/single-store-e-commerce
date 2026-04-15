export const supportKeys = {
  all: () => ["admin-support"] as const,

  // Tickets
  tickets: () => [...supportKeys.all(), "tickets"] as const,
  ticketList: (params: Record<string, unknown>) =>
    [...supportKeys.tickets(), "list", params] as const,
  ticket: (id: string) => [...supportKeys.tickets(), id] as const,
  ticketTimeline: (id: string) =>
    [...supportKeys.ticket(id), "timeline"] as const,
  ticketAttachments: (id: string) =>
    [...supportKeys.ticket(id), "attachments"] as const,

  // Queue
  queue: () => [...supportKeys.all(), "queue"] as const,
  queueSlice: (params: Record<string, unknown>) =>
    [...supportKeys.queue(), params] as const,

  // Analytics
  analytics: () => [...supportKeys.all(), "analytics"] as const,
  analyticsSlice: (params: Record<string, unknown>) =>
    [...supportKeys.analytics(), params] as const,
};
