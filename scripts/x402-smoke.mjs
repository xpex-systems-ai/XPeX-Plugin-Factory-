import assert from "node:assert/strict";

const base = (process.env.FACTORY_URL || "https://xpex-plugin-factory-production.up.railway.app").replace(/\/$/, "");
const options = { signal: AbortSignal.timeout(20000) };
const discoveryResponse = await fetch(base + "/v1/x402", options);
assert.equal(discoveryResponse.status, 200);
const discovery = await discoveryResponse.json();
assert.equal(discovery.enabled, true);
assert.ok(discovery.sellerAddress);
const openapi = await fetch(base + "/openapi.json", options);
assert.equal(openapi.status, 200);
assert.ok((await openapi.json()).paths["/v1/x402/agent-kit"]);
const challengeResponse = await fetch(base + "/v1/x402/agent-kit", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(discovery.example), signal: AbortSignal.timeout(20000)
});
assert.equal(challengeResponse.status, 402);
const challenge = JSON.parse(Buffer.from(challengeResponse.headers.get("payment-required"), "base64").toString());
assert.equal(challenge.x402Version, 2);
assert.equal(challenge.accepts.length, 1);
const payment = challenge.accepts[0];
assert.equal(payment.amount, "10000");
assert.equal(payment.payTo.toLowerCase(), discovery.sellerAddress.toLowerCase());
assert.equal(payment.network, discovery.network);
assert.equal(payment.extra.name, "GatewayWalletBatched");
assert.equal(challengeResponse.headers.get("cache-control"), "no-store");
const malformed = await fetch(base + "/v1/x402/agent-kit", {
  method: "POST", headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": "not-a-payment" }, body: JSON.stringify(discovery.example), signal: AbortSignal.timeout(20000)
});
assert.equal(malformed.status, 400);
const llms = await fetch(base + "/llms.txt", options);
assert.equal(llms.status, 200);
assert.ok((await llms.text()).includes("/v1/x402/agent-kit"));
const wellKnown = await fetch(base + "/.well-known/mcp.json", options);
assert.equal(wellKnown.status, 200);
console.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), target: base, mode: discovery.mode, network: payment.network, amountAtomic: payment.amount, payTo: payment.payTo, asset: payment.asset, unpaidStatus: challengeResponse.status, invalidPaymentStatus: malformed.status, paidSettlementTested: false, fundsSpent: "0" }, null, 2));
