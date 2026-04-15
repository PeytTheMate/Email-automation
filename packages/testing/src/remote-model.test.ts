import { afterEach, describe, expect, it, vi } from "vitest";

import { resetConfigCache } from "../../config/src/index.js";
import { RemoteModelProvider } from "../../providers/model-remote/src/index.js";

describe("remote model provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetConfigCache();
  });

  it("rejects generated replies that introduce unsupported URLs", async () => {
    process.env.ENABLE_REMOTE_MODELS = "true";
    process.env.REMOTE_MODEL_API_KEY = "test-key";
    process.env.REMOTE_MODEL_PROVIDER = "openai";
    process.env.REMOTE_MODEL_NAME = "gpt-5-mini";
    resetConfigCache();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            subject: "Re: Parking",
            body: "Hello,\n\nPlease park here: https://invented.example.com\n\nThanks."
          })
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const provider = new RemoteModelProvider();

    await expect(
      provider.generateReply({
        normalizedEmail: {
          messageId: "message-1",
          senderEmail: "guest@example.com",
          senderName: "Guest",
          recipients: ["demo@example.com"],
          ccRecipients: [],
          subject: "Parking",
          normalizedBodyText: "Where should I park?",
          strippedQuotedText: null,
          threadId: "thread-1",
          receivedAt: "2026-04-12T10:00:00.000Z",
          attachmentMetadata: [],
          language: "en",
          assumptions: []
        },
        classification: {
          id: "classification-1",
          messageId: "message-1",
          intent: "parking_question",
          confidence: 0.99,
          secondaryIntents: [],
          extractedEntities: {
            requestedDocumentTypes: [],
            hasMultipleQuestions: false,
            mentionsAttachment: false,
            sensitiveKeywords: [],
            matchedTopics: ["parking_question"]
          },
          riskFlags: [],
          reasoningSummary: "Matched parking language.",
          providerUsed: "deterministic-rules",
          createdAt: "2026-04-12T10:00:00.000Z"
        },
        retrieval: {
          facts: [
            {
              key: "parking-notes",
              title: "Parking instructions",
              value: "Guest parking is available in the front lot.",
              documentId: "doc-parking-notes"
            }
          ],
          documents: [],
          summary: "Retrieved 1 trusted fact."
        },
        toneProfile: {
          id: "tone-1",
          key: "warm",
          name: "Warm",
          description: "Warm and friendly",
          greetingStyle: "warm",
          closingStyle: "warm",
          styleRules: {},
          approvedClosings: ["Thanks,"],
          forbiddenPhrases: [],
          signatureTemplate: "Team",
          createdAt: "2026-04-12T10:00:00.000Z",
          updatedAt: "2026-04-12T10:00:00.000Z"
        },
        mailbox: {
          id: "mailbox-gmail-demo",
          key: "gmail-demo",
          displayName: "Gmail Demo",
          emailAddress: null,
          providerMode: "gmail_test",
          connectionMode: "gmail_test",
          gmailMailboxAddress: "demo@example.com",
          gmailLabelFilter: "codex-demo",
          allowedSenderPatterns: [],
          allowedOutboundRecipientPatterns: [],
          enableLiveRead: true,
          enableLiveDrafts: true,
          enableLiveSend: true,
          defaultModelProvider: "remote",
          gmailHistoryId: null,
          defaultToneProfileId: "tone-1",
          defaultAutomationProfileId: "auto-1",
          escalationTarget: "owner@example.com",
          allowMockAutoSend: false,
          enabledIntents: ["parking_question"],
          createdAt: "2026-04-12T10:00:00.000Z",
          updatedAt: "2026-04-12T10:00:00.000Z"
        },
        automationProfile: {
          id: "auto-1",
          key: "review-only",
          name: "Review only",
          description: "No live auto-send.",
          approvalMode: "draft_only",
          allowedAutoSendIntents: [],
          blockedIntents: [],
          confidenceThresholdDraft: 0.8,
          confidenceThresholdAutoSend: 0.99,
          featureFlags: {},
          maxReplySentences: 4,
          createdAt: "2026-04-12T10:00:00.000Z",
          updatedAt: "2026-04-12T10:00:00.000Z"
        }
      })
    ).rejects.toThrow("unsupported URL");
  });

  it("parses Gemini generateContent responses for classification", async () => {
    process.env.ENABLE_REMOTE_MODELS = "true";
    process.env.REMOTE_MODEL_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.REMOTE_MODEL_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    process.env.REMOTE_MODEL_NAME = "gemini-2.5-flash";
    resetConfigCache();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      intent: "parking_question",
                      confidence: 0.91,
                      reasoningSummary: "Matched parking instructions language.",
                      secondaryIntents: [],
                      riskFlags: []
                    })
                  }
                ]
              }
            }
          ]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const provider = new RemoteModelProvider();
    const result = await provider.classifyIntent({
      normalizedEmail: {
        messageId: "message-1",
        senderEmail: "guest@example.com",
        senderName: "Guest",
        recipients: ["demo@example.com"],
        ccRecipients: [],
        subject: "Parking question",
        normalizedBodyText: "Where should I park when I arrive?",
        strippedQuotedText: null,
        threadId: "thread-1",
        receivedAt: "2026-04-12T10:00:00.000Z",
        attachmentMetadata: [],
        language: "en",
        assumptions: []
      }
    });

    expect(result).toMatchObject({
      intent: "parking_question",
      confidence: 0.91,
      providerUsed: "remote-gemini-generate-content"
    });
  });
});
