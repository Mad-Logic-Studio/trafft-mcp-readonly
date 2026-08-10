# Validated Remote Admin & Automation Patterns

> Public, redacted engineering findings. This document intentionally omits tenant names, customer data, account identifiers, deployment URLs, secret values, and company-specific business logic.

## Why this document exists

The original project was intentionally hardened as a read-only Trafft MCP server. Subsequent work tested how a read-only booking MCP can evolve into a governed operational integration without turning an LLM client into an unrestricted admin console.

The result is a reusable pattern: keep broad read access separate from narrow, explicitly authorized write access; authenticate the write surface with OAuth; add server-side authorization and an independent audit trail; and use webhooks/events for lifecycle automation rather than relying on conversational polling alone.

## What has been validated

The following architecture has been validated in a controlled downstream deployment derived from this repository's hardened patterns:

1. A remote Streamable HTTP MCP can expose a stable read-only Trafft tool surface to a hosted MCP client.
2. A separate admin MCP can be protected with OAuth 2.1 instead of sharing the read-only access path.
3. The OAuth identity can be checked against a server-side administrator allowlist before any write tool is exposed or executed.
4. A write tool can require an exact explicit confirmation value in addition to client-side approval controls.
5. The write transport can enforce a path/method allowlist so only reviewed mutation contracts are reachable.
6. Non-idempotent writes can be configured with no automatic retries, avoiding accidental duplication after ambiguous upstream failures.
7. Metadata-only audit events can record both the attempt and final outcome without storing customer names, email addresses, or request bodies.
8. A controlled customer-create smoke test completed successfully through the full chain: MCP client -> OAuth -> admin MCP -> server-side authorization -> Trafft API -> audit trail.

This validation does **not** mean every Trafft mutation is safe or supported. Each additional mutation still requires its own exact current contract review and controlled test.

## Recommended split: reader vs. operator

### Read MCP

Use a broad, low-risk read-only MCP for day-to-day inspection:

- services
- employees
- locations
- appointments
- customers
- availability
- duplicate review
- reconciliation checks

This server should never compile mutation tools into its stable surface.

### Admin MCP

Use a second MCP for writes. Recommended controls:

- OAuth 2.1 authorization
- server-side administrator allowlist
- explicit tool-level write allowlist
- confirmation token for non-idempotent operations
- no automatic retry for mutations
- sanitized upstream errors
- metadata-only write audit
- conservative client permission mode

A useful first mutation is customer creation because it is additive and straightforward to verify. Higher-risk mutations should be introduced one at a time.

## Write-tool promotion ladder

A practical promotion order is:

1. `create_customer`
2. `update_customer`
3. `create_appointment`
4. `cancel_appointment`
5. narrowly scoped service or staff updates, only if operationally necessary

Avoid conversational exposure of destructive or bulk operations unless there is a compelling use case and stronger approval controls.

Examples that should normally remain engineering-only:

- delete customer
- delete service
- delete employee
- bulk destructive changes
- mass price changes

## OAuth pattern

A standards-based OAuth authorization server can sit in front of the admin MCP while Trafft API credentials remain server-side.

The MCP client should receive only an OAuth access token for the admin resource. It should never receive Trafft client credentials.

Recommended token checks at the admin MCP:

- valid issuer/signature/expiration
- expected resource or audience
- OAuth client identifier present
- explicit admin claim or equivalent authorization signal
- live server-side allowlist lookup

This lets the operator revoke write authority without rotating the Trafft API credentials themselves.

## Audit pattern

Write auditing should be independent of chat history. A minimal audit row can contain:

- timestamp
- actor user identifier
- OAuth client identifier
- tool name
- status (`attempt`, `success`, `failure`)
- upstream HTTP status
- resulting resource identifier, when safe
- normalized error code

Do **not** store request payloads by default. Customer names, email addresses, phone numbers, appointment notes, and API tokens do not belong in a generic write audit log.

## Why webhooks matter

MCP is excellent for operator-driven inspection and action, but it should not be the only automation mechanism.

For lifecycle automation, webhooks are the preferred fast path:

1. receive provider event
2. authenticate/verify it
3. persist a normalized event record
4. acknowledge quickly
5. process asynchronously
6. record result/retry state

This avoids requiring an operator or LLM to poll for every business event.

For booking systems, high-value events commonly include:

- appointment booked
- appointment canceled
- appointment rescheduled
- appointment status changed
- customer created

## Event hub pattern

For multi-system automation, avoid connecting every vendor directly to every other vendor. Route events through one small orchestration layer instead:

```text
Payments/Orders ----\
Booking -------------> Event Hub -> governed workflows -> CRM / booking / reporting
CRM events ----------/
```

The event hub should normalize provider-specific events into a common envelope and maintain idempotency/deduplication state.

Suggested normalized event fields:

- `event_id`
- `provider`
- `event_type`
- `provider_event_id`
- `subject_identity`
- `received_at`
- `processed_at`
- `status`
- `retry_count`
- `correlation_id`
- payload hash or private payload reference

## Customer identity map

Cross-platform automation becomes much more reliable when provider IDs are linked once instead of repeatedly guessing by email.

A generic identity map can associate:

- internal subject/customer UUID
- booking-system customer ID
- payment-system customer ID
- CRM subscriber ID
- normalized email
- normalized phone (optional)

Email can be used for initial reconciliation, but should not be the permanent primary identity key.

## Webhooks first, reconciliation second

Do not trust webhooks as the sole source of consistency. Use two layers:

**Fast path:** process authenticated webhooks as they arrive.

**Repair path:** run scheduled reconciliation that compares systems and identifies drift such as:

- paid but missing CRM record
- paid but not booked
- booked but expected payment missing
- booking customer missing from CRM
- stale lifecycle group/status
- duplicate customer identities
- failed webhook processing

This combination gives near-real-time automation without sacrificing recoverability.

## Public/private boundary

This repository is public. Keep reusable engineering patterns here; keep business configuration and tenant-specific implementations elsewhere.

Never commit:

- real API credentials or tokens
- hosted MCP URLs that function as secrets/capability URLs
- OAuth client secrets
- private tenant/project references when not necessary
- customer names, emails, phone numbers, appointment details, or payment data
- private webhook verification secrets
- internal pricing/offer logic
- production account identifiers
- private operational screenshots/logs containing PII

Public examples should use placeholders such as `example.invalid`, `tenant.example`, `customer_123`, and `project_ref`.

## Relationship to this repository

The stable `main` branch remains intentionally read-only. Controlled write work belongs behind an additional promotion gate and should not silently broaden the read-only server's trust boundary.

The open controlled-write work in this repository demonstrates the code-level foundation for a narrow mutation client and explicit `create_customer` confirmation contract. Production authorization, tenant identity, secrets, and event-hub implementation are deliberately outside the public repository.

## Broader reusable package opportunity

The same pattern is useful beyond Trafft. A generic CRM lifecycle engine can combine:

- a payment/order provider
- a booking/service provider
- a CRM/email lifecycle provider
- an event hub and identity map
- MCP read/admin operator surfaces
- webhook ingestion
- reconciliation jobs
- audit logging

That broader package should live in its own vendor-neutral repository rather than making this Trafft-specific project responsible for cross-platform orchestration.

## Design principle

> Use MCP for governed operator intent. Use webhooks for events. Use reconciliation for correctness. Keep systems of record authoritative.

That separation is what makes the stack useful without making it fragile.
