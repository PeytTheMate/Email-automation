# Demo Script

## Goal

Show leadership that this is an inspectable automation platform with both a safe local sandbox and a reviewed Gmail pilot path.

## Prep

1. Run `npm install`
2. Run `npm run seed`
3. Run `npm run dev`
4. Open [http://localhost:5173](http://localhost:5173)

### Optional Gmail pilot prep

If you want to show the live Gmail path:

1. Set the Gmail OAuth env vars in `.env`
2. Set the hosted model vars for Gemini in `.env`
3. Set `ENABLE_REMOTE_MODELS=true`
4. Set `ENABLE_GMAIL_READ=true`
5. Set `ENABLE_GMAIL_DRAFTS=true`
6. Set `ENABLE_GMAIL_SEND=true`
7. Update `data/seed/mailboxes.json` with the real Gmail demo address and reseed
8. Keep the `Gmail Demo Pilot` mailbox restricted to alt/test accounts
9. Send the demo email from a different mailbox because sync excludes self-sent mail

## Recommended walkthrough

### 1. Start with the product framing

Say:

> This starts as a safe local-first sandbox, but the same core pipeline can now also power a reviewed Gmail pilot mailbox with explicit provider controls and auditability.

### 2. Run the polished pack

- Click `Run Demo Pack`
- The dashboard resets the sandbox and moves into the replay-friendly state
- Switch to `Replay Lab`

Explain:

- every seeded demo scenario is replayed locally
- the lab shows expected vs actual intent, routing, and reply grounding
- this is a concrete regression surface, not just a pretty mockup

### 2b. Optional Gmail live pass

If the Gmail pilot is configured:

1. Select `Gmail Demo Pilot`
2. Click `Sync Gmail Now`
3. Open the synced inbox item
4. Show the external provider metadata and risk/policy trace
5. Click `Create Gmail Draft`
6. Click `Approve & Send Live Reply`
7. Switch to `Delivery Log` and point out the provider status plus external IDs

### 2a. Exact click path for the showcase

Use this order if you want a smooth 3 to 5 minute demo:

1. Click `Run Demo Pack`
2. In `Replay Lab`, point to the passing safe scenarios and the intentionally escalated risky scenarios
3. Click `Open Message` on `Where Are You Located?`
4. Click `Open Message` on `What Time Do You Open Tomorrow?`
5. Click `Approve & Send`
6. Open `Outbox`
7. Return to `Replay Lab`
8. Click `Open Message` on `I Need A Refund` or `Prompt Injection Email`

### 3. Show the inbox simulator

- Point out the manual paste form
- Point out the seeded scenario selector and `Load Into Composer`
- Explain that local mailboxes never send real email and that Gmail send is separately gated

### 4. Replay or open a safe FAQ

Use one of:

- `Where Are You Located?`
- `Where Should I Park?`

Show:

- intent classification
- trusted retrieved address
- policy decision
- mock auto-send into the local outbox

### 5. Show a draft-only review case

Use:

- `What Time Do You Open Tomorrow?`

Show:

- normalized email
- thread and acting-user context
- detected intent
- grounded business-hours fact
- draft in the selected tone profile
- approve/send into the local outbox

### 6. Show a risky message

Use one of:

- `I Need A Refund`
- `Upset With Service`
- `Prompt Injection Email`

Show:

- escalation decision
- no unsupported draft
- audit trail explaining why the system refused to automate it

## What each recommended scenario proves

- `Where Are You Located?`: grounded fact retrieval plus safe mock auto-send
- `Where Should I Park?`: another grounded FAQ with approved structured knowledge
- `What Time Do You Open Tomorrow?`: draft-only policy with human approval still required
- `I Need A Refund`: billing language routes to escalation
- `Prompt Injection Email`: adversarial language is flagged and prevented from automation

## If something looks off during the demo

- Click `Run Demo Pack` again to restore the curated local showcase state
- If you want a manual recovery path, click `Reset Sandbox` and then `Run Demo Pack`
- If you changed seed files, rerun `npm run seed` before starting the stack again

### 7. Show settings and extensibility

Explain:

- tone profiles are config-driven
- automation thresholds are config-driven
- business facts come from local structured files
- mailbox bindings decide which documents can be used for a given mailbox
- Gmail and hosted model providers are implemented but feature-flagged and allowlist-gated for the pilot

## Operator notes during the demo

- `Inbox` is the operational review screen
- `Replay Lab` is the scenario scoring and QA screen
- `Delivery Log` proves whether a reply was mock-sent, drafted in Gmail, or sent live
- `Settings` shows that behavior is configuration-driven
- `Settings` is currently a read-only seeded configuration snapshot

## Talking points

- Rules run before models
- Facts come from structured data, not model memory
- Policy decides send eligibility
- The audit trail includes related message, draft, job, and outbox events for the selected message
- The same domain pipeline serves both local sandbox and Gmail pilot modes
