import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const base =
  process.env.FACTORY_BASE_URL ??
  "https://gxeon-agent-gateway-production.up.railway.app";

const blueprint = JSON.parse(
  await readFile(
    new URL("../examples/gxeon-agent-gateway.blueprint.json", import.meta.url),
    "utf8",
  ),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postJson(path, payload) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, application/zip" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  return response;
}

const results = [];

{
  const response = await postJson("/v1/validate", blueprint);
  const body = await response.json();
  assert(response.status === 200, `validate expected 200, got ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.report?.valid === true, "validate report.valid must be true");
  results.push({ check: "validate-reference", status: response.status, pass: true });
}

{
  const response = await postJson("/v1/preview", blueprint);
  const body = await response.json();
  assert(response.status === 200, `preview expected 200, got ${response.status}: ${JSON.stringify(body)}`);
  const paths = Object.keys(body?.files ?? {}).sort();
  for (const required of [
    "plugin.json",
    ".codex-plugin/plugin.json",
    "mcp.json",
    ".mcp.json",
    "README.md",
  ]) {
    assert(paths.includes(required), `preview missing ${required}`);
  }
  results.push({ check: "preview-reference", status: response.status, pass: true, files: paths });
}

{
  const response = await postJson("/v1/package", blueprint);
  assert(response.status === 200, `package expected 200, got ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  const validHeader = response.headers.get("x-xpex-factory-valid");
  assert(contentType.includes("application/zip"), `package content-type mismatch: ${contentType}`);
  assert(validHeader === "true", `package validity header mismatch: ${validHeader}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.length > 500, `package too small: ${bytes.length} bytes`);
  const zip = await JSZip.loadAsync(bytes);
  const paths = Object.keys(zip.files).sort();
  for (const required of [
    "plugin.json",
    ".codex-plugin/plugin.json",
    "mcp.json",
    ".mcp.json",
    "README.md",
    "FACTORY-REPORT.json",
    "skills/gxeon-market/SKILL.md",
  ]) {
    assert(paths.includes(required), `zip missing ${required}`);
  }
  results.push({
    check: "package-reference",
    status: response.status,
    pass: true,
    contentType,
    validHeader,
    bytes: bytes.length,
    files: paths,
  });
}

{
  const bad = structuredClone(blueprint);
  bad.mcpServers[0].url = "https://127.0.0.1/mcp";
  const response = await postJson("/v1/validate", bad);
  const body = await response.json();
  assert(response.status === 422, `private-host expected 422, got ${response.status}: ${JSON.stringify(body)}`);
  const codes = (body?.report?.findings ?? []).map((x) => x.code);
  assert(codes.includes("MCP_PRIVATE_HOST"), `missing MCP_PRIVATE_HOST: ${JSON.stringify(codes)}`);
  results.push({ check: "reject-private-mcp", status: response.status, pass: true, codes });
}

{
  const bad = structuredClone(blueprint);
  bad.skills[0].instructions += " Fake test credential: sk-123456789012345678901234567890";
  const response = await postJson("/v1/validate", bad);
  const body = await response.json();
  assert(response.status === 422, `secret expected 422, got ${response.status}: ${JSON.stringify(body)}`);
  const codes = (body?.report?.findings ?? []).map((x) => x.code);
  assert(codes.includes("SECRET_OPENAI"), `missing SECRET_OPENAI: ${JSON.stringify(codes)}`);
  results.push({ check: "reject-secret", status: response.status, pass: true, codes });
}

console.log(JSON.stringify({ base, ok: true, results }, null, 2));
