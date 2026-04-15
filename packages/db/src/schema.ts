import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mailboxesTable = sqliteTable("mailboxes", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  displayName: text("display_name").notNull(),
  emailAddress: text("email_address"),
  providerMode: text("provider_mode").notNull(),
  connectionMode: text("connection_mode").notNull().default("local_sandbox"),
  gmailMailboxAddress: text("gmail_mailbox_address"),
  gmailLabelFilter: text("gmail_label_filter"),
  allowedSenderPatternsJson: text("allowed_sender_patterns_json").notNull().default("[]"),
  allowedOutboundRecipientPatternsJson: text("allowed_outbound_recipient_patterns_json").notNull().default("[]"),
  enableLiveRead: integer("enable_live_read", { mode: "boolean" }).notNull().default(false),
  enableLiveDrafts: integer("enable_live_drafts", { mode: "boolean" }).notNull().default(false),
  enableLiveSend: integer("enable_live_send", { mode: "boolean" }).notNull().default(false),
  defaultModelProvider: text("default_model_provider").notNull().default("mock"),
  gmailHistoryId: text("gmail_history_id"),
  defaultToneProfileId: text("default_tone_profile_id").notNull(),
  defaultAutomationProfileId: text("default_automation_profile_id").notNull(),
  escalationTarget: text("escalation_target").notNull(),
  allowMockAutoSend: integer("allow_mock_auto_send", { mode: "boolean" })
    .notNull()
    .default(false),
  enabledIntentsJson: text("enabled_intents_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  mailboxId: text("mailbox_id").notNull(),
  toneProfileOverrideId: text("tone_profile_override_id"),
  automationProfileOverrideId: text("automation_profile_override_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const automationProfilesTable = sqliteTable("automation_profiles", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  approvalMode: text("approval_mode").notNull(),
  allowedAutoSendIntentsJson: text("allowed_auto_send_intents_json").notNull(),
  blockedIntentsJson: text("blocked_intents_json").notNull(),
  confidenceThresholdDraft: real("confidence_threshold_draft").notNull(),
  confidenceThresholdAutoSend: real("confidence_threshold_auto_send").notNull(),
  featureFlagsJson: text("feature_flags_json").notNull(),
  maxReplySentences: integer("max_reply_sentences").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const toneProfilesTable = sqliteTable("tone_profiles", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  greetingStyle: text("greeting_style").notNull(),
  closingStyle: text("closing_style").notNull(),
  styleRulesJson: text("style_rules_json").notNull(),
  approvedClosingsJson: text("approved_closings_json").notNull(),
  forbiddenPhrasesJson: text("forbidden_phrases_json").notNull(),
  signatureTemplate: text("signature_template").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const knowledgeDocumentsTable = sqliteTable("knowledge_documents", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  intent: text("intent"),
  mailboxKeysJson: text("mailbox_keys_json").notNull().default("[]"),
  contentType: text("content_type").notNull(),
  contentJson: text("content_json").notNull(),
  source: text("source").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull()
});

export const scenariosTable = sqliteTable("scenarios", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  scenarioType: text("scenario_type").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  expectedIntent: text("expected_intent").notNull(),
  expectedDecision: text("expected_decision").notNull(),
  expectedReplyContainsJson: text("expected_reply_contains_json").notNull(),
  replayReceivedAt: text("replay_received_at"),
  demoReady: integer("demo_ready", { mode: "boolean" }).notNull().default(false)
});

export const threadsTable = sqliteTable("threads", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id").notNull(),
  subject: text("subject").notNull(),
  latestMessageId: text("latest_message_id").notNull(),
  providerName: text("provider_name").notNull().default("local-email-sandbox"),
  externalThreadId: text("external_thread_id"),
  latestExternalHistoryId: text("latest_external_history_id"),
  currentIntent: text("current_intent"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const messagesTable = sqliteTable("messages", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id").notNull(),
  sourceType: text("source_type").notNull(),
  scenarioId: text("scenario_id"),
  threadId: text("thread_id").notNull(),
  actorUserId: text("actor_user_id"),
  sourceMessageKey: text("source_message_key"),
  providerName: text("provider_name").notNull().default("local-email-sandbox"),
  externalMessageId: text("external_message_id"),
  externalThreadId: text("external_thread_id"),
  externalHistoryId: text("external_history_id"),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name"),
  recipientsJson: text("recipients_json").notNull(),
  ccRecipientsJson: text("cc_recipients_json").notNull(),
  subject: text("subject").notNull(),
  rawBody: text("raw_body").notNull(),
  normalizedBodyText: text("normalized_body_text"),
  strippedQuotedText: text("stripped_quoted_text"),
  attachmentMetadataJson: text("attachment_metadata_json").notNull(),
  language: text("language"),
  receivedAt: text("received_at").notNull(),
  status: text("status").notNull(),
  processingVersion: text("processing_version").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const classificationsTable = sqliteTable("classifications", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().unique(),
  intent: text("intent").notNull(),
  confidence: real("confidence").notNull(),
  secondaryIntentsJson: text("secondary_intents_json").notNull(),
  extractedEntitiesJson: text("extracted_entities_json").notNull(),
  riskFlagsJson: text("risk_flags_json").notNull(),
  reasoningSummary: text("reasoning_summary").notNull(),
  providerUsed: text("provider_used").notNull(),
  createdAt: text("created_at").notNull()
});

export const policyDecisionsTable = sqliteTable("policy_decisions", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().unique(),
  classificationId: text("classification_id").notNull(),
  action: text("action").notNull(),
  allowMockAutoSend: integer("allow_mock_auto_send", { mode: "boolean" })
    .notNull()
    .default(false),
  rationale: text("rationale").notNull(),
  triggeredRulesJson: text("triggered_rules_json").notNull(),
  riskLevel: text("risk_level").notNull(),
  escalationTarget: text("escalation_target"),
  createdAt: text("created_at").notNull()
});

export const draftsTable = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  toneProfileId: text("tone_profile_id").notNull(),
  providerName: text("provider_name").notNull().default("internal-draft"),
  externalDraftId: text("external_draft_id"),
  externalMessageId: text("external_message_id"),
  retrievedFactKeysJson: text("retrieved_fact_keys_json").notNull(),
  confidenceNote: text("confidence_note").notNull(),
  generationMetadataJson: text("generation_metadata_json").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const outboxTable = sqliteTable("outbox_messages", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  draftId: text("draft_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  providerName: text("provider_name").notNull(),
  externalDraftId: text("external_draft_id"),
  externalMessageId: text("external_message_id"),
  deliveryStatus: text("delivery_status").notNull(),
  failureReason: text("failure_reason"),
  operatorUserId: text("operator_user_id"),
  sentAt: text("sent_at").notNull(),
  deliveryMode: text("delivery_mode").notNull()
});

export const auditLogsTable = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const processingJobsTable = sqliteTable("processing_jobs", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  jobType: text("job_type").notNull(),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  nextRetryAt: text("next_retry_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});
