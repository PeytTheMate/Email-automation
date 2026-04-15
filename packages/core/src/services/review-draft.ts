import {
  messageRepository,
  processingRepository,
  settingsRepository
} from "../../../db/src/index.js";
import type { ProviderRegistry, SendProvider } from "../contracts.js";

function resolveSendProvider(args: {
  draftId: string;
  sendProvider?: SendProvider;
  providerRegistry?: ProviderRegistry;
}) {
  if (args.sendProvider) {
    return args.sendProvider;
  }

  const draft = messageRepository.getDraft(args.draftId);
  if (!draft) {
    throw new Error(`Draft ${args.draftId} was not found.`);
  }

  const message = messageRepository.get(draft.messageId);
  if (!message) {
    throw new Error(`Message ${draft.messageId} was not found.`);
  }

  const mailbox = settingsRepository.getMailbox(message.mailboxId);
  if (!mailbox || !args.providerRegistry) {
    throw new Error("Provider registry is required for runtime send resolution.");
  }

  return args.providerRegistry.getSendProvider(mailbox);
}

export async function approveDraftAndSend(args: {
  draftId: string;
  editedBody?: string;
  operatorUserId?: string | null;
  sendProvider?: SendProvider;
  providerRegistry?: ProviderRegistry;
}) {
  const draft = messageRepository.getDraft(args.draftId);
  if (!draft) {
    throw new Error(`Draft ${args.draftId} was not found.`);
  }

  const message = messageRepository.get(draft.messageId);
  if (!message) {
    throw new Error(`Message ${draft.messageId} was not found.`);
  }

  const mailbox = settingsRepository.getMailbox(message.mailboxId);
  if (!mailbox) {
    throw new Error(`Mailbox ${message.mailboxId} was not found.`);
  }

  const sendProvider = resolveSendProvider(args);

  const body = args.editedBody?.trim() ? args.editedBody.trim() : draft.body;
  const nextStatus = args.editedBody?.trim() ? "edited" : "approved";
  messageRepository.updateDraft(draft.id, body, nextStatus);

  const deliveryMode =
    mailbox.connectionMode === "gmail_test" ? "send_after_approval" : "mock_send";

  const outboxMessage = await sendProvider.sendReply({
    messageId: message.id,
    mailbox,
    draft: {
      ...draft,
      body,
      status: nextStatus
    },
    recipientEmail: message.senderEmail,
    operatorUserId: args.operatorUserId ?? message.actorUserId ?? null,
    externalThreadId: message.externalThreadId,
    externalMessageId: message.externalMessageId,
    deliveryMode
  });

  messageRepository.updateDraft(draft.id, body, "mock_sent", {
    providerName: outboxMessage.providerName,
    externalDraftId: outboxMessage.externalDraftId,
    externalMessageId: outboxMessage.externalMessageId
  });
  messageRepository.updateStatus(message.id, "sent");
  processingRepository.log({
    entityType: "outbox",
    entityId: outboxMessage.id,
    eventType:
      deliveryMode === "send_after_approval" ? "live_sent_after_review" : "mock_sent_after_review",
    payload: outboxMessage
  });

  return outboxMessage;
}

export async function createDraftInProvider(args: {
  draftId: string;
  operatorUserId?: string | null;
  sendProvider?: SendProvider;
  providerRegistry?: ProviderRegistry;
}) {
  const draft = messageRepository.getDraft(args.draftId);
  if (!draft) {
    throw new Error(`Draft ${args.draftId} was not found.`);
  }

  const message = messageRepository.get(draft.messageId);
  if (!message) {
    throw new Error(`Message ${draft.messageId} was not found.`);
  }

  const mailbox = settingsRepository.getMailbox(message.mailboxId);
  if (!mailbox) {
    throw new Error(`Mailbox ${message.mailboxId} was not found.`);
  }

  const sendProvider = resolveSendProvider(args);
  const outboxMessage = await sendProvider.createDraft({
    messageId: message.id,
    mailbox,
    draft,
    recipientEmail: message.senderEmail,
    operatorUserId: args.operatorUserId ?? message.actorUserId ?? null,
    externalThreadId: message.externalThreadId,
    externalMessageId: message.externalMessageId,
    deliveryMode: "draft"
  });

  messageRepository.updateStatus(message.id, "draft_created");
  processingRepository.log({
    entityType: "outbox",
    entityId: outboxMessage.id,
    eventType: "provider_draft_created",
    payload: outboxMessage
  });

  return outboxMessage;
}

export function rejectDraft(draftId: string, reason: string) {
  const draft = messageRepository.getDraft(draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} was not found.`);
  }

  messageRepository.updateDraft(draft.id, draft.body, "rejected");
  messageRepository.updateStatus(draft.messageId, "escalated");
  processingRepository.log({
    entityType: "draft",
    entityId: draft.id,
    eventType: "draft_rejected",
    payload: {
      messageId: draft.messageId,
      draftId: draft.id,
      reason
    }
  });
}
