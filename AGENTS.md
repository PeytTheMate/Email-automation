# AGENTS.md

## Project mission

This repository is a local-first email automation sandbox for a Google Workspace business.
The current milestone must stay fully local, fully inspectable, and safe by default.

## Non-negotiable product rules

- Never send real email in local mode.
- Never let reply generation invent company facts.
- Never allow billing, complaint, unknown, prompt-injection, attachment-dependent, or other risky messages to auto-send.
- Keep provider boundaries explicit so Gmail and hosted model providers can be added later without rewriting the domain core.

## Architecture expectations

- Keep domain logic in `packages/core`.
- Keep typed schemas in `packages/schemas`.
- Keep storage concerns in `packages/db`.
- Keep transport/provider adapters in `packages/providers`.
- Treat `apps/api`, `apps/worker`, and `apps/web` as thin shells around the shared core.
- Prefer configuration-driven changes over mailbox-specific conditionals in code.

## Seeded business configuration

- Business facts live in `data/seed/knowledge/knowledge.json`.
- Tone profiles live in `data/seed/tone-profiles/profiles.json`.
- Automation profiles live in `data/seed/automation-profiles/profiles.json`.
- Mailboxes and user defaults live in `data/seed/mailboxes.json` and `data/seed/users.json`.
- Replay/demo scenarios live in `data/seed/emails/scenarios.json`.

## Local workflow

- Install dependencies with `npm install`.
- Seed local data with `npm run seed`.
- Run the full stack with `npm run dev`.
- Build with `npm run build`.
- Run tests with `npm test`.
- Run lint with `npm run lint`.

## Testing expectations

- Add or update unit tests when changing classification, retrieval, policy, or generation logic.
- Add or update integration tests when changing the end-to-end processing pipeline.
- If behavior changes for a seeded scenario, update both the scenario data and the corresponding regression coverage.

## Documentation expectations

When behavior or structure changes, update:

- `README.md`
- `docs/architecture.md`
- `docs/runbook.md`
- `docs/demo-script.md`
