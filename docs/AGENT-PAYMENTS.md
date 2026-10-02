# Agent API payments

`POST /v1/x402/agent-kit` creates a deterministic public, read-only MCP/plugin starter from a small product specification. Price: **0.01 USDC**. It returns the full blueprint, generated files, policy report and base64 ZIP with SHA-256. It does not contact the customer MCP endpoint, invoke an LLM, publish software or promise marketplace acceptance.

Discovery: `GET /v1/x402`, `GET /.well-known/x402.json` and `GET /openapi.json`. Inspect the live `enabled`, `mode`, `network` and receiving address before paying.

## Server configuration

```dotenv
XPEX_X402_ENABLED=true
XPEX_X402_NETWORK=mainnet
XPEX_X402_SELLER_ADDRESS=<your-public-EVM-receiving-address>
XPEX_FACTORY_PUBLIC_URL=https://xpex-plugin-factory-production.up.railway.app
```

- Disabled by default. Enabled configuration requires an explicit network and nonzero EVM address; bad configuration prevents startup.
- `mainnet`: Base (`eip155:8453`), `https://gateway-api.circle.com`.
- `testnet`: Arc Testnet (`eip155:5042002`), `https://gateway-api-testnet.circle.com`. Test payments are not revenue.
- No seller private key is needed or stored. Stripe and the free MCP/blueprint endpoints retain their existing behavior.
- Rollback: set `XPEX_X402_ENABLED=false` and redeploy. The paid route returns 503; discovery reports disabled.

## Request flow

1. Obtain an example and schema from `/openapi.json` or `/v1/x402`.
2. POST the specification without payment. Valid requests receive 402 and `PAYMENT-REQUIRED`.
3. A compatible buyer wallet checks price, currency, network and recipient, signs locally, and retries the same request with `PAYMENT-SIGNATURE`. The buyer needs a funded Circle Gateway balance. This server never requests wallet keys.
4. Input validation, policy checks and archive preparation run before charging. SDK 3.5.0 verifies and settles through Circle. Failure releases no kit. Successful delivery includes `PAYMENT-RESPONSE` and a `gateway_accepted` receipt.

Provider acceptance is not a claim of on-chain finality, wallet withdrawal or fiat availability. Reconcile the provider transfer ID and its final status using Circle before recognizing confirmed receipts. Never count an HTTP 402 response, test fixture, quoted price or self-test as sales.

The Circle provider enforces payment authorization and nonce replay protection. The SDK constructs payment requirements from server configuration, not buyer-supplied prices or recipients. No recovery hook grants access after failure. After a timeout following payment, query/reconcile the existing transfer before creating a fresh authorization; artifact retrieval after a lost response is not persisted by this stateless service.

## Verification

`npm test`, `npm run check`, `npm run build`, `npm run smoke:production` and `npm run smoke:x402`.

The x402 test suite uses the real Circle middleware and HTTP routing with a **simulated facilitator** for success/failure/replay cases; it does not prove a live paid settlement. The production x402 smoke sends only unpaid requests, validates the real provider-generated challenge and checks malformed headers. No funds are spent.

Official integration reference: https://developers.circle.com/gateway-nanopayments/quickstarts/seller

Publishing these endpoints does not automatically register the service in the Circle marketplace. Directory submission and approval are separate.
