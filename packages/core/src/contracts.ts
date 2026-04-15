import type {
  DeliveryMode,
  DraftReply,
  ExtractedEntities,
  Intent,
  KnowledgeDocument,
  MailboxSettings,
  NormalizedEmail,
  OutboxMessage,
  ToneProfile
} from "../../schemas/src/index.js";
import type { AutomationProfile, IntentClassification } from "../../schemas/src/index.js";

export type KnowledgeFact = {
  key: string;
  title: string;
  value: string;
  documentId: string;
};

export type RetrievalResult = {
  facts: KnowledgeFact[];
  documents: KnowledgeDocument[];
  summary: string;
};

export type ClassificationRequest = {
  normalizedEmail: NormalizedEmail;
};

export type ClassificationResult = Pick<
  IntentClassification,
  | "intent"
  | "confidence"
  | "secondaryIntents"
  | "extractedEntities"
  | "riskFlags"
  | "reasoningSummary"
  | "providerUsed"
>;

export type GenerationRequest = {
  normalizedEmail: NormalizedEmail;
  classification: IntentClassification;
  retrieval: RetrievalResult;
  toneProfile: ToneProfile;
  mailbox: MailboxSettings;
  automationProfile: AutomationProfile;
};

export type GenerationResult = Pick<
  DraftReply,
  "subject" | "body" | "confidenceNote" | "generationMetadata"
>;

export type SyncedInboundMessage = {
  providerName: string;
  sourceMessageKey: string;
  externalMessageId: string;
  externalThreadId: string | null;
  externalHistoryId: string | null;
  senderEmail: string;
  senderName: string | null;
  recipients: string[];
  ccRecipients: string[];
  subject: string;
  rawBody: string;
  receivedAt: string;
};

export type EmailSyncResult = {
  providerName: string;
  nextSyncCursor: string | null;
  messages: SyncedInboundMessage[];
};

export type DeliveryRequest = {
  messageId: string;
  mailbox: MailboxSettings;
  draft: DraftReply;
  recipientEmail: string;
  deliveryMode: DeliveryMode;
  operatorUserId?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
};

export interface EmailProvider {
  providerName: string;
  listMessages(args: {
    mailbox: MailboxSettings;
    limit?: number;
    syncCursor?: string | null;
  }): Promise<EmailSyncResult>;
}

export interface ModelProvider {
  providerName: string;
  classifyIntent(request: ClassificationRequest): Promise<ClassificationResult | null>;
  generateReply(request: GenerationRequest): Promise<GenerationResult>;
}

export interface KnowledgeProvider {
  providerName: string;
  retrieveForIntent(args: {
    intent: Intent;
    entities: ExtractedEntities;
    mailbox: MailboxSettings;
    receivedAt: string;
  }): Promise<RetrievalResult>;
}

export interface SendProvider {
  providerName: string;
  createDraft(request: DeliveryRequest): Promise<OutboxMessage>;
  sendReply(request: DeliveryRequest): Promise<OutboxMessage>;
}

export interface ProviderRegistry {
  getEmailProvider(mailbox: MailboxSettings): EmailProvider;
  getModelProvider(mailbox: MailboxSettings): ModelProvider;
  getKnowledgeProvider(mailbox: MailboxSettings): KnowledgeProvider;
  getSendProvider(mailbox: MailboxSettings): SendProvider;
}

export type PolicyContext = {
  classification: IntentClassification;
  retrieval: RetrievalResult;
  mailbox: MailboxSettings;
  automationProfile: AutomationProfile;
};

export type NormalizationContext = {
  messageId: string;
  senderEmail: string;
  senderName: string | null;
  recipients: string[];
  ccRecipients: string[];
  subject: string;
  rawBody: string;
  threadId: string;
  receivedAt: string;
};
