import type { EmailProvider } from "../../../core/src/contracts.js";

export class LocalEmailProvider implements EmailProvider {
  providerName = "local-email-sandbox";

  async listMessages() {
    return [];
  }

  async getMessage(_messageId: string) {
    return {};
  }

  async createDraft(): Promise<never> {
    throw new Error("LocalEmailProvider does not create transport-level drafts. Use the draft repository instead.");
  }

  async sendReply(): Promise<never> {
    throw new Error("LocalEmailProvider does not send real email in sandbox mode.");
  }

  async acknowledgeEvent(_eventId: string) {
    return;
  }
}
