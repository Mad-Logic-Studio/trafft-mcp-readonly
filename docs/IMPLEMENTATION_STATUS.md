# Implementation status — July 29, 2026

## Completed

- Created the public `Mad-Logic-Studio/trafft-mcp-readonly` repository with upstream MIT provenance.
- Removed all upstream write-capable tools from stable V1 registration.
- Enforced GET-only data access with one exact authentication POST exception.
- Implemented Trafft's published client-credentials contract at `POST /api/v2/token` using URL-encoded fields.
- Added HTTPS, exact-host allowlisting, standard-port enforcement, redirect refusal, API-path confinement, and encoded-traversal rejection.
- Added sanitized errors, bounded safe-GET retry behavior, streaming response-size limits, and valid-JSON MCP response limits.
- Added privacy-minimized JSONL audit logging with secret and method verification.
- Reduced stable V1 to 13 read-only tools; appointments are list-only.
- Mapped appointment filters and availability parameters to Trafft's published contract.
- Added a bounded one-service, one-day availability probe to protected live validation.
- Kept six unverified read endpoints behind a disabled experimental gate.
- Committed and reviewed the lockfile.
- Passed Node 20 installation, TypeScript build, MCP protocol smoke tests, policy tests, `npm audit --audit-level=high`, and package inspection.
- Passed controlled live authentication and read-only validation for services, employees, locations, appointment listing, and customers with both metadata-only audit checks green.

## Required before the first tagged release

- Pass the protected live workflow on the final runtime commit, including the bounded availability probe.
- Complete account-specific service name, price, and capacity reconciliation.
- Review employee/service assignments returned by the account.
- Verify pagination behavior with more than one page where the account contains enough records.
- Keep experimental endpoints disabled until each path is separately documented and live-verified.

Merging the hardened candidate into `main` does not by itself create a production release or authorize any write-capable Trafft integration.
