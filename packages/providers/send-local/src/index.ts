import { messageRepository } from "../../../db/src/index.js";
import type { DeliveryRequest, SendProvider } from "../../../core/src/contracts.js";

export class LocalSendProvider implements SendProvider {
  providerName = "local-outbox";

  async createDraft(request: DeliveryRequest) {
    return messageRepository.createOutboxMessage({
      messageId: request.messageId,
      draftId: request.draft.id,
      recipientEmail: request.recipientEmail,
      subject: request.draft.subject,
      body: request.draft.body,
      providerName: this.providerName,
      externalDraftId: null,
      externalMessageId: null,
      deliveryStatus: "draft_created",
      failureReason: null,
      operatorUserId: request.operatorUserId ?? null,
      sentAt: new Date().toISOString(),
      deliveryMode: "draft"
    });
  }

  async sendReply(request: DeliveryRequest) {
    return messageRepository.createOutboxMessage({
      messageId: request.messageId,
      draftId: request.draft.id,
      recipientEmail: request.recipientEmail,
      subject: request.draft.subject,
      body: request.draft.body,
      providerName: this.providerName,
      externalDraftId: null,
      externalMessageId: null,
      deliveryStatus: "sent",
      failureReason: null,
      operatorUserId: request.operatorUserId ?? null,
      sentAt: new Date().toISOString(),
      deliveryMode: request.deliveryMode
    });
  }
}
