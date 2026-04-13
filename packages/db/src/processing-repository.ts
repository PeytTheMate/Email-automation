import { and, asc, desc, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";

import type {
  AuditLogEvent,
  IntentClassification,
  PolicyDecision,
  ProcessingJob
} from "../../schemas/src/index.js";
import { auditLogEventSchema, processingJobSchema } from "../../schemas/src/index.js";
import { getDb, getSqlite } from "./client.js";
import {
  auditLogsTable,
  classificationsTable,
  policyDecisionsTable,
  processingJobsTable
} from "./schema.js";
import { mapAudit, mapClassification, mapJob, mapPolicyDecision } from "./mappers.js";
import { nowIso, toJson } from "./utils.js";

export const processingRepository = {
  enqueue(messageId: string): ProcessingJob {
    const record = processingJobSchema.parse({
      id: nanoid(),
      messageId,
      jobType: "process_inbound_email",
      status: "queued",
      attempts: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    getDb().insert(processingJobsTable).values(record).run();
    return record;
  },
  listPending() {
    const currentTime = nowIso();
    return getDb()
      .select()
      .from(processingJobsTable)
      .orderBy(asc(processingJobsTable.createdAt))
      .all()
      .filter(
        (row) =>
          (row.status === "queued" && (row.nextRetryAt === null || row.nextRetryAt <= currentTime)) ||
          (row.status === "failed" && row.nextRetryAt !== null && row.nextRetryAt <= currentTime)
      )
      .map(mapJob);
  },
  listAll() {
    return getDb()
      .select()
      .from(processingJobsTable)
      .orderBy(desc(processingJobsTable.createdAt))
      .all()
      .map(mapJob);
  },
  claim(id: string) {
    const row = getDb()
      .select()
      .from(processingJobsTable)
      .where(
        and(
          eq(processingJobsTable.id, id),
          or(eq(processingJobsTable.status, "queued"), eq(processingJobsTable.status, "failed"))
        )
      )
      .get();

    if (!row) {
      return null;
    }

    getDb()
      .update(processingJobsTable)
      .set({
        status: "processing",
        attempts: row.attempts + 1,
        nextRetryAt: null,
        updatedAt: nowIso()
      })
      .where(eq(processingJobsTable.id, id))
      .run();

    return this.get(id);
  },
  complete(id: string) {
    getDb()
      .update(processingJobsTable)
      .set({
        status: "completed",
        lastError: null,
        nextRetryAt: null,
        updatedAt: nowIso()
      })
      .where(eq(processingJobsTable.id, id))
      .run();
  },
  fail(id: string, error: string, maxAttempts = 3) {
    const row = getDb().select().from(processingJobsTable).where(eq(processingJobsTable.id, id)).get();
    if (!row) {
      return { terminal: true };
    }

    const terminal = row.attempts >= maxAttempts;
    const retryAt = terminal ? null : new Date(Date.now() + row.attempts * 1_000).toISOString();
    getDb()
      .update(processingJobsTable)
      .set({
        status: terminal ? "failed" : "queued",
        lastError: error,
        nextRetryAt: retryAt,
        updatedAt: nowIso()
      })
      .where(eq(processingJobsTable.id, id))
      .run();

    return { terminal, nextRetryAt: retryAt };
  },
  get(id: string) {
    const row = getDb().select().from(processingJobsTable).where(eq(processingJobsTable.id, id)).get();
    return row ? mapJob(row) : null;
  },
  saveClassification(classification: IntentClassification) {
    getDb()
      .insert(classificationsTable)
      .values({
        id: classification.id,
        messageId: classification.messageId,
        intent: classification.intent,
        confidence: classification.confidence,
        secondaryIntentsJson: toJson(classification.secondaryIntents),
        extractedEntitiesJson: toJson(classification.extractedEntities),
        riskFlagsJson: toJson(classification.riskFlags),
        reasoningSummary: classification.reasoningSummary,
        providerUsed: classification.providerUsed,
        createdAt: classification.createdAt
      })
      .onConflictDoUpdate({
        target: classificationsTable.messageId,
        set: {
          intent: classification.intent,
          confidence: classification.confidence,
          secondaryIntentsJson: toJson(classification.secondaryIntents),
          extractedEntitiesJson: toJson(classification.extractedEntities),
          riskFlagsJson: toJson(classification.riskFlags),
          reasoningSummary: classification.reasoningSummary,
          providerUsed: classification.providerUsed
        }
      })
      .run();
  },
  getClassificationByMessage(messageId: string) {
    const row = getDb()
      .select()
      .from(classificationsTable)
      .where(eq(classificationsTable.messageId, messageId))
      .get();
    return row ? mapClassification(row) : null;
  },
  savePolicyDecision(decision: PolicyDecision) {
    getDb()
      .insert(policyDecisionsTable)
      .values({
        id: decision.id,
        messageId: decision.messageId,
        classificationId: decision.classificationId,
        action: decision.action,
        allowMockAutoSend: decision.allowMockAutoSend,
        rationale: decision.rationale,
        triggeredRulesJson: toJson(decision.triggeredRules),
        riskLevel: decision.riskLevel,
        escalationTarget: decision.escalationTarget,
        createdAt: decision.createdAt
      })
      .onConflictDoUpdate({
        target: policyDecisionsTable.messageId,
        set: {
          classificationId: decision.classificationId,
          action: decision.action,
          allowMockAutoSend: decision.allowMockAutoSend,
          rationale: decision.rationale,
          triggeredRulesJson: toJson(decision.triggeredRules),
          riskLevel: decision.riskLevel,
          escalationTarget: decision.escalationTarget
        }
      })
      .run();
  },
  getPolicyDecisionByMessage(messageId: string) {
    const row = getDb()
      .select()
      .from(policyDecisionsTable)
      .where(eq(policyDecisionsTable.messageId, messageId))
      .get();
    return row ? mapPolicyDecision(row) : null;
  },
  log(event: Omit<AuditLogEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
    const record = auditLogEventSchema.parse({
      id: event.id ?? nanoid(),
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.eventType,
      payload: event.payload,
      createdAt: event.createdAt ?? nowIso()
    });

    getDb()
      .insert(auditLogsTable)
      .values({
        id: record.id,
        entityType: record.entityType,
        entityId: record.entityId,
        eventType: record.eventType,
        payloadJson: toJson(record.payload),
        createdAt: record.createdAt
      })
      .run();

    return record;
  },
  listAuditForMessage(messageId: string) {
    return getDb()
      .select()
      .from(auditLogsTable)
      .orderBy(asc(auditLogsTable.createdAt))
      .all()
      .map(mapAudit)
      .filter((event) => {
        if (event.entityId === messageId) {
          return true;
        }

        const payloadMessageId =
          typeof event.payload.messageId === "string" ? event.payload.messageId : null;

        return payloadMessageId === messageId;
      });
  },
  listRecentAudit(limit = 100) {
    return getDb()
      .select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .all()
      .map(mapAudit);
  }
};

export function clearAllTables() {
  getSqlite().exec(`
    DELETE FROM outbox_messages;
    DELETE FROM drafts;
    DELETE FROM policy_decisions;
    DELETE FROM classifications;
    DELETE FROM processing_jobs;
    DELETE FROM audit_logs;
    DELETE FROM messages;
    DELETE FROM threads;
    DELETE FROM scenarios;
    DELETE FROM knowledge_documents;
    DELETE FROM users;
    DELETE FROM mailboxes;
    DELETE FROM automation_profiles;
    DELETE FROM tone_profiles;
  `);
}
