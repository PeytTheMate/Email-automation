# Email Automation Platform

Dual-mode email automation platform for a Google Workspace business. The repo now supports a safe local sandbox by default and a tightly gated Gmail demo pilot mode for one reviewed mailbox at a time.

## What this ships

- Dual-mode mailbox operation: `local_sandbox` and `gmail_test`
- Local inbox simulator for pasted emails and replayable scenarios
- Gmail polling sync for allowlisted demo mailboxes
- Deterministic-first intent classification with pluggable local and hosted model provider layers
- Structured local knowledge retrieval for hours, location, booking, required documents, and parking
- Conservative policy engine with `auto_send_allowed`, `draft_only`, `escalate`, and `blocked`
- Config-driven tone profiles, automation profiles, mailbox settings, user defaults, allowlists, and provider controls
- Review dashboard for inbox, email detail, Gmail sync, grounded draft review, audit trail, settings, and delivery log
- SQLite-backed state with a separate API shell, worker shell, and shared core domain logic
- Real Gmail draft creation and reviewed send paths behind feature flags
- Unit and integration tests for the main safety-critical paths, including Gmail/provider regressions

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

## Runtime modes

### Local sandbox

- default seeded path
- supports replay, manual paste, local outbox, and mock auto-send for safe FAQ scenarios
- safest mode for development and leadership demos

### Gmail demo pilot

- seeded as `Gmail Demo Pilot`
- requires Gmail OAuth refresh-token env vars plus `ENABLE_GMAIL_READ`, `ENABLE_GMAIL_DRAFTS`, and `ENABLE_GMAIL_SEND`
- supports hosted draft generation through either the OpenAI-compatible Responses path or the Gemini `generateContent` API key path
- only syncs and sends for allowlisted test senders/recipients
- supports `Sync Gmail Now`, `Create Gmail Draft`, and reviewed live send from the UI

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

## Gmail demo setup

1. Update `data/seed/mailboxes.json` so `mailbox-gmail-demo.gmailMailboxAddress` matches your real Gmail test mailbox.
2. Keep the seeded `mailbox-gmail-demo` mailbox on a dedicated Gmail test account and the `codex-demo` label, or change the label there and reseed.
3. Fill in the Gmail and remote-model variables in `.env`.
4. Turn on the Gmail feature flags you need:

```bash
ENABLE_GMAIL_READ=true
ENABLE_GMAIL_DRAFTS=true
ENABLE_GMAIL_SEND=true
ENABLE_REMOTE_MODELS=true
```

5. For Gemini API-key usage, set:

```bash
REMOTE_MODEL_PROVIDER=gemini
REMOTE_MODEL_BASE_URL=https://generativelanguage.googleapis.com/v1beta
REMOTE_MODEL_NAME=gemini-2.5-flash
GEMINI_API_KEY=your_gemini_api_key
```

You can also use `REMOTE_MODEL_API_KEY` instead of `GEMINI_API_KEY`.

6. Reseed with `npm run seed`.
7. Start the stack with `npm run dev`.
8. Send a labeled test email from a different account. Gmail sync skips messages sent from the mailbox itself.
9. In the dashboard, select `Gmail Demo Pilot` and click `Sync Gmail Now`.
10. Review the generated reply, optionally click `Create Gmail Draft`, then use `Approve & Send Live Reply`.

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
- Gmail adapter unit coverage
- hosted-model validation coverage

## Current scope notes

- The `Settings` tab is a read-only seeded configuration snapshot, not a live admin editor yet.
- The audit trail includes related message, draft, job, and outbox events for the selected message.
- Gmail uses polling-first sync and env-provided OAuth credentials for the first pilot.
- Gemini API-key support uses the official Google AI `generateContent` endpoint for hosted generation.
- Live Gmail send remains review-only; unattended live auto-send is still intentionally out of scope.

## Phase 2 ideas

- Gmail watch / history-driven sync instead of polling
- Role-based mailbox and employee settings UI
- Attachment parsing
- Richer workflow automations and CRM/calendar integrations
- stronger secrets management, RBAC, and regulated-data controls
