import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetConfigCache } from "../../config/src/index.js";
import { settingsRepository } from "../../db/src/index.js";
import { GmailEmailProvider } from "../../providers/email-gmail/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

describe("gmail provider", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.ENABLE_GMAIL_READ = "true";
    process.env.GMAIL_CLIENT_ID = "client-id";
    process.env.GMAIL_CLIENT_SECRET = "client-secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh-token";
    process.env.GMAIL_DEMO_LABEL = "codex-demo";
    process.env.GMAIL_ALLOWLIST_SENDERS = "@example.com";
    resetConfigCache();
    await prepareTestDatabase();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await cleanupTestDatabase();
  });

  it("maps Gmail messages into inbound sync records and filters by sender allowlist", async () => {
    const mailbox = settingsRepository.getMailboxByKey("gmail-demo");
    if (!mailbox) {
      throw new Error("Expected seeded Gmail demo mailbox.");
    }

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [{ id: "allowed" }, { id: "blocked" }], historyId: "456" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "allowed",
            threadId: "thread-1",
            historyId: "123",
            internalDate: String(Date.parse("2026-04-12T10:00:00.000Z")),
            payload: {
              headers: [
                { name: "From", value: "Allowed Sender <allowed@example.com>" },
                { name: "To", value: "demo-inbox@example.com" },
                { name: "Subject", value: "Where are you located?" }
              ],
              mimeType: "text/plain",
              body: {
                data: Buffer.from("Where are you located?", "utf8").toString("base64url")
              }
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "blocked",
            threadId: "thread-2",
            historyId: "124",
            internalDate: String(Date.parse("2026-04-12T10:02:00.000Z")),
            payload: {
              headers: [
                { name: "From", value: "Blocked Sender <blocked@not-allowed.test>" },
                { name: "To", value: "demo-inbox@example.com" },
                { name: "Subject", value: "Ignore this" }
              ],
              mimeType: "text/plain",
              body: {
                data: Buffer.from("This should be skipped.", "utf8").toString("base64url")
              }
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );

    const provider = new GmailEmailProvider();
    const result = await provider.listMessages({ mailbox, limit: 10, syncCursor: null });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.nextSyncCursor).toBe("456");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({
      providerName: "gmail",
      externalMessageId: "allowed",
      externalThreadId: "thread-1",
      senderEmail: "allowed@example.com",
      subject: "Where are you located?"
    });
  });
});
