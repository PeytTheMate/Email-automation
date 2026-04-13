import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { settingsRepository } from "../../db/src/index.js";
import { applyPolicy } from "../../core/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

describe("applyPolicy", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("allows mock auto-send for high-confidence safe FAQs", () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }
    const automationProfile = settingsRepository.getAutomationProfile(
      mailbox.defaultAutomationProfileId
    );
    if (!automationProfile) {
      throw new Error("Expected seeded automation profile.");
    }

    const decision = applyPolicy({
      mailbox,
      automationProfile,
      classification: {
        id: "classification-1",
        messageId: "message-1",
        intent: "location_question",
        confidence: 0.99,
        secondaryIntents: [],
        extractedEntities: {
          requestedDay: undefined,
          requestedTimeWindow: undefined,
          requestedLocationHint: undefined,
          requestedDocumentTypes: [],
          bookingContext: undefined,
          hasMultipleQuestions: false,
          mentionsAttachment: false,
          sensitiveKeywords: [],
          matchedTopics: ["location_question"]
        },
        riskFlags: [],
        reasoningSummary: "",
        providerUsed: "deterministic-rules",
        createdAt: new Date().toISOString()
      },
      retrieval: {
        facts: [
          {
            key: "business-address",
            title: "Business address",
            value: "1450 West Orchard Avenue, Suite 220, Springfield, IL 62704",
            documentId: "doc-business-location"
          }
        ],
        documents: [],
        summary: "Retrieved 1 trusted fact."
      }
    });

    expect(decision.action).toBe("auto_send_allowed");
    expect(decision.allowMockAutoSend).toBe(true);
  });

  it("escalates billing questions even when classification is confident", () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }
    const automationProfile = settingsRepository.getAutomationProfile(
      mailbox.defaultAutomationProfileId
    );
    if (!automationProfile) {
      throw new Error("Expected seeded automation profile.");
    }

    const decision = applyPolicy({
      mailbox,
      automationProfile,
      classification: {
        id: "classification-2",
        messageId: "message-2",
        intent: "billing_question",
        confidence: 0.99,
        secondaryIntents: [],
        extractedEntities: {
          requestedDay: undefined,
          requestedTimeWindow: undefined,
          requestedLocationHint: undefined,
          requestedDocumentTypes: [],
          bookingContext: undefined,
          hasMultipleQuestions: false,
          mentionsAttachment: false,
          sensitiveKeywords: [],
          matchedTopics: ["billing_question"]
        },
        riskFlags: ["billing_language"],
        reasoningSummary: "",
        providerUsed: "deterministic-rules",
        createdAt: new Date().toISOString()
      },
      retrieval: {
        facts: [],
        documents: [],
        summary: "No trusted facts."
      }
    });

    expect(decision.action).toBe("escalate");
  });

  it("respects mailbox enabled intents before allowing automation", () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }
    const automationProfile = settingsRepository.getAutomationProfile(
      mailbox.defaultAutomationProfileId
    );
    if (!automationProfile) {
      throw new Error("Expected seeded automation profile.");
    }

    const decision = applyPolicy({
      mailbox: {
        ...mailbox,
        enabledIntents: ["booking_question"]
      },
      automationProfile,
      classification: {
        id: "classification-3",
        messageId: "message-3",
        intent: "location_question",
        confidence: 0.99,
        secondaryIntents: [],
        extractedEntities: {
          requestedDay: undefined,
          requestedTimeWindow: undefined,
          requestedLocationHint: undefined,
          requestedDocumentTypes: [],
          bookingContext: undefined,
          hasMultipleQuestions: false,
          mentionsAttachment: false,
          sensitiveKeywords: [],
          matchedTopics: ["location_question"]
        },
        riskFlags: [],
        reasoningSummary: "",
        providerUsed: "deterministic-rules",
        createdAt: new Date().toISOString()
      },
      retrieval: {
        facts: [
          {
            key: "business-address",
            title: "Business address",
            value: "1450 West Orchard Avenue, Suite 220, Springfield, IL 62704",
            documentId: "doc-business-location"
          }
        ],
        documents: [],
        summary: "Retrieved 1 trusted fact."
      }
    });

    expect(decision.action).toBe("escalate");
    expect(decision.escalationTarget).toBe(mailbox.escalationTarget);
  });
});
