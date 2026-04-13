export type InboxItem = {
  id: string;
  mailboxId: string;
  scenarioId?: string | null;
  senderEmail: string;
  senderName: string | null;
  subject: string;
  receivedAt: string;
  status: string;
  policyDecision: { action: string } | null;
  draft: { id: string; status: string } | null;
};

export type ScenarioListItem = {
  id: string;
  key: string;
  name: string;
  description: string;
  scenarioType: "safe" | "ambiguous" | "escalation" | "adversarial";
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  expectedIntent: string;
  expectedDecision: string;
  replayReceivedAt?: string | null;
  demoReady: boolean;
};

export type ScenarioRunResult = {
  scenarioId: string;
  scenarioKey: string;
  scenarioName: string;
  scenarioType: "safe" | "ambiguous" | "escalation" | "adversarial";
  demoReady: boolean;
  expectedIntent: string;
  expectedDecision: string;
  latestMessageId: string | null;
  latestStatus: string | null;
  actualIntent: string | null;
  actualDecision: string | null;
  actualConfidence: number | null;
  matchesIntent: boolean;
  matchesDecision: boolean;
  matchesReplyContent: boolean;
  failureReasons: string[];
  isPassing: boolean;
  latestRunAt: string | null;
  replyPreview: string | null;
};

export type DashboardData = {
  summary: {
    inboxTotal: number;
    draftsReady: number;
    escalated: number;
    blocked: number;
    sent: number;
    autoSent: number;
    outboxTotal: number;
  };
  queue: {
    queued: number;
    processing: number;
    failed: number;
    completed: number;
  };
  inbox: InboxItem[];
  outbox: Array<{
    id: string;
    messageId: string;
    draftId: string;
    recipientEmail: string;
    subject: string;
    body: string;
    sentAt: string;
    deliveryMode: string;
  }>;
  mailboxes: Array<{
    id: string;
    key: string;
    displayName: string;
    defaultToneProfileId: string;
    defaultAutomationProfileId: string;
    allowMockAutoSend: boolean;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    mailboxId: string;
    toneProfileOverrideId: string | null;
    automationProfileOverrideId: string | null;
  }>;
  automationProfiles: Array<{
    id: string;
    name: string;
    approvalMode: string;
    confidenceThresholdDraft: number;
    confidenceThresholdAutoSend: number;
  }>;
  toneProfiles: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  knowledgeDocuments: Array<{
    id: string;
    title: string;
    contentType: string;
    source: string;
  }>;
  scenarios: ScenarioListItem[];
  scenarioResults: ScenarioRunResult[];
  lastRefreshedAt: string;
};

export type MessageDetail = {
  message: {
    id: string;
    threadId?: string;
    actorUserId?: string | null;
    sourceMessageKey?: string | null;
    senderEmail: string;
    senderName: string | null;
    subject: string;
    rawBody: string;
    normalizedBodyText: string | null;
    strippedQuotedText?: string | null;
    status: string;
    scenarioId?: string | null;
  };
  thread: {
    id: string;
    subject: string;
    currentIntent: string | null;
    status: string;
    latestMessageId: string;
  } | null;
  threadMessages: Array<{
    id: string;
    subject: string;
    senderEmail: string;
    senderName: string | null;
    receivedAt: string;
    status: string;
  }>;
  actingUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    toneProfileOverrideId: string | null;
    automationProfileOverrideId: string | null;
  } | null;
  classification: {
    intent: string;
    confidence: number;
    extractedEntities: Record<string, unknown>;
    riskFlags: string[];
    reasoningSummary: string;
    providerUsed: string;
  } | null;
  policyDecision: {
    action: string;
    rationale: string;
    triggeredRules: string[];
    riskLevel: string;
    escalationTarget?: string | null;
  } | null;
  retrieval: {
    facts: Array<{ key: string; title: string; value: string }>;
    summary: string;
  } | null;
  draft: {
    id: string;
    subject?: string;
    toneProfileId?: string;
    body: string;
    status: string;
    confidenceNote: string;
    generationMetadata: {
      provider: string;
      mode: string;
      grounded: boolean;
    };
  } | null;
  audit: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }>;
};

export type DemoRunResponse = {
  replayedCount: number;
  processedCount: number;
  dashboard: DashboardData;
};

export const EMPTY_FORM = {
  senderEmail: "guest@example.com",
  senderName: "Guest",
  subject: "",
  rawBody: "",
  threadId: ""
};

export function toneForStatus(status: string | null | undefined): "neutral" | "good" | "warn" | "danger" {
  if (!status) {
    return "neutral";
  }
  if (status === "sent" || status === "auto_sent") {
    return "good";
  }
  if (status === "draft_ready" || status === "processing" || status === "new") {
    return "warn";
  }
  return "danger";
}

export function toneForPolicy(action: string | null | undefined): "neutral" | "good" | "warn" | "danger" {
  if (!action) {
    return "neutral";
  }
  if (action === "auto_send_allowed") {
    return "good";
  }
  if (action === "draft_only") {
    return "warn";
  }
  return "danger";
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not run yet";
  }
  return new Date(value).toLocaleString();
}
