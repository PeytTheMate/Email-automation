import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { settingsRepository } from "../../db/src/index.js";
import { generateDraft } from "../../core/src/index.js";
import { MockModelProvider } from "../../providers/model-local/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

describe("generateDraft", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("uses retrieved local facts instead of inventing business details", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }
    const automationProfile = settingsRepository.getAutomationProfile(
      mailbox.defaultAutomationProfileId
    );
    const toneProfile = settingsRepository.getToneProfile(mailbox.defaultToneProfileId);
    if (!automationProfile || !toneProfile) {
      throw new Error("Missing seeded config.");
    }

    const draft = await generateDraft({
      messageId: "message-1",
      modelProvider: new MockModelProvider(),
      request: {
        normalizedEmail: {
          messageId: "message-1",
          senderEmail: "jamie@example.com",
          senderName: "Jamie",
          recipients: ["frontdesk@example.local"],
          ccRecipients: [],
          subject: "Where are you located?",
          normalizedBodyText: "Can you send me your address?",
          strippedQuotedText: null,
          threadId: "thread-1",
          receivedAt: "2026-04-10T10:00:00.000Z",
          attachmentMetadata: [],
          language: "en",
          assumptions: []
        },
        classification: {
          id: "classification-1",
          messageId: "message-1",
          intent: "location_question",
          confidence: 0.99,
          secondaryIntents: [],
          extractedEntities: {
            requestedDay: undefined,
            requestedTimeWindow: undefined,
            requestedLocationHint: "directions",
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
          summary: "Retrieved address."
        },
        toneProfile,
        mailbox,
        automationProfile
      }
    });

    expect(draft.body).toContain("1450 West Orchard Avenue");
    expect(draft.body).not.toContain("parking garage");
    expect(draft.generationMetadata.grounded).toBe(true);
  });

  it("applies tone and automation constraints to the generated reply", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }
    const automationProfile = settingsRepository.getAutomationProfile(
      mailbox.defaultAutomationProfileId
    );
    const toneProfile = settingsRepository.getToneProfile(mailbox.defaultToneProfileId);
    if (!automationProfile || !toneProfile) {
      throw new Error("Missing seeded config.");
    }

    const draft = await generateDraft({
      messageId: "message-2",
      modelProvider: new MockModelProvider(),
      request: {
        normalizedEmail: {
          messageId: "message-2",
          senderEmail: "alex@example.com",
          senderName: "Alex",
          recipients: ["frontdesk@example.local"],
          ccRecipients: [],
          subject: "What time do you open tomorrow?",
          normalizedBodyText: "What time do you open tomorrow?",
          strippedQuotedText: null,
          threadId: "thread-2",
          receivedAt: "2026-04-10T10:00:00.000Z",
          attachmentMetadata: [],
          language: "en",
          assumptions: []
        },
        classification: {
          id: "classification-2",
          messageId: "message-2",
          intent: "business_hours_question",
          confidence: 0.98,
          secondaryIntents: [],
          extractedEntities: {
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
          riskFlags: [],
          reasoningSummary: "",
          providerUsed: "deterministic-rules",
          createdAt: new Date().toISOString()
        },
        retrieval: {
          facts: [
            {
              key: "hours",
              title: "Tomorrow hours",
              value: "Tomorrow, Saturday, we are open from 9:00 AM to 12:00 PM.",
              documentId: "doc-business-hours"
            }
          ],
          documents: [],
          summary: "Retrieved hours."
        },
        toneProfile: {
          ...toneProfile,
          forbiddenPhrases: ["Please let us know if there is anything else we can help with."]
        },
        mailbox,
        automationProfile: {
          ...automationProfile,
          maxReplySentences: 3
        }
      }
    });

    expect(draft.body).not.toContain("Please let us know if there is anything else we can help with.");
  });
});
