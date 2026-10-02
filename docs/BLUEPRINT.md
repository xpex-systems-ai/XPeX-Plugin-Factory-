# Blueprint Contract

A blueprint is the source of truth for one generated plugin release.

## Product identity

```json
{
  "name": "company-agent",
  "version": "1.0.0",
  "displayName": "Company Agent",
  "developerName": "Example Company",
  "category": "Business"
}
```

## MCP servers

```json
{
  "mcpServers": [
    {
      "name": "company",
      "url": "https://api.example.com/mcp",
      "transport": "streamable-http",
      "auth": "oauth2.1"
    }
  ]
}
```

Supported auth declarations:

- `none` — public read-only data only;
- `oauth2.1` — user-linked authenticated workflows;
- `machine-key` — server-to-server agents; the key itself is never placed in the package.

## Skills

A plugin can contain multiple skills. Each skill receives a safety appendix during generation.

```json
{
  "skills": [
    {
      "name": "account-audit",
      "description": "Audit an account using approved tools.",
      "instructions": "Use only live MCP responses. Never invent account state."
    }
  ]
}
```

## Review metadata

Positive and negative cases are compiled into plugin review metadata so safety and expected behavior are specified before release.

## Security policy

```json
{
  "security": {
    "dataClassification": "public",
    "writeActions": false,
    "requiresHumanApproval": false,
    "forbiddenSecretClasses": [
      "api_key",
      "password",
      "private_key"
    ]
  }
}
```

Rules enforced by V1:

- non-public data cannot use anonymous MCP;
- write actions require human approval;
- common secret formats are rejected;
- private/local MCP endpoints are rejected;
- MCP endpoints require HTTPS.
