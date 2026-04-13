# Architecture Overview

## Design goals

This repository is designed as a platform-shaped local sandbox, not a throwaway prototype. The core pipeline is transport-agnostic and provider-driven so the same domain services can later be reused for Gmail ingestion, Gmail draft/send flows, and hosted model providers.

## High-level flow

```text
Manual paste / seeded scenario
  -> API ingest endpoint
  -> SQLite message + processing job
  -> Worker or manual process trigger
  -> Normalization
  -> Deterministic-first classification
  -> Structured knowledge retrieval
  -> Policy engine
  -> Draft generation
  -> Draft review or mock auto-send
  -> Local outbox + audit trail
```

## Repo responsibilities

### `apps/api`

Thin HTTP layer for:

- manual email ingest
- scenario replay
- processing triggers
- dashboard data
- draft approve/reject actions
- sandbox reset/seed

### `apps/worker`

Thin local worker loop that polls queued jobs and runs the shared pipeline from `packages/core`.

### `apps/web`

Dashboard UI for:

- inbox list
- email detail
- replay lab with expected-vs-actual scenario scoring
- intent/risk review
- grounded draft review
- audit trail
- outbox
- settings inspection

### `packages/schemas`

Zod schemas and shared domain types for:

- email messages/threads
- normalized email
- intent classification
- extracted entities
- policy decisions
- automation profiles
- tone profiles
- knowledge documents
- draft replies
- audit events
- mailbox/user settings
- processing jobs

### `packages/db`

SQLite schema, initialization, and typed repositories. This is the only layer that knows table structure directly.

### `packages/core`

Shared domain services:

- `normalize-email.ts`
- `classify-intent.ts`
- `retrieve-knowledge.ts`
- `apply-policy.ts`
- `generate-draft.ts`
- `process-email.ts`
- `review-draft.ts`
- `scenario-replay.ts`

### `packages/providers`

Swappable infrastructure adapters:

- `knowledge-local`: reads trusted local business data
- `model-local`: mock template provider plus an Ollama scaffold
- `send-local`: writes to the local outbox
- `email-local`: local provider shell
- `email-gmail`: phase 2 scaffold
- `model-remote`: phase 2 scaffold

### `packages/testing`

Seed/bootstrap helpers plus regression coverage for safety-critical paths.

## Safety boundaries

### Facts

The generator does not own business truth. Facts come only from `data/seed/knowledge/knowledge.json` through the local knowledge provider.

### Policy

Generation never decides whether a reply can send. Policy is applied first and generation only runs when the policy allows drafting.

### Local-only delivery

The send provider writes to the `outbox_messages` table only. No real SMTP or Gmail send path exists in local mode.

## Current intent taxonomy

- `business_hours_question`
- `location_question`
- `booking_question`
- `required_documents_question`
- `parking_question`
- `reschedule_request`
- `billing_question`
- `complaint`
- `unknown`

The closed taxonomy lives in `packages/schemas/src/index.ts`.

## Data-driven customization

Mailbox behavior is intentionally configuration-driven:

- mailboxes select default tone and automation profiles
- automation profiles define thresholds and approval mode
- tone profiles define approved voice and constraints
- knowledge documents define trusted facts
- user records provide a future path for employee-level overrides

## Database model

Core tables:

- `mailboxes`
- `users`
- `automation_profiles`
- `tone_profiles`
- `knowledge_documents`
- `scenarios`
- `threads`
- `messages`
- `classifications`
- `policy_decisions`
- `drafts`
- `outbox_messages`
- `audit_logs`
- `processing_jobs`

## Provider expansion path

### Gmail later

Add Gmail support by implementing the `EmailProvider` interface in `packages/providers/email-gmail` and keeping the current `packages/core` pipeline unchanged.

### Hosted models later

Add hosted models by implementing `ModelProvider` in `packages/providers/model-remote` and keeping policy/budget controls unchanged.

### Attachments later

Attachment metadata already exists as a placeholder in normalized email and message storage, so attachment parsing can plug into normalization and risk handling without changing dashboard shape.
