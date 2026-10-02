import { generatePlugin, assertGenerationReady } from "../factory/generate.js";
import { packagePlugin } from "../factory/package.js";

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

type ToolCallParams = {
  name?: unknown;
  arguments?: unknown;
};

const tools = [
  {
    name: "xpex_factory_get_schema",
    title: "Get XPeX Plugin Factory schema",
    description:
      "Return the factory blueprint contract summary and generation endpoints. Read-only.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    securitySchemes: [{ type: "noauth" }],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "xpex_factory_validate_blueprint",
    title: "Validate a plugin blueprint",
    description:
      "Validate a plugin blueprint and run XPeX security policy checks without generating or publishing anything.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["blueprint"],
      properties: {
        blueprint: { type: "object" }
      }
    },
    securitySchemes: [{ type: "noauth" }],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "xpex_factory_preview_plugin",
    title: "Preview generated plugin files",
    description:
      "Compile a valid blueprint into text artifacts for review without publishing or mutating external systems.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["blueprint"],
      properties: {
        blueprint: { type: "object" }
      }
    },
    securitySchemes: [{ type: "noauth" }],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "xpex_factory_compile_plugin",
    title: "Compile plugin ZIP",
    description:
      "Compile a valid blueprint into a deterministic ZIP returned as base64. It does not publish the plugin or change external state.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["blueprint"],
      properties: {
        blueprint: { type: "object" }
      }
    },
    securitySchemes: [{ type: "noauth" }],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }
];

function toolResult(structuredContent: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: false
  };
}

function toolError(code: string, message: string, details?: unknown) {
  const structuredContent = {
    error: code,
    message,
    ...(details === undefined ? {} : { details })
  };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: true
  };
}

function getBlueprintArgument(params: ToolCallParams): unknown {
  const args =
    params.arguments &&
    typeof params.arguments === "object" &&
    !Array.isArray(params.arguments)
      ? (params.arguments as Record<string, unknown>)
      : {};
  return args.blueprint;
}

async function callTool(params: ToolCallParams) {
  const name = typeof params.name === "string" ? params.name : "";

  if (name === "xpex_factory_get_schema") {
    return toolResult({
      name: "XPeX Plugin Factory Blueprint",
      version: "1",
      workflow: [
        "validate blueprint",
        "review security findings",
        "preview generated files",
        "compile deterministic ZIP"
      ],
      requiredTopLevelFields: [
        "name",
        "version",
        "displayName",
        "shortDescription",
        "longDescription",
        "developerName",
        "category",
        "homepage",
        "supportUrl",
        "privacyPolicyUrl",
        "termsOfServiceUrl",
        "keywords",
        "brandColor",
        "brandColorDark",
        "defaultPrompts",
        "capabilities",
        "mcpServers",
        "skills",
        "review",
        "publication",
        "security"
      ],
      safety:
        "Never put passwords, API keys, private keys, seed phrases, cookies, or bearer credentials into a blueprint."
    });
  }

  if (
    name !== "xpex_factory_validate_blueprint" &&
    name !== "xpex_factory_preview_plugin" &&
    name !== "xpex_factory_compile_plugin"
  ) {
    return toolError("UNKNOWN_TOOL", `Unknown XPeX Factory tool: ${name || "(missing)"}`);
  }

  const blueprint = getBlueprintArgument(params);

  try {
    const result = generatePlugin(blueprint);

    if (name === "xpex_factory_validate_blueprint") {
      return toolResult({
        blueprint: {
          name: result.blueprint.name,
          version: result.blueprint.version,
          displayName: result.blueprint.displayName
        },
        report: result.report
      });
    }

    if (!result.report.valid) {
      return toolError(
        "FACTORY_POLICY_BLOCKED",
        "The blueprint is structurally valid but failed factory security policy.",
        result.report
      );
    }

    if (name === "xpex_factory_preview_plugin") {
      return toolResult({
        report: result.report,
        files: Object.fromEntries(
          result.files.map((file) => [file.path, file.content])
        )
      });
    }

    assertGenerationReady(result);
    const archive = await packagePlugin(result);

    return toolResult({
      report: result.report,
      fileName: `${result.blueprint.name}-${result.blueprint.version}.zip`,
      mediaType: "application/zip",
      encoding: "base64",
      bytes: archive.length,
      data: archive.toString("base64")
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Factory operation failed";
    return toolError("INVALID_BLUEPRINT", message);
  }
}

export function getFactoryMcpDescriptor() {
  return {
    name: "xpex-plugin-factory",
    version: "0.2.0",
    protocol: "MCP Streamable HTTP",
    endpoint: "/mcp",
    transport: "streamable-http",
    authentication: "none",
    tools: tools.map((tool) => tool.name),
    scope:
      "Blueprint validation, policy checks, preview compilation, and deterministic ZIP compilation only. No publishing or external mutation."
  };
}

export async function handleFactoryMcp(body: unknown) {
  const request = body as JsonRpcRequest;

  if (
    !request ||
    request.jsonrpc !== "2.0" ||
    typeof request.method !== "string"
  ) {
    return {
      status: 400,
      body: {
        jsonrpc: "2.0",
        id: request?.id ?? null,
        error: { code: -32600, message: "Invalid Request" }
      }
    };
  }

  if (request.method === "notifications/initialized") {
    return { status: 202, body: null };
  }

  if (request.method === "initialize") {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          protocolVersion: "2026-07-28",
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "xpex-plugin-factory",
            version: "0.2.0"
          },
          instructions:
            "Compile plugin artifacts from explicit blueprints. Never place credentials or private user data in a blueprint. This MCP does not publish plugins or mutate external systems."
        }
      }
    };
  }

  if (request.method === "ping") {
    return {
      status: 200,
      body: { jsonrpc: "2.0", id: request.id ?? null, result: {} }
    };
  }

  if (request.method === "tools/list") {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: { tools }
      }
    };
  }

  if (request.method === "tools/call") {
    const params =
      request.params &&
      typeof request.params === "object" &&
      !Array.isArray(request.params)
        ? (request.params as ToolCallParams)
        : {};

    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: await callTool(params)
      }
    };
  }

  return {
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: { code: -32601, message: "Method not found" }
    }
  };
}
