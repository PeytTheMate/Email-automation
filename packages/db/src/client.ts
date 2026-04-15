import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getConfig } from "../../config/src/index.js";
import * as schema from "./schema.js";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let sqlite: Database.Database | null = null;
let db: DbClient | null = null;

function ensureColumn(database: Database.Database, tableName: string, columnName: string, definition: string) {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function resolveDatabasePath(databaseUrl: string): string {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  return resolve(process.cwd(), databaseUrl);
}

export function getSqlite() {
  if (!sqlite) {
    const config = getConfig();
    const path = resolveDatabasePath(config.DATABASE_URL);

    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
  }

  return sqlite;
}

export function getDb() {
  if (!db) {
    db = drizzle(getSqlite(), { schema });
  }

  return db;
}

export function resetDbClient() {
  sqlite?.close();
  sqlite = null;
  db = null;
}

export function initializeDatabase() {
  const database = getSqlite();

  database.exec(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      email_address TEXT,
      provider_mode TEXT NOT NULL,
      connection_mode TEXT NOT NULL DEFAULT 'local_sandbox',
      gmail_mailbox_address TEXT,
      gmail_label_filter TEXT,
      allowed_sender_patterns_json TEXT NOT NULL DEFAULT '[]',
      allowed_outbound_recipient_patterns_json TEXT NOT NULL DEFAULT '[]',
      enable_live_read INTEGER NOT NULL DEFAULT 0,
      enable_live_drafts INTEGER NOT NULL DEFAULT 0,
      enable_live_send INTEGER NOT NULL DEFAULT 0,
      default_model_provider TEXT NOT NULL DEFAULT 'mock',
      gmail_history_id TEXT,
      default_tone_profile_id TEXT NOT NULL,
      default_automation_profile_id TEXT NOT NULL,
      escalation_target TEXT NOT NULL,
      allow_mock_auto_send INTEGER NOT NULL DEFAULT 0,
      enabled_intents_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      mailbox_id TEXT NOT NULL,
      tone_profile_override_id TEXT,
      automation_profile_override_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS automation_profiles (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      approval_mode TEXT NOT NULL,
      allowed_auto_send_intents_json TEXT NOT NULL,
      blocked_intents_json TEXT NOT NULL,
      confidence_threshold_draft REAL NOT NULL,
      confidence_threshold_auto_send REAL NOT NULL,
      feature_flags_json TEXT NOT NULL,
      max_reply_sentences INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tone_profiles (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      greeting_style TEXT NOT NULL,
      closing_style TEXT NOT NULL,
      style_rules_json TEXT NOT NULL,
      approved_closings_json TEXT NOT NULL,
      forbidden_phrases_json TEXT NOT NULL,
      signature_template TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      intent TEXT,
      mailbox_keys_json TEXT NOT NULL DEFAULT '[]',
      content_type TEXT NOT NULL,
      content_json TEXT NOT NULL,
      source TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      scenario_type TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      expected_intent TEXT NOT NULL,
      expected_decision TEXT NOT NULL,
      expected_reply_contains_json TEXT NOT NULL,
      demo_ready INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      latest_message_id TEXT NOT NULL,
      provider_name TEXT NOT NULL DEFAULT 'local-email-sandbox',
      external_thread_id TEXT,
      latest_external_history_id TEXT,
      current_intent TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      scenario_id TEXT,
      thread_id TEXT NOT NULL,
      actor_user_id TEXT,
      source_message_key TEXT,
      provider_name TEXT NOT NULL DEFAULT 'local-email-sandbox',
      external_message_id TEXT,
      external_thread_id TEXT,
      external_history_id TEXT,
      sender_email TEXT NOT NULL,
      sender_name TEXT,
      recipients_json TEXT NOT NULL,
      cc_recipients_json TEXT NOT NULL,
      subject TEXT NOT NULL,
      raw_body TEXT NOT NULL,
      normalized_body_text TEXT,
      stripped_quoted_text TEXT,
      attachment_metadata_json TEXT NOT NULL,
      language TEXT,
      received_at TEXT NOT NULL,
      status TEXT NOT NULL,
      processing_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classifications (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      intent TEXT NOT NULL,
      confidence REAL NOT NULL,
      secondary_intents_json TEXT NOT NULL,
      extracted_entities_json TEXT NOT NULL,
      risk_flags_json TEXT NOT NULL,
      reasoning_summary TEXT NOT NULL,
      provider_used TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policy_decisions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      classification_id TEXT NOT NULL,
      action TEXT NOT NULL,
      allow_mock_auto_send INTEGER NOT NULL DEFAULT 0,
      rationale TEXT NOT NULL,
      triggered_rules_json TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      escalation_target TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      tone_profile_id TEXT NOT NULL,
      provider_name TEXT NOT NULL DEFAULT 'internal-draft',
      external_draft_id TEXT,
      external_message_id TEXT,
      retrieved_fact_keys_json TEXT NOT NULL,
      confidence_note TEXT NOT NULL,
      generation_metadata_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox_messages (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      draft_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      external_draft_id TEXT,
      external_message_id TEXT,
      delivery_status TEXT NOT NULL,
      failure_reason TEXT,
      operator_user_id TEXT,
      sent_at TEXT NOT NULL,
      delivery_mode TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processing_jobs (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_retry_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn(database, "knowledge_documents", "mailbox_keys_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, "mailboxes", "connection_mode", "TEXT NOT NULL DEFAULT 'local_sandbox'");
  ensureColumn(database, "mailboxes", "gmail_mailbox_address", "TEXT");
  ensureColumn(database, "mailboxes", "gmail_label_filter", "TEXT");
  ensureColumn(database, "mailboxes", "allowed_sender_patterns_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, "mailboxes", "allowed_outbound_recipient_patterns_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, "mailboxes", "enable_live_read", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "mailboxes", "enable_live_drafts", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "mailboxes", "enable_live_send", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "mailboxes", "default_model_provider", "TEXT NOT NULL DEFAULT 'mock'");
  ensureColumn(database, "mailboxes", "gmail_history_id", "TEXT");
  ensureColumn(database, "messages", "actor_user_id", "TEXT");
  ensureColumn(database, "messages", "source_message_key", "TEXT");
  ensureColumn(database, "messages", "provider_name", "TEXT NOT NULL DEFAULT 'local-email-sandbox'");
  ensureColumn(database, "messages", "external_message_id", "TEXT");
  ensureColumn(database, "messages", "external_thread_id", "TEXT");
  ensureColumn(database, "messages", "external_history_id", "TEXT");
  ensureColumn(database, "threads", "provider_name", "TEXT NOT NULL DEFAULT 'local-email-sandbox'");
  ensureColumn(database, "threads", "external_thread_id", "TEXT");
  ensureColumn(database, "threads", "latest_external_history_id", "TEXT");
  ensureColumn(database, "policy_decisions", "escalation_target", "TEXT");
  ensureColumn(database, "drafts", "provider_name", "TEXT NOT NULL DEFAULT 'internal-draft'");
  ensureColumn(database, "drafts", "external_draft_id", "TEXT");
  ensureColumn(database, "drafts", "external_message_id", "TEXT");
  ensureColumn(database, "outbox_messages", "provider_name", "TEXT NOT NULL DEFAULT 'local-outbox'");
  ensureColumn(database, "outbox_messages", "external_draft_id", "TEXT");
  ensureColumn(database, "outbox_messages", "external_message_id", "TEXT");
  ensureColumn(database, "outbox_messages", "delivery_status", "TEXT NOT NULL DEFAULT 'sent'");
  ensureColumn(database, "outbox_messages", "failure_reason", "TEXT");
  ensureColumn(database, "outbox_messages", "operator_user_id", "TEXT");
  ensureColumn(database, "processing_jobs", "next_retry_at", "TEXT");
  ensureColumn(database, "scenarios", "replay_received_at", "TEXT");
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_source_message_key ON messages(source_message_key) WHERE source_message_key IS NOT NULL;"
  );
}
