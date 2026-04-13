import { nanoid } from "nanoid";

import type {
  ExtractedEntities,
  Intent,
  IntentClassification,
  NormalizedEmail,
  RiskFlag
} from "../../../schemas/src/index.js";
import { extractedEntitiesSchema, intentClassificationSchema } from "../../../schemas/src/index.js";

import type { ModelProvider } from "../contracts.js";
import { containsAny, lines } from "../lib/text.js";

type IntentRule = {
  intent: Intent;
  keywords: string[];
  confidence: number;
  reason: string;
};

const INTENT_RULES: IntentRule[] = [
  {
    intent: "business_hours_question",
    keywords: ["open", "hours", "close", "closing", "late today", "tomorrow", "today"],
    confidence: 0.9,
    reason: "Matched business-hours keywords."
  },
  {
    intent: "location_question",
    keywords: ["where are you located", "address", "located", "directions"],
    confidence: 0.98,
    reason: "Matched location and address keywords."
  },
  {
    intent: "booking_question",
    keywords: ["book", "booking", "schedule", "appointment", "reserve"],
    confidence: 0.97,
    reason: "Matched booking and scheduling keywords."
  },
  {
    intent: "required_documents_question",
    keywords: ["documents", "paperwork", "bring", "id", "insurance card", "what do i need"],
    confidence: 0.9,
    reason: "Matched document requirement keywords."
  },
  {
    intent: "parking_question",
    keywords: ["parking", "park", "garage", "lot"],
    confidence: 0.98,
    reason: "Matched parking keywords."
  },
  {
    intent: "reschedule_request",
    keywords: ["reschedule", "move my appointment", "another time", "change my appointment"],
    confidence: 0.93,
    reason: "Matched reschedule language."
  },
  {
    intent: "billing_question",
    keywords: ["refund", "invoice", "charged", "billing", "payment", "receipt", "charged incorrectly"],
    confidence: 0.94,
    reason: "Matched billing and refund language."
  },
  {
    intent: "complaint",
    keywords: ["upset", "rude", "complaint", "terrible", "disappointed", "bad service"],
    confidence: 0.96,
    reason: "Matched complaint and escalation language."
  }
];

const PROMPT_INJECTION_PATTERNS = [
  "ignore all previous instructions",
  "system prompt",
  "act as",
  "refund me immediately",
  "override policy"
];

const SENSITIVE_KEYWORDS = ["social security", "credit card", "attorney", "lawsuit", "medical record"];

function extractEntities(normalizedEmail: NormalizedEmail, matchedTopics: string[]): ExtractedEntities {
  const text = `${normalizedEmail.subject}\n${normalizedEmail.normalizedBodyText}`.toLowerCase();
  const bodyQuestionCount = (normalizedEmail.normalizedBodyText.match(/\?/g) ?? []).length;
  const requestedDay =
    text.includes("tomorrow") ? "tomorrow" : text.includes("today") ? "today" : undefined;
  const requestedTimeWindow = text.includes("after work")
    ? "after_work"
    : text.includes("late")
      ? "late"
      : undefined;
  const requestedLocationHint = text.includes("directions") ? "directions" : undefined;
  const requestedDocumentTypes = [
    text.includes("id") ? "photo_id" : null,
    text.includes("insurance") ? "insurance_card" : null,
    text.includes("paperwork") ? "paperwork" : null
  ].filter(Boolean) as string[];
  const mentionsAttachment =
    text.includes("attached") || text.includes("attachment") || text.includes("paperwork attached");
  const sensitiveKeywords = SENSITIVE_KEYWORDS.filter((keyword) => text.includes(keyword));

  return extractedEntitiesSchema.parse({
    requestedDay,
    requestedTimeWindow,
    requestedLocationHint,
    requestedDocumentTypes,
    bookingContext: text.includes("appointment") ? "appointment" : undefined,
    hasMultipleQuestions: bodyQuestionCount > 1,
    mentionsAttachment,
    sensitiveKeywords,
    matchedTopics
  });
}

function deriveRiskFlags(normalizedEmail: NormalizedEmail, entities: ExtractedEntities, secondaryIntents: Intent[]): RiskFlag[] {
  const text = `${normalizedEmail.subject}\n${normalizedEmail.normalizedBodyText}`.toLowerCase();
  const flags = new Set<RiskFlag>();

  if (entities.hasMultipleQuestions || secondaryIntents.length > 0) {
    flags.add("multiple_asks");
  }
  if (entities.mentionsAttachment) {
    flags.add("attachment_dependency");
  }
  if (entities.sensitiveKeywords.length > 0) {
    flags.add("sensitive_keyword");
  }
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => text.includes(pattern))) {
    flags.add("prompt_injection");
  }
  if (lines(normalizedEmail.normalizedBodyText).length > 20) {
    flags.add("long_thread");
  }
  if (containsAny(text, ["unsubscribe", "newsletter", "do-not-reply"])) {
    flags.add("newsletter_candidate");
  }
  if (containsAny(text, ["automatic reply", "out of office", "auto-reply"])) {
    flags.add("auto_reply_candidate");
  }
  if (containsAny(text, ["refund", "invoice", "charged"])) {
    flags.add("billing_language");
  }
  if (containsAny(text, ["upset", "rude", "terrible", "disappointed"])) {
    flags.add("complaint_language");
  }

  return [...flags];
}

function runDeterministicClassification(normalizedEmail: NormalizedEmail) {
  const combined = `${normalizedEmail.subject}\n${normalizedEmail.normalizedBodyText}`.toLowerCase();
  const matches = INTENT_RULES.filter((rule) => containsAny(combined, rule.keywords))
    .map((rule) => ({
      intent: rule.intent,
      confidence: rule.confidence,
      reason: rule.reason
    }));

  const hasDocumentLanguage = containsAny(combined, [
    "what do i need",
    "bring",
    "documents",
    "paperwork",
    "insurance card",
    "photo id"
  ]);

  if (hasDocumentLanguage) {
    for (const match of matches) {
      if (match.intent === "required_documents_question") {
        match.confidence = Math.max(match.confidence, 0.98);
        match.reason = "Matched strong document-requirement language.";
      }
      if (match.intent === "booking_question") {
        match.confidence = Math.min(match.confidence, 0.78);
      }
    }
  }

  return matches
    .sort((left, right) => right.confidence - left.confidence);
}

export async function classifyIntent(args: {
  messageId: string;
  normalizedEmail: NormalizedEmail;
  modelProvider: ModelProvider;
}): Promise<IntentClassification> {
  const deterministicMatches = runDeterministicClassification(args.normalizedEmail);
  const matchedTopics = deterministicMatches.map((match) => match.intent);
  const entities = extractEntities(args.normalizedEmail, matchedTopics);
  const secondaryIntents = deterministicMatches.slice(1, 3).map((match) => match.intent);
  let primaryIntent: Intent = deterministicMatches[0]?.intent ?? "unknown";
  let confidence = deterministicMatches[0]?.confidence ?? 0.38;
  let reasoningSummary = deterministicMatches[0]?.reason ?? "No deterministic rule matched the message.";
  let providerUsed = "deterministic-rules";
  let riskFlags = deriveRiskFlags(args.normalizedEmail, entities, secondaryIntents);

  if (deterministicMatches.length === 0 || confidence < 0.75) {
    const fallback = await args.modelProvider.classifyIntent({
      normalizedEmail: args.normalizedEmail
    });

    if (fallback) {
      primaryIntent = fallback.intent;
      confidence = fallback.confidence;
      reasoningSummary = `${reasoningSummary} Fallback model summary: ${fallback.reasoningSummary}`;
      providerUsed = fallback.providerUsed;
      riskFlags = Array.from(new Set<RiskFlag>([...riskFlags, ...fallback.riskFlags]));
    }
  }

  if (confidence < 0.75) {
    riskFlags = Array.from(new Set<RiskFlag>([...riskFlags, "low_confidence"]));
  }

  return intentClassificationSchema.parse({
    id: nanoid(),
    messageId: args.messageId,
    intent: primaryIntent,
    confidence,
    secondaryIntents,
    extractedEntities: entities,
    riskFlags,
    reasoningSummary,
    providerUsed,
    createdAt: new Date().toISOString()
  });
}
