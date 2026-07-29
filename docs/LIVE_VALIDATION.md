# Controlled live read-only validation

This project must not connect to a Trafft account until the non-live CI gates are green and the account owner has explicitly approved a live read-only test.

## Privacy boundary

The validation command:

- authenticates with `POST /api/v2/token` only;
- sends `application/x-www-form-urlencoded` fields `grant_type=client_credentials`, `client_id`, and `client_secret`;
- sends only `GET` requests after authentication;
- keeps experimental endpoints disabled;
- requests small first pages;
- uses the first returned service ID for one bounded availability GET covering one date only;
- does not print or upload raw Trafft responses;
- reports endpoint status, record presence, recognized structural fields, and optional expected-service pass/fail labels only;
- stores a local JSONL audit containing method, sanitized path, status, HTTP status, duration, attempt, and request ID only.

Do not add credentials to Git, issues, pull requests, workflow inputs, command history, or chat.

## Required protected environment

Create a GitHub Environment named `trafft-validation` and restrict deployment to trusted maintainers. Add these environment secrets:

- `TRAFFT_API_URL` — the HTTPS Trafft API origin only, without `/api/v2`.
- `TRAFFT_ALLOWED_HOSTS` — the exact hostname from `TRAFFT_API_URL`.
- `TRAFFT_CLIENT_ID`
- `TRAFFT_CLIENT_SECRET`

Optional environment secret:

- `TRAFFT_EXPECTED_SERVICES_JSON`

Example shape:

```json
[
  {
    "label": "public-service-key",
    "name": "Exact Trafft service name",
    "price": 44,
    "capacity": 1
  }
]
```

The validator prints `label` and `matched`, `missing`, or `mismatch`. It never prints the API's actual service name, price, capacity, availability slot, or returned record.

## Fixed workflow settings

The protected workflow supplies these non-secret values itself:

- `TRAFFT_API_PATH=/api/v2`
- `TRAFFT_AUTH_PATH=/token` (relative to `TRAFFT_API_PATH`)
- `TRAFFT_ENABLE_EXPERIMENTAL_READS=false`
- `TRAFFT_LIVE_VALIDATION_ACK=READ_ONLY_ONLY`
- small response and retry limits
- an ephemeral audit path under `RUNNER_TEMP`

## Passing result

A pass requires:

1. authentication succeeds;
2. list reads succeed for services, employees, locations, appointments, and customers;
3. documented detail reads succeed for services, employees, locations, and customers when a first-page record exists;
4. appointments remain list-only because Trafft's published collection does not document a read-by-ID appointment endpoint;
5. a one-service, one-day GET to `/available-times` succeeds using the documented `calendar_start_date`, `calendar_end_date`, and `service` parameters;
6. optional expected-service checks all match;
7. the audit file contains only the approved metadata keys;
8. no experimental path is requested;
9. no non-authentication write method is sent.

The live workflow must remain manual and must not run on pull requests, forks, schedules, or ordinary pushes.
