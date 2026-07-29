# Trafft MCP Read-Only

A hardened, community-maintained, read-only Model Context Protocol server for auditing Trafft booking data without exposing mutation tools.

This repository is a clean derivative of `mjmirza/trafft-mcp` at commit `c8793116e564a6c84d4e727ee0d4c7f24aef45ff`. It retains the upstream MIT terms and documents all material changes in `UPSTREAM.md` and `NOTICE`.

## Release status

**Live-validated read-only candidate—not yet a tagged production release.**

The committed lockfile, Node 20 build, MCP protocol smoke test, high-severity dependency audit, package inspection, authentication flow, core list/detail reads, and privacy-minimized audit checks have passed. The protected release workflow also performs a bounded one-day availability read using a service returned by Trafft.

Before the first tagged release, complete the account-specific service/capacity reconciliation, employee-assignment review, and pagination verification recorded in `docs/RELEASE_CHECKLIST.md`. Do not call this project affiliated with, endorsed by, or officially verified by Trafft.

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

Six experimental **read-only** probes—webhooks, notifications, working hours, Special Days, Days Off, and settings—remain disabled unless `TRAFFT_ENABLE_EXPERIMENTAL_READS=true`. Do not enable them until each path is verified.

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

## Community

Contributions are welcome under `CONTRIBUTING.md`. V1 deliberately remains read-only. Security concerns should be reported privately through GitHub Security Advisories.

## Independence

This project is not affiliated with, endorsed by, or sponsored by Trafft. Trafft is a trademark of its respective owner.
