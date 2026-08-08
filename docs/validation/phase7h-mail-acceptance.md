# Phase 7H Mail Acceptance

Status: not passed.

## Blocking Findings

- Public mail DNS still needs correction.
- DKIM was enabled in Hestia but not visible at `mail._domainkey.modula.digital`.
- SPF and DMARC had duplicate public TXT records.
- `mail.modula.digital` and `webmail.modula.digital` resolved to Cloudflare proxy IPs.
- Hestia mail SSL for `modula.digital` was disabled.
- No authenticated Greenfield SMTP relay is configured in repository state.
- Exim queue was large and needs operator triage before direct VPS delivery is trusted.

## Required Acceptance

1. Register a production-alpha test account.
2. Confirm verification mail arrives in Gmail inbox or a documented non-spam state.
3. Confirm verification mail arrives in Outlook/Hotmail inbox or a documented non-spam state.
4. Confirm verification mail arrives at one independent domain.
5. Confirm SPF pass.
6. Confirm DKIM pass.
7. Confirm DMARC pass.
8. Confirm TLS.
9. Confirm the verification link opens `/verify-email` and activates the account.
10. Use resend and confirm the prior token no longer verifies.
11. Request password reset and confirm the reset link opens `/reset-password`.
12. Complete reset and confirm password-changed mail.
13. Confirm mail queue summary has no unexpected dead letters.

## Evidence Rules

- Use dedicated test addresses.
- Do not include personal production email screenshots.
- Do not capture verification/reset tokens in evidence screenshots unless redacted.
- Record provider message IDs only from safe operator views.
