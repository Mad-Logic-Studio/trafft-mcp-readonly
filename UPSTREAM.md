# Upstream provenance

This hardening branch is derived from:

- Repository: `mjmirza/trafft-mcp`
- Upstream commit: `c8793116e564a6c84d4e727ee0d4c7f24aef45ff`
- Upstream license: MIT
- Audit date: 2026-07-28

The upstream repository is not affiliated with Trafft. This fork is also not
affiliated with or endorsed by Trafft.

## Material changes in this branch

- Removes all create, update, cancel, and delete MCP tools.
- Enforces read-only HTTP methods in the REST client.
- Permits POST only for the configured authentication endpoint.
- Requires HTTPS and an explicit API hostname allowlist.
- Refuses redirects so credentials cannot be forwarded to another host.
- Redacts upstream response bodies from errors.
- Adds bounded GET retry behavior for 429 and transient 5xx responses.
- Adds privacy-minimized JSONL audit logging.
- Adds mock-based security tests that require no Trafft credentials.
- Marks unverified API surfaces as experimental and disabled by default.
