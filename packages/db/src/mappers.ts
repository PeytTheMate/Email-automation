import {
  auditLogEventSchema,
  automationProfileSchema,
  draftReplySchema,
  emailMessageSchema,
  emailThreadSchema,
  intentClassificationSchema,
  knowledgeDocumentSchema,
  mailboxSettingsSchema,
  outboxMessageSchema,
  policyDecisionSchema,
  processingJobSchema,
  scenarioSchema,
  toneProfileSchema,
  userSettingsSchema
} from "../../schemas/src/index.js";
import type {
  AuditLogEvent,
  AutomationProfile,
  DraftReply,
  EmailMessage,
  EmailThread,
  IntentClassification,
  KnowledgeDocument,
  MailboxSettings,
  OutboxMessage,
  PolicyDecision,
  ProcessingJob,
  Scenario,
  ToneProfile,
  UserSettings
} from "../../schemas/src/index.js";
import {
  auditLogsTable,
  automationProfilesTable,
  classificationsTable,
  draftsTable,
  knowledgeDocumentsTable,
  mailboxesTable,
  messagesTable,
  outboxTable,
  policyDecisionsTable,
  processingJobsTable,
  scenariosTable,
  threadsTable,
  toneProfilesTable,
  usersTable
} from "./schema.js";
import { parseJson } from "./utils.js";

export function mapMailbox(row: typeof mailboxesTable.$inferSelect): MailboxSettings {
  return mailboxSettingsSchema.parse({
    ...row,
    displayName: row.displayName,
    emailAddress: row.emailAddress,
    providerMode: row.providerMode,
    defaultToneProfileId: row.defaultToneProfileId,
    defaultAutomationProfileId: row.defaultAutomationProfileId,
    escalationTarget: row.escalationTarget,
    allowMockAutoSend: row.allowMockAutoSend,
    enabledIntents: parseJson(row.enabledIntentsJson)
  });
}

export function mapUser(row: typeof usersTable.$inferSelect): UserSettings {
  return userSettingsSchema.parse({
    ...row,
    mailboxId: row.mailboxId,
    toneProfileOverrideId: row.toneProfileOverrideId ?? null,
    automationProfileOverrideId: row.automationProfileOverrideId ?? null
  });
}

export function mapAutomationProfile(
  row: typeof automationProfilesTable.$inferSelect
): AutomationProfile {
  return automationProfileSchema.parse({
    ...row,
    approvalMode: row.approvalMode,
    allowedAutoSendIntents: parseJson(row.allowedAutoSendIntentsJson),
    blockedIntents: parseJson(row.blockedIntentsJson),
    confidenceThresholdDraft: row.confidenceThresholdDraft,
    confidenceThresholdAutoSend: row.confidenceThresholdAutoSend,
    featureFlags: parseJson(row.featureFlagsJson),
    maxReplySentences: row.maxReplySentences
  });
}

export function mapToneProfile(row: typeof toneProfilesTable.$inferSelect): ToneProfile {
  return toneProfileSchema.parse({
    ...row,
    greetingStyle: row.greetingStyle,
    closingStyle: row.closingStyle,
    styleRules: parseJson(row.styleRulesJson),
    approvedClosings: parseJson(row.approvedClosingsJson),
    forbiddenPhrases: parseJson(row.forbiddenPhrasesJson),
    signatureTemplate: row.signatureTemplate
  });
}

export function mapKnowledgeDocument(
  row: typeof knowledgeDocumentsTable.$inferSelect
): KnowledgeDocument {
  return knowledgeDocumentSchema.parse({
    id: row.id,
    key: row.key,
    title: row.title,
    intent: row.intent ?? undefined,
    mailboxKeys: parseJson(row.mailboxKeysJson),
    contentType: row.contentType,
    content: parseJson(row.contentJson),
    source: row.source,
    isActive: row.isActive,
    updatedAt: row.updatedAt
  });
}

export function mapScenario(row: typeof scenariosTable.$inferSelect): Scenario {
  return scenarioSchema.parse({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    scenarioType: row.scenarioType,
    senderEmail: row.senderEmail,
    senderName: row.senderName,
    subject: row.subject,
    body: row.body,
    expectedIntent: row.expectedIntent,
    expectedDecision: row.expectedDecision,
    expectedReplyContains: parseJson(row.expectedReplyContainsJson),
    replayReceivedAt: row.replayReceivedAt ?? null,
    demoReady: row.demoReady
  });
}

export function mapThread(row: typeof threadsTable.$inferSelect): EmailThread {
  return emailThreadSchema.parse({
    id: row.id,
    mailboxId: row.mailboxId,
    subject: row.subject,
    latestMessageId: row.latestMessageId,
    currentIntent: row.currentIntent,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

export function mapMessage(row: typeof messagesTable.$inferSelect): EmailMessage {
  return emailMessageSchema.parse({
    id: row.id,
    mailboxId: row.mailboxId,
    sourceType: row.sourceType,
    actorUserId: row.actorUserId ?? null,
    sourceMessageKey: row.sourceMessageKey ?? null,
    scenarioId: row.scenarioId ?? null,
    threadId: row.threadId,
    senderEmail: row.senderEmail,
    senderName: row.senderName ?? null,
    recipients: parseJson(row.recipientsJson),
    ccRecipients: parseJson(row.ccRecipientsJson),
    subject: row.subject,
    rawBody: row.rawBody,
    receivedAt: row.receivedAt,
    status: row.status,
    createdAt: row.createdAt
  });
}

export function mapClassification(
  row: typeof classificationsTable.$inferSelect
): IntentClassification {
  return intentClassificationSchema.parse({
    id: row.id,
    messageId: row.messageId,
    intent: row.intent,
    confidence: row.confidence,
    secondaryIntents: parseJson(row.secondaryIntentsJson),
    extractedEntities: parseJson(row.extractedEntitiesJson),
    riskFlags: parseJson(row.riskFlagsJson),
    reasoningSummary: row.reasoningSummary,
    providerUsed: row.providerUsed,
    createdAt: row.createdAt
  });
}

export function mapPolicyDecision(
  row: typeof policyDecisionsTable.$inferSelect
): PolicyDecision {
  return policyDecisionSchema.parse({
    id: row.id,
    messageId: row.messageId,
    classificationId: row.classificationId,
    action: row.action,
    allowMockAutoSend: row.allowMockAutoSend,
    rationale: row.rationale,
    triggeredRules: parseJson(row.triggeredRulesJson),
    riskLevel: row.riskLevel,
    escalationTarget: row.escalationTarget ?? null,
    createdAt: row.createdAt
  });
}

export function mapDraft(row: typeof draftsTable.$inferSelect): DraftReply {
  return draftReplySchema.parse({
    id: row.id,
    messageId: row.messageId,
    subject: row.subject,
    body: row.body,
    toneProfileId: row.toneProfileId,
    retrievedFactKeys: parseJson(row.retrievedFactKeysJson),
    confidenceNote: row.confidenceNote,
    generationMetadata: parseJson(row.generationMetadataJson),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

export function mapAudit(row: typeof auditLogsTable.$inferSelect): AuditLogEvent {
  return auditLogEventSchema.parse({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    eventType: row.eventType,
    payload: parseJson(row.payloadJson),
    createdAt: row.createdAt
  });
}

export function mapJob(row: typeof processingJobsTable.$inferSelect): ProcessingJob {
  return processingJobSchema.parse({
    id: row.id,
    messageId: row.messageId,
    jobType: row.jobType,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError ?? null,
    nextRetryAt: row.nextRetryAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

export function mapOutbox(row: typeof outboxTable.$inferSelect): OutboxMessage {
  return outboxMessageSchema.parse({
    id: row.id,
    messageId: row.messageId,
    draftId: row.draftId,
    recipientEmail: row.recipientEmail,
    subject: row.subject,
    body: row.body,
    sentAt: row.sentAt,
    deliveryMode: row.deliveryMode
  });
}
