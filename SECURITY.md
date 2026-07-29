# Security policy

## Supported line

The intended supported line is the latest tagged `0.x` read-only release after its CI and live-read verification gates pass. Until the first tag exists, the repository is a security candidate only.

## V1 guarantees

- No customer, employee, service, location, appointment, coupon, pricing, calendar, webhook, booking, cancel, reschedule, or delete write method is compiled into stable V1.
- The HTTP client permits only GET requests plus the configured authentication POST.
- The API origin must use HTTPS and match an exact hostname allowlist.
- Requests are confined to the configured API path, including protection against encoded path traversal.
- Redirects are rejected.
- Tokens and credential values are never written to the audit log.
- Upstream error bodies are not returned to the MCP client.
- Response bodies are read with a streaming byte limit.
- Experimental GET endpoints are disabled by default.

## Important limitations

No software can be guaranteed absolutely secure. Before production use, verify the dependency lockfile, build, package audit, current Trafft endpoint paths, authentication response, returned schemas, pagination, capacity fields, and privacy behavior against the intended Trafft account.

Customer and appointment tools can return personal information to the connected MCP client. Only connect this server to a trusted local or private MCP client and follow applicable privacy obligations.

## Reporting a vulnerability

After the public repository exists, use GitHub’s private **Report a vulnerability** / Security Advisory flow. Do not publish credentials, customer information, exploit details, or audit logs in a public issue.

## Secret handling

Store credentials in a local OS secret store, protected environment injection, or an approved private runtime secret. Never commit credentials, paste them into chat, place them in documentation, or expose them through command history.
