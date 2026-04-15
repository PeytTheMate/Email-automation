import { asc, eq } from "drizzle-orm";

import { getDb } from "./client.js";
import {
  automationProfilesTable,
  knowledgeDocumentsTable,
  mailboxesTable,
  scenariosTable,
  toneProfilesTable,
  usersTable
} from "./schema.js";
import {
  mapAutomationProfile,
  mapKnowledgeDocument,
  mapMailbox,
  mapScenario,
  mapToneProfile,
  mapUser
} from "./mappers.js";

export const settingsRepository = {
  listMailboxes() {
    return getDb()
      .select()
      .from(mailboxesTable)
      .orderBy(asc(mailboxesTable.displayName))
      .all()
      .map(mapMailbox);
  },
  getMailbox(id: string) {
    const row = getDb().select().from(mailboxesTable).where(eq(mailboxesTable.id, id)).get();
    return row ? mapMailbox(row) : null;
  },
  getMailboxByKey(key: string) {
    const row = getDb().select().from(mailboxesTable).where(eq(mailboxesTable.key, key)).get();
    return row ? mapMailbox(row) : null;
  },
  updateMailboxRuntime(id: string, updates: {
    gmailHistoryId?: string | null;
    updatedAt?: string;
  }) {
    getDb()
      .update(mailboxesTable)
      .set({
        gmailHistoryId: updates.gmailHistoryId,
        updatedAt: updates.updatedAt ?? new Date().toISOString()
      })
      .where(eq(mailboxesTable.id, id))
      .run();
  },
  listUsers() {
    return getDb().select().from(usersTable).orderBy(asc(usersTable.name)).all().map(mapUser);
  },
  getUser(id: string) {
    const row = getDb().select().from(usersTable).where(eq(usersTable.id, id)).get();
    return row ? mapUser(row) : null;
  },
  listUsersByMailbox(mailboxId: string) {
    return getDb()
      .select()
      .from(usersTable)
      .where(eq(usersTable.mailboxId, mailboxId))
      .orderBy(asc(usersTable.name))
      .all()
      .map(mapUser);
  },
  getPrimaryUserForMailbox(mailboxId: string) {
    return this.listUsersByMailbox(mailboxId)[0] ?? null;
  },
  listAutomationProfiles() {
    return getDb()
      .select()
      .from(automationProfilesTable)
      .orderBy(asc(automationProfilesTable.name))
      .all()
      .map(mapAutomationProfile);
  },
  getAutomationProfile(id: string) {
    const row = getDb()
      .select()
      .from(automationProfilesTable)
      .where(eq(automationProfilesTable.id, id))
      .get();
    return row ? mapAutomationProfile(row) : null;
  },
  listToneProfiles() {
    return getDb()
      .select()
      .from(toneProfilesTable)
      .orderBy(asc(toneProfilesTable.name))
      .all()
      .map(mapToneProfile);
  },
  getToneProfile(id: string) {
    const row = getDb().select().from(toneProfilesTable).where(eq(toneProfilesTable.id, id)).get();
    return row ? mapToneProfile(row) : null;
  },
  listKnowledgeDocuments() {
    return getDb()
      .select()
      .from(knowledgeDocumentsTable)
      .orderBy(asc(knowledgeDocumentsTable.title))
      .all()
      .map(mapKnowledgeDocument);
  },
  listScenarios() {
    return getDb()
      .select()
      .from(scenariosTable)
      .orderBy(asc(scenariosTable.name))
      .all()
      .map(mapScenario);
  },
  getScenario(id: string) {
    const row = getDb().select().from(scenariosTable).where(eq(scenariosTable.id, id)).get();
    return row ? mapScenario(row) : null;
  },
  getScenarioByKey(key: string) {
    const row = getDb().select().from(scenariosTable).where(eq(scenariosTable.key, key)).get();
    return row ? mapScenario(row) : null;
  }
};
