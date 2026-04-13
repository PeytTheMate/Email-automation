import { describe, expect, it } from "vitest";

import { applyDashboardState, resolveSelectedMessageId } from "./dashboard-state.js";
import type { DashboardData } from "../types.js";

const dashboard = {
  summary: {
    inboxTotal: 2,
    draftsReady: 1,
    escalated: 0,
    blocked: 0,
    sent: 0,
    autoSent: 1,
    outboxTotal: 1
  },
  queue: {
    queued: 0,
    processing: 0,
    failed: 0,
    completed: 2
  },
  inbox: [
    {
      id: "message-1",
      mailboxId: "mailbox-1",
      senderEmail: "alex@example.com",
      senderName: "Alex",
      subject: "Question one",
      receivedAt: "2026-04-11T12:00:00.000Z",
      status: "draft_ready",
      policyDecision: { action: "draft_only" },
      draft: { id: "draft-1", status: "ready" }
    },
    {
      id: "message-2",
      mailboxId: "mailbox-1",
      senderEmail: "jamie@example.com",
      senderName: "Jamie",
      subject: "Question two",
      receivedAt: "2026-04-11T12:05:00.000Z",
      status: "auto_sent",
      policyDecision: { action: "auto_send_allowed" },
      draft: null
    }
  ],
  outbox: [
    {
      id: "outbox-1",
      messageId: "message-2",
      draftId: "draft-2",
      recipientEmail: "jamie@example.com",
      subject: "Re: Question two",
      body: "Hello Jamie",
      sentAt: "2026-04-11T12:06:00.000Z",
      deliveryMode: "mock"
    }
  ],
  mailboxes: [
    {
      id: "mailbox-1",
      key: "frontdesk",
      displayName: "Front Desk",
      defaultToneProfileId: "tone-1",
      defaultAutomationProfileId: "automation-1",
      allowMockAutoSend: true
    }
  ],
  automationProfiles: [],
  toneProfiles: [],
  knowledgeDocuments: [],
  users: [],
  scenarios: [],
  scenarioResults: [],
  lastRefreshedAt: "2026-04-11T12:06:00.000Z"
} satisfies DashboardData;

describe("dashboard state helpers", () => {
  it("falls back to the first inbox item when the current selection no longer exists", () => {
    const selectedMessageId = resolveSelectedMessageId({
      currentSelectedMessageId: "stale-message",
      inbox: dashboard.inbox,
      resetSelection: true
    });

    expect(selectedMessageId).toBe("message-1");
  });

  it("preserves a valid preferred message id after creating a new message", () => {
    const nextState = applyDashboardState({
      currentMailboxId: "mailbox-1",
      currentSelectedMessageId: "message-1",
      dashboard,
      preferredMessageId: "message-2"
    });

    expect(nextState.nextMailboxId).toBe("mailbox-1");
    expect(nextState.nextSelectedMessageId).toBe("message-2");
  });

  it("keeps the existing selection during a normal refresh when it is still valid", () => {
    const nextState = applyDashboardState({
      currentMailboxId: "mailbox-1",
      currentSelectedMessageId: "message-2",
      dashboard
    });

    expect(nextState.nextSelectedMessageId).toBe("message-2");
  });
});
