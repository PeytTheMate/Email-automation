import { settingsRepository } from "../../../packages/db/src/index.js";
import { ingestEmail, processPendingJobs } from "../../../packages/core/src/index.js";
import { LocalKnowledgeProvider } from "../../../packages/providers/knowledge-local/src/index.js";
import {
  MockModelProvider
} from "../../../packages/providers/model-local/src/index.js";
import { LocalSendProvider } from "../../../packages/providers/send-local/src/index.js";

const command = process.argv[2];
const modelProvider = new MockModelProvider();
const knowledgeProvider = new LocalKnowledgeProvider();
const sendProvider = new LocalSendProvider();

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
      recipients: [mailbox.emailAddress ?? "frontdesk@example.local"],
      subject: scenario.subject,
      rawBody: scenario.body,
      receivedAt: scenario.replayReceivedAt ?? undefined
    });
  }

  const processed = await processPendingJobs({
    modelProvider,
    knowledgeProvider,
    sendProvider
  });

  console.log(`Replayed ${processed.length} scenario(s).`);
}

async function run() {
  switch (command) {
    case "replay":
      await replayScenario(process.argv[3]);
      break;
    case "process-pending":
      await processPendingJobs({
        modelProvider,
        knowledgeProvider,
        sendProvider
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
