import { describe, expect, it } from "vitest";
import { generatePlugin } from "./generate.js";
import { packagePlugin } from "./package.js";
import type { PluginBlueprint } from "../domain/blueprint.js";

function blueprint(): PluginBlueprint {
  return {
    name: "demo-agent",
    version: "1.0.0",
    displayName: "Demo Agent",
    shortDescription: "A safe read-only demo plugin for external agents.",
    longDescription:
      "A deterministic test blueprint for validating XPeX Plugin Factory generation and security behavior.",
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
      releaseNotes: "Factory test release."
    },
    security: {
      dataClassification: "public",
      writeActions: false,
      requiresHumanApproval: false,
      forbiddenSecretClasses: ["api_key", "password"]
    }
  };
}

describe("XPeX Plugin Factory", () => {
  it("generates a valid plugin package surface", () => {
    const result = generatePlugin(blueprint());

    expect(result.report.valid).toBe(true);
    expect(result.report.generatedFiles).toContain("plugin.json");
    expect(result.report.generatedFiles).toContain(".codex-plugin/plugin.json");
    expect(result.report.generatedFiles).toContain("mcp.json");
    expect(result.report.generatedFiles).toContain("skills/demo-skill/SKILL.md");

    const plugin = result.files.find((file) => file.path === "plugin.json");
    expect(plugin?.content).toContain('"displayName": "Demo Agent"');
    expect(plugin?.content).not.toContain("sk-");
  });

  it("blocks private MCP network targets", () => {
    const raw = blueprint();
    raw.mcpServers[0] = {
      ...raw.mcpServers[0],
      url: "https://127.0.0.1/mcp"
    };

    const result = generatePlugin(raw);
    expect(result.report.valid).toBe(false);
    expect(
      result.report.findings.some((finding) => finding.code === "MCP_PRIVATE_HOST")
    ).toBe(true);
  });

  it("blocks embedded secret-like credentials", () => {
    const raw = blueprint();
    raw.skills[0] = {
      ...raw.skills[0],
      instructions:
        "Use this forbidden fake credential only for this security test: sk-123456789012345678901234567890. Never do this in production."
    };

    const result = generatePlugin(raw);
    expect(result.report.valid).toBe(false);
    expect(
      result.report.findings.some((finding) => finding.code === "SECRET_OPENAI")
    ).toBe(true);
  });

  it("produces deterministic zip bytes", async () => {
    const result = generatePlugin(blueprint());
    const first = await packagePlugin(result);
    const second = await packagePlugin(result);

    expect(first.equals(second)).toBe(true);
    expect(first.length).toBeGreaterThan(500);
  });
});
