import type {
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

export type MockSendRequest = {
  messageId: string;
  draft: DraftReply;
  recipientEmail: string;
  deliveryMode: OutboxMessage["deliveryMode"];
};

export interface EmailProvider {
  providerName: string;
  listMessages(): Promise<unknown[]>;
  getMessage(messageId: string): Promise<unknown>;
  createDraft(): Promise<never>;
  sendReply(): Promise<never>;
  acknowledgeEvent(eventId: string): Promise<void>;
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
  sendMockReply(request: MockSendRequest): Promise<OutboxMessage>;
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
