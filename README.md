# Trafft MCP Read-Only

> **Project status — concluded reference implementation**
>
> Active development for Sunflower Studio concluded on July 30, 2026 after Trafft Support confirmed that the public API does not support service creation or updates, appointment creation, appointment editing or rescheduling, or reversible appointment cancellation. Permanent deletion is the only published appointment mutation.
>
> This repository remains **public and unarchived** as a hardened read-only reference implementation. No deployment or ongoing maintenance is promised. Issues remain enabled so people may ask questions, report compatibility changes, or share useful findings. A future change would be considered only if Trafft publishes materially broader official API contracts.

A hardened, community-readable, read-only Model Context Protocol server for auditing Trafft booking data without exposing mutation tools.

This repository is a clean derivative of `mjmirza/trafft-mcp` at commit `c8793116e564a6c84d4e727ee0d4c7f24aef45ff`. It retains the upstream MIT terms and documents all material changes in `UPSTREAM.md` and `NOTICE`.

## Final status

The read-only implementation completed its build, protocol, dependency, privacy, authentication, core read, and bounded availability validation gates. It was not deployed as a Sunflower Studio production integration because the official Trafft API does not provide the safe write capabilities that motivated the broader project.

The repository is intentionally not tagged as an actively maintained production release.

## Stable V1 tools

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

Trafft's published collection documents appointment listing but not a read-by-ID appointment endpoint, so stable V1 deliberately exposes appointments as list-only.

`get_available_times` accepts one service and one date, then maps them to Trafft's documented `calendar_start_date`, `calendar_end_date`, and `service` query parameters. Optional employee, location, and additional-guest inputs are mapped to the published API names.

No create, update, cancel, reschedule, pricing-write, webhook-write, booking, coupon, or delete tool is compiled into stable V1.

Six experimental **read-only** probes—webhooks, notifications, working hours, Special Days, Days Off, and settings—remain disabled unless `TRAFFT_ENABLE_EXPERIMENTAL_READS=true`. They should not be enabled without fresh verification against Trafft's current official API.

## Confirmed Trafft API boundary

Trafft Support confirmed the following in July 2026:

- services may only be listed or retrieved;
- services cannot be created or updated through the API;
- appointments cannot be created, edited, or rescheduled through the API;
- reversible appointment cancellation is unavailable;
- appointment listing and permanent deletion are the only supported appointment operations described by support.

This project does not use undocumented dashboard endpoints or infer unsupported mutation contracts.

## Security architecture

- Local stdio MCP transport
- HTTPS-only Trafft origin
- Exact hostname allowlist
- API-path confinement and encoded-traversal rejection
- Redirect refusal
- GET-only REST policy, except the authentication POST
- In-memory Bearer token
- Sanitized errors and request identifiers
- Bounded safe-GET retries
- Streaming response-size enforcement
- Valid-JSON MCP response limits
- Privacy-minimized JSONL operation log
- No deep/write audit mode

See `SECURITY.md` for guarantees and limitations.

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

## Questions and comments

Use the standing project-status issue for general questions and compatibility discussion. Security concerns should be reported privately through GitHub Security Advisories.

## Independence

This project is not affiliated with, endorsed by, or sponsored by Trafft. Trafft is a trademark of its respective owner.
