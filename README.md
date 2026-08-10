# Trafft MCP Read-Only

> **Project status — remote-access upgrade in review (August 2026)**
>
> The hardened July 2026 read-only implementation remains the verified baseline. Development was reopened on August 9, 2026 to add an authenticated remote MCP transport so the same validated tool surface can be hosted for remote MCP clients.
>
> Trafft's current public documentation describes a broader API surface than was available during the July validation. This branch does **not** infer or enable write tools from high-level documentation alone. Stable tools remain read-only until exact endpoint, request-body, cancellation, and failure semantics are verified against Trafft's current official contract.

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
- No deep/write audit mode

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

Current write support will be considered only from exact, current, official Trafft request contracts and controlled validation. Undocumented dashboard endpoints are out of scope.

## Questions and comments

Use the standing project-status issue for general questions and compatibility discussion. Security concerns should be reported privately through GitHub Security Advisories.

## Independence

This project is not affiliated with, endorsed by, or sponsored by Trafft. Trafft is a trademark of its respective owner.
