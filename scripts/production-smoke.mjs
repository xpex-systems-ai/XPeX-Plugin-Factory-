import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const baseUrl = (process.env.FACTORY_URL ??
  "https://xpex-plugin-factory-production.up.railway.app"
).replace(/\/$/, "");

const blueprint = JSON.parse(
  await readFile(
    new URL("../examples/gxeon-agent-gateway.blueprint.json", import.meta.url),
    "utf8"
  )
);

const results = [];

function record(name, passed, evidence) {
  results.push({ name, passed, evidence });
  if (!passed) {
    throw new Error(`${name} failed: ${JSON.stringify(evidence)}`);
  }
}

async function getJson(path) {
  const response = await fetch(baseUrl + path, {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  let body = null;
  try {
    body = await response.json();
  } catch {}
  return { response, body };
}

async function postJson(path, body) {
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  let json = null;
  try {
    json = await response.clone().json();
  } catch {}
  return { response, body: json };
}

const health = await getJson("/health");
record(
  "health",
  health.response.status === 200 &&
    health.body?.ok === true &&
    health.body?.service === "xpex-plugin-factory",
  {
    status: health.response.status,
    service: health.body?.service,
    version: health.body?.version,
    environment: health.body?.environment
  }
);

const schema = await getJson("/v1/schema");
record(
  "schema",
  schema.response.status === 200 &&
    schema.body?.endpoints?.validate === "POST /v1/validate" &&
    schema.body?.endpoints?.preview === "POST /v1/preview" &&
    schema.body?.endpoints?.package === "POST /v1/package",
  {
    status: schema.response.status,
    endpoints: schema.body?.endpoints
  }
);

const validation = await postJson("/v1/validate", blueprint);
record(
  "validate_reference_blueprint",
  validation.response.status === 200 &&
    validation.body?.report?.valid === true &&
    Array.isArray(validation.body?.report?.generatedFiles) &&
    validation.body.report.generatedFiles.length >= 6,
  {
    status: validation.response.status,
    valid: validation.body?.report?.valid,
    findings: validation.body?.report?.findings,
    generatedFiles: validation.body?.report?.generatedFiles
  }
);

const preview = await postJson("/v1/preview", blueprint);
const previewKeys =
  preview.body?.files && typeof preview.body.files === "object"
    ? Object.keys(preview.body.files).sort()
    : [];
record(
  "preview_reference_blueprint",
  preview.response.status === 200 &&
    previewKeys.includes("plugin.json") &&
    previewKeys.includes(".codex-plugin/plugin.json") &&
    previewKeys.includes("mcp.json") &&
    previewKeys.includes(".mcp.json") &&
    previewKeys.includes("README.md"),
  {
    status: preview.response.status,
    fileKeys: previewKeys
  }
);

const packageResponse = await fetch(baseUrl + "/v1/package", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/zip"
  },
  body: JSON.stringify(blueprint)
});
const packageBytes = Buffer.from(await packageResponse.arrayBuffer());
const zip = await JSZip.loadAsync(packageBytes);
const zipEntries = Object.keys(zip.files).sort();

record(
  "package_reference_blueprint",
  packageResponse.status === 200 &&
    packageResponse.headers.get("content-type")?.includes("application/zip") === true &&
    packageResponse.headers.get("x-xpex-factory-valid") === "true" &&
    packageBytes.length > 500 &&
    zipEntries.includes("plugin.json") &&
    zipEntries.includes(".codex-plugin/plugin.json") &&
    zipEntries.includes("mcp.json") &&
    zipEntries.includes("FACTORY-REPORT.json"),
  {
    status: packageResponse.status,
    contentType: packageResponse.headers.get("content-type"),
    factoryValid: packageResponse.headers.get("x-xpex-factory-valid"),
    bytes: packageBytes.length,
    entries: zipEntries
  }
);

const negativeBlueprint = structuredClone(blueprint);
negativeBlueprint.mcpServers[0].url = "https://127.0.0.1/mcp";

const negative = await postJson("/v1/validate", negativeBlueprint);
const negativeCodes = Array.isArray(negative.body?.report?.findings)
  ? negative.body.report.findings.map((finding) => finding.code)
  : [];

record(
  "reject_private_mcp",
  negative.response.status === 422 &&
    negative.body?.report?.valid === false &&
    negativeCodes.includes("MCP_PRIVATE_HOST"),
  {
    status: negative.response.status,
    valid: negative.body?.report?.valid,
    findingCodes: negativeCodes
  }
);

console.log(
  JSON.stringify(
    {
      ok: true,
      target: baseUrl,
      checkedAt: new Date().toISOString(),
      results
    },
    null,
    2
  )
);
