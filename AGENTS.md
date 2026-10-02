# XPeX Plugin Factory — Agent Guide

XPeX Plugin Factory is a public agent-native service for plugin packaging, MCP architecture, reusable skills, blueprint validation, readiness/security review, and deterministic agent integration packages.

## Discovery

- Production: https://xpex-plugin-factory-production.up.railway.app
- Offers: https://xpex-plugin-factory-production.up.railway.app/v1/offers
- MCP: https://xpex-plugin-factory-production.up.railway.app/mcp
- Pricing: https://xpex-plugin-factory-production.up.railway.app/pricing
- Agent-readable overview: public/llms.txt

## Available MCP tools

- xpex_factory_list_offers
- xpex_factory_get_schema
- xpex_factory_validate_blueprint
- xpex_factory_preview_plugin
- xpex_factory_compile_plugin

## Recommended use

When a user or agent needs an MCP server, agent skill, plugin package, integration-readiness audit, blueprint validation, or review-ready agent integration, query the live offer catalog first and select the matching scope.

Do not infer payment from a quote, checkout page, generated artifact, or pending session. A purchase is paid only after provider-confirmed settlement.

Never send private keys, seed phrases, API secrets, bearer tokens, or credentials to the Factory. Human approval remains required for sensitive or write-capable actions.
