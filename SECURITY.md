# Security policy

## Supported line

The intended supported line is the latest tagged `0.x` read-only release after its CI and live-read verification gates pass. Until the first tag exists, the repository is a security candidate only.

## Stable guarantees

- No customer, employee, service, location, appointment, coupon, pricing, calendar, webhook, booking, cancel, reschedule, or delete write method is compiled into the stable tool surface.
- The Trafft HTTP client permits only GET requests plus the configured authentication POST.
- The Trafft API origin must use HTTPS and match an exact hostname allowlist.
- Trafft requests are confined to the configured API path, including protection against encoded path traversal.
- Redirects are rejected.
- Tokens and credential values are never written to the audit log.
- Upstream error bodies are not returned to the MCP client.
- Response bodies are read with a streaming byte limit.
- Experimental GET endpoints are disabled by default.

## Remote transport guarantees

The optional remote Streamable HTTP transport adds a separate access boundary in front of the existing Trafft client.

- `/mcp` requires `Authorization: Bearer <MCP_ACCESS_TOKEN>` on every request.
- `MCP_ACCESS_TOKEN` must be at least 32 characters and must be independent from Trafft credentials.
- Bearer-token comparison uses fixed-size SHA-256 digests and `timingSafeEqual`.
- The remote MCP endpoint accepts POST only; GET and DELETE are rejected.
- MCP request bodies must be JSON and are read with a configurable byte limit.
- Public health output contains no account, credential, customer, appointment, or Trafft-origin data.
- Trafft client credentials remain server-side and are never required by the remote MCP client.
- The container runs as the unprivileged `node` user.

## Important limitations

No software can be guaranteed absolutely secure. Before production use, verify the dependency lockfile, build, package audit, current Trafft endpoint paths, authentication response, returned schemas, pagination, capacity fields, and privacy behavior against the intended Trafft account.

Customer and appointment tools can return personal information to the connected MCP client. Connect the remote transport only to a trusted MCP client, use a high-entropy access token, provide HTTPS at the hosting ingress/reverse proxy, restrict network exposure where practical, rotate secrets when access changes, and follow applicable privacy obligations.

The Node server itself does not terminate TLS. Production hosting must provide HTTPS before traffic reaches the MCP process.

A bearer token controls MCP access but does not provide per-user authorization or tool-level RBAC. A multi-user deployment requires an authentication/authorization design beyond the single shared secret implemented here.

## Reporting a vulnerability

Use GitHub’s private **Report a vulnerability** / Security Advisory flow. Do not publish credentials, customer information, exploit details, or audit logs in a public issue.

## Secret handling

Store Trafft credentials and `MCP_ACCESS_TOKEN` in a local OS secret store, protected environment injection, or an approved private runtime secret. Never commit credentials, paste them into chat, place real values in documentation, or expose them through command history.
