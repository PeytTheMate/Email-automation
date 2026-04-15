import { z } from "zod";

export const intentSchema = z.enum([
  "business_hours_question",
  "location_question",
  "booking_question",
  "required_documents_question",
  "parking_question",
  "reschedule_request",
  "billing_question",
  "complaint",
  "unknown"
]);

export const riskFlagSchema = z.enum([
  "low_confidence",
  "multiple_asks",
  "sensitive_keyword",
  "attachment_dependency",
  "prompt_injection",
  "auto_reply_candidate",
  "long_thread",
  "newsletter_candidate",
  "billing_language",
  "complaint_language",
  "knowledge_gap"
]);

export const emailStatusSchema = z.enum([
  "new",
  "processing",
  "draft_ready",
  "draft_created",
  "auto_sent",
  "sent",
  "escalated",
  "blocked",
  "failed"
]);

export const policyActionSchema = z.enum([
  "auto_send_allowed",
  "draft_only",
  "escalate",
  "blocked"
]);

export const approvalModeSchema = z.enum([
  "observe_only",
  "draft_only",
  "mock_auto_send"
]);

export const modelProviderKeySchema = z.enum(["mock", "ollama", "remote"]);

export const deliveryModeSchema = z.enum([
  "draft",
  "send_after_approval",
  "mock_send",
  "mock_auto_send"
]);

export const deliveryStatusSchema = z.enum([
  "draft_created",
  "sent",
  "failed"
]);

export const processingJobStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed"
]);

export const extractedEntitiesSchema = z.object({
  requestedDay: z.string().optional(),
  requestedTimeWindow: z.string().optional(),
  requestedLocationHint: z.string().optional(),
  requestedDocumentTypes: z.array(z.string()).default([]),
  bookingContext: z.string().optional(),
  hasMultipleQuestions: z.boolean().default(false),
  mentionsAttachment: z.boolean().default(false),
  sensitiveKeywords: z.array(z.string()).default([]),
  matchedTopics: z.array(z.string()).default([])
});

export const emailMessageSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  sourceType: z.enum(["manual_paste", "seeded_scenario", "replay", "gmail_sync"]),
  threadId: z.string(),
  actorUserId: z.string().nullable().optional(),
  sourceMessageKey: z.string().nullable().optional(),
  scenarioId: z.string().nullable().optional(),
  providerName: z.string().default("local-email-sandbox"),
  externalMessageId: z.string().nullable().default(null),
  externalThreadId: z.string().nullable().default(null),
  externalHistoryId: z.string().nullable().default(null),
  senderEmail: z.string().email(),
  senderName: z.string().nullable(),
  recipients: z.array(z.string().email()).default([]),
  ccRecipients: z.array(z.string().email()).default([]),
  subject: z.string(),
  rawBody: z.string(),
  receivedAt: z.string(),
  status: emailStatusSchema,
  createdAt: z.string()
});

export const emailThreadSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  subject: z.string(),
  latestMessageId: z.string(),
  providerName: z.string().default("local-email-sandbox"),
  externalThreadId: z.string().nullable().default(null),
  latestExternalHistoryId: z.string().nullable().default(null),
  currentIntent: intentSchema.nullable(),
  status: emailStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const normalizedEmailSchema = z.object({
  messageId: z.string(),
  senderEmail: z.string().email(),
  senderName: z.string().nullable(),
  recipients: z.array(z.string().email()),
  ccRecipients: z.array(z.string().email()),
  subject: z.string(),
  normalizedBodyText: z.string(),
  strippedQuotedText: z.string().nullable(),
  threadId: z.string(),
  receivedAt: z.string(),
  attachmentMetadata: z.array(
    z.object({
      fileName: z.string(),
      mimeType: z.string().optional(),
      sizeBytes: z.number().optional()
    })
  ),
  language: z.string().nullable(),
  assumptions: z.array(z.string()).default([])
});

export const intentClassificationSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  intent: intentSchema,
  confidence: z.number().min(0).max(1),
  secondaryIntents: z.array(intentSchema).default([]),
  extractedEntities: extractedEntitiesSchema,
  riskFlags: z.array(riskFlagSchema).default([]),
  reasoningSummary: z.string(),
  providerUsed: z.string(),
  createdAt: z.string()
});

export const policyDecisionSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  classificationId: z.string(),
  action: policyActionSchema,
  allowMockAutoSend: z.boolean(),
  rationale: z.string(),
  triggeredRules: z.array(z.string()).default([]),
  riskLevel: z.enum(["low", "medium", "high"]),
  escalationTarget: z.string().nullable().default(null),
  createdAt: z.string()
});

export const automationProfileSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  approvalMode: approvalModeSchema,
  allowedAutoSendIntents: z.array(intentSchema),
  blockedIntents: z.array(intentSchema),
  confidenceThresholdDraft: z.number().min(0).max(1),
  confidenceThresholdAutoSend: z.number().min(0).max(1),
  featureFlags: z.record(z.boolean()).default({}),
  maxReplySentences: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const toneProfileSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  greetingStyle: z.string(),
  closingStyle: z.string(),
  styleRules: z.record(z.union([z.string(), z.number(), z.boolean()])),
  approvedClosings: z.array(z.string()),
  forbiddenPhrases: z.array(z.string()),
  signatureTemplate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const knowledgeDocumentSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  intent: intentSchema.optional(),
  mailboxKeys: z.array(z.string()).default([]),
  contentType: z.enum(["faq", "business_hours", "address", "booking", "parking", "documents", "policy"]),
  content: z.record(z.any()),
  source: z.string(),
  isActive: z.boolean(),
  updatedAt: z.string()
});

export const draftReplySchema = z.object({
  id: z.string(),
  messageId: z.string(),
  subject: z.string(),
  body: z.string(),
  toneProfileId: z.string(),
  providerName: z.string().default("internal-draft"),
  externalDraftId: z.string().nullable().default(null),
  externalMessageId: z.string().nullable().default(null),
  retrievedFactKeys: z.array(z.string()),
  confidenceNote: z.string(),
  generationMetadata: z.object({
    provider: z.string(),
    mode: z.string(),
    grounded: z.boolean()
  }),
  status: z.enum(["generated", "edited", "approved", "rejected", "mock_sent"]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const auditLogEventSchema = z.object({
  id: z.string(),
  entityType: z.enum(["message", "draft", "job", "outbox"]),
  entityId: z.string(),
  eventType: z.string(),
  payload: z.record(z.any()),
  createdAt: z.string()
});

export const mailboxSettingsSchema = z.object({
  id: z.string(),
  key: z.string(),
  displayName: z.string(),
  emailAddress: z.string().nullable(),
  providerMode: z.enum(["local_mock", "gmail_test"]),
  connectionMode: z.enum(["local_sandbox", "gmail_test"]).default("local_sandbox"),
  gmailMailboxAddress: z.string().email().nullable().default(null),
  gmailLabelFilter: z.string().nullable().default(null),
  allowedSenderPatterns: z.array(z.string()).default([]),
  allowedOutboundRecipientPatterns: z.array(z.string()).default([]),
  enableLiveRead: z.boolean().default(false),
  enableLiveDrafts: z.boolean().default(false),
  enableLiveSend: z.boolean().default(false),
  defaultModelProvider: modelProviderKeySchema.default("mock"),
  gmailHistoryId: z.string().nullable().default(null),
  defaultToneProfileId: z.string(),
  defaultAutomationProfileId: z.string(),
  escalationTarget: z.string(),
  allowMockAutoSend: z.boolean(),
  enabledIntents: z.array(intentSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const userSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  mailboxId: z.string(),
  toneProfileOverrideId: z.string().nullable(),
  automationProfileOverrideId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const processingJobSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  jobType: z.enum(["process_inbound_email"]),
  status: processingJobStatusSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  nextRetryAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const outboxMessageSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  draftId: z.string(),
  recipientEmail: z.string(),
  subject: z.string(),
  body: z.string(),
  providerName: z.string(),
  externalDraftId: z.string().nullable().default(null),
  externalMessageId: z.string().nullable().default(null),
  deliveryStatus: deliveryStatusSchema,
  failureReason: z.string().nullable().default(null),
  operatorUserId: z.string().nullable().default(null),
  sentAt: z.string(),
  deliveryMode: deliveryModeSchema
});

export const scenarioSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  scenarioType: z.enum(["safe", "ambiguous", "escalation", "adversarial"]),
  senderEmail: z.string().email(),
  senderName: z.string(),
  subject: z.string(),
  body: z.string(),
  expectedIntent: intentSchema,
  expectedDecision: policyActionSchema,
  expectedReplyContains: z.array(z.string()).default([]),
  replayReceivedAt: z.string().nullable().optional(),
  demoReady: z.boolean()
});

export const scenarioRunResultSchema = z.object({
  scenarioId: z.string(),
  scenarioKey: z.string(),
  scenarioName: z.string(),
  scenarioType: z.enum(["safe", "ambiguous", "escalation", "adversarial"]),
  demoReady: z.boolean(),
  expectedIntent: intentSchema,
  expectedDecision: policyActionSchema,
  latestMessageId: z.string().nullable(),
  latestStatus: emailStatusSchema.nullable(),
  actualIntent: intentSchema.nullable(),
  actualDecision: policyActionSchema.nullable(),
  actualConfidence: z.number().min(0).max(1).nullable(),
  matchesIntent: z.boolean(),
  matchesDecision: z.boolean(),
  matchesReplyContent: z.boolean(),
  failureReasons: z.array(z.string()).default([]),
  isPassing: z.boolean(),
  latestRunAt: z.string().nullable(),
  replyPreview: z.string().nullable()
});

export type Intent = z.infer<typeof intentSchema>;
export type RiskFlag = z.infer<typeof riskFlagSchema>;
export type EmailMessage = z.infer<typeof emailMessageSchema>;
export type EmailThread = z.infer<typeof emailThreadSchema>;
export type NormalizedEmail = z.infer<typeof normalizedEmailSchema>;
export type ExtractedEntities = z.infer<typeof extractedEntitiesSchema>;
export type IntentClassification = z.infer<typeof intentClassificationSchema>;
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;
export type AutomationProfile = z.infer<typeof automationProfileSchema>;
export type ToneProfile = z.infer<typeof toneProfileSchema>;
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;
export type DraftReply = z.infer<typeof draftReplySchema>;
export type AuditLogEvent = z.infer<typeof auditLogEventSchema>;
export type MailboxSettings = z.infer<typeof mailboxSettingsSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;
export type ProcessingJob = z.infer<typeof processingJobSchema>;
export type OutboxMessage = z.infer<typeof outboxMessageSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioRunResult = z.infer<typeof scenarioRunResultSchema>;
export type ModelProviderKey = z.infer<typeof modelProviderKeySchema>;
export type DeliveryMode = z.infer<typeof deliveryModeSchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
