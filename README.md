# @shieldz/sdk

[![CI](https://github.com/ShieldZCash/shieldz-node/actions/workflows/ci.yml/badge.svg)](https://github.com/ShieldZCash/shieldz-node/actions/workflows/ci.yml)

Official Node / TypeScript SDK for [**Shieldz**](https://shieldz.cash) — non-custodial crypto payments with **$0 fees**.

Accept **USDC/USDT** across Base, Arbitrum, Optimism, Polygon, and Ethereum, plus native **Bitcoin** and shielded **Zcash**. Funds settle straight to your own wallet — Shieldz never holds them, and never asks for your keys.

- 🪪 **Non-custodial** — payments go wallet → wallet; you keep the keys.
- 💸 **$0 platform fees** — you only pay network gas.
- 🧩 **Stripe-shaped API** — create an invoice, send the hosted checkout, get a signed webhook.
- 🌐 **Runs anywhere** — zero dependencies, pure web standards (`fetch` + Web Crypto). Works on Node 18+, Deno, Bun, Cloudflare Workers, and Vercel/Netlify Edge. Ships **dual ESM + CommonJS** (`import` and `require`).
- 🔁 **Resilient** — automatic retries with backoff on transient failures, idempotent invoice creation, and async-iterator auto-pagination.

## Install

```bash
npm install @shieldz/sdk
```

Requires Node 18+ (or any runtime with `fetch` + Web Crypto). Get an API key (`sk_live_…` / `sk_test_…`) from your [merchant dashboard](https://merchant.shieldz.cash) → Developers.

## Quickstart

```ts
import Shieldz from "@shieldz/sdk";

const shieldz = new Shieldz(process.env.SHIELDZ_API_KEY!);

// Create an invoice
const invoice = await shieldz.invoices.create({
  amount_usd_cents: 5000, // $50.00
  memo: "Order #1234",
  metadata: { order_id: "1234" },
});

console.log(invoice.id, invoice.status, invoice.pay_url);
// → send your customer to invoice.pay_url (the hosted checkout)
```

CommonJS works too:

```js
const { Shieldz } = require("@shieldz/sdk");
const shieldz = new Shieldz(process.env.SHIELDZ_API_KEY);
```

### Retrieve & list

```ts
const inv = await shieldz.invoices.retrieve("Qgvz8WQw0mnv2M8");

// One page
const page = await shieldz.invoices.list({ limit: 20, status: "paid" });
console.log(page.data, page.has_more);

// …or auto-paginate across every page (follows the cursor for you)
for await (const invoice of shieldz.invoices.listAll({ status: "paid" })) {
  console.log(invoice.id);
}
```

### Retries & idempotency

Transient failures (network errors, timeouts, `429`, and `5xx`) are retried automatically with exponential backoff + jitter — `2` retries by default, honouring `Retry-After`. To make a retried `POST /invoices` safe, the SDK auto-attaches an `idempotency_key`, so a create can never duplicate. Pass your own `idempotency_key` to tie it to your order id:

```ts
await shieldz.invoices.create({ amount_usd_cents: 5000, idempotency_key: "order_1234" });
```

Replaying the same key returns the original invoice (`idempotent_replay: true`) instead of creating a second one. Tune or disable retries via `maxRetries` (see Configuration).

## Webhooks

Register an HTTPS endpoint in the dashboard and save the `whsec_…` signing secret. Shieldz sends `invoice.paid` and `invoice.failed` events, signed with HMAC-SHA256.

Verification uses the Web Crypto API, so it's **async** and runs on any runtime (Node, Deno, Bun, Cloudflare Workers, Edge). **Always verify against the raw request body** (not a re-serialized object):

```ts
import express from "express";
import { constructEvent } from "@shieldz/sdk";

const app = express();

// Capture the raw body for this route
app.post("/webhooks/shieldz", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await constructEvent(
      req.body, // Buffer / Uint8Array (raw bytes)
      req.header("X-Shieldz-Signature") ?? "",
      process.env.SHIELDZ_WEBHOOK_SECRET!,
    );

    if (event.type === "invoice.paid") {
      // fulfill the order — idempotent on X-Shieldz-Delivery (deliveries are at-least-once)
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(400); // bad signature
  }
});
```

On Cloudflare Workers / Edge it's the same call — pass the raw body and header:

```ts
export default {
  async fetch(req: Request, env): Promise<Response> {
    const raw = await req.text();
    try {
      const event = await constructEvent(raw, req.headers.get("X-Shieldz-Signature") ?? "", env.SHIELDZ_WEBHOOK_SECRET);
      // handle event…
      return new Response("ok");
    } catch {
      return new Response("bad signature", { status: 400 });
    }
  },
};
```

`await verifySignature(rawBody, header, secret)` is also exported if you just want a boolean check. During the 24h after a secret rotation, the header carries both signatures (`v1=…,v1=…`) and either matches.

## Errors

Any non-2xx response throws `ShieldzError`:

```ts
import { ShieldzError } from "@shieldz/sdk";

try {
  await shieldz.invoices.create({ amount_usd_cents: 1 }); // below the $1 minimum
} catch (err) {
  if (err instanceof ShieldzError) {
    console.log(err.status, err.type, err.code, err.param, err.requestId);
    // 400 "invalid_request" "invalid_amount" "amount_usd_cents" "<cf-ray>"
  }
}
```

`err.requestId` is a correlation id for the failed request — quote it to support to trace it in the logs.

## Configuration

```ts
const shieldz = new Shieldz({
  apiKey: "sk_live_…",
  baseUrl: "https://shieldz.cash/api/v1", // default
  timeoutMs: 30_000,                       // default per-request timeout
  maxRetries: 2,                           // default; set 0 to disable
  maxRetryDelayMs: 8_000,                  // cap on a single backoff delay
  fetch: globalThis.fetch,                 // inject a custom fetch if you like
});
```

## Links

- Docs / API quickstart: https://shieldz.cash/docs
- How it works: https://shieldz.cash/methodology
- Is it safe? (non-custodial proof): https://shieldz.cash/verify
- Dashboard: https://merchant.shieldz.cash

## License

MIT © Deniz Yanbollu / Shieldz
