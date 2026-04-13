# Email Automation Sandbox

Local-first email automation sandbox for a Google Workspace business. V1 runs entirely on a developer laptop, keeps all business facts in structured local data, and routes risky messages conservatively into draft or escalation paths.

## What this ships

- Local inbox simulator for pasted emails and replayable scenarios
- Deterministic-first intent classification with a pluggable local model provider layer
- Structured local knowledge retrieval for hours, location, booking, required documents, and parking
- Conservative policy engine with `auto_send_allowed`, `draft_only`, `escalate`, and `blocked`
- Config-driven tone profiles, automation profiles, mailbox settings, and user defaults
- Review dashboard for inbox, email detail, grounded draft review, audit trail, settings, and local outbox
- SQLite-backed state with a separate API shell, worker shell, and shared core domain logic
- Unit and integration tests for the main safety-critical paths

## Stack

- Frontend: React + Vite
- Backend API: Fastify + TypeScript
- Worker: TypeScript polling worker
- Database: SQLite
- Validation: Zod
- Persistence: typed repository layer on top of SQLite tables
- Testing: Vitest

## Repository layout

```text
apps/
  api/      Fastify API for dashboard, ingestion, replay, review, and settings
  web/      React dashboard
  worker/   Local processing worker
  cli/      Replay and processing helpers
packages/
  config/   Environment parsing
  schemas/  Shared typed domain schemas
  db/       SQLite schema and repositories
  core/     Normalization, classification, retrieval, policy, generation, review
  providers/
    email-local/
    email-gmail/
    knowledge-local/
    model-local/
    model-remote/
    send-local/
  testing/  Seed/bootstrap helpers and regression tests
data/seed/  Business facts, tone profiles, automation profiles, mailboxes, users, scenarios
docs/       Architecture, runbook, and demo guidance
```

## Quick start

1. Copy `.env.example` to `.env` if you want to override defaults.
2. Install dependencies:

```bash
npm install
```

3. Seed the local sandbox database:

```bash
npm run seed
```

4. Start the full stack:

```bash
npm run dev
```

5. Open the dashboard:

- Web UI: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Useful commands

```bash
npm run seed
npm run dev
npm run build
npm run lint
npm test
npm run replay -- open-tomorrow
npm run process:pending
```

## Optional Docker workflow

```bash
docker compose build
docker compose run --rm api npm run seed
docker compose up
```

## Local demo flow

1. Click `Run Demo Pack` in the top-right of the dashboard. This resets the sandbox, replays the demo-ready seeded scenarios using stable timestamps, and moves you into a clean showcase state.
2. Open the `Replay Lab` tab and confirm the safe, escalation, and adversarial scenarios show expected vs actual intent, routing, and reply-grounding results.
3. Use `Open Message` on `Where Are You Located?` or `Where Should I Park?` to show a grounded FAQ response that is safe enough for mock auto-send.
4. Use `Open Message` on `What Time Do You Open Tomorrow?` to show the draft-only review path and then click `Approve & Send`.
5. Switch to `Outbox` to prove the mock-approved reply persisted locally.
6. Open `I Need A Refund`, `Upset With Service`, or `Prompt Injection Email` to show conservative escalation with no unsupported reply.

See `docs/demo-script.md` for a polished walkthrough.

## How to use the app

### Run a polished boss demo

1. Click `Run Demo Pack`.
2. Open `Replay Lab`.
3. Show that the demo-ready scenarios pass and that the app is comparing expected vs actual intent, routing, and reply grounding.
4. Click `Open Message` on `Where Are You Located?` or `Where Should I Park?` to jump into the inbox review view.
5. Click `Open Message` on `What Time Do You Open Tomorrow?`, explain the `draft_only` policy, and use `Approve & Send`.
6. Click `Open Message` on `I Need A Refund` or `Prompt Injection Email` and show the escalation decision plus audit trail.

### Test a custom email manually

1. In `Manual Inbox Simulator`, choose a mailbox and acting user.
2. Paste a subject and body.
3. Optionally enter an existing thread ID to continue a thread.
4. Click `Submit Mock Email`.
5. The API ingests the message and immediately processes it through normalization, classification, retrieval, policy, and draft generation.
6. Review the detail pane and, if a draft was created, approve or reject it.

### Replay specific scenarios

1. In `Scenario Controls`, select one or more seeded scenarios.
2. Click `Replay Selected`.
3. Switch to `Replay Lab` to compare expected vs actual outcomes.
4. Use `Load Into Composer` if you want to tweak a seeded scenario and rerun it manually.

## Where to change things

- Business facts and mailbox bindings: `data/seed/knowledge/knowledge.json`
- Tone profiles: `data/seed/tone-profiles/profiles.json`
- Automation policies and thresholds: `data/seed/automation-profiles/profiles.json`
- Mailbox defaults: `data/seed/mailboxes.json`
- Replay scenarios: `data/seed/emails/scenarios.json`
- Intent taxonomy and heuristics: `packages/schemas/src/index.ts` and `packages/core/src/services/classify-intent.ts`
- Policy logic: `packages/core/src/services/apply-policy.ts`
- Draft shaping: `packages/providers/model-local/src/index.ts`

## Verification status

The current implementation has been verified with:

- `npm run build`
- `npm run lint`
- `npm test`
- API startup and `/api/health` response locally

## Current scope notes

- The `Settings` tab is a read-only seeded configuration snapshot, not a live admin editor yet.
- The audit trail includes related message, draft, job, and outbox events for the selected message.
- Local bootstrap only supports `DEFAULT_EMAIL_PROVIDER=local`, `DEFAULT_SEND_PROVIDER=local`, and `DEFAULT_MODEL_PROVIDER=mock|ollama`.

## Phase 2 ideas

- Gmail message ingestion and watch handling
- Gmail draft and send providers
- Role-based mailbox and employee settings UI
- Attachment parsing
- Richer workflow automations and CRM/calendar integrations
- Remote model providers behind the same current policy/budget boundaries
