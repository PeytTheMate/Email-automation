import { getDb } from "./client.js";
import {
  automationProfilesTable,
  knowledgeDocumentsTable,
  mailboxesTable,
  scenariosTable,
  toneProfilesTable,
  usersTable
} from "./schema.js";
import { toJson } from "./utils.js";

export const seedRepository = {
  replaceMailboxes(records: Array<{
    id: string;
    key: string;
    displayName: string;
    emailAddress: string | null;
    providerMode: string;
    defaultToneProfileId: string;
    defaultAutomationProfileId: string;
    escalationTarget: string;
    allowMockAutoSend: boolean;
    enabledIntents: string[];
    createdAt: string;
    updatedAt: string;
  }>) {
    const values = records.map((record) => ({
      ...record,
      enabledIntentsJson: toJson(record.enabledIntents)
    }));

    getDb().delete(mailboxesTable).run();
    if (values.length > 0) {
      getDb().insert(mailboxesTable).values(values).run();
    }
  },
  replaceUsers(records: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    mailboxId: string;
    toneProfileOverrideId: string | null;
    automationProfileOverrideId: string | null;
    createdAt: string;
    updatedAt: string;
  }>) {
    getDb().delete(usersTable).run();
    if (records.length > 0) {
      getDb().insert(usersTable).values(records).run();
    }
  },
  replaceAutomationProfiles(records: Array<{
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
  }>) {
    const values = records.map((record) => ({
      ...record,
      allowedAutoSendIntentsJson: toJson(record.allowedAutoSendIntents),
      blockedIntentsJson: toJson(record.blockedIntents),
      featureFlagsJson: toJson(record.featureFlags)
    }));

    getDb().delete(automationProfilesTable).run();
    if (values.length > 0) {
      getDb().insert(automationProfilesTable).values(values).run();
    }
  },
  replaceToneProfiles(records: Array<{
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
  }>) {
    const values = records.map((record) => ({
      ...record,
      styleRulesJson: toJson(record.styleRules),
      approvedClosingsJson: toJson(record.approvedClosings),
      forbiddenPhrasesJson: toJson(record.forbiddenPhrases)
    }));

    getDb().delete(toneProfilesTable).run();
    if (values.length > 0) {
      getDb().insert(toneProfilesTable).values(values).run();
    }
  },
  replaceKnowledgeDocuments(records: Array<{
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
  }>) {
    const values = records.map((record) => ({
      id: record.id,
      key: record.key,
      title: record.title,
      intent: record.intent ?? null,
      mailboxKeysJson: toJson(record.mailboxKeys ?? []),
      contentType: record.contentType,
      contentJson: toJson(record.content),
      source: record.source,
      isActive: record.isActive,
      updatedAt: record.updatedAt
    }));

    getDb().delete(knowledgeDocumentsTable).run();
    if (values.length > 0) {
      getDb().insert(knowledgeDocumentsTable).values(values).run();
    }
  },
  replaceScenarios(records: Array<{
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
  }>) {
    const values = records.map((record) => ({
      ...record,
      expectedReplyContainsJson: toJson(record.expectedReplyContains)
    }));

    getDb().delete(scenariosTable).run();
    if (values.length > 0) {
      getDb().insert(scenariosTable).values(values).run();
    }
  }
};
