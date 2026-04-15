import Fastify from "fastify";
import cors from "@fastify/cors";

import { getConfig } from "../../../packages/config/src/index.js";
import {
  messageRepository,
  processingRepository,
  settingsRepository
} from "../../../packages/db/src/index.js";
import {
  ingestEmail,
  processPendingJobs,
  approveDraftAndSend,
  createDraftInProvider,
  rejectDraft,
  buildScenarioRunResults,
  replayScenarios,
  runDemoPack,
  syncMailbox
} from "../../../packages/core/src/index.js";
import {
  createLocalProviders,
  createRuntimeProviderRegistry,
  ensureRuntimeBootstrap
} from "../../../packages/testing/src/bootstrap-local.js";
import { seedLocalData } from "../../../packages/testing/src/seed-local-data.js";

const config = getConfig();
const providers = createLocalProviders();
const providerRegistry = createRuntimeProviderRegistry();

const app = Fastify({
  logger: false
});

function resolveMailboxRecipient(mailbox: { emailAddress: string | null; gmailMailboxAddress?: string | null }) {
  return mailbox.emailAddress ?? mailbox.gmailMailboxAddress ?? "frontdesk@example.local";
}

await app.register(cors, {
  origin: true
});

function getDashboardPayload() {
  const inbox = messageRepository.listInboxSummary();
  const jobs = processingRepository.listAll();
  const queue = {
    queued: jobs.filter((job) => job.status === "queued").length,
    processing: jobs.filter((job) => job.status === "processing").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    completed: jobs.filter((job) => job.status === "completed").length
  };
  const summary = {
    inboxTotal: inbox.length,
    draftsReady: inbox.filter((message) => message.status === "draft_ready").length,
    escalated: inbox.filter((message) => message.status === "escalated").length,
    blocked: inbox.filter((message) => message.status === "blocked").length,
    sent: inbox.filter((message) => message.status === "sent").length,
    autoSent: inbox.filter((message) => message.status === "auto_sent").length,
    outboxTotal: messageRepository.listOutbox().length
  };

  return {
    summary,
    queue,
    inbox,
    outbox: messageRepository.listOutbox(),
    mailboxes: settingsRepository.listMailboxes(),
    automationProfiles: settingsRepository.listAutomationProfiles(),
    toneProfiles: settingsRepository.listToneProfiles(),
    knowledgeDocuments: settingsRepository.listKnowledgeDocuments(),
    scenarios: settingsRepository.listScenarios(),
    scenarioResults: buildScenarioRunResults(),
    users: settingsRepository.listUsers(),
    providerStatus: {
      gmailReadEnabled: config.ENABLE_GMAIL_READ,
      gmailDraftsEnabled: config.ENABLE_GMAIL_DRAFTS,
      gmailSendEnabled: config.ENABLE_GMAIL_SEND,
      remoteModelsEnabled: config.ENABLE_REMOTE_MODELS
    },
    lastRefreshedAt: new Date().toISOString()
  };
}

app.get("/api/health", async () => ({
  status: "ok",
  mode: config.APP_MODE
}));

app.get("/api/dashboard", async () => getDashboardPayload());

app.get("/api/providers/status", async () => ({
  gmailReadEnabled: config.ENABLE_GMAIL_READ,
  gmailDraftsEnabled: config.ENABLE_GMAIL_DRAFTS,
  gmailSendEnabled: config.ENABLE_GMAIL_SEND,
  remoteModelsEnabled: config.ENABLE_REMOTE_MODELS
}));

app.get("/api/messages/:messageId", async (request, reply) => {
  const params = request.params as { messageId: string };
  const message = messageRepository.getRecord(params.messageId);

  if (!message) {
    return reply.status(404).send({
      error: "Message not found."
    });
  }

  const audit = processingRepository.listAuditForMessage(params.messageId);
  const actingUser = message.actorUserId ? settingsRepository.getUser(message.actorUserId) : null;

  return {
    message: {
      ...messageRepository.get(params.messageId),
      actorUserId: message.actorUserId ?? null,
      sourceMessageKey: message.sourceMessageKey ?? null,
      providerName: message.providerName,
      externalMessageId: message.externalMessageId ?? null,
      externalThreadId: message.externalThreadId ?? null,
      externalHistoryId: message.externalHistoryId ?? null,
      normalizedBodyText: message.normalizedBodyText,
      strippedQuotedText: message.strippedQuotedText,
      attachmentMetadata: JSON.parse(message.attachmentMetadataJson),
      language: message.language
    },
    thread: messageRepository.getThread(message.threadId),
    threadMessages: messageRepository.listMessagesForThread(message.threadId),
    actingUser,
    classification: processingRepository.getClassificationByMessage(params.messageId),
    policyDecision: processingRepository.getPolicyDecisionByMessage(params.messageId),
    draft: messageRepository.getDraftByMessage(params.messageId),
    retrieval: audit.find((event) => event.eventType === "knowledge_retrieved")?.payload ?? null,
    audit
  };
});

app.post("/api/messages/manual", async (request) => {
  const body = request.body as {
      mailboxId: string;
      actorUserId?: string | null;
      threadId?: string | null;
      senderEmail: string;
      senderName?: string;
      subject: string;
    rawBody: string;
  };
  const mailbox = settingsRepository.getMailbox(body.mailboxId);

  if (!mailbox) {
    throw new Error("Mailbox not found.");
  }

  const result = await ingestEmail({
      mailboxId: body.mailboxId,
      sourceType: "manual_paste",
      actorUserId: body.actorUserId ?? null,
      threadId: body.threadId ?? null,
      sourceMessageKey: body.actorUserId
        ? `manual:${body.mailboxId}:${body.actorUserId}:${body.senderEmail}:${body.subject}:${body.rawBody}`
        : `manual:${body.mailboxId}:${body.senderEmail}:${body.subject}:${body.rawBody}`,
      senderEmail: body.senderEmail,
      senderName: body.senderName ?? null,
      recipients: [resolveMailboxRecipient(mailbox)],
    subject: body.subject,
    rawBody: body.rawBody
  });

  return result;
});

app.post("/api/scenarios/replay", async (request) => {
  const body = request.body as {
    mailboxId?: string;
    scenarioIds?: string[];
  };
  const mailbox = body.mailboxId
    ? settingsRepository.getMailbox(body.mailboxId)
    : settingsRepository.getMailboxByKey("frontdesk");

  if (!mailbox) {
    throw new Error("Mailbox not found.");
  }

  return replayScenarios({
    mailboxId: mailbox.id,
    scenarioIds: body.scenarioIds
  });
});

app.post("/api/jobs/process-pending", async () => {
  const processed = await processPendingJobs({ providerRegistry });
  return {
    processedCount: processed.length
  };
});

app.post("/api/mailboxes/:mailboxId/sync", async (request) => {
  const params = request.params as { mailboxId: string };
  const body = (request.body ?? {}) as { limit?: number };
  const synced = await syncMailbox({
    mailboxId: params.mailboxId,
    providerRegistry,
    limit: body.limit
  });

  const processed = await processPendingJobs({ providerRegistry });
  return {
    syncedCount: synced.syncedCount,
    ingestedCount: synced.ingested.length,
    processedCount: processed.length
  };
});

app.get("/api/outbox", async () => ({
  outbox: messageRepository.listOutbox()
}));

app.get("/api/settings", async () => ({
  mailboxes: settingsRepository.listMailboxes(),
  automationProfiles: settingsRepository.listAutomationProfiles(),
  toneProfiles: settingsRepository.listToneProfiles(),
  knowledgeDocuments: settingsRepository.listKnowledgeDocuments(),
  users: settingsRepository.listUsers(),
  scenarios: settingsRepository.listScenarios()
}));

app.post("/api/drafts/:draftId/send", async (request) => {
  const params = request.params as { draftId: string };
  const body = request.body as { editedBody?: string; operatorUserId?: string | null };
  const outboxMessage = await approveDraftAndSend({
    draftId: params.draftId,
    editedBody: body.editedBody,
    operatorUserId: body.operatorUserId ?? null,
    providerRegistry
  });

  return {
    outboxMessage
  };
});

app.post("/api/drafts/:draftId/provider-draft", async (request) => {
  const params = request.params as { draftId: string };
  const body = request.body as { operatorUserId?: string | null };
  const outboxMessage = await createDraftInProvider({
    draftId: params.draftId,
    operatorUserId: body.operatorUserId ?? null,
    providerRegistry
  });

  return {
    outboxMessage
  };
});

app.post("/api/drafts/:draftId/reject", async (request) => {
  const params = request.params as { draftId: string };
  const body = request.body as { reason: string };
  rejectDraft(params.draftId, body.reason);
  return {
    ok: true
  };
});

app.post("/api/admin/seed", async () => {
  await seedLocalData();
  return {
    ok: true
  };
});

app.post("/api/demo/run", async (request) => {
  const body = (request.body ?? {}) as { mailboxId?: string };
  await seedLocalData();
  const mailbox = body.mailboxId
    ? settingsRepository.getMailbox(body.mailboxId)
    : settingsRepository.getMailboxByKey("frontdesk");

  if (!mailbox) {
    throw new Error("Mailbox not found.");
  }

  const result = await runDemoPack({
    mailboxId: mailbox.id,
    modelProvider: providers.modelProvider,
    knowledgeProvider: providers.knowledgeProvider,
    sendProvider: providers.sendProvider
  });

  return {
    ...result,
    dashboard: getDashboardPayload()
  };
});

async function start() {
  await ensureRuntimeBootstrap();
  await app.listen({
    host: "0.0.0.0",
    port: config.PORT
  });
  console.log(`API listening on http://localhost:${config.PORT}`);
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
