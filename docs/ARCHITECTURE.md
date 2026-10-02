# XPeX Plugin Factory — Architecture

## Pipeline

```text
Blueprint
   |
   v
Zod contract validation
   |
   v
Security policy engine
   |
   +--> block secrets/private MCP/data-auth mismatch
   |
   v
Renderer
   |
   +--> plugin.json
   +--> .codex-plugin/plugin.json
   +--> mcp.json / .mcp.json
   +--> skills/*/SKILL.md
   +--> assets/icon.svg
   +--> README.md
   |
   v
Factory report
   |
   v
Deterministic ZIP
```

## Interfaces

### SDK

Import `generatePlugin`, `runSecurityPolicy`, and `packagePlugin`.

### CLI

```bash
xpex-plugin-factory generate blueprint.json --out ./generated
```

### HTTP

- `GET /health`
- `GET /v1/schema`
- `POST /v1/validate`
- `POST /v1/preview`
- `POST /v1/package`

## Design rules

1. The blueprint never contains runtime credentials.
2. MCP endpoints must be HTTPS and cannot target local/private network hosts.
3. Account/sensitive data cannot use anonymous MCP.
4. Write-capable plugins default to human approval.
5. Generation is deterministic so packages can be hashed, reproduced and audited.
6. The factory produces software artifacts; it does not silently publish them or mutate external services.
7. Review metadata and negative test cases are first-class inputs, not release-time paperwork.

## Factory layers

```text
Product Blueprint
      |
      v
Policy Compiler
      |
      v
Artifact Compiler
      |
      v
Verification
      |
      v
Package
      |
      +--> Private plugin
      +--> Workspace plugin
      +--> Review candidate
      +--> Customer delivery
```
