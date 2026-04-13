import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  messageRepository,
  processingRepository,
  settingsRepository
} from "../../db/src/index.js";
import {
  approveDraftAndSend,
  ingestEmail,
  processPendingJobs
} from "../../core/src/index.js";
import { LocalKnowledgeProvider } from "../../providers/knowledge-local/src/index.js";
import { MockModelProvider } from "../../providers/model-local/src/index.js";
import { LocalSendProvider } from "../../providers/send-local/src/index.js";
import { cleanupTestDatabase, prepareTestDatabase } from "./test-helpers.js";

describe("local pipeline integration", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("processes a safe scenario end to end and creates a grounded draft", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    const scenario = settingsRepository.getScenarioByKey("open-tomorrow");
    if (!mailbox || !scenario) {
      throw new Error("Expected seeded mailbox and scenario.");
    }

    const { message } = await ingestEmail({
      mailboxId: mailbox.id,
      sourceType: "seeded_scenario",
      scenarioId: scenario.id,
      senderEmail: scenario.senderEmail,
      senderName: scenario.senderName,
      recipients: [mailbox.emailAddress ?? "frontdesk@example.local"],
      subject: scenario.subject,
      rawBody: scenario.body,
      receivedAt: scenario.replayReceivedAt ?? undefined
    });

    await processPendingJobs({
      modelProvider: new MockModelProvider(),
      knowledgeProvider: new LocalKnowledgeProvider(),
      sendProvider: new LocalSendProvider()
    });

    const detail = messageRepository.getMessageWithRelations(message.id);
    expect(detail?.message.status).toBe("draft_ready");
    expect(detail?.policyDecision?.action).toBe("draft_only");
    expect(detail?.draft?.body).toContain("Tomorrow");
  });

  it("replays a high-confidence safe FAQ into the local outbox", async () => {
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

    await processPendingJobs({
      modelProvider: new MockModelProvider(),
      knowledgeProvider: new LocalKnowledgeProvider(),
      sendProvider: new LocalSendProvider()
    });

    const outbox = messageRepository.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.recipientEmail).toBe("jamie@example.com");
    expect(outbox[0]?.deliveryMode).toBe("mock_auto_send");
  });

  it("applies owner override settings instead of mailbox defaults", async () => {
    const ownerMailbox = settingsRepository.getMailboxByKey("owner");
    const ownerUser = settingsRepository.listUsersByMailbox("mailbox-owner")[0];
    const scenario = settingsRepository.getScenarioByKey("where-are-you-located");
    if (!ownerMailbox || !ownerUser || !scenario) {
      throw new Error("Expected seeded owner mailbox, user, and scenario.");
    }

    const { message } = await ingestEmail({
      mailboxId: ownerMailbox.id,
      actorUserId: ownerUser.id,
      sourceType: "manual_paste",
      senderEmail: scenario.senderEmail,
      senderName: scenario.senderName,
      recipients: [ownerMailbox.emailAddress ?? "owner@example.local"],
      subject: scenario.subject,
      rawBody: scenario.body
    });

    await processPendingJobs({
      modelProvider: new MockModelProvider(),
      knowledgeProvider: new LocalKnowledgeProvider(),
      sendProvider: new LocalSendProvider()
    });

    const detail = messageRepository.getMessageWithRelations(message.id);
    expect(detail?.message.status).toBe("draft_ready");
    expect(detail?.policyDecision?.action).toBe("draft_only");
    expect(detail?.draft?.toneProfileId).toBe("tone-concise-professional");
  });

  it("keeps the full audit timeline after a reviewed send", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    const scenario = settingsRepository.getScenarioByKey("open-tomorrow");
    if (!mailbox || !scenario) {
      throw new Error("Expected seeded mailbox and scenario.");
    }

    const { message } = await ingestEmail({
      mailboxId: mailbox.id,
      sourceType: "seeded_scenario",
      scenarioId: scenario.id,
      senderEmail: scenario.senderEmail,
      senderName: scenario.senderName,
      recipients: [mailbox.emailAddress ?? "frontdesk@example.local"],
      subject: scenario.subject,
      rawBody: scenario.body,
      receivedAt: scenario.replayReceivedAt ?? undefined
    });

    await processPendingJobs({
      modelProvider: new MockModelProvider(),
      knowledgeProvider: new LocalKnowledgeProvider(),
      sendProvider: new LocalSendProvider()
    });

    const draft = messageRepository.getDraftByMessage(message.id);
    if (!draft) {
      throw new Error("Expected a draft for the review flow.");
    }

    await approveDraftAndSend({
      draftId: draft.id,
      sendProvider: new LocalSendProvider()
    });

    const audit = processingRepository.listAuditForMessage(message.id);
    expect(audit.some((event) => event.eventType === "draft_generated")).toBe(true);
    expect(audit.some((event) => event.eventType === "mock_sent_after_review")).toBe(true);
  });

  it("deduplicates identical manual paste submissions", async () => {
    const mailbox = settingsRepository.getMailboxByKey("frontdesk");
    if (!mailbox) {
      throw new Error("Expected seeded frontdesk mailbox.");
    }

    const first = await ingestEmail({
      mailboxId: mailbox.id,
      sourceType: "manual_paste",
      senderEmail: "guest@example.com",
      senderName: "Guest",
      recipients: [mailbox.emailAddress ?? "frontdesk@example.local"],
      subject: "Parking",
      rawBody: "Where should I park?"
    });

    const second = await ingestEmail({
      mailboxId: mailbox.id,
      sourceType: "manual_paste",
      senderEmail: "guest@example.com",
      senderName: "Guest",
      recipients: [mailbox.emailAddress ?? "frontdesk@example.local"],
      subject: "Parking",
      rawBody: "Where should I park?"
    });

    expect(second.message.id).toBe(first.message.id);
    expect(messageRepository.list().length).toBe(1);
  });
});
