import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { settingsRepository } from "../../db/src/index.js";
import { LocalKnowledgeProvider } from "../../providers/knowledge-local/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

describe("LocalKnowledgeProvider", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("retrieves the requested day business hours from structured local data", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }

    const result = await new LocalKnowledgeProvider().retrieveForIntent({
      intent: "business_hours_question",
      entities: {
        requestedDay: "tomorrow",
        requestedTimeWindow: undefined,
        requestedLocationHint: undefined,
        requestedDocumentTypes: [],
        bookingContext: undefined,
        hasMultipleQuestions: false,
        mentionsAttachment: false,
        sensitiveKeywords: [],
        matchedTopics: ["business_hours_question"]
      },
      mailbox,
      receivedAt: "2026-04-10T12:00:00.000Z"
    });

    expect(result.facts[0]?.value).toContain("Saturday");
    expect(result.facts[0]?.value).toContain("9:00 AM to 12:00 PM");
  });

  it("filters mailbox-specific booking documents", async () => {
    const ownerMailbox = settingsRepository.getMailboxByKey("owner");
    if (!ownerMailbox) {
      throw new Error("Expected seeded owner mailbox.");
    }

    const result = await new LocalKnowledgeProvider().retrieveForIntent({
      intent: "booking_question",
      entities: {
        requestedDay: undefined,
        requestedTimeWindow: undefined,
        requestedLocationHint: undefined,
        requestedDocumentTypes: [],
        bookingContext: "appointment",
        hasMultipleQuestions: false,
        mentionsAttachment: false,
        sensitiveKeywords: [],
        matchedTopics: ["booking_question"]
      },
      mailbox: ownerMailbox,
      receivedAt: "2026-04-10T12:00:00.000Z"
    });

    expect(result.facts.some((fact) => fact.value.includes("owner-demo.example"))).toBe(true);
    expect(result.documents.every((document) => document.mailboxKeys.length === 0 || document.mailboxKeys.includes("owner"))).toBe(true);
  });

  it("returns a clear closed-day message instead of awkward open phrasing", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }

    const result = await new LocalKnowledgeProvider().retrieveForIntent({
      intent: "business_hours_question",
      entities: {
        requestedDay: "tomorrow",
        requestedTimeWindow: undefined,
        requestedLocationHint: undefined,
        requestedDocumentTypes: [],
        bookingContext: undefined,
        hasMultipleQuestions: false,
        mentionsAttachment: false,
        sensitiveKeywords: [],
        matchedTopics: ["business_hours_question"]
      },
      mailbox,
      receivedAt: "2026-04-11T12:00:00.000Z"
    });

    expect(result.facts[0]?.value).toContain("closed on Sunday");
    expect(result.facts[0]?.value).not.toContain("open Sunday from closed");
  });
});
