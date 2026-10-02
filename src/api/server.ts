import express from "express";
import { ZodError } from "zod";
import { generatePlugin, assertGenerationReady } from "../factory/generate.js";
import { packagePlugin } from "../factory/package.js";
import {
  getFactoryMcpDescriptor,
  handleFactoryMcp
} from "../mcp/handler.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb", strict: true }));

function noStore(res: express.Response): void {
  res.setHeader("Cache-Control", "no-store");
}

app.get("/health", (_req, res) => {
  noStore(res);
  res.json({
    ok: true,
    service: "xpex-plugin-factory",
    version: "0.2.0",
    environment: process.env.XPEX_FACTORY_ENV ?? "development"
  });
});

app.get("/mcp", (_req, res) => {
  noStore(res);
  res.json(getFactoryMcpDescriptor());
});

app.post("/mcp", async (req, res) => {
  noStore(res);
  const result = await handleFactoryMcp(req.body);
  res.status(result.status);
  if (result.body === null) {
    res.end();
    return;
  }
  res.json(result.body);
});

app.get("/v1/schema", (_req, res) => {
  noStore(res);
  res.json({
    name: "XPeX Plugin Factory Blueprint",
    version: "1",
    endpoints: {
      validate: "POST /v1/validate",
      preview: "POST /v1/preview",
      package: "POST /v1/package",
      mcp: "POST /mcp"
    },
    note: "Secrets must never be placed in a blueprint."
  });
});

app.post("/v1/validate", (req, res) => {
  noStore(res);
  try {
    const result = generatePlugin(req.body);
    res.status(result.report.valid ? 200 : 422).json({
      blueprint: {
        name: result.blueprint.name,
        version: result.blueprint.version,
        displayName: result.blueprint.displayName
      },
      report: result.report
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "INVALID_BLUEPRINT", issues: error.issues });
      return;
    }
    res.status(500).json({ error: "FACTORY_VALIDATION_FAILED" });
  }
});

app.post("/v1/preview", (req, res) => {
  noStore(res);
  try {
    const result = generatePlugin(req.body);
    if (!result.report.valid) {
      res.status(422).json({ report: result.report });
      return;
    }

    const previewPaths = new Set([
      "plugin.json",
      ".codex-plugin/plugin.json",
      "mcp.json",
      ".mcp.json",
      "README.md"
    ]);

    res.json({
      report: result.report,
      files: Object.fromEntries(
        result.files
          .filter((file) => previewPaths.has(file.path))
          .map((file) => [file.path, file.content])
      )
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "INVALID_BLUEPRINT", issues: error.issues });
      return;
    }
    res.status(500).json({ error: "FACTORY_PREVIEW_FAILED" });
  }
});

app.post("/v1/package", async (req, res) => {
  noStore(res);
  try {
    const result = generatePlugin(req.body);
    assertGenerationReady(result);
    const archive = await packagePlugin(result);

    res.status(200);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="' + result.blueprint.name + "-" + result.blueprint.version + '.zip"'
    );
    res.setHeader("X-XPeX-Factory-Valid", "true");
    res.send(archive);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "INVALID_BLUEPRINT", issues: error.issues });
      return;
    }

    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Factory policy blocked")) {
      res.status(422).json({ error: "FACTORY_POLICY_BLOCKED", message });
      return;
    }

    res.status(500).json({ error: "FACTORY_PACKAGE_FAILED" });
  }
});

app.get("/", (_req, res) => {
  res.type("html").send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>XPeX Plugin Factory</title><style>body{font-family:system-ui;background:#0B1220;color:white;margin:0;padding:64px}main{max-width:980px;margin:auto}.badge{color:#FF7A00}h1{font-size:64px;line-height:1}p{color:#b8c4d8;font-size:18px;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{border:1px solid #26344c;border-radius:18px;padding:20px;background:#0f1a2d}code{color:#00D4FF}</style></head><body><main>' +
      '<div class="badge">XPEX SYSTEMS AI // FACTORY V1</div>' +
      '<h1>Build agent software, not plugin boilerplate.</h1>' +
      '<p>Blueprint → security policy → OpenAI/Codex manifest → MCP config → skills → review metadata → deterministic ZIP.</p>' +
      '<div class="grid"><div class="card"><b>01 Blueprint</b><p>Typed product, MCP, skill, review and security contract.</p></div>' +
      '<div class="card"><b>02 Guardrails</b><p>Secret scanning, HTTPS, auth checks and approval gates.</p></div>' +
      '<div class="card"><b>03 Generate</b><p>Plugin manifests, MCP configs, skills, icon and docs.</p></div>' +
      '<div class="card"><b>04 Agentic</b><p>Agents can use the factory itself through <code>/mcp</code>.</p></div>' +
      '<div class="card"><b>05 Ship</b><p><code>/v1/validate</code> → <code>/v1/preview</code> → <code>/v1/package</code>.</p></div></div>' +
      '</main></body></html>'
  );
});

app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, "0.0.0.0", () => {
    console.log("XPeX Plugin Factory listening on :" + port);
  });
}

export { app };
