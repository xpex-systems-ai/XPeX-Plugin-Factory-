# XPeX Plugin Factory

Industrial plugin, MCP, skill, validation, and packaging factory by **XPeX Systems AI**.

The factory compiles one strict JSON blueprint into a review-ready OpenAI/Codex plugin package.

## What it generates

- `plugin.json`
- `.codex-plugin/plugin.json`
- `mcp.json`
- `.mcp.json`
- one or more `skills/*/SKILL.md`
- generated SVG branding asset
- package README
- `FACTORY-REPORT.json`
- deterministic ZIP artifact

## Pipeline

```text
Blueprint
   ↓
Schema validation
   ↓
Security policy engine
   ↓
Manifest + MCP + Skill compiler
   ↓
Factory report
   ↓
Deterministic ZIP
```

## Fast start

```bash
npm install
npm run check
npm test
npm run build

node dist/cli.js generate \
  examples/gxeon-agent-gateway.blueprint.json \
  --out ./generated/gxeon
```

## HTTP API

Start the factory:

```bash
npm run dev
```

Endpoints:

```text
GET  /health
GET  /v1/schema
GET  /mcp
POST /mcp
POST /v1/validate
POST /v1/preview
POST /v1/package
```

### Validate a blueprint

```bash
curl -X POST http://localhost:8080/v1/validate \
  -H "Content-Type: application/json" \
  --data @examples/gxeon-agent-gateway.blueprint.json
```

### Generate a ZIP

```bash
curl -X POST http://localhost:8080/v1/package \
  -H "Content-Type: application/json" \
  --data @examples/gxeon-agent-gateway.blueprint.json \
  -o gxeon-agent-gateway.zip
```

## Security gates

The V1 compiler rejects or warns on:

- embedded API keys, bearer tokens, Stripe secrets, private keys, and GXEON machine keys;
- localhost/private-network MCP endpoints;
- non-HTTPS MCP endpoints;
- sensitive/account data exposed through anonymous MCP;
- write-capable plugins without human approval;
- machine-key plugin surfaces that need an OAuth boundary for user-linked public distribution;
- commerce configurations that require a current policy review.

Runtime credentials are never generated into plugin packages.

## Reference blueprint

`examples/gxeon-agent-gateway.blueprint.json` is the first real reference product compiled by this factory.

## Architecture

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)

## Deployment

A production container and `railway.toml` are included. The service exposes `/health` for readiness checks.

## Philosophy

XPeX Plugin Factory is not a prompt generator. It is a software supply-chain compiler for agent products:

```text
PRODUCT IDEA
   ↓
BLUEPRINT
   ↓
POLICY
   ↓
PLUGIN + MCP + SKILLS
   ↓
TESTS
   ↓
PACKAGE
   ↓
PRIVATE / WORKSPACE / REVIEW PIPELINE
```

Built by **XPeX Systems AI**.


## Production

Factory V1 is live at:

```text
https://xpex-plugin-factory-production.up.railway.app
```

Health: `/health` · Schema: `/v1/schema` · Validate: `POST /v1/validate` · Preview: `POST /v1/preview` · Package: `POST /v1/package`


## Agent-native factory access

Factory V0.2 exposes a no-auth, computation-only MCP endpoint at `/mcp`.

Available tools:

- `xpex_factory_get_schema`
- `xpex_factory_validate_blueprint`
- `xpex_factory_preview_plugin`
- `xpex_factory_compile_plugin`

The MCP surface never publishes plugins and never mutates third-party systems. ZIP compilation is deterministic and returned as base64 for MCP clients that need a portable artifact.
