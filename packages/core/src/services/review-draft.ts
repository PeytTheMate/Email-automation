import {
  messageRepository,
  processingRepository
} from "../../../db/src/index.js";
import type { SendProvider } from "../contracts.js";

export async function approveDraftAndSend(args: {
  draftId: string;
  editedBody?: string;
  sendProvider: SendProvider;
}) {
  const draft = messageRepository.getDraft(args.draftId);
  if (!draft) {
    throw new Error(`Draft ${args.draftId} was not found.`);
  }

  const message = messageRepository.get(draft.messageId);
  if (!message) {
    throw new Error(`Message ${draft.messageId} was not found.`);
  }

  const body = args.editedBody?.trim() ? args.editedBody.trim() : draft.body;
  const nextStatus = args.editedBody?.trim() ? "edited" : "approved";
  messageRepository.updateDraft(draft.id, body, nextStatus);

  const outboxMessage = await args.sendProvider.sendMockReply({
    messageId: message.id,
    draft: {
      ...draft,
      body,
      status: nextStatus
    },
    recipientEmail: message.senderEmail,
    deliveryMode: "mock_send"
  });

  messageRepository.updateDraft(draft.id, body, "mock_sent");
  messageRepository.updateStatus(message.id, "sent");
  processingRepository.log({
    entityType: "outbox",
    entityId: outboxMessage.id,
    eventType: "mock_sent_after_review",
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
