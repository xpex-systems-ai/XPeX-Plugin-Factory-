import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching";
import { fileURLToPath } from "node:url";
import { createX402Router } from "../commerce/x402.js";
import { ZodError } from "zod";
import { generatePlugin, assertGenerationReady } from "../factory/generate.js";
import { packagePlugin } from "../factory/package.js";
import { FACTORY_OFFERS } from "../commerce/offers.js";
import { renderPricingPage } from "../commerce/pricingPage.js";
import {
  extractVerifiedFactoryPayment,
  stripeSignatureFromRequest,
  verifyStripeWebhookSignature,
  webhookSecretFromEnv
} from "../commerce/stripeWebhook.js";
import {
  getFactoryMcpDescriptor,
  handleFactoryMcp
} from "../mcp/handler.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");

app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json", limit: "512kb" }),
  (req, res) => {
    const secret = webhookSecretFromEnv();
    const signature = stripeSignatureFromRequest(req);

    if (!secret) {
      res.status(503).json({ error: "STRIPE_WEBHOOK_NOT_CONFIGURED" });
      return;
    }

    if (!signature || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "INVALID_STRIPE_WEBHOOK_REQUEST" });
      return;
    }

    try {
      verifyStripeWebhookSignature(req.body, signature, secret);
      const event = JSON.parse(req.body.toString("utf8")) as unknown;
      const payment = extractVerifiedFactoryPayment(event);

      if (payment) {
        console.log(
          JSON.stringify({
            type: "xpex.factory.payment.verified",
            ...payment
          })
        );
      }

      res.status(200).json({
        received: true,
        verifiedPayment: payment !== null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN";
      console.warn(
        JSON.stringify({
          type: "xpex.factory.payment.webhook_rejected",
          reason: message
        })
      );
      res.status(400).json({ error: "INVALID_STRIPE_SIGNATURE" });
    }
  }
);

app.use(express.json({ limit: "1mb", strict: true }));

const x402SellerAddress = process.env.XPEX_X402_SELLER_ADDRESS?.trim();
const x402Gateway = x402SellerAddress
  ? createGatewayMiddleware({ sellerAddress: x402SellerAddress })
  : null;

app.get("/v1/x402/status", (_req, res) => {
  noStore(res);
  res.json({
    enabled: x402Gateway !== null,
    provider: "Circle Gateway",
    protocol: "x402",
    priceUsd: "0.01",
    route: "/v1/x402/agent-readiness",
    moneyTruth:
      "A 402 challenge is not revenue. Only provider-confirmed settlement counts as payment."
  });
});

app.post(
  "/v1/x402/agent-readiness",
  (req, res, next) => {
    if (!x402Gateway) {
      res.status(503).json({ error: "X402_SELLER_NOT_CONFIGURED" });
      return;
    }
    x402Gateway.require("$0.01")(req, res, next);
  },
  (req, res) => {
    noStore(res);
    try {
      const result = generatePlugin(req.body);
      res.status(result.report.valid ? 200 : 422).json({
        paidService: "xpex-agent-readiness",
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
      res.status(500).json({ error: "X402_AGENT_READINESS_FAILED" });
    }
  }
);
app.use(createX402Router());
// Serve only intentional public assets, including the MCP discovery document.
app.use("/.well-known", express.static(fileURLToPath(new URL("../../public/.well-known", import.meta.url))));
app.use(express.static(fileURLToPath(new URL("../../public", import.meta.url))));
app.get("/openapi.yaml", (_req, res) => {
  res.sendFile(fileURLToPath(new URL("../../openapi.yaml", import.meta.url)));
});

function noStore(res: express.Response): void {
  res.setHeader("Cache-Control", "no-store");
}

app.get("/health", (_req, res) => {
  noStore(res);
  res.json({
    ok: true,
    service: "xpex-plugin-factory",
    version: "0.4.0",
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

app.get("/v1/offers", (_req, res) => {
  noStore(res);
  res.json({
    currency: "BRL",
    provider: "Stripe",
    livemode: true,
    moneyTruth:
      "Checkout creation is not revenue. Only provider-confirmed paid settlement counts as payment.",
    offers: FACTORY_OFFERS.map((offer) => ({
      id: offer.id,
      name: offer.name,
      priceBrl: offer.priceBrl,
      priceLabel: offer.priceLabel,
      description: offer.description,
      includes: offer.includes,
      featured: Boolean(offer.featured),
      checkoutUrl: offer.paymentUrl
    }))
  });
});

app.get("/pricing", (_req, res) => {
  res.type("html").send(renderPricingPage());
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    "User-agent: *\nAllow: /\nSitemap: https://xpex-plugin-factory-production.up.railway.app/sitemap.xml\n"
  );
});

app.get("/sitemap.xml", (_req, res) => {
  res.type("application/xml").send(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<url><loc>https://xpex-plugin-factory-production.up.railway.app/</loc></url>' +
      '<url><loc>https://xpex-plugin-factory-production.up.railway.app/pricing</loc></url>' +
      '<url><loc>https://xpex-plugin-factory-production.up.railway.app/plugin</loc></url>' +
      '<url><loc>https://xpex-plugin-factory-production.up.railway.app/support</loc></url>' +
      '</urlset>'
  );
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
      mcp: "POST /mcp",
      offers: "GET /v1/offers",
      pricing: "GET /pricing",
      stripeWebhook: "POST /stripe/webhook",
      agentKit: "POST /v1/x402/agent-kit",
      agentPayments: "GET /v1/x402",
      openapi: "GET /openapi.json"
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

app.get("/plugin", (_req, res) => {
  res.type("html").send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XPeX Plugin Factory</title></head><body style="font-family:system-ui;background:#0B1220;color:#fff;margin:0;padding:64px"><main style="max-width:900px;margin:auto"><div style="color:#FF7A00">XPEX SYSTEMS AI // OFFICIAL PLUGIN</div><h1 style="font-size:56px">XPeX Plugin Factory</h1><p style="color:#b8c4d8;font-size:18px;line-height:1.6">Compile validated blueprints into OpenAI/Codex plugin manifests, MCP configuration, skills, review metadata, and deterministic ZIP artifacts. The public factory plugin performs computation only and never publishes a plugin or mutates external systems.</p><p><a style="color:#00D4FF" href="/privacy">Privacy</a> · <a style="color:#00D4FF" href="/terms">Terms</a> · <a style="color:#00D4FF" href="/support">Support</a></p></main></body></html>'
  );
});

app.get("/privacy", (_req, res) => {
  res.type("html").send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XPeX Plugin Factory Privacy</title></head><body style="font-family:system-ui;background:#0B1220;color:#fff;margin:0;padding:64px"><main style="max-width:800px;margin:auto"><h1>Privacy Notice</h1><p>The public XPeX Plugin Factory accepts plugin blueprints for validation, preview, and deterministic compilation. Blueprints must not contain passwords, API keys, private keys, seed phrases, session cookies, or bearer credentials.</p><p>The service may process standard operational metadata such as request timestamps, response status, and security logs required to operate and protect the service. The public factory plugin does not publish generated plugins or connect to customer accounts.</p><p>Operator: XPeX Systems AI. Last updated: October 2, 2026.</p></main></body></html>'
  );
});

app.get("/terms", (_req, res) => {
  res.type("html").send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XPeX Plugin Factory Terms</title></head><body style="font-family:system-ui;background:#0B1220;color:#fff;margin:0;padding:64px"><main style="max-width:800px;margin:auto"><h1>Terms of Use</h1><p>XPeX Plugin Factory generates software artifacts from user-provided blueprints. Generated files require review before deployment or public submission. The factory does not guarantee approval by any third-party platform.</p><p>Do not submit credentials, confidential secrets, private keys, seed phrases, payment secrets, or session cookies. Users remain responsible for authorization, legal compliance, external service terms, and final release decisions.</p><p>Operator: XPeX Systems AI. Last updated: October 2, 2026.</p></main></body></html>'
  );
});

app.get("/support", (_req, res) => {
  res.type("html").send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XPeX Plugin Factory Support</title></head><body style="font-family:system-ui;background:#0B1220;color:#fff;margin:0;padding:64px"><main style="max-width:800px;margin:auto"><h1>Support</h1><p>For source, examples, and issue tracking, use the official XPeX Plugin Factory repository.</p><p><a style="color:#00D4FF" href="https://github.com/xpex-systems-ai/XPeX-Plugin-Factory-">GitHub repository</a></p><p>Never include passwords, API keys, private keys, seed phrases, Stripe secrets, or session cookies in support requests.</p></main></body></html>'
  );
});

app.get("/", (_req, res) => {
  res.type("html").send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>XPeX Plugin Factory</title><style>body{font-family:system-ui;background:#0B1220;color:white;margin:0;padding:64px}main{max-width:980px;margin:auto}.badge{color:#FF7A00}h1{font-size:64px;line-height:1}p{color:#b8c4d8;font-size:18px;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{border:1px solid #26344c;border-radius:18px;padding:20px;background:#0f1a2d}code{color:#00D4FF}</style></head><body><main>' +
      '<div class="badge">XPEX SYSTEMS AI // FACTORY V1</div>' +
      '<h1>Build agent software, not plugin boilerplate.</h1>' +
      '<p>Blueprint → security policy → OpenAI/Codex manifest → MCP config → skills → review metadata → deterministic ZIP.</p>' +
      '<p><a style="display:inline-block;background:#FF7A00;color:#07101f;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:900" href="/pricing">Começar por R$49</a></p>' +
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
