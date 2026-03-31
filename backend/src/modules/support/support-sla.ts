import { TicketPriority, TicketStatus } from "@prisma/client";

/** First-response SLA from ticket creation (operational policy). */
export const FIRST_RESPONSE_SLA_HOURS: Record<TicketPriority, number> = {
  [TicketPriority.URGENT]: 4,
  [TicketPriority.HIGH]: 8,
  [TicketPriority.MEDIUM]: 24,
  [TicketPriority.LOW]: 72
};

export const firstResponseDueAt = (createdAt: Date, priority: TicketPriority): Date => {
  const h = FIRST_RESPONSE_SLA_HOURS[priority] ?? 24;
  return new Date(createdAt.getTime() + h * 60 * 60 * 1000);
};

export type SlaComputation = {
  slaDueAt: string;
  firstAdminReplyAt: string | null;
  /** Negative = overdue seconds until first response was due */
  slaSecondsRemaining: number | null;
  slaBreached: boolean;
  slaMet: boolean;
};

export const computeTicketSla = (input: {
  createdAt: Date;
  priority: TicketPriority;
  status: TicketStatus;
  firstAdminReplyAt: Date | null;
  now?: Date;
}): SlaComputation => {
  const now = input.now ?? new Date();
  const due = firstResponseDueAt(input.createdAt, input.priority);
  const fr = input.firstAdminReplyAt;
  const closed = input.status === TicketStatus.CLOSED;

  const met = Boolean(fr && fr.getTime() <= due.getTime());
  const breached = !fr && !closed && now.getTime() > due.getTime();

  let slaSecondsRemaining: number | null = null;
  if (!fr && !closed) {
    slaSecondsRemaining = Math.round((due.getTime() - now.getTime()) / 1000);
  }

  return {
    slaDueAt: due.toISOString(),
    firstAdminReplyAt: fr ? fr.toISOString() : null,
    slaSecondsRemaining,
    slaBreached: breached,
    slaMet: met
  };
};
