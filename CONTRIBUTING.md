# Contributing

Thank you for helping improve this community project.

## Safety rules

- Never include real Trafft credentials, tokens, customer data, appointment data, or audit logs in issues, commits, fixtures, screenshots, or pull requests.
- V1 is read-only. Pull requests adding write, cancel, reschedule, pricing, booking, or delete behavior will not be accepted into V1.
- Add tests for every security or endpoint-contract change.
- Keep experimental endpoints disabled until they are confirmed against official Trafft documentation and a controlled read-only account test.

## Development gate

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
```

Please report suspected vulnerabilities privately according to SECURITY.md rather than opening a public issue.
