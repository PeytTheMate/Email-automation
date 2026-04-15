import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  clearAllTables,
  initializeDatabase,
  resetDbClient,
  seedRepository
} from "../../db/src/index.js";

type MailboxSeed = {
  id: string;
  key: string;
  displayName: string;
  emailAddress: string | null;
  providerMode: string;
  connectionMode?: string;
  gmailMailboxAddress?: string | null;
  gmailLabelFilter?: string | null;
  allowedSenderPatterns?: string[];
  allowedOutboundRecipientPatterns?: string[];
  enableLiveRead?: boolean;
  enableLiveDrafts?: boolean;
  enableLiveSend?: boolean;
  defaultModelProvider?: string;
  gmailHistoryId?: string | null;
  defaultToneProfileId: string;
  defaultAutomationProfileId: string;
  escalationTarget: string;
  allowMockAutoSend: boolean;
  enabledIntents: string[];
  createdAt: string;
  updatedAt: string;
};

type UserSeed = {
  id: string;
  name: string;
  email: string;
  role: string;
  mailboxId: string;
  toneProfileOverrideId: string | null;
  automationProfileOverrideId: string | null;
  createdAt: string;
  updatedAt: string;
};

type AutomationProfileSeed = {
  id: string;
  key: string;
  name: string;
  description: string;
  approvalMode: string;
  allowedAutoSendIntents: string[];
  blockedIntents: string[];
  confidenceThresholdDraft: number;
  confidenceThresholdAutoSend: number;
  featureFlags: Record<string, boolean>;
  maxReplySentences: number;
  createdAt: string;
  updatedAt: string;
};

type ToneProfileSeed = {
  id: string;
  key: string;
  name: string;
  description: string;
  greetingStyle: string;
  closingStyle: string;
  styleRules: Record<string, string | number | boolean>;
  approvedClosings: string[];
  forbiddenPhrases: string[];
  signatureTemplate: string;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeSeed = {
  id: string;
  key: string;
  title: string;
  intent?: string;
  mailboxKeys?: string[];
  contentType: string;
  content: Record<string, unknown>;
  source: string;
  isActive: boolean;
  updatedAt: string;
};

type ScenarioSeed = {
  id: string;
  key: string;
  name: string;
  description: string;
  scenarioType: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  expectedIntent: string;
  expectedDecision: string;
  expectedReplyContains: string[];
  replayReceivedAt?: string | null;
  demoReady: boolean;
};

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = resolve(process.cwd(), relativePath);
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export async function seedLocalData() {
  resetDbClient();
  initializeDatabase();
  clearAllTables();

  const [mailboxes, users, automationProfiles, toneProfiles, knowledgeDocuments, scenarios] =
    await Promise.all([
      readJson<MailboxSeed[]>("data/seed/mailboxes.json"),
      readJson<UserSeed[]>("data/seed/users.json"),
      readJson<AutomationProfileSeed[]>("data/seed/automation-profiles/profiles.json"),
      readJson<ToneProfileSeed[]>("data/seed/tone-profiles/profiles.json"),
      readJson<KnowledgeSeed[]>("data/seed/knowledge/knowledge.json"),
      readJson<ScenarioSeed[]>("data/seed/emails/scenarios.json")
    ]);

  seedRepository.replaceAutomationProfiles(automationProfiles);
  seedRepository.replaceToneProfiles(toneProfiles);
  seedRepository.replaceMailboxes(mailboxes);
  seedRepository.replaceUsers(users);
  seedRepository.replaceKnowledgeDocuments(knowledgeDocuments);
  seedRepository.replaceScenarios(scenarios);
}
