import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { normalizeEmail, classifyIntent } from "../../core/src/index.js";
import { MockModelProvider } from "../../providers/model-local/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

describe("classifyIntent", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("classifies clear business-hours questions", async () => {
    const normalized = normalizeEmail({
      messageId: "message-1",
      senderEmail: "alex@example.com",
      senderName: "Alex",
      recipients: ["frontdesk@example.local"],
      ccRecipients: [],
      subject: "What time do you open tomorrow?",
      rawBody: "Hi, what time do you open tomorrow?",
      threadId: "thread-1",
      receivedAt: "2026-04-10T09:00:00.000Z"
    });

    const result = await classifyIntent({
      messageId: "message-1",
      normalizedEmail: normalized,
      modelProvider: new MockModelProvider()
    });

    expect(result.intent).toBe("business_hours_question");
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.riskFlags).not.toContain("low_confidence");
  });

  it("flags multiple asks when more than one safe intent is present", async () => {
    const normalized = normalizeEmail({
      messageId: "message-2",
      senderEmail: "devon@example.com",
      senderName: "Devon",
      recipients: ["frontdesk@example.local"],
      ccRecipients: [],
      subject: "Location and parking",
      rawBody: "Where are you located and where should I park when I get there?",
      threadId: "thread-2",
      receivedAt: "2026-04-10T09:00:00.000Z"
    });

    const result = await classifyIntent({
      messageId: "message-2",
      normalizedEmail: normalized,
      modelProvider: new MockModelProvider()
    });

    expect(result.intent).toBe("location_question");
    expect(result.secondaryIntents).toContain("parking_question");
    expect(result.riskFlags).toContain("multiple_asks");
  });

  it("prefers required documents over booking when the email is about what to bring", async () => {
    const normalized = normalizeEmail({
      messageId: "message-3",
      senderEmail: "casey@example.com",
      senderName: "Casey",
      recipients: ["frontdesk@example.local"],
      ccRecipients: [],
      subject: "What documents do I need?",
      rawBody: "What do I need to bring for my appointment?",
      threadId: "thread-3",
      receivedAt: "2026-04-10T09:00:00.000Z"
    });

    const result = await classifyIntent({
      messageId: "message-3",
      normalizedEmail: normalized,
      modelProvider: new MockModelProvider()
    });

    expect(result.intent).toBe("required_documents_question");
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
