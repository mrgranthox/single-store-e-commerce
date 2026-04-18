import { invalidInputError } from "../../common/errors/app-error";

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

/**
 * Rejects review text that looks abusive (optional blocklist), scam-like, or spammy.
 * Rating-only reviews (empty body) skip text checks.
 */
export const assertCustomerReviewContentPublishable = (
  body: string | null | undefined,
  blocklistTerms: readonly string[]
): void => {
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) {
    return;
  }

  const normalized = normalizeReviewText(trimmed);

  if (SPAM_CHAR_RUN.test(normalized)) {
    throw invalidInputError(
      "This review could not be submitted. Please shorten repeated characters and try again.",
      { reason: "SPAM_PATTERN" }
    );
  }

  if (countUrls(normalized) >= 3) {
    throw invalidInputError(
      "This review could not be submitted. Please use fewer links in your review.",
      { reason: "EXCESSIVE_URLS" }
    );
  }

  for (const pattern of FRAUD_PATTERNS) {
    if (pattern.test(normalized)) {
      throw invalidInputError(
        "This review could not be submitted. Remove payment requests, off-platform contact instructions, or suspicious claims.",
        { reason: "FRAUD_PATTERN" }
      );
    }
  }

  for (const rawTerm of blocklistTerms) {
    const t = rawTerm.trim().toLowerCase();
    if (t.length < 2) {
      continue;
    }
    if (t.includes(" ")) {
      if (normalized.includes(t)) {
        throw invalidInputError(
          "This review could not be submitted. Please revise your wording and try again.",
          { reason: "BLOCKLIST_TERM" }
        );
      }
      continue;
    }
    const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, "iu");
    if (re.test(normalized)) {
      throw invalidInputError(
        "This review could not be submitted. Please revise your wording and try again.",
        { reason: "BLOCKLIST_TERM" }
      );
    }
  }
};
