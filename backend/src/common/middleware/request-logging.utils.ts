import { createHash } from "node:crypto";

export const hashLogIdentifier = (value: string | null | undefined, salt: string) => {
  if (!value) {
    return null;
  }

  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex")
    .slice(0, 12);
};

export const sanitizeRequestLogContext = (
  input: {
    actorId?: string | null;
    ipAddress?: string | null;
  },
  salt: string
) => ({
  actorFingerprint: hashLogIdentifier(input.actorId, salt),
  ipFingerprint: hashLogIdentifier(input.ipAddress, salt)
});
