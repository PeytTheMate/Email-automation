import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { messageRepository, processingRepository, settingsRepository } from "../../db/src/index.js";
import {
  ingestEmail,
  processPendingJobs
} from "../../core/src/index.js";
import type { ClassificationRequest, ClassificationResult, GenerationRequest, GenerationResult, ModelProvider } from "../../core/src/contracts.js";
import { LocalKnowledgeProvider } from "../../providers/knowledge-local/src/index.js";
import { LocalSendProvider } from "../../providers/send-local/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

class FlakyModelProvider implements ModelProvider {
  providerName = "flaky-test-provider";
  attempts = 0;

  async classifyIntent(_request: ClassificationRequest): Promise<ClassificationResult | null> {
    return null;
  }

  async generateReply(request: GenerationRequest): Promise<GenerationResult> {
    this.attempts += 1;
    if (this.attempts === 1) {
      throw new Error("Synthetic first-attempt failure");
    }

    return {
      subject: `Re: ${request.normalizedEmail.subject}`,
      body: "Hello,\n\nRecovered on retry.\n\nFront Desk Team",
      confidenceNote: "Recovered after retry.",
      generationMetadata: {
        provider: this.providerName,
        mode: "template",
        grounded: true
      }
    };
  }
}

describe("processing retries", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("requeues transient failures and succeeds on the next worker pass", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    const scenario = settingsRepository.getScenarioByKey("where-are-you-located");
    if (!mailbox || !scenario) {
      throw new Error("Expected seeded mailbox and scenario.");
    }

    await ingestEmail({
      mailboxId: mailbox.id,
      sourceType: "seeded_scenario",
      scenarioId: scenario.id,
      senderEmail: scenario.senderEmail,
      senderName: scenario.senderName,
      recipients: [mailbox.emailAddress ?? "frontdesk@example.local"],
      subject: scenario.subject,
      rawBody: scenario.body
    });

    const modelProvider = new FlakyModelProvider();
    await processPendingJobs({
      modelProvider,
      knowledgeProvider: new LocalKnowledgeProvider(),
      sendProvider: new LocalSendProvider()
    });

    expect(processingRepository.listAll()[0]?.status).toBe("queued");
    expect(messageRepository.list()[0]?.status).toBe("new");

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await processPendingJobs({
      modelProvider,
      knowledgeProvider: new LocalKnowledgeProvider(),
      sendProvider: new LocalSendProvider()
    });

    expect(processingRepository.listAll()[0]?.status).toBe("completed");
    expect(messageRepository.listOutbox()).toHaveLength(1);
  });
});
