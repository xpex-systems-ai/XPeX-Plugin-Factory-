# Security

XPeX Plugin Factory treats plugin generation as a software-supply-chain operation.

## Invariants

- No provider secret belongs in a blueprint or generated ZIP.
- MCP URLs must use HTTPS.
- Localhost and common private-network MCP targets are rejected.
- Public/no-auth MCP cannot be used for account or sensitive data.
- Write-capable plugins require human approval by default.
- Generated packages never embed browser cookies, wallet keys, Stripe secrets, API keys or seed phrases.
- Tool output must be treated as untrusted data by generated skills.
- Payment state must come from independently verified provider settlement, never from a quote or checkout URL.

## Built-in scanning

The V1 policy engine scans blueprint content for common secret classes including:

- OpenAI-style API keys;
- Stripe keys and webhook secrets;
- GXEON machine keys;
- PEM private keys;
- literal bearer credentials.

This is defense in depth. Production publishers should also use repository secret scanning, dependency review and external security review.

## Authentication modes

`none`
: Only for public data and read-only discovery.

`oauth2.1`
: Preferred for user-linked authenticated plugin experiences.

`machine-key`
: Suitable for server-to-server agent runtimes. Never embed a machine key inside a public plugin package.

## Release gate

A package is releasable only when:

1. schema validation passes;
2. policy report has no `error` findings;
3. tests/build pass;
4. MCP backend is reachable and reviewed separately;
5. privacy/support/terms URLs are live when required by the target distribution channel.
