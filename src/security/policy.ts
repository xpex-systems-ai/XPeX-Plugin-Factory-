import type { PluginBlueprint } from "../domain/blueprint.js";
import type { FactoryFinding } from "../domain/report.js";

const secretPatterns: Array<{ code: string; pattern: RegExp; label: string }> = [
  { code: "SECRET_OPENAI", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/, label: "OpenAI-style API key" },
  { code: "SECRET_STRIPE", pattern: /\b(?:sk|rk|whsec)_(?:live|test)?_?[A-Za-z0-9]{16,}\b/, label: "Stripe credential" },
  { code: "SECRET_GXEON", pattern: /\bgxa_live_[A-Za-z0-9_-]{12,}\b/, label: "GXEON machine key" },
  { code: "SECRET_PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: "private key" },
  { code: "SECRET_BEARER", pattern: /Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+\/-]{16,}/i, label: "bearer credential" }
];

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  const match = h.match(/^172\.(\d{1,3})\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (h === "::1" || /^fc/i.test(h) || /^fd/i.test(h) || /^fe[89ab]/i.test(h)) return true;
  return false;
}

export function runSecurityPolicy(blueprint: PluginBlueprint): FactoryFinding[] {
  const findings: FactoryFinding[] = [];
  const serialized = JSON.stringify(blueprint);

  for (const candidate of secretPatterns) {
    if (candidate.pattern.test(serialized)) {
      findings.push({
        code: candidate.code,
        severity: "error",
        message: `Blueprint appears to contain a ${candidate.label}. Secrets must never be packaged.`
      });
    }
  }

  for (const server of blueprint.mcpServers) {
    const url = new URL(server.url);
    if (isPrivateHostname(url.hostname)) {
      findings.push({
        code: "MCP_PRIVATE_HOST",
        severity: "error",
        path: `mcpServers.${server.name}.url`,
        message: "Public plugin MCP endpoints cannot target localhost or private network hosts."
      });
    }

    if (server.auth === "machine-key") {
      findings.push({
        code: "MACHINE_KEY_PLUGIN_BOUNDARY",
        severity: "warning",
        path: `mcpServers.${server.name}.auth`,
        message:
          "Machine-key MCP is suitable for server-to-server agents, but public ChatGPT user-linked execution should use OAuth 2.1 instead of embedding credentials."
      });
    }
  }

  if (blueprint.review.commerce) {
    findings.push({
      code: "COMMERCE_REVIEW_REQUIRED",
      severity: "warning",
      path: "review.commerce",
      message:
        "Commerce is enabled. Re-check current platform commerce rules and payment-provider requirements before submission."
    });
  }

  if (blueprint.security.dataClassification !== "public" && blueprint.mcpServers.some((server) => server.auth === "none")) {
    findings.push({
      code: "PUBLIC_AUTH_MISMATCH",
      severity: "error",
      path: "security.dataClassification",
      message: "Account or sensitive data cannot be exposed through unauthenticated MCP servers."
    });
  }

  if (!blueprint.repository) {
    findings.push({
      code: "REPOSITORY_RECOMMENDED",
      severity: "info",
      path: "repository",
      message: "A source repository is recommended for operational traceability."
    });
  }

  return findings;
}
