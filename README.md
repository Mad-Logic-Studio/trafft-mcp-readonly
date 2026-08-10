# Trafft MCP Read-Only

> **Project status — remote read access validated; controlled write foundation under review (August 2026)**
>
> The hardened read-only implementation remains the stable baseline. Remote Streamable HTTP access has been added without broadening the stable tool surface. A separate controlled-write foundation is under review and remains intentionally isolated from the read-only server.
>
> Downstream validation has also proven a generic architecture for an OAuth-protected admin MCP, explicit write gates, server-side authorization, metadata-only write auditing, and webhook/event-driven lifecycle automation. Those findings are documented publicly in [`docs/VALIDATED_ADMIN_AUTOMATION_PATTERNS.md`](docs/VALIDATED_ADMIN_AUTOMATION_PATTERNS.md) with tenant-specific details removed.

A hardened Model Context Protocol server for inspecting Trafft booking data without exposing mutation tools. It supports both local `stdio` and bearer-protected remote Streamable HTTP transports.

This repository is a clean derivative of `mjmirza/trafft-mcp` at commit `c8793116e564a6c84d4e727ee0d4c7f24aef45ff`. It retains the upstream MIT terms and documents material changes in `UPSTREAM.md` and `NOTICE`.

## Stable tool surface

- `list_services`
- `get_service`
- `find_services_by_name`
- `list_employees`
- `get_employee`
- `list_locations`
- `get_location`
- `list_appointments`
- `list_customers`
- `get_customer`
- `find_duplicate_customers`
- `get_available_times`
- `compare_services_to_expected`

`get_available_times` accepts one service and one date, then maps them to Trafft's documented `calendar_start_date`, `calendar_end_date`, and `service` query parameters. Optional employee, location, and additional-guest inputs are mapped to the published API names.

No create, update, cancel, reschedule, pricing-write, webhook-write, booking, coupon, or delete tool is compiled into the stable tool surface.

Six experimental **read-only** probes—webhooks, notifications, working hours, Special Days, Days Off, and settings—remain disabled unless `TRAFFT_ENABLE_EXPERIMENTAL_READS=true`. They should not be enabled without fresh verification against Trafft's current official API.

## Local stdio transport

```bash
npm ci --ignore-scripts
npm run build
npm run start:stdio
```

The original stdio transport is preserved for local MCP clients.

## Remote Streamable HTTP transport

The remote server exposes:

- `GET /healthz` — non-sensitive health response
- `POST /mcp` — stateless MCP endpoint
- bearer authentication on every `/mcp` request
- bounded JSON request bodies
- the same Trafft origin allowlist, path confinement, redirect refusal, response limits, sanitized errors, and audit logging used by the stdio build

Configure the normal `TRAFFT_*` values plus a **separate** `MCP_ACCESS_TOKEN` of at least 32 characters. The MCP access token is not a Trafft API credential.

```bash
npm ci --ignore-scripts
npm run build
MCP_ACCESS_TOKEN='use-a-secure-secret-store' npm run start:remote
```

Local binding defaults to `127.0.0.1:3000`. Hosted containers should set `MCP_BIND_HOST=0.0.0.0` behind an HTTPS ingress or reverse proxy. The included `Dockerfile` does this automatically for the container runtime.

### Remote client configuration

A remote MCP client should target the hosted HTTPS endpoint ending in `/mcp` and send:

```text
Authorization: Bearer <MCP_ACCESS_TOKEN>
```

Never put `TRAFFT_CLIENT_ID` or `TRAFFT_CLIENT_SECRET` into the MCP client configuration. Those credentials belong only in the server-side secret store.

## Controlled admin evolution

The stable reader should remain read-only. If writes are required, use a **separate admin MCP** with its own authorization boundary rather than quietly adding mutations to the reader.

The validated pattern is:

- OAuth 2.1 for the admin resource
- server-side administrator allowlist
- exact method/path allowlist for upstream mutations
- explicit confirmation for non-idempotent tools
- no automatic retry for ambiguous writes
- metadata-only write audit
- one mutation promoted at a time after exact current contract review

See [`docs/VALIDATED_ADMIN_AUTOMATION_PATTERNS.md`](docs/VALIDATED_ADMIN_AUTOMATION_PATTERNS.md) for the redacted engineering findings and the event-hub/lifecycle pattern that emerged from controlled downstream testing.

## Container deployment

Build and run the included production container with all secrets injected at runtime. Do not bake `.env` files, API credentials, or MCP access tokens into the image.

The container exposes port `3000`, starts `build/remote.js`, and keeps audit storage writable for the non-root Node user. Production ingress must provide HTTPS.

## Security architecture

- Local stdio and remote Streamable HTTP MCP transports
- Separate bearer secret for remote MCP access
- HTTPS-only Trafft origin
- Exact Trafft hostname allowlist
- API-path confinement and encoded-traversal rejection
- Redirect refusal
- GET-only Trafft REST policy, except the authentication POST
- In-memory Trafft bearer token
- Sanitized errors and request identifiers
- Bounded safe-GET retries
- Streaming response-size enforcement
- Bounded remote request bodies
- Valid-JSON MCP response limits
- Privacy-minimized JSONL operation log
- No deep/write audit mode in the stable reader

See `SECURITY.md` for the verified baseline guarantees and limitations.

## Development gate

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
npm pack --dry-run
```

The mock security suite does not call Trafft and does not require credentials.

## Secret handling

Never commit credentials or paste them into chat, issues, screenshots, fixtures, or shell history. Use an OS secret store or approved private runtime injection.

## Historical API boundary

The July 2026 implementation intentionally compiled only read operations after Trafft Support described a much narrower mutation surface at that time. Those findings remain part of the project history, but should not be treated as a claim about Trafft's present-day API.

Current write support is considered only from exact, current, official request contracts and controlled validation. Undocumented dashboard endpoints are out of scope.

## Broader lifecycle-engine work

The Trafft-specific MCP is deliberately not becoming a generic CRM orchestration repository. The reusable multi-system lifecycle pattern—payments/orders, booking, CRM/email, webhooks, identity mapping, reconciliation, audit, and MCP operator surfaces—belongs in a separate vendor-neutral public project.

That separation keeps this repository useful to Trafft users without coupling it to any one company's CRM or commerce stack.

## Questions and comments

Use the standing project-status issue for general questions and compatibility discussion. Security concerns should be reported privately through GitHub Security Advisories.

## Independence

This project is not affiliated with, endorsed by, or sponsored by Trafft. Trafft is a trademark of its respective owner.
