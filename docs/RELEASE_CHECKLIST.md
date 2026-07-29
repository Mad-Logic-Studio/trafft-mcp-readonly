# Release checklist

Merging the hardened read-only candidate into `main` requires the source, security, CI, and protected live-validation gates below. A tagged production release additionally requires every account-specific release gate.

## Source and licensing

- [x] Clean repository history created.
- [x] Upstream commit and MIT provenance recorded.
- [x] Upstream and Mad Logic Studio copyright notices retained.
- [x] No credentials or customer data committed.

## Security and tool-surface gates

- [x] Mock authentication and GET request tests pass.
- [x] All non-authentication write methods are blocked at the client layer.
- [x] Stable tool allowlist contains exactly 13 approved read-only tools.
- [x] Appointment access is list-only.
- [x] Six experimental read tools are disabled by default.
- [x] HTTPS, hostname allowlist, redirect refusal, and API-path confinement tests pass.
- [x] Error redaction, network-error sanitization, response-size, and output-limit tests pass.

## Repository CI gates

- [x] Node 20 dependency installation succeeds with lifecycle scripts disabled.
- [x] `package-lock.json` is generated, reviewed, and committed.
- [x] `npm ci --ignore-scripts` succeeds from the committed lockfile.
- [x] `npm run check` succeeds against installed dependencies.
- [x] `npm audit --audit-level=high` reports no unresolved high or critical finding.
- [x] `npm pack --dry-run` contains only intended files.
- [x] MCP client/server protocol smoke tests succeed.
- [x] Appointment and availability query mapping is tested against the published parameter names.

## Protected live read-only merge gates

- [x] Credentials are injected through the protected `trafft-validation` environment, never chat or Git.
- [x] API origin, `/api/v2` path, and client-credentials authentication are verified against the account.
- [x] Small-page reads succeed for services, employees, locations, appointments, and customers.
- [ ] The bounded one-service, one-day availability probe passes on the final runtime commit.
- [x] Audit verification finds no token, secret, customer name, email, phone, or query string.
- [x] Experimental endpoints remain disabled.

## Additional gates before the first tagged production release

- [ ] Service names, prices, and group capacities reconcile with the approved source of truth.
- [ ] Employee/service assignments reconcile correctly.
- [ ] Pagination is verified with a multi-page dataset.
- [ ] A tagged release is created only after the above account-specific results are reviewed.
