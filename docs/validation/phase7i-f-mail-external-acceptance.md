# Phase 7I-F Mail External Acceptance

Date: 2026-08-09
Repo: `/root/modula-latest`
Branch: `phase7i-trusted-production-alpha`
Commit: `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353`

## External Open-Relay Proof

Verdict: `BLOCKED`

The required proof is a true off-host SMTP test from another network or trusted external machine:

`unauthenticated external sender -> Modula SMTP -> unrelated external recipient -> REJECTED`

This was not completed from the current execution context. The current agent shell is on `core.modula.digital`, which is the mail host context, so any SMTP attempt from here would not satisfy the off-host requirement.

Required capture, once run from an external machine:

| Field | Value |
| --- | --- |
| Source context | `BLOCKED: no off-host machine/access available in this run` |
| SMTP host | `mail.modula.digital` |
| SMTP target DNS | `MX modula.digital -> mail.modula.digital`, `A mail.modula.digital -> 87.106.40.136` |
| Response code | `NOT_CAPTURED` |
| Timestamp | `NOT_CAPTURED` |
| Verdict | `BLOCKED` |

Do not advance Phase 7I-F public cutover until this row is replaced by a true off-host rejection result.

## Stale Exim Queue Orphan

Verdict: `PASS`

Queue inspection found one historical queue object:

| Field | Value |
| --- | --- |
| Message ID | `1w06zY-00000001f1H-3TuB` |
| Age | `152d` |
| Sender | `root@core.modula.digital` |
| Recipient domain category | local host recipient, `root@core.modula.digital` |
| Reason | local Exim paniclog notification from 2026-03-11; message log/body spool object was already missing |
| Archived metadata | `/var/backups/modula/mail/phase7i-f/20260809T122253Z/exim-orphan-1w06zY-00000001f1H-3TuB.metadata.txt` |

No message body was printed or archived.

Commands:

```sh
exim4 -bp
exim4 -Mvh 1w06zY-00000001f1H-3TuB
exim4 -Mrm 1w06zY-00000001f1H-3TuB
exim4 -bpc
```

Result:

```text
exim4 -bpc -> 0
exim4 -bp -> empty
```

`exim4 -Mrm` returned non-zero because the data spool object was already absent, but Exim removed the remaining header queue object. A follow-up queue count and queue listing confirmed zero queued messages.
