import express from "express";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentKitExample } from "./agentKit.js";
import { AGENT_KIT_PATH, createX402Router, readX402Config } from "./x402.js";

const seller = "0x1111111111111111111111111111111111111111";
const payer = "0x2222222222222222222222222222222222222222";
const network = "eip155:8453";
const asset = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const config = { XPEX_X402_ENABLED: "true", XPEX_X402_NETWORK: "mainnet", XPEX_X402_SELLER_ADDRESS: seller };
const realFetch = globalThis.fetch;
let server: Server;
let base: string;
let providerCalls: Array<{ url: string; body: any }>;
let failSettlement: boolean;
let offline: boolean;
let seen: Set<string>;

async function start(env = config) {
  const app = express();
  app.use(express.json());
  app.use(createX402Router(env));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  base = `http://127.0.0.1:${address.port}`;
}
function header(options: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify({
    x402Version: 2,
    accepted: { network },
    payload: { signature: "TEST_VALID", authorization: { from: payer, to: seller, value: "10000", nonce: "test-nonce" } },
    ...options
  })).toString("base64");
}
function request(signature?: string, body: unknown = agentKitExample) {
  return realFetch(base + AGENT_KIT_PATH, {
    method: "POST", headers: { "content-type": "application/json", ...(signature ? { "PAYMENT-SIGNATURE": signature } : {}) }, body: JSON.stringify(body)
  });
}
beforeEach(() => {
  providerCalls = []; failSettlement = false; offline = false; seen = new Set();
  vi.spyOn(console, "log").mockImplementation(() => {});
  // Simulated provider only. Exercise actual Circle SDK over the real HTTP route.
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("https://gateway-api.circle.com/")) return realFetch(input, init);
    if (offline) return Response.json({ error: "unavailable" }, { status: 503 });
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    providerCalls.push({ url, body });
    if (url.endsWith("/supported")) return Response.json({ kinds: [{ x402Version: 2, scheme: "exact", network, extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: "0x77777777dcc4d5a8b6e418fd04d8997ef11000ee", assets: [{ symbol: "USDC", address: asset, decimals: 6 }] } }], extensions: [], signers: {} });
    if (url.endsWith("/verify")) return Response.json({ isValid: body.paymentPayload.payload.signature === "TEST_VALID", payer, invalidReason: "invalid_signature" });
    if (url.endsWith("/settle")) {
      const nonce = body.paymentPayload.payload.authorization.nonce;
      if (failSettlement || seen.has(nonce)) return Response.json({ success: false, errorReason: "settlement_rejected", network, transaction: "", payer });
      seen.add(nonce);
      return Response.json({ success: true, transaction: "simulated-gateway-transfer", network, payer });
    }
    throw new Error(`Unexpected provider request: ${url}`);
  }));
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("x402 seller gate (simulated Circle provider; no funds)", () => {
  it("defaults to disabled and rejects ambiguous network or missing wallet", () => {
    expect(readX402Config({})).toBeNull();
    expect(() => readX402Config({ XPEX_X402_ENABLED: "true" })).toThrow();
    expect(() => readX402Config({ ...config, XPEX_X402_SELLER_ADDRESS: "0x" + "0".repeat(40) })).toThrow();
    expect(readX402Config({ ...config, XPEX_X402_NETWORK: "testnet" })?.network).toBe("eip155:5042002");
  });
  it("does not expose a kit when disabled", async () => {
    await start({ ...config, XPEX_X402_ENABLED: "false" });
    expect((await request(header())).status).toBe(503);
    expect(providerCalls).toHaveLength(0);
  });
  it("rejects invalid input and private MCP before payment processing", async () => {
    await start();
    expect((await request(header(), {})).status).toBe(400);
    expect((await request(header(), { ...agentKitExample, mcpUrl: "https://127.0.0.1/mcp" })).status).toBe(422);
    expect(providerCalls).toHaveLength(0);
  });
  it("returns an SDK-generated Base USDC 402 challenge with exact recipient and price", async () => {
    await start();
    const response = await request();
    expect(response.status).toBe(402);
    const challenge = JSON.parse(Buffer.from(response.headers.get("payment-required")!, "base64").toString());
    expect(challenge.accepts).toHaveLength(1);
    expect(challenge.accepts[0]).toMatchObject({ amount: "10000", payTo: seller, network, asset, scheme: "exact" });
    expect(await response.json()).toEqual({});
    expect(providerCalls.map((call) => call.url)).toEqual(["https://gateway-api.circle.com/v1/x402/supported"]);
  });
  it("lets an unauthenticated empty discovery probe inspect the 402 without a kit", async () => {
    await start();
    const response = await request(undefined, {});
    expect(response.status).toBe(402);
    expect(response.headers.has("payment-required")).toBe(true);
    expect(await response.json()).not.toHaveProperty("archive");
    expect(providerCalls.every((call) => call.url.endsWith("/supported"))).toBe(true);
    expect((await request(header(), {})).status).toBe(400);
  });
  it("rejects malformed payment headers without contacting the provider", async () => {
    await start();
    expect((await request("malformed")).status).toBe(400);
    expect(providerCalls).toHaveLength(0);
  });
  it("rejects testnet payment on mainnet", async () => {
    await start();
    expect((await request(header({ accepted: { network: "eip155:5042002" } }))).status).toBe(400);
    expect(providerCalls.every((call) => call.url.endsWith("/supported"))).toBe(true);
  });
  it("does not settle or deliver after rejected verification", async () => {
    await start();
    const response = await request(header({ payload: { signature: "INVALID" } }));
    expect(response.status).toBe(402);
    expect(await response.json()).not.toHaveProperty("archive");
    expect(providerCalls.some((call) => call.url.endsWith("/settle"))).toBe(false);
  });
  it("does not deliver after settlement failure", async () => {
    await start(); failSettlement = true;
    const response = await request(header());
    expect(response.status).toBe(402);
    expect(await response.json()).not.toHaveProperty("archive");
    expect(response.headers.has("payment-response")).toBe(false);
  });
  it("delivers a verifiable ZIP only after provider success and uses server-owned terms", async () => {
    await start();
    const response = await request(header({ accepted: { network, payTo: payer, amount: "1" } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.payment).toMatchObject({ status: "gateway_accepted", amount: "10000", network, transaction: "simulated-gateway-transfer" });
    const settleCall = providerCalls.find((call) => call.url.endsWith("/settle"))!;
    expect(settleCall.body.paymentRequirements).toMatchObject({ amount: "10000", payTo: seller, asset, network });
    const archive = Buffer.from(body.archive.data, "base64");
    expect(createHash("sha256").update(archive).digest("hex")).toBe(body.archive.sha256);
    const zip = await JSZip.loadAsync(archive);
    expect(zip.file(".codex-plugin/plugin.json")).not.toBeNull();
    expect(zip.file("FACTORY-REPORT.json")).not.toBeNull();
    expect(response.headers.has("payment-response")).toBe(true);
    const retry = await request(header());
    expect(retry.status).toBe(402);
    expect(await retry.json()).not.toHaveProperty("archive");
  });
  it("fails closed when the provider is unavailable", async () => {
    await start(); offline = true;
    const response = await request();
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await response.json()).not.toHaveProperty("archive");
  });
  it("exposes accurate OpenAPI, discovery and browser payment headers", async () => {
    await start();
    const doc = await (await realFetch(base + "/openapi.json")).json();
    expect(doc.paths[AGENT_KIT_PATH].post["x-payment"]).toMatchObject({ enabled: true, mode: "mainnet", sellerAddress: seller });
    expect(doc.paths[AGENT_KIT_PATH].post.requestBody.content["application/json"].schema.required).toContain("mcpUrl");
    const discovery = await (await realFetch(base + "/.well-known/x402.json")).json();
    expect(discovery.example).toEqual(agentKitExample);
    const preflight = await realFetch(base + AGENT_KIT_PATH, { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("PAYMENT-SIGNATURE");
  });
});
