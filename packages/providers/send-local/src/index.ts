import { messageRepository } from "../../../db/src/index.js";
import type { MockSendRequest, SendProvider } from "../../../core/src/contracts.js";

export class LocalSendProvider implements SendProvider {
  providerName = "local-outbox";

  async sendMockReply(request: MockSendRequest) {
    return messageRepository.createOutboxMessage({
      messageId: request.messageId,
      draftId: request.draft.id,
      recipientEmail: request.recipientEmail,
      subject: request.draft.subject,
      body: request.draft.body,
      sentAt: new Date().toISOString(),
      deliveryMode: request.deliveryMode
    });
  }
}
