import { invalidInputError } from "../../common/errors/app-error";

/** Stored on `Review.moderationNote` when automated screening requires moderation before publish. */
export const REVIEW_AUTOMATED_PENDING_NOTE = "Pending automated content screening.";

const normalizeReviewText = (raw: string) => raw.normalize("NFKC").trim().toLowerCase();

/** Catches keyboard-mash / noise spam without blocking normal emphasis. */
const SPAM_CHAR_RUN = /(.)\1{8,}/u;

/**
 * High-confidence scam / off-platform payment solicitation patterns for product reviews.
 * Tuned for false-positive safety on typical merchandise feedback.
 */
const FRAUD_PATTERNS: RegExp[] = [
  /\bwestern\s+union\b/i,
  /\bmoneygram\b/i,
  /\bwire\s+transfer\b/i,
  /\bgift\s*cards?\s+(?:for\s+)?(?:amazon|google|apple|itunes)\b/i,
  /\bdouble\s+your\s+(?:money|crypto|bitcoin)\b/i,
  /\b(?:100%|guaranteed)\s+(?:returns?|profit)\b/i,
  /\b(?:send|transfer)\s+(?:cash|money)\s+to\b/i,
  /\bclick\s+(?:here|this\s+link)\s+to\s+(?:pay|send|verify)\b/i,
  /\bverification\s+(?:payment|fee)\s+required\b/i,
  /\bcontact\s+(?:me|us)\b.*\bwhatsapp\b.*\+?\d/i,
  /\bwhatsapp\b.*\b(?:send|pay|transfer)\b/i
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countUrls = (normalized: string): number => {
  const matches = normalized.match(/https?:\/\/[^\s]+/gi);
  return matches?.length ?? 0;
};

type ContentViolation = "SPAM_PATTERN" | "EXCESSIVE_URLS" | "FRAUD_PATTERN" | "BLOCKLIST_TERM";

const getCustomerReviewContentViolation = (
  body: string | null | undefined,
  blocklistTerms: readonly string[]
): ContentViolation | null => {
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeReviewText(trimmed);

  if (SPAM_CHAR_RUN.test(normalized)) {
    return "SPAM_PATTERN";
  }

  if (countUrls(normalized) >= 3) {
    return "EXCESSIVE_URLS";
  }

  for (const pattern of FRAUD_PATTERNS) {
    if (pattern.test(normalized)) {
      return "FRAUD_PATTERN";
    }
  }

  for (const rawTerm of blocklistTerms) {
    const t = rawTerm.trim().toLowerCase();
    if (t.length < 2) {
      continue;
    }
    if (t.includes(" ")) {
      if (normalized.includes(t)) {
        return "BLOCKLIST_TERM";
      }
      continue;
    }
    const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, "iu");
    if (re.test(normalized)) {
      return "BLOCKLIST_TERM";
    }
  }

  return null;
};

/** Rating-only reviews (empty body) skip text checks and are treated as publishable. */
export const isCustomerReviewContentPublishable = (
  body: string | null | undefined,
  blocklistTerms: readonly string[]
): boolean => getCustomerReviewContentViolation(body, blocklistTerms) === null;

/**
 * Hard-fail variant for callers that must reject instead of pending (tests, optional paths).
 * Rating-only reviews (empty body) skip text checks.
 */
export const assertCustomerReviewContentPublishable = (
  body: string | null | undefined,
  blocklistTerms: readonly string[]
): void => {
  const violation = getCustomerReviewContentViolation(body, blocklistTerms);
  if (violation === null) {
    return;
  }

  switch (violation) {
    case "SPAM_PATTERN":
      throw invalidInputError(
        "This review could not be submitted. Please shorten repeated characters and try again.",
        { reason: "SPAM_PATTERN" }
      );
    case "EXCESSIVE_URLS":
      throw invalidInputError(
        "This review could not be submitted. Please use fewer links in your review.",
        { reason: "EXCESSIVE_URLS" }
      );
    case "FRAUD_PATTERN":
      throw invalidInputError(
        "This review could not be submitted. Remove payment requests, off-platform contact instructions, or suspicious claims.",
        { reason: "FRAUD_PATTERN" }
      );
    case "BLOCKLIST_TERM":
      throw invalidInputError(
        "This review could not be submitted. Please revise your wording and try again.",
        { reason: "BLOCKLIST_TERM" }
      );
    default: {
      const _exhaustive: never = violation;
      throw new Error(`Unhandled violation: ${_exhaustive}`);
    }
  }
};
