export const queueNames = {
  payments: "payment-processing",
  webhooks: "webhook-processing",
  notifications: "notifications",
  reconciliation: "reconciliation-cleanup"
} as const;
