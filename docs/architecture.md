# Architecture Overview

## Design goals

This repository is designed as a platform-shaped local sandbox plus Gmail demo pilot, not a throwaway prototype. The core pipeline is transport-agnostic and provider-driven so the same domain services can run local replay/manual flows and a reviewed Gmail mailbox flow.

## High-level flow

```text
Manual paste / seeded scenario / Gmail sync
  -> API ingest or Gmail sync endpoint
  -> SQLite message + processing job
  -> Worker or manual process trigger
  -> Normalization
  -> Deterministic-first classification
  -> Structured knowledge retrieval
  -> Policy engine
  -> Draft generation
  -> Draft review / provider draft / reviewed send
  -> Delivery log + audit trail
```

## Repo responsibilities

### `apps/api`

Thin HTTP layer for:

- manual email ingest
- Gmail sync trigger
- scenario replay
- processing triggers
- dashboard data
- provider draft creation
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
- `model-local`: mock template provider plus an Ollama local runtime adapter
- `send-local`: writes to the local outbox
- `email-local`: local provider shell
- `email-gmail`: polling sync plus Gmail draft/send adapter for the reviewed pilot
- `model-remote`: hosted model provider with output validation and grounding guards

### `packages/testing`

Seed/bootstrap helpers plus regression coverage for safety-critical paths.

## Safety boundaries

### Facts

The generator does not own business truth. Facts come only from `data/seed/knowledge/knowledge.json` through the local knowledge provider.

### Policy

Generation never decides whether a reply can send. Policy is applied first and generation only runs when the policy allows drafting.

### Delivery boundaries

- In `local_sandbox`, delivery writes only to `outbox_messages`.
- In `gmail_test`, Gmail draft/send is allowed only when the mailbox enables it and the recipient matches the configured allowlist.
- Live Gmail auto-send is intentionally disabled. Reviewed send is the only live delivery mode in this milestone.

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
- mailboxes choose connection mode and default model provider
- mailboxes hold Gmail label filters, allowlists, and live delivery toggles
- automation profiles define thresholds and approval mode
- tone profiles define approved voice and constraints
- knowledge documents define trusted facts
- user records provide employee-level overrides and operator attribution

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

Notable stored metadata additions:

- mailbox Gmail sync cursor / history ID
- external provider message/thread IDs
- external draft/sent IDs for delivery reconciliation
- provider name and delivery status on outbox records

## Provider expansion path

### Gmail now

The current Gmail implementation is polling-first and uses env-backed OAuth refresh credentials. It is intentionally narrow:

- one reviewed mailbox at a time
- label-filtered sync
- allowlisted inbound senders
- allowlisted outbound recipients
- reviewed draft/send only

### Hosted models now

The current hosted model path runs behind `ENABLE_REMOTE_MODELS` and validates output before draft persistence:

- no unsupported URLs
- no forbidden tone phrases
- sentence-count cap
- no generation when facts are missing

### Attachments later

Attachment metadata already exists as a placeholder in normalized email and message storage, so attachment parsing can plug into normalization and risk handling without changing dashboard shape.
