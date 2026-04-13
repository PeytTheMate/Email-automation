import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { settingsRepository } from "../../db/src/index.js";
import {
  buildScenarioRunResults,
  runDemoPack
} from "../../core/src/index.js";
import { LocalKnowledgeProvider } from "../../providers/knowledge-local/src/index.js";
import { MockModelProvider } from "../../providers/model-local/src/index.js";
import { LocalSendProvider } from "../../providers/send-local/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

describe("scenario replay services", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("builds pass/fail results after running the demo pack", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }

    await runDemoPack({
      mailboxId: mailbox.id,
      modelProvider: new MockModelProvider(),
      knowledgeProvider: new LocalKnowledgeProvider(),
      sendProvider: new LocalSendProvider()
    });

    const results = buildScenarioRunResults();
    const demoReadyResults = results.filter((result) => result.demoReady);
    const safeLocation = results.find((result) => result.scenarioKey === "where-are-you-located");
    const openTomorrow = results.find((result) => result.scenarioKey === "open-tomorrow");
    const refund = results.find((result) => result.scenarioKey === "need-a-refund");

    expect(demoReadyResults.every((result) => result.isPassing)).toBe(true);
    expect(safeLocation?.latestMessageId).toBeTruthy();
    expect(safeLocation?.actualIntent).toBe("location_question");
    expect(safeLocation?.actualDecision).toBe("auto_send_allowed");
    expect(safeLocation?.matchesReplyContent).toBe(true);
    expect(openTomorrow?.replyPreview).toContain("Tomorrow");
    expect(openTomorrow?.failureReasons).toEqual([]);
    expect(refund?.actualDecision).toBe("escalate");
  });
});
