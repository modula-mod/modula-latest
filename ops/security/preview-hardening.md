# Preview hardening checklist
- Postgres not published on host
- API bound to 127.0.0.1:4020
- Secrets only in `/etc/modula/`
- Wildcard CORS forbidden
- Preview writes disabled
- OpenAPI UI disabled in production/preview
