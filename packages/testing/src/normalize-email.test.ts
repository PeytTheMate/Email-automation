import { describe, expect, it } from "vitest";

import { normalizeEmail } from "../../core/src/index.js";

describe("normalizeEmail", () => {
  it("strips common quoted reply blocks conservatively", () => {
    const normalized = normalizeEmail({
      messageId: "message-quoted",
      senderEmail: "Guest@Example.com",
      senderName: "Guest",
      recipients: ["FrontDesk@Example.local"],
      ccRecipients: [],
      subject: " Re: Parking  ",
      rawBody:
        "Where should I park?\n\nOn Monday Taylor wrote:\n> Please use the visitor lot.\n> Thank you.",
      threadId: "thread-quoted",
      receivedAt: "2026-04-10T09:00:00.000Z"
    });

    expect(normalized.senderEmail).toBe("guest@example.com");
    expect(normalized.recipients).toEqual(["frontdesk@example.local"]);
    expect(normalized.subject).toBe("Re: Parking");
    expect(normalized.normalizedBodyText).toBe("Where should I park?");
    expect(normalized.strippedQuotedText).toContain("On Monday Taylor wrote:");
  });

  it("keeps minimal plain text untouched and documents conservative assumptions", () => {
    const normalized = normalizeEmail({
      messageId: "message-minimal",
      senderEmail: "alex@example.com",
      senderName: "Alex",
      recipients: ["frontdesk@example.local"],
      ccRecipients: [],
      subject: "Hours",
      rawBody: "Open today?",
      threadId: "thread-minimal",
      receivedAt: "2026-04-10T09:00:00.000Z"
    });

    expect(normalized.normalizedBodyText).toBe("Open today?");
    expect(normalized.attachmentMetadata).toEqual([]);
    expect(normalized.assumptions.length).toBeGreaterThan(0);
  });
});
