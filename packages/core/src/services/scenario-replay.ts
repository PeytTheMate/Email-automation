import { messageRepository, processingRepository, settingsRepository } from "../../../db/src/index.js";
import type {
  Scenario,
  ScenarioRunResult
} from "../../../schemas/src/index.js";
import { scenarioRunResultSchema } from "../../../schemas/src/index.js";

import type { KnowledgeProvider, ModelProvider, SendProvider } from "../contracts.js";
import { ingestEmail, processPendingJobs } from "./process-email.js";

const DEFAULT_REPLAY_RECEIVED_AT = "2026-04-10T12:00:00.000Z";

function resolveMailboxRecipient(mailbox: {
  emailAddress: string | null;
  gmailMailboxAddress?: string | null;
}) {
  return mailbox.emailAddress ?? mailbox.gmailMailboxAddress ?? "frontdesk@example.local";
}

export async function replayScenarios(args: {
  mailboxId: string;
  scenarioIds?: string[];
}) {
  const mailbox = settingsRepository.getMailbox(args.mailboxId);
  if (!mailbox) {
    throw new Error("Mailbox not found.");
  }

  const selectedScenarios = args.scenarioIds?.length
    ? settingsRepository
        .listScenarios()
        .filter((scenario) => args.scenarioIds?.includes(scenario.id))
    : settingsRepository.listScenarios();

  const ingested = [];
  for (const scenario of selectedScenarios) {
    ingested.push(
      await ingestEmail({
        mailboxId: mailbox.id,
        sourceType: "seeded_scenario",
        scenarioId: scenario.id,
        senderEmail: scenario.senderEmail,
        senderName: scenario.senderName,
        recipients: [resolveMailboxRecipient(mailbox)],
        subject: scenario.subject,
        rawBody: scenario.body,
        receivedAt: scenario.replayReceivedAt ?? DEFAULT_REPLAY_RECEIVED_AT
      })
    );
  }

  return {
    count: ingested.length,
    ingested
  };
}

export async function runDemoPack(args: {
  mailboxId: string;
  modelProvider: ModelProvider;
  knowledgeProvider: KnowledgeProvider;
  sendProvider: SendProvider;
}) {
  const demoScenarioIds = settingsRepository
    .listScenarios()
    .filter((scenario) => scenario.demoReady)
    .map((scenario) => scenario.id);

  const replayed = await replayScenarios({
    mailboxId: args.mailboxId,
    scenarioIds: demoScenarioIds
  });

  const processed = await processPendingJobs({
    modelProvider: args.modelProvider,
    knowledgeProvider: args.knowledgeProvider,
    sendProvider: args.sendProvider
  });

  return {
    replayedCount: replayed.count,
    processedCount: processed.length
  };
}

function pickLatestScenarioRun(scenario: Scenario) {
  const inbox = messageRepository
    .listInboxSummary()
    .filter((message) => message.scenarioId === scenario.id)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));

  return inbox[0] ?? null;
}

export function buildScenarioRunResults(): ScenarioRunResult[] {
  return settingsRepository.listScenarios().map((scenario) => {
    const latestRun = pickLatestScenarioRun(scenario);
    const classification = latestRun
      ? processingRepository.getClassificationByMessage(latestRun.id)
      : null;
    const policyDecision = latestRun
      ? processingRepository.getPolicyDecisionByMessage(latestRun.id)
      : null;
    const draft = latestRun ? messageRepository.getDraftByMessage(latestRun.id) : null;
    const matchesReplyContent =
      scenario.expectedReplyContains.length === 0 ||
      scenario.expectedReplyContains.every((snippet) =>
        draft?.body.toLowerCase().includes(snippet.toLowerCase())
      );
    const failureReasons = [
      classification?.intent !== scenario.expectedIntent
        ? `Expected intent ${scenario.expectedIntent} but saw ${classification?.intent ?? "not_run"}.`
        : null,
      policyDecision?.action !== scenario.expectedDecision
        ? `Expected decision ${scenario.expectedDecision} but saw ${policyDecision?.action ?? "not_run"}.`
        : null,
      !matchesReplyContent && scenario.expectedReplyContains.length > 0
        ? `Reply preview did not include: ${scenario.expectedReplyContains.join(", ")}.`
        : null
    ].filter(Boolean) as string[];

    return scenarioRunResultSchema.parse({
      scenarioId: scenario.id,
      scenarioKey: scenario.key,
      scenarioName: scenario.name,
      scenarioType: scenario.scenarioType,
      demoReady: scenario.demoReady,
      expectedIntent: scenario.expectedIntent,
      expectedDecision: scenario.expectedDecision,
      latestMessageId: latestRun?.id ?? null,
      latestStatus: latestRun?.status ?? null,
      actualIntent: classification?.intent ?? null,
      actualDecision: policyDecision?.action ?? null,
      actualConfidence: classification?.confidence ?? null,
      matchesIntent: classification?.intent === scenario.expectedIntent,
      matchesDecision: policyDecision?.action === scenario.expectedDecision,
      matchesReplyContent,
      failureReasons,
      isPassing:
        classification?.intent === scenario.expectedIntent &&
        policyDecision?.action === scenario.expectedDecision &&
        matchesReplyContent,
      latestRunAt: latestRun?.receivedAt ?? null,
      replyPreview: draft?.body ?? null
    });
  });
}
