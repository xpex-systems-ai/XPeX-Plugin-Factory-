import express from "express";
import { createGatewayMiddleware, type PaymentRequest } from "@circle-fin/x402-batching/server";
import { isAddress } from "viem";
import { z, ZodError } from "zod";
import { agentKitExample, agentKitSchema, prepareAgentKit } from "./agentKit.js";

export const AGENT_KIT_PATH = "/v1/x402/agent-kit";
export const AGENT_KIT_PRICE = "0.01";
const environments = {
  mainnet: { facilitatorUrl: "https://gateway-api.circle.com", network: "eip155:8453" },
  testnet: { facilitatorUrl: "https://gateway-api-testnet.circle.com", network: "eip155:5042002" }
} as const;

export function readX402Config(env: NodeJS.ProcessEnv = process.env) {
  if (env.XPEX_X402_ENABLED !== "true") return null;
  const mode = env.XPEX_X402_NETWORK;
  const sellerAddress = env.XPEX_X402_SELLER_ADDRESS;
  if (mode !== "mainnet" && mode !== "testnet") throw new Error("XPEX_X402_NETWORK must be mainnet or testnet");
  if (!sellerAddress || !isAddress(sellerAddress) || /^0x0{40}$/i.test(sellerAddress)) {
    throw new Error("XPEX_X402_SELLER_ADDRESS must be a valid nonzero EVM address");
  }
  return { mode, sellerAddress, ...environments[mode] };
}

export function createX402Router(env: NodeJS.ProcessEnv = process.env) {
  const router = express.Router();
  const config = readX402Config(env);
  const publicUrl = (env.XPEX_FACTORY_PUBLIC_URL || "https://xpex-plugin-factory-production.up.railway.app").replace(/\/$/, "");
  const terms = {
    enabled: config !== null,
    mode: config?.mode ?? "disabled",
    currency: "USDC",
    price: AGENT_KIT_PRICE,
    amountAtomic: "10000",
    network: config?.network ?? null,
    sellerAddress: config?.sellerAddress ?? null,
    facilitator: config?.facilitatorUrl ?? null,
    settlement: "Circle Gateway balance; subsequent on-chain settlement/withdrawal is separate. HTTP 402 is not revenue."
  };
  router.use((req, res, next) => {
    if (req.path.includes("x402") || req.path === "/openapi.json") {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, PAYMENT-SIGNATURE");
      res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
    }
    next();
  });
  router.options(AGENT_KIT_PATH, (_req, res) => { res.sendStatus(204); });
  router.get(["/v1/x402", "/.well-known/x402.json"], (_req, res) => {
    res.json({
      service: "XPeX Plugin Factory", protocol: "x402", x402Version: 2,
      ...terms,
      openapi: `${publicUrl}/openapi.json`,
      endpoints: [{ method: "POST", url: publicUrl + AGENT_KIT_PATH, product: "MCP Plugin Starter Kit", price: AGENT_KIT_PRICE, currency: "USDC" }],
      example: agentKitExample,
      requirements: "Buyer needs a compatible wallet with funded Circle Gateway balance. Seller never receives buyer private keys."
    });
  });
  router.get("/openapi.json", (_req, res) => {
    res.json({
      openapi: "3.1.0",
      info: { title: "XPeX Agent API", version: "1.0.0", description: "Deterministic read-only MCP/plugin starter kits. 0.01 USDC per call via x402 and Circle Gateway. Existing free blueprint APIs and human Stripe services remain available.", "x-guidance": "Use POST /v1/x402/agent-kit with a public HTTPS MCP URL and product details. Inspect the 402 challenge and authorize payment before retrying with PAYMENT-SIGNATURE." },
      servers: [{ url: publicUrl }],
      paths: {
        [AGENT_KIT_PATH]: { post: {
          operationId: "createMcpPluginStarterKit",
          summary: "Generate a read-only MCP/plugin starter ZIP with integrity hash",
          description: "Provide your public MCP endpoint and product details. Returns blueprint, files, policy report and base64 ZIP. Deterministic templates; no LLM calls, endpoint verification or publication. Invalid inputs are rejected before any payment. Send PAYMENT-SIGNATURE only after inspecting the 402 challenge.",
          "x-payment": terms,
          "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: AGENT_KIT_PRICE }, protocols: [{ x402: {} }] },
          parameters: [{ in: "header", name: "PAYMENT-SIGNATURE", required: false, schema: { type: "string" }, description: "Base64 x402 v2 payment authorization, created by a compatible buyer wallet." }],
          requestBody: { required: true, content: { "application/json": { schema: z.toJSONSchema(agentKitSchema), example: agentKitExample } } },
          responses: {
            "200": { description: "Circle accepted payment; generated kit and provider receipt.", headers: { "PAYMENT-RESPONSE": { schema: { type: "string" }, description: "Base64 provider settlement response." } }, content: { "application/json": { schema: { type: "object", required: ["product", "archive", "payment"], properties: { product: { type: "string" }, archive: { type: "object", properties: { filename: { type: "string" }, data: { type: "string", contentEncoding: "base64" }, sha256: { type: "string" } } }, payment: { type: "object" } } } } } },
            "400": { description: "Invalid input or payment header; no charge." },
            "402": { description: "Payment required or rejected. Decode PAYMENT-REQUIRED for payment options.", headers: { "PAYMENT-REQUIRED": { schema: { type: "string" }, description: "Base64 x402 v2 payment requirements." } } },
            "422": { description: "Policy rejected input; no charge." },
            "503": { description: "Payments disabled or unavailable; no kit released." }
          }
        } }
      }
    });
  });
  const gateway = config ? createGatewayMiddleware({
    sellerAddress: config.sellerAddress,
    facilitatorUrl: config.facilitatorUrl,
    networks: [config.network],
    description: "XPeX deterministic MCP/plugin starter kit with ZIP, policy report and SHA-256"
  }) : null;

  router.post(AGENT_KIT_PATH, async (req, res, next) => {
    if (!gateway) { res.status(503).json({ error: "X402_NOT_ENABLED" }); return; }
    try {
      // Discovery clients probe without an input body. A no-signature probe may
      // inspect the 402 terms, but cannot buy or receive an artifact.
      const emptyProbe = req.headers["payment-signature"] === undefined &&
        (!req.body || (typeof req.body === "object" && !Array.isArray(req.body) && Object.keys(req.body).length === 0));
      if (emptyProbe) { res.locals.x402DiscoveryProbe = true; next(); return; }
      // Prepare the complete deliverable before asking the provider to charge.
      const prepared = await prepareAgentKit(req.body);
      if (!prepared.ok) { res.status(422).json({ error: "FACTORY_POLICY_BLOCKED", report: prepared.report }); return; }
      res.locals.agentKit = prepared.result;
      const signature = req.headers["payment-signature"];
      if (signature !== undefined) {
        if (typeof signature !== "string" || signature.length > 16384) throw new Error("INVALID_PAYMENT_HEADER");
        try {
          const payload = JSON.parse(Buffer.from(signature, "base64").toString("utf8"));
          if (payload?.x402Version !== 2 || !payload?.accepted || !payload?.payload) throw new Error();
        } catch { throw new Error("INVALID_PAYMENT_HEADER"); }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) { res.status(400).json({ error: "INVALID_AGENT_KIT_INPUT", issues: error.issues }); return; }
      if (error instanceof Error && error.message === "INVALID_PAYMENT_HEADER") { res.status(400).json({ error: "INVALID_PAYMENT_HEADER" }); return; }
      res.status(503).json({ error: "AGENT_KIT_PREPARATION_FAILED" });
    }
  }, (req, res, next) => {
    // Some public directories inspect the JSON body instead of the v2 header.
    // Mirror only the SDK's empty challenge response, using its exact terms.
    const end = res.end.bind(res);
    res.end = ((...args: any[]) => {
      const required = res.getHeader("PAYMENT-REQUIRED");
      if (res.statusCode === 402 && typeof required === "string" && String(args[0]) === "{}") {
        try {
          const challenge = JSON.parse(Buffer.from(required, "base64").toString("utf8"));
          if (challenge.x402Version === 2 && Array.isArray(challenge.accepts)) {
            args[0] = JSON.stringify(challenge);
            res.removeHeader("Content-Length");
          }
        } catch { /* Preserve the SDK response if the header cannot be decoded. */ }
      }
      return end(...args as Parameters<typeof end>);
    }) as typeof res.end;
    // No grant-access or recovery hooks: only provider-accepted payments pass.
    void gateway!.require(`$${AGENT_KIT_PRICE}`)(req, res, next);
  }, (req, res) => {
    if (res.locals.x402DiscoveryProbe) { res.status(503).json({ error: "DISCOVERY_PROBE_NO_DELIVERY" }); return; }
    const payment = (req as PaymentRequest).payment;
    if (!payment?.verified || payment.amount !== "10000" || payment.network !== config?.network) {
      res.status(503).json({ error: "PAYMENT_RECEIPT_UNAVAILABLE" }); return;
    }
    console.log(JSON.stringify({ type: "xpex.factory.x402.accepted", mode: config.mode, amount: payment.amount, currency: "USDC", network: payment.network, transaction: payment.transaction ?? null, artifactSha256: res.locals.agentKit.archive.sha256 }));
    res.json({ ...res.locals.agentKit, payment: { status: "gateway_accepted", mode: config.mode, ...payment } });
  });
  return router;
}
