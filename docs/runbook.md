# Runbook

## Local setup

```bash
npm install
npm run seed
npm run dev
```

Open:

- Dashboard: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Recommended local demo commands

Start the stack:

```bash
npm run dev
```

Optional verification before a demo:

```bash
npm run build
npm run lint
npm test
curl http://localhost:4000/api/health
```

## Dashboard workflow

### Quick polished demo

1. Click `Run Demo Pack`.
2. Open `Replay Lab`.
3. Confirm the seeded scenarios show expected vs actual intent, routing, and reply-grounding results.
4. Use `Open Message` on `Where Are You Located?` or `Where Should I Park?` and show the grounded reply path.
5. Use `Open Message` on `What Time Do You Open Tomorrow?`, explain the `draft_only` policy, and approve the draft.
6. Open `Outbox` to show the local mock send.
7. Use `Open Message` on `I Need A Refund` or `Prompt Injection Email` and show the escalation path.

### Manual test flow

1. Paste a mock email in `Manual Inbox Simulator`.
2. Choose the acting user and optionally an existing thread ID.
3. Submit it.
4. If needed, click `Process Pending`.
5. Review the message in `Inbox`.
6. Approve or reject the draft.
7. Inspect `Outbox` for mock-delivered replies.

### Gmail demo pilot flow

1. Configure the Gmail and hosted-model env vars in `.env`.
2. Turn on `ENABLE_GMAIL_READ=true`.
3. Turn on `ENABLE_GMAIL_DRAFTS=true` if you want provider draft creation.
4. Turn on `ENABLE_GMAIL_SEND=true` only for allowlisted test recipients.
5. Select `Gmail Demo Pilot` in the dashboard.
6. Click `Sync Gmail Now`.
7. Open the synced message from the inbox.
8. Review the grounded draft.
9. Optionally click `Create Gmail Draft`.
10. Click `Approve & Send Live Reply` for a reviewed live send.

## Build, lint, and test

```bash
npm run build
npm run lint
npm test
```

## Where to make common changes

### Change business facts

Edit `data/seed/knowledge/knowledge.json`, then reseed:

```bash
npm run seed
```

### Change tone profiles

Edit `data/seed/tone-profiles/profiles.json`, then reseed.

### Change automation profiles or thresholds

Edit `data/seed/automation-profiles/profiles.json`, then reseed.

### Change mailbox defaults

Edit `data/seed/mailboxes.json` and optionally `data/seed/users.json`, then reseed.

### Add or update replay scenarios

Edit `data/seed/emails/scenarios.json`, then reseed and update tests if behavior changes.

### Add a new intent

1. Add the intent to `packages/schemas/src/index.ts`.
2. Update rules in `packages/core/src/services/classify-intent.ts`.
3. Add retrieval handling if it needs structured facts.
4. Update `packages/core/src/services/apply-policy.ts`.
5. Update draft shaping in `packages/providers/model-local/src/index.ts`.
6. Add or update tests.
7. Add a seeded scenario for the new path.

## Operational troubleshooting

### Drafts are not being generated

Check in order:

1. Was the message normalized?
2. Did classification return a supported intent?
3. Did retrieval return any facts?
4. Did policy route to `draft_only` or `auto_send_allowed`?
5. Did generation metadata show a grounded provider result?

Use the dashboard audit panel or inspect `audit_logs` in SQLite. The dashboard now aggregates related draft, job, and outbox events for the selected message.

### Safe FAQ unexpectedly escalates

Common causes:

- confidence below draft threshold
- `multiple_asks` risk flag
- missing knowledge document
- attachment or prompt-injection flag
- intent fell into `unknown`

### Mock auto-send did not happen

Check:

1. mailbox `allowMockAutoSend`
2. automation profile `approvalMode`
3. automation profile allowed auto-send intents
4. auto-send confidence threshold
5. risk flags and retrieval success

### Gmail sync returned nothing

Check:

1. `ENABLE_GMAIL_READ=true`
2. `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` are set
3. the selected mailbox is `gmail_test`
4. the Gmail account has the configured demo label
5. the sender is on the mailbox or env allowlist

### Gmail draft or send failed

Check:

1. `ENABLE_GMAIL_DRAFTS` or `ENABLE_GMAIL_SEND`
2. outbound recipient allowlist
3. selected mailbox live-delivery toggles
4. the message has a generated draft and was not escalated/blocked
5. the audit trail for `provider_draft_created` or live-send errors

### Message looks wrong factually

Check:

1. the retrieval event in the audit panel
2. the business facts in `data/seed/knowledge/knowledge.json`
3. the draft generator template in `packages/providers/model-local/src/index.ts`

### Worker seems idle

Check:

1. worker process is running
2. `processing_jobs` contains queued work
3. `npm run process:pending` works manually

### Reset the sandbox

Use the dashboard `Reset Sandbox` button or run:

```bash
npm run seed
```

For the curated showcase state, follow reset with `Run Demo Pack` in the UI.

## Swapping providers later

### Gmail provider

The current Gmail provider already supports polling sync, Gmail draft creation, and reviewed send. Extend it next with:

- label state reconciliation
- watch/history renewal
- richer MIME parsing
- more robust OAuth credential storage

### Local LLM provider

Set:

```bash
DEFAULT_MODEL_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

The core generator path already supports the provider interface. Keep policy unchanged.

### Hosted model provider

The current hosted model provider uses the Responses API shape and validates output before draft persistence. Preserve the same conservative checks when adding more providers.
