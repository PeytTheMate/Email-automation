import type { EmailProvider } from "../../../core/src/contracts.js";

export class LocalEmailProvider implements EmailProvider {
  providerName = "local-email-sandbox";

  async listMessages() {
    return {
      providerName: this.providerName,
      nextSyncCursor: null,
      messages: []
    };
  }
}
