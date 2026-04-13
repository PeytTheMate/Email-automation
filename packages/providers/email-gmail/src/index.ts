import type { EmailProvider } from "../../../core/src/contracts.js";

export class GmailEmailProvider implements EmailProvider {
  providerName = "gmail-future";

  async listMessages(): Promise<unknown[]> {
    throw new Error("Gmail integration is scaffolded but disabled in local v1.");
  }

  async getMessage(): Promise<unknown> {
    throw new Error("Gmail integration is scaffolded but disabled in local v1.");
  }

  async createDraft(): Promise<never> {
    throw new Error("Gmail draft support is a phase 2 integration.");
  }

  async sendReply(): Promise<never> {
    throw new Error("Gmail send support is a phase 2 integration.");
  }

  async acknowledgeEvent(): Promise<void> {
    throw new Error("Gmail event acknowledgement is a phase 2 integration.");
  }
}
