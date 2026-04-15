import { settingsRepository } from "../../../packages/db/src/index.js";
import { ingestEmail, processPendingJobs } from "../../../packages/core/src/index.js";
import {
  createRuntimeProviderRegistry,
  ensureRuntimeBootstrap
} from "../../../packages/testing/src/bootstrap-local.js";

const command = process.argv[2];
const providerRegistry = createRuntimeProviderRegistry();

function resolveMailboxRecipient(mailbox: {
  emailAddress: string | null;
  gmailMailboxAddress?: string | null;
}) {
  return mailbox.emailAddress ?? mailbox.gmailMailboxAddress ?? "frontdesk@example.local";
}

async function replayScenario(key?: string) {
  const mailbox = settingsRepository.getMailboxByKey("frontdesk");
  if (!mailbox) {
    throw new Error("Front desk mailbox is missing. Run the seed script first.");
  }

  const scenarios = settingsRepository.listScenarios();
  const selected = key ? scenarios.filter((scenario) => scenario.key === key) : scenarios;

  for (const scenario of selected) {
    await ingestEmail({
      mailboxId: mailbox.id,
      sourceType: "replay",
      scenarioId: scenario.id,
      senderEmail: scenario.senderEmail,
      senderName: scenario.senderName,
      recipients: [resolveMailboxRecipient(mailbox)],
      subject: scenario.subject,
      rawBody: scenario.body,
      receivedAt: scenario.replayReceivedAt ?? undefined
    });
  }

  const processed = await processPendingJobs({
    providerRegistry
  });

  console.log(`Replayed ${processed.length} scenario(s).`);
}

async function run() {
  await ensureRuntimeBootstrap();

  switch (command) {
    case "replay":
      await replayScenario(process.argv[3]);
      break;
    case "process-pending":
      await processPendingJobs({
        providerRegistry
      });
      console.log("Processed pending jobs.");
      break;
    default:
      console.log("Usage: npm run replay -- [scenario-key] | npm run process:pending");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
