import { nanoid } from "nanoid";

import {
  messageRepository,
  processingRepository,
  settingsRepository
} from "../../../db/src/index.js";
import type { DraftReply, EmailMessage } from "../../../schemas/src/index.js";
import { emailMessageSchema } from "../../../schemas/src/index.js";

import type {
  KnowledgeProvider,
  ModelProvider,
  SendProvider
} from "../contracts.js";
import { applyPolicy } from "./apply-policy.js";
import { classifyIntent } from "./classify-intent.js";
import { generateDraft } from "./generate-draft.js";
import { normalizeEmail } from "./normalize-email.js";
import { retrieveKnowledge } from "./retrieve-knowledge.js";

function resolveActingUser(args: { mailboxId: string; actorUserId?: string | null }) {
  if (args.actorUserId) {
    return settingsRepository.getUser(args.actorUserId);
  }

  return settingsRepository.getPrimaryUserForMailbox(args.mailboxId);
}

export async function ingestEmail(input: {
  mailboxId: string;
  sourceType: EmailMessage["sourceType"];
  scenarioId?: string | null;
  threadId?: string | null;
  actorUserId?: string | null;
  sourceMessageKey?: string | null;
  senderEmail: string;
  senderName: string | null;
  recipients: string[];
  ccRecipients?: string[];
  subject: string;
  rawBody: string;
  receivedAt?: string;
}) {
  if (input.sourceMessageKey) {
    const existing = messageRepository.getBySourceMessageKey(input.sourceMessageKey);
    if (existing) {
      return {
        message: existing,
        job: null
      };
    }
  }

  if (input.sourceType === "manual_paste") {
    const duplicate = messageRepository.findRecentDuplicate({
      mailboxId: input.mailboxId,
      sourceType: input.sourceType,
      senderEmail: input.senderEmail,
      subject: input.subject,
      rawBody: input.rawBody
    });

    if (duplicate) {
      return {
        message: duplicate,
        job: null
      };
    }
  }

  const timestamp = input.receivedAt ?? new Date().toISOString();
  const threadId = input.threadId?.trim() ? input.threadId.trim() : `thread-${nanoid(10)}`;
  const message = emailMessageSchema.parse({
    id: nanoid(),
    mailboxId: input.mailboxId,
    sourceType: input.sourceType,
    actorUserId: input.actorUserId ?? null,
    sourceMessageKey: input.sourceMessageKey ?? null,
    scenarioId: input.scenarioId ?? null,
    threadId,
    senderEmail: input.senderEmail,
    senderName: input.senderName ?? null,
    recipients: input.recipients,
    ccRecipients: input.ccRecipients ?? [],
    subject: input.subject,
    rawBody: input.rawBody,
    receivedAt: timestamp,
    status: "new",
    createdAt: timestamp
  });

  messageRepository.create(message);
  messageRepository.createOrUpdateThread({
    id: threadId,
    mailboxId: message.mailboxId,
    subject: message.subject,
    latestMessageId: message.id,
    currentIntent: null,
    status: "new",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  processingRepository.log({
    entityType: "message",
    entityId: message.id,
    eventType: "message_ingested",
    payload: {
      messageId: message.id,
      mailboxId: message.mailboxId,
      sourceType: message.sourceType,
      subject: message.subject,
      actorUserId: message.actorUserId ?? null,
      sourceMessageKey: message.sourceMessageKey ?? null
    }
  });

  const job = processingRepository.enqueue(message.id);
  processingRepository.log({
    entityType: "job",
    entityId: job.id,
    eventType: "job_enqueued",
    payload: {
      messageId: message.id
    }
  });

  return { message, job };
}

export async function processPendingJobs(args: {
  modelProvider: ModelProvider;
  knowledgeProvider: KnowledgeProvider;
  sendProvider: SendProvider;
}) {
  const jobs = processingRepository.listPending();
  const results = [];

  for (const job of jobs) {
    const claimed = processingRepository.claim(job.id);
    if (!claimed) {
      continue;
    }

    try {
      const result = await processMessage({
        messageId: claimed.messageId,
        modelProvider: args.modelProvider,
        knowledgeProvider: args.knowledgeProvider,
        sendProvider: args.sendProvider
      });
      processingRepository.complete(claimed.id);
      results.push(result);
    } catch (error) {
      const failure = processingRepository.fail(
        claimed.id,
        error instanceof Error ? error.message : "Unknown processing failure"
      );
      messageRepository.updateStatus(claimed.messageId, failure.terminal ? "failed" : "new");
      processingRepository.log({
        entityType: "job",
        entityId: claimed.id,
        eventType: failure.terminal ? "job_failed_terminal" : "job_requeued",
        payload: {
          messageId: claimed.messageId,
          lastError: error instanceof Error ? error.message : "Unknown processing failure",
          attempts: claimed.attempts,
          nextRetryAt: failure.nextRetryAt ?? null
        }
      });
    }
  }

  return results;
}

export async function processMessage(args: {
  messageId: string;
  modelProvider: ModelProvider;
  knowledgeProvider: KnowledgeProvider;
  sendProvider: SendProvider;
}) {
  const rawMessage = messageRepository.get(args.messageId);
  if (!rawMessage) {
    throw new Error(`Message ${args.messageId} was not found.`);
  }

  const mailbox = settingsRepository.getMailbox(rawMessage.mailboxId);
  if (!mailbox) {
    throw new Error(`Mailbox ${rawMessage.mailboxId} was not found.`);
  }

  const actingUser = resolveActingUser({
    mailboxId: rawMessage.mailboxId,
    actorUserId: rawMessage.actorUserId ?? null
  });
  const automationProfile = settingsRepository.getAutomationProfile(
    actingUser?.automationProfileOverrideId ?? mailbox.defaultAutomationProfileId
  );
  const toneProfile = settingsRepository.getToneProfile(
    actingUser?.toneProfileOverrideId ?? mailbox.defaultToneProfileId
  );

  if (!automationProfile || !toneProfile) {
    throw new Error("Mailbox configuration is incomplete.");
  }

  messageRepository.updateStatus(rawMessage.id, "processing");

  const normalizedEmail = normalizeEmail({
    messageId: rawMessage.id,
    senderEmail: rawMessage.senderEmail,
    senderName: rawMessage.senderName,
    recipients: rawMessage.recipients,
    ccRecipients: rawMessage.ccRecipients,
    subject: rawMessage.subject,
    rawBody: rawMessage.rawBody,
    threadId: rawMessage.threadId,
    receivedAt: rawMessage.receivedAt
  });

  messageRepository.updateNormalization(
    rawMessage.id,
    normalizedEmail.normalizedBodyText,
    normalizedEmail.strippedQuotedText,
    normalizedEmail.language
  );
  processingRepository.log({
    entityType: "message",
    entityId: rawMessage.id,
    eventType: "message_normalized",
    payload: normalizedEmail
  });

  const classification = await classifyIntent({
    messageId: rawMessage.id,
    normalizedEmail,
    modelProvider: args.modelProvider
  });
  processingRepository.saveClassification(classification);
  processingRepository.log({
    entityType: "message",
    entityId: rawMessage.id,
    eventType: "intent_classified",
    payload: classification
  });

  const retrieval = await retrieveKnowledge({
    intent: classification.intent,
    entities: classification.extractedEntities,
    mailbox,
    receivedAt: rawMessage.receivedAt,
    knowledgeProvider: args.knowledgeProvider
  });
  processingRepository.log({
    entityType: "message",
    entityId: rawMessage.id,
    eventType: "knowledge_retrieved",
    payload: {
      messageId: rawMessage.id,
      ...retrieval
    }
  });

  const policyDecision = applyPolicy({
    classification,
    retrieval,
    mailbox,
    automationProfile
  });
  processingRepository.savePolicyDecision(policyDecision);
  processingRepository.log({
    entityType: "message",
    entityId: rawMessage.id,
    eventType: "policy_applied",
    payload: {
      ...policyDecision,
      messageId: rawMessage.id,
      retrievalSummary: retrieval.summary,
      actingUserId: actingUser?.id ?? null,
      effectiveAutomationProfileId: automationProfile.id,
      effectiveToneProfileId: toneProfile.id
    }
  });

  let draft: DraftReply | null = null;
  if (policyDecision.action !== "blocked" && policyDecision.action !== "escalate") {
    draft = await generateDraft({
      messageId: rawMessage.id,
      request: {
        normalizedEmail,
        classification,
        retrieval,
        toneProfile,
        mailbox,
        automationProfile
      },
      modelProvider: args.modelProvider
    });
    messageRepository.saveDraft(draft);
    processingRepository.log({
      entityType: "draft",
      entityId: draft.id,
      eventType: "draft_generated",
      payload: draft
    });
  }

  if (policyDecision.action === "auto_send_allowed" && policyDecision.allowMockAutoSend && draft) {
    const outboxMessage = await args.sendProvider.sendMockReply({
      messageId: rawMessage.id,
      draft,
      recipientEmail: rawMessage.senderEmail,
      deliveryMode: "mock_auto_send"
    });

    messageRepository.updateDraft(draft.id, draft.body, "mock_sent");
    messageRepository.updateStatus(rawMessage.id, "auto_sent");
    processingRepository.log({
      entityType: "outbox",
      entityId: outboxMessage.id,
      eventType: "mock_auto_sent",
      payload: outboxMessage
    });
  } else {
    messageRepository.updateStatus(
      rawMessage.id,
      policyDecision.action === "draft_only"
        ? "draft_ready"
        : policyDecision.action === "escalate"
          ? "escalated"
          : "blocked"
    );
  }

  messageRepository.createOrUpdateThread({
    id: rawMessage.threadId,
    mailboxId: rawMessage.mailboxId,
    subject: rawMessage.subject,
    latestMessageId: rawMessage.id,
    currentIntent: classification.intent,
    status:
      policyDecision.action === "auto_send_allowed" && policyDecision.allowMockAutoSend
        ? "auto_sent"
        : policyDecision.action === "draft_only"
          ? "draft_ready"
          : policyDecision.action === "escalate"
            ? "escalated"
            : "blocked",
    createdAt: rawMessage.createdAt,
    updatedAt: new Date().toISOString()
  });

  return {
    messageId: rawMessage.id,
    actingUser,
    normalizedEmail,
    classification,
    retrieval,
    policyDecision,
    draft
  };
}
