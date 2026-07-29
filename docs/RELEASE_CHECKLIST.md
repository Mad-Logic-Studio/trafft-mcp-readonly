# Release checklist

A release must not be tagged, merged to `main`, or described as production-ready until every required gate is complete.

## Source and licensing

- [x] Clean repository history created.
- [x] Upstream commit and MIT provenance recorded.
- [x] Upstream and Mad Logic Studio copyright notices retained.
- [x] No credentials or customer data committed.

## Local security gates

- [x] Mock authentication and GET request tests pass.
- [x] All non-authentication write methods are blocked at the client layer.
- [x] Stable tool allowlist contains only the approved 14 read tools.
- [x] Six experimental read tools are disabled by default.
- [x] HTTPS, hostname allowlist, redirect refusal, and API-path confinement tests pass.
- [x] Error redaction, network-error sanitization, response-size, and output-limit tests pass.
- [x] TypeScript source syntax and Git integrity checks pass.

## Repository CI gates

- [x] Node 20 dependency installation succeeds with lifecycle scripts disabled.
- [x] `package-lock.json` is generated, reviewed, and committed.
- [x] `npm ci --ignore-scripts` succeeds from the committed lockfile.
- [x] `npm run check` succeeds against the real installed dependencies.
- [x] `npm audit --audit-level=high` reports no unresolved high or critical finding.
- [x] `npm pack --dry-run` contains only intended files.
- [x] MCP client/server protocol smoke test succeeds.

## Controlled Trafft read-only gates

- [ ] Credentials are injected through an approved secret store, never chat or Git.
- [ ] API origin, API path, and authentication response are verified against the account.
- [ ] Small-page reads succeed for services, employees, locations, appointments, and customers.
- [ ] Service prices and Standard/Premium capacities reconcile with the approved source of truth.
- [ ] Employee/service assignments reconcile correctly.
- [ ] Pagination and status fields are confirmed.
- [ ] Audit logs contain no token, secret, customer name, email, phone, or query string.
- [ ] Experimental endpoints remain disabled unless each one is separately verified.
