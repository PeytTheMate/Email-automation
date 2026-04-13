import type { NormalizedEmail } from "../../../schemas/src/index.js";
import { normalizedEmailSchema } from "../../../schemas/src/index.js";

import type { NormalizationContext } from "../contracts.js";
import { normalizeWhitespace } from "../lib/text.js";

const QUOTED_REPLY_PATTERNS = [
  /^on .+ wrote:$/i,
  /^from:\s/i,
  /^sent:\s/i,
  /^subject:\s/i,
  /^>/i
];

export function stripQuotedText(rawBody: string) {
  const normalized = normalizeWhitespace(rawBody);
  const lines = normalized.split("\n");
  const kept: string[] = [];
  const quoted: string[] = [];
  let inQuotedSection = false;

  for (const line of lines) {
    if (QUOTED_REPLY_PATTERNS.some((pattern) => pattern.test(line.trim()))) {
      inQuotedSection = true;
    }

    if (inQuotedSection) {
      quoted.push(line);
    } else {
      kept.push(line);
    }
  }

  return {
    strippedBody: normalizeWhitespace(kept.join("\n")),
    strippedQuotedText: quoted.length > 0 ? quoted.join("\n").trim() : null
  };
}

export function normalizeEmail(context: NormalizationContext): NormalizedEmail {
  const { strippedBody, strippedQuotedText } = stripQuotedText(context.rawBody);
  const assumptions = [
    "Quoted text is removed using conservative reply separators and leading quote markers.",
    "Attachment metadata is a placeholder until attachment parsing is added.",
    "Language is left as en unless a provider supplies a stronger signal."
  ];

  return normalizedEmailSchema.parse({
    messageId: context.messageId,
    senderEmail: context.senderEmail.toLowerCase(),
    senderName: context.senderName,
    recipients: context.recipients.map((recipient) => recipient.toLowerCase()),
    ccRecipients: context.ccRecipients.map((recipient) => recipient.toLowerCase()),
    subject: normalizeWhitespace(context.subject),
    normalizedBodyText: strippedBody,
    strippedQuotedText,
    threadId: context.threadId,
    receivedAt: context.receivedAt,
    attachmentMetadata: [],
    language: "en",
    assumptions
  });
}
