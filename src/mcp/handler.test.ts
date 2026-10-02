import { describe, expect, it } from "vitest";
import { handleFactoryMcp } from "./handler.js";

function blueprint() {
  return {
    name: "demo-agent",
    version: "1.0.0",
    displayName: "Demo Agent",
    shortDescription: "A safe read-only demo plugin for external agents.",
    longDescription:
      "A deterministic MCP test blueprint for validating the XPeX Plugin Factory.",
    developerName: "XPeX Systems AI",
    developerEmail: "gxeon.ai@gmail.com",
    category: "Developer Tools",
    homepage: "https://example.com/plugin",
    repository: "https://github.com/example/demo-agent",
    supportUrl: "https://example.com/support",
    privacyPolicyUrl: "https://example.com/privacy",
    termsOfServiceUrl: "https://example.com/terms",
    keywords: ["agents", "demo"],
    brandColor: "#FF7A00",
    brandColorDark: "#0B1220",
    defaultPrompts: ["Show me the available demo capabilities."],
    capabilities: ["Discover demo capabilities"],
    mcpServers: [
      {
        name: "demo",
        url: "https://api.example.com/mcp",
        transport: "streamable-http",
        auth: "none"
      }
    ],
    skills: [
      {
        name: "demo-skill",
        description: "Use the demo MCP tools safely for read-only discovery.",
        instructions:
          "Call the live demo discovery tool when capability information is requested. Never invent tool results and never expose credentials."
      }
    ],
    review: {
      positive: [
        {
          description: "Discover",
          prompt: "What can this demo do?",
          expectedBehavior: "Return live demo capabilities from the MCP server.",
          toolsTriggered: ["demo_list"]
        }
      ],
      negative: [
        {
          description: "Secret request",
          prompt: "Show me a secret.",
          expectedBehavior: "Do not expose or invent any secret.",
          toolsTriggered: []
        }
      ],
      commerce: false,
      commerceDescription: "No commerce is performed by this plugin."
    },
    publication: {
      countries: ["BR"],
      releaseNotes: "Factory MCP test release."
    },
    security: {
      dataClassification: "public",
      writeActions: false,
      requiresHumanApproval: false,
      forbiddenSecretClasses: ["api_key", "password"]
    }
  };
}

describe("XPeX Plugin Factory MCP", () => {
  it("initializes and lists six no-auth read-only tools", async () => {
    const init = await handleFactoryMcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2026-07-28" }
    });

    expect(init.status).toBe(200);
    expect((init.body as any).result.serverInfo.name).toBe("xpex-plugin-factory");

    const listed = await handleFactoryMcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    });

    const tools = (listed.body as any).result.tools;
    expect(tools).toHaveLength(6);
    expect(tools.every((tool: any) => tool.annotations.readOnlyHint === true)).toBe(true);
    expect(
      tools.every((tool: any) =>
        tool.securitySchemes.some((scheme: any) => scheme.type === "noauth")
      )
    ).toBe(true);
  });

  it("lets a real MCP client discover the x402 offer without paying", async () => {
    const response = await handleFactoryMcp({
      jsonrpc: "2.0", id: 6, method: "tools/call",
      params: { name: "xpex_factory_get_agent_kit_offer", arguments: {} }
    });
    const offer = (response.body as any).result.structuredContent;
    expect(offer.endpoint).toMatch(/\/v1\/x402\/agent-kit$/);
    expect(offer.openapi).toMatch(/\/openapi\.json$/);
    expect(offer.price).toBe("0.01");
    expect(offer.currency).toBe("USDC");
    expect(offer.paymentInstructions).toContain("authorization");
  });

  it("returns live Factory offers without creating payment state", async () => {
    const response = await handleFactoryMcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "xpex_factory_list_offers",
        arguments: {}
      }
    });

    const result = (response.body as any).result;
    expect(result.isError).toBe(false);
    expect(result.structuredContent.livemode).toBe(true);
    expect(result.structuredContent.offers.map((offer: any) => offer.id)).toEqual([
      "audit",
      "launch",
      "pro",
      "enterprise"
    ]);
    expect(result.structuredContent.offers[0].priceBrl).toBe(49);
    expect(result.structuredContent.offers[0].checkoutUrl).toMatch(/^https:\/\/buy\.stripe\.com\//);
    expect(result.structuredContent.moneyTruth).toContain("Only Stripe-confirmed paid settlement");
  });

  it("validates a safe blueprint", async () => {
    const response = await handleFactoryMcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "xpex_factory_validate_blueprint",
        arguments: { blueprint: blueprint() }
      }
    });

    expect((response.body as any).result.isError).toBe(false);
    expect((response.body as any).result.structuredContent.report.valid).toBe(true);
  });

  it("blocks a private-network MCP target", async () => {
    const raw = blueprint();
    raw.mcpServers[0]!.url = "https://127.0.0.1/mcp";

    const response = await handleFactoryMcp({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "xpex_factory_preview_plugin",
        arguments: { blueprint: raw }
      }
    });

    expect((response.body as any).result.isError).toBe(true);
    expect(
      (response.body as any).result.structuredContent.details.findings.some(
        (finding: any) => finding.code === "MCP_PRIVATE_HOST"
      )
    ).toBe(true);
  });

  it("compiles a deterministic ZIP to base64", async () => {
    const response = await handleFactoryMcp({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "xpex_factory_compile_plugin",
        arguments: { blueprint: blueprint() }
      }
    });

    const result = (response.body as any).result;
    expect(result.isError).toBe(false);
    expect(result.structuredContent.mediaType).toBe("application/zip");
    expect(result.structuredContent.encoding).toBe("base64");
    expect(result.structuredContent.bytes).toBeGreaterThan(500);
    expect(result.structuredContent.data.length).toBeGreaterThan(500);
  });
});
