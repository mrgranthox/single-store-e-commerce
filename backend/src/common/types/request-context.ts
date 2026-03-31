import type { AdminStatus, UserStatus } from "@prisma/client";

export type ActorKind = "anonymous" | "customer" | "admin" | "system";

export interface RequestActor {
  kind: ActorKind;
  isAuthenticated: boolean;
  actorId: string | null;
  userId?: string;
  adminUserId?: string;
  clerkUserId?: string;
  email?: string;
  userStatus?: UserStatus;
  adminStatus?: AdminStatus;
  roles: string[];
  permissions: string[];
}

export interface RequestContext {
  requestId: string;
  traceId: string;
  startedAt: number;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  actor: RequestActor;
}

export const anonymousActor = (): RequestActor => ({
  kind: "anonymous",
  isAuthenticated: false,
  actorId: null,
  roles: [],
  permissions: []
});
