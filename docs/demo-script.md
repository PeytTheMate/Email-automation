# Demo Script

## Goal

Show leadership that this is an inspectable local automation platform with a safe path toward Google Workspace production integration.

## Prep

1. Run `npm install`
2. Run `npm run seed`
3. Run `npm run dev`
4. Open [http://localhost:5173](http://localhost:5173)

## Recommended walkthrough

### 1. Start with the product framing

Say:

> This is a local-first email automation sandbox. It simulates repetitive inbox work safely, keeps business facts in structured local sources, and can later reuse the same core pipeline for Gmail.

### 2. Run the polished pack

- Click `Run Demo Pack`
- The dashboard resets the sandbox and moves into the replay-friendly state
- Switch to `Replay Lab`

Explain:

- every seeded demo scenario is replayed locally
- the lab shows expected vs actual intent, routing, and reply grounding
- this is a concrete regression surface, not just a pretty mockup

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
- Explain that nothing here sends real email

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
- Gmail and hosted model providers are scaffolded but intentionally disabled in local v1

## Operator notes during the demo

- `Inbox` is the operational review screen
- `Replay Lab` is the scenario scoring and QA screen
- `Outbox` proves what was mock-sent locally
- `Settings` shows that behavior is configuration-driven
- `Settings` is currently a read-only seeded configuration snapshot

## Talking points

- Rules run before models
- Facts come from structured data, not model memory
- Policy decides send eligibility
- The audit trail includes related message, draft, job, and outbox events for the selected message
- The same domain pipeline can later plug into Gmail
