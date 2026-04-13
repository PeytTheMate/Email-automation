import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { DraftReply, EmailMessage, EmailThread, OutboxMessage } from "../../schemas/src/index.js";
import { getDb } from "./client.js";
import {
  draftsTable,
  messagesTable,
  outboxTable,
  policyDecisionsTable,
  threadsTable
} from "./schema.js";
import {
  mapDraft,
  mapMessage,
  mapOutbox,
  mapPolicyDecision,
  mapThread
} from "./mappers.js";
import { nowIso, parseJson, toJson } from "./utils.js";

export const messageRepository = {
  create(input: Omit<EmailMessage, "createdAt">) {
    const createdAt = nowIso();
    getDb()
      .insert(messagesTable)
      .values({
        id: input.id,
        mailboxId: input.mailboxId,
        sourceType: input.sourceType,
        scenarioId: input.scenarioId ?? null,
        threadId: input.threadId,
        actorUserId: input.actorUserId ?? null,
        sourceMessageKey: input.sourceMessageKey ?? null,
        senderEmail: input.senderEmail,
        senderName: input.senderName,
        recipientsJson: toJson(input.recipients),
        ccRecipientsJson: toJson(input.ccRecipients),
        subject: input.subject,
        rawBody: input.rawBody,
        normalizedBodyText: null,
        strippedQuotedText: null,
        attachmentMetadataJson: toJson([]),
        language: null,
        receivedAt: input.receivedAt,
        status: input.status,
        processingVersion: "v1",
        createdAt,
        updatedAt: createdAt
      })
      .run();

    return this.get(input.id)!;
  },
  get(id: string) {
    const row = getDb().select().from(messagesTable).where(eq(messagesTable.id, id)).get();
    return row ? mapMessage(row) : null;
  },
  getBySourceMessageKey(sourceMessageKey: string) {
    const row = getDb()
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sourceMessageKey, sourceMessageKey))
      .get();
    return row ? mapMessage(row) : null;
  },
  getRecord(id: string) {
    return getDb().select().from(messagesTable).where(eq(messagesTable.id, id)).get() ?? null;
  },
  findRecentDuplicate(args: {
    mailboxId: string;
    sourceType: EmailMessage["sourceType"];
    senderEmail: string;
    subject: string;
    rawBody: string;
  }) {
    const candidates = getDb()
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.mailboxId, args.mailboxId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(20)
      .all();

    const duplicate = candidates.find(
      (row) =>
        row.sourceType === args.sourceType &&
        row.senderEmail === args.senderEmail &&
        row.subject === args.subject &&
        row.rawBody === args.rawBody
    );

    return duplicate ? mapMessage(duplicate) : null;
  },
  list() {
    return getDb()
      .select()
      .from(messagesTable)
      .orderBy(desc(messagesTable.receivedAt))
      .all()
      .map((row) => ({
        ...mapMessage(row),
        normalizedBodyText: row.normalizedBodyText,
        strippedQuotedText: row.strippedQuotedText,
        attachmentMetadata: parseJson(row.attachmentMetadataJson),
        language: row.language
      }));
  },
  updateNormalization(id: string, normalizedBodyText: string, strippedQuotedText: string | null, language: string | null) {
    getDb()
      .update(messagesTable)
      .set({
        normalizedBodyText,
        strippedQuotedText,
        language,
        updatedAt: nowIso()
      })
      .where(eq(messagesTable.id, id))
      .run();
  },
  updateStatus(id: string, status: EmailMessage["status"]) {
    getDb()
      .update(messagesTable)
      .set({
        status,
        updatedAt: nowIso()
      })
      .where(eq(messagesTable.id, id))
      .run();
  },
  createOrUpdateThread(thread: EmailThread) {
    const existing = getDb().select().from(threadsTable).where(eq(threadsTable.id, thread.id)).get();

    if (existing) {
      getDb()
        .update(threadsTable)
        .set({
          latestMessageId: thread.latestMessageId,
          currentIntent: thread.currentIntent,
          status: thread.status,
          updatedAt: thread.updatedAt
        })
        .where(eq(threadsTable.id, thread.id))
        .run();
    } else {
      getDb().insert(threadsTable).values(thread).run();
    }
  },
  getThread(id: string) {
    const row = getDb().select().from(threadsTable).where(eq(threadsTable.id, id)).get();
    return row ? mapThread(row) : null;
  },
  listMessagesForThread(threadId: string) {
    return getDb()
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, threadId))
      .orderBy(desc(messagesTable.receivedAt))
      .all()
      .map((row) => ({
        ...mapMessage(row),
        normalizedBodyText: row.normalizedBodyText,
        strippedQuotedText: row.strippedQuotedText,
        attachmentMetadata: parseJson(row.attachmentMetadataJson),
        language: row.language
      }));
  },
  listDrafts() {
    return getDb().select().from(draftsTable).orderBy(desc(draftsTable.updatedAt)).all().map(mapDraft);
  },
  saveDraft(draft: DraftReply) {
    getDb()
      .insert(draftsTable)
      .values({
        id: draft.id,
        messageId: draft.messageId,
        subject: draft.subject,
        body: draft.body,
        toneProfileId: draft.toneProfileId,
        retrievedFactKeysJson: toJson(draft.retrievedFactKeys),
        confidenceNote: draft.confidenceNote,
        generationMetadataJson: toJson(draft.generationMetadata),
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt
      })
      .onConflictDoUpdate({
        target: draftsTable.messageId,
        set: {
          subject: draft.subject,
          body: draft.body,
          toneProfileId: draft.toneProfileId,
          retrievedFactKeysJson: toJson(draft.retrievedFactKeys),
          confidenceNote: draft.confidenceNote,
          generationMetadataJson: toJson(draft.generationMetadata),
          status: draft.status,
          updatedAt: draft.updatedAt
        }
      })
      .run();
  },
  getDraftByMessage(messageId: string) {
    const row = getDb().select().from(draftsTable).where(eq(draftsTable.messageId, messageId)).get();
    return row ? mapDraft(row) : null;
  },
  getDraft(id: string) {
    const row = getDb().select().from(draftsTable).where(eq(draftsTable.id, id)).get();
    return row ? mapDraft(row) : null;
  },
  updateDraft(id: string, body: string, status: DraftReply["status"]) {
    getDb()
      .update(draftsTable)
      .set({
        body,
        status,
        updatedAt: nowIso()
      })
      .where(eq(draftsTable.id, id))
      .run();
  },
  listInboxSummary() {
    return getDb()
      .select()
      .from(messagesTable)
      .orderBy(desc(messagesTable.receivedAt))
      .all()
      .map((row) => {
        const policy = getDb()
          .select()
          .from(policyDecisionsTable)
          .where(eq(policyDecisionsTable.messageId, row.id))
          .get();
        const draft = getDb().select().from(draftsTable).where(eq(draftsTable.messageId, row.id)).get();

        return {
          ...mapMessage(row),
          policyDecision: policy ? mapPolicyDecision(policy) : null,
          draft: draft ? mapDraft(draft) : null
        };
      });
  },
  createOutboxMessage(outboxMessage: Omit<OutboxMessage, "id">) {
    const record = {
      ...outboxMessage,
      id: nanoid()
    };

    getDb().insert(outboxTable).values(record).run();
    return record;
  },
  listOutbox() {
    return getDb().select().from(outboxTable).orderBy(desc(outboxTable.sentAt)).all().map(mapOutbox);
  },
  getMessageWithRelations(messageId: string) {
    const message = this.getRecord(messageId);
    if (!message) {
      return null;
    }

    const classification = getDb()
      .select()
      .from(policyDecisionsTable)
      .where(eq(policyDecisionsTable.messageId, messageId))
      .get();

    return {
      message: {
        ...mapMessage(message),
        normalizedBodyText: message.normalizedBodyText,
        strippedQuotedText: message.strippedQuotedText,
        attachmentMetadata: parseJson(message.attachmentMetadataJson),
        language: message.language
      },
      thread: this.getThread(message.threadId),
      draft: this.getDraftByMessage(messageId),
      policyDecision: classification ? mapPolicyDecision(classification) : null
    };
  }
};
