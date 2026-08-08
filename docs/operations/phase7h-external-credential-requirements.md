# Phase 7H External Credential Requirements

Date: 2026-08-08
Purpose: define the minimum external credentials needed for clean-host Alpha launch.

Do not put credential values in this file or in Git.

## Transactional SMTP Provider

The worker mail subsystem needs only SMTP delivery credentials, not broad provider account access.

Required from the selected provider:

- SMTP hostname
- SMTP port
- SMTP username
- SMTP password or API SMTP credential
- Required transport security mode
- Verified sender identity requirement
- Allowed sender address, expected to include `no-reply@modula.digital`
- DKIM DNS records supplied by the provider
- SPF include or mechanism supplied by the provider, if any
- Return-path or bounce-domain requirement, if any
- Provider rate limits or sandbox restrictions
- Test-recipient restrictions, if the account begins in sandbox mode

## Cloudflare DNS Deployment

Required credential:

- one least-privilege API token scoped to DNS management for the `modula.digital` zone.

Minimum expected scope:

- `Zone -> Zone -> Read`
- `Zone -> DNS -> Edit`
- resource limited to the specific `modula.digital` zone

Do not use the Global API key.

## GitHub Deployment

Required credential:

- scoped deploy key, GitHub App credential, or environment-scoped deployment token for clean-host repository clone/deploy.

It must not be a founder personal token with broad account permissions.

## Object Storage

Required only if user media/module artifacts are stored outside local disk:

- endpoint
- bucket/container names
- access key identifier
- secret access key supplied outside Git
- region
- least-privilege policy summary

## AI Provider Keys

Required only for explicitly enabled hosted-provider smoke tests or production AI features.

Do not provide these for the clean-host infrastructure gate unless the specific verifier needs them. Hosted provider smoke tests must remain opt-in.
