# Phase 6S — VPS Agent Instructions

Copy everything below the line into the VPS Agent.

---

## Role

You are the Phase 6S **PART 4 VPS agent**.

| Item | Value |
| --- | --- |
| Repository | `/home/andrei/modula-latest` |
| Branch | `phase6s-social-product-completion` |
| Product API | `https://api.modula.digital` |
| Mac tip context | Parts 1–3 complete on GitHub; PART 4 deferred for VPS |
| Base branch constraint | Do **not** merge Phase 6R |
| Main constraint | Do **not** merge to `main` |

### Permanent constraints

- AT Protocol remains optional (not required).
- DIMON remains inactive (no balances, no fake wallets).
- No arbitrary code execution / `eval` / untrusted GitHub execution.
- Do not weaken test gates.
- Do not classify broken behaviour as expected without evidence.
- Do not redesign the product while fixing deploy/migrate issues.
- Do not modify frontend product directories on the VPS except validation docs.
- Do not restore backups onto the active production database.
- Never commit secrets, passwords, or raw verification/recovery tokens.

---

## PART 4 — Execution order

Follow this order exactly.

### 1. Sync branch

```bash
cd /home/andrei/modula-latest
git fetch origin --prune
git switch phase6s-social-product-completion
git pull --ff-only origin phase6s-social-product-completion
git status --short
git rev-parse HEAD
git log --oneline --decorate -10
```

Requirements:

- Working tree must be clean before migrate/deploy.
- If dirty with unrelated changes, stop and report.

### 2. Install and migrate

```bash
pnpm install --frozen-lockfile
pnpm --filter @modula/greenfield-api db:status
pnpm --filter @modula/greenfield-api db:migrate
pnpm --filter @modula/greenfield-api db:status
```

Confirm after migrate:

- existing accounts preserved
- existing posts preserved
- reaction / comment / repost / quote / save / appearance / extension tables present
- counts initialised correctly
- appearance defaults created where required
- extension catalogue seeded
- no duplicate social rows

If migrate fails, stop. Do not force-rollback production without evidence.

### 3. Controlled seed

```bash
pnpm --filter @modula/greenfield-api db:seed
```

Seed only non-secret Phase 6S fixtures:

- multiple public posts
- text / media / link / quote / repost / deleted post
- multiple reactions
- top-level comments
- nested replies
- deleted comment tombstone
- notifications
- saved posts (private)
- extension states
- plugin failure example
- function job example

Do not seed personal secrets.

### 4. Restore API health

`https://api.modula.digital` previously returned **502** from Mac.

Restart / repair Greenfield API + Worker (+ Postgres/nginx as needed) until:

```bash
curl -fsS https://api.modula.digital/v1/meta
```

succeeds and reports Greenfield preview behaviour:

- backend is Greenfield
- AT is not required
- DIMON is inactive

If still unhealthy, inspect logs, fix, and retest. Do not invent PASS.

### 5. Full live API acceptance

Test against the live preview API (use invite/admin verification path if SMTP is still unavailable):

**Account**

- Registration
- Verification
- Sign-in
- Session refresh
- Password recovery / reset
- Session revocation after reset

**Posts / social**

- Create post
- React
- Change reaction
- Remove reaction
- Comment
- Reply
- Edit comment
- Delete comment (tombstone when replies exist)
- Repost
- Quote
- Save (private)
- Follow
- Notifications
- Search
- Profile edit
- Appearance update (`GET/PATCH /v1/accounts/me/appearance`)

**Extensions / functions**

- Extension install
- Enable
- Disable
- Uninstall
- Plugin failure isolation
- Function invoke
- Function cancel

Validate critical counts directly in PostgreSQL where required.

Rules:

- Saves remain private
- No self-notifications
- Reaction counters must match source rows
- Quoted private/unavailable content must not leak

### 6. Isolated backup restoration (mandatory)

Complete and fill:

`docs/validation/phase6s-backup-restore.md`

Procedure:

1. Create fresh production backup.
2. Record size + SHA-256 checksum.
3. Create isolated PostgreSQL restore target.
4. Restore backup into that isolated target only.
5. Run migrate/status against restore target if required.
6. Verify account count, post count, reaction count, comment count.
7. Verify event hash chains.
8. Verify checkpoints.
9. Verify extension installations.
10. Start Greenfield API against restored database.
11. Run smoke tests.
12. Capture evidence in the doc.
13. Destroy isolated restore environment after evidence is captured.

Hard rule: never restore against the active production database.  
Hard rule: no database passwords in the document.

### 7. Extension failure isolation

Prove:

- plugin throws during enable
- plugin times out
- function returns invalid payload
- function exceeds timeout
- connector/tool failure cases as available

Expected:

- Greenfield API remains ready
- Greenfield Worker continues
- extension becomes failed/disabled
- failure is recorded
- user receives safe error
- retry is controlled

### 8. VPS integrated validation

```bash
pnpm install --frozen-lockfile
pnpm --filter @modula/greenfield-api typecheck
pnpm --filter @modula/greenfield-api test
pnpm --filter @modula/greenfield-api build
pnpm --filter @modula/greenfield-worker typecheck
pnpm --filter @modula/greenfield-worker test
pnpm --filter @modula/greenfield-worker build
pnpm verify:phase6-greenfield-backend
pnpm verify:phase6-greenfield-frontend
pnpm verify:phase6s-social-backend
pnpm verify:phase6s-social-frontend
pnpm exec expo export --platform web
git diff --check
```

All must PASS, or be reported FAIL with logs. Do not weaken gates.

### 9. Commit and push evidence

Update:

- `docs/validation/phase6s-backup-restore.md`
- `docs/validation/phase6s-final-acceptance.md` (PART 4 results)

Then:

```bash
git add docs/validation/phase6s-backup-restore.md docs/validation/phase6s-final-acceptance.md
git commit -m "docs: record Phase 6S VPS migrate seed and backup restore"
git push origin phase6s-social-product-completion
```

If deploy/config changes are required:

- keep them minimal
- document them
- never commit secrets

### 10. Hand back to Mac Agent

Report exactly:

1. HEAD SHA
2. migrate result
3. whether `https://api.modula.digital/v1/meta` is healthy
4. live acceptance PASS/FAIL list
5. backup restore PASS/FAIL + doc filled
6. plugin isolation PASS/FAIL
7. verifier results
8. remaining blockers for physical iPhone / TestFlight

Mac continues PART 5 only after:

- API is healthy
- backup restore is evidenced
- PART 4 validation commands pass

---

## Hard stops

Stop and report if any of these occur:

- dirty unrelated working tree
- production DB used as restore target
- secrets about to be committed
- verifier failures that cannot be fixed honestly
- temptation to mark blocked checks as PASS
- request to merge Phase 6R or merge to `main` before PART 4–5 gates pass
