import { describe, expect, it } from "vitest";
import { handleEnterpriseMcp, getEnterpriseMcpDescriptor } from "./handler.js";

describe("XPeX Enterprise Agent API MCP", () => {
  it("describes eight public read-only enterprise tools", () => {
    const descriptor = getEnterpriseMcpDescriptor();
    expect(descriptor.name).toBe("xpex-enterprise-agent-api");
    expect(descriptor.tools).toHaveLength(8);
    expect(descriptor.offerings).toBe(7);
    expect(descriptor.endpoint).toBe("/enterprise/mcp");
  });

  it("initializes and lists tools", async () => {
    const init = await handleEnterpriseMcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25" }
    });
    expect(init.status).toBe(200);
    expect((init.body as any).result.serverInfo.name).toBe("xpex-enterprise-agent-api");

    const listed = await handleEnterpriseMcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    });
    const tools = (listed.body as any).result.tools;
    expect(tools).toHaveLength(8);
    expect(tools.every((tool: any) => tool.annotations.readOnlyHint === true)).toBe(true);
    expect(tools.every((tool: any) => tool.securitySchemes.some((s: any) => s.type === "noauth"))).toBe(true);
  });

  it("routes agent marketplace needs to the distribution offering", async () => {
    const response = await handleEnterpriseMcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "xpex_enterprise_match_need",
        arguments: {
          need: "We run an agent marketplace and need MCP service discovery and agent distribution",
          company_type: "Agent Platform"
        }
      }
    });
    const result = (response.body as any).result.structuredContent;
    expect(result.matches[0].id).toBe("agent-distribution");
    expect(result.truthBoundary).toContain("not a sale");
  });

  it("prepares a bounded pilot without guaranteeing results", async () => {
    const response = await handleEnterpriseMcp({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "xpex_enterprise_prepare_pilot",
        arguments: { offering_id: "company-intelligence" }
      }
    });
    const result = (response.body as any).result.structuredContent;
    expect(result.phases).toHaveLength(5);
    expect(result.truthBoundary).toContain("guaranteed");
  });

  it("returns a public contact handoff instead of pretending a contract exists", async () => {
    const response = await handleEnterpriseMcp({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "xpex_enterprise_contact_handoff",
        arguments: { context: "Enterprise AI integration" }
      }
    });
    const result = (response.body as any).result.structuredContent;
    expect(result.contact.website).toBe("https://xpex-systems-ai.vercel.app");
    expect(result.contact.linkedin).toContain("linkedin.com/in/ceojuniorsena");
  });
});
