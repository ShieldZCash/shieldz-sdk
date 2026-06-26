import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Shieldz, { ShieldzError } from "../dist/esm/index.js";

function fakeInvoice(over = {}) {
  return {
    id: "inv_1", object: "invoice", amount_usd_cents: 5000, memo: null,
    settlement: { chain: "BASE", asset: "USDC", address: "0xabc" },
    customer_email: null, metadata: null, status: "pending", expires_at: 0,
    paid_after_expiry: false, submitted_tx_hash: null, created_at: 0, paid_at: null,
    mode: "test", pay_url: "https://shieldz.cash/pay/inv_1", zcash: null,
    payment_chain_id: null, payment_address: null, payment_amount_atomic: null,
    payment_targets: [], paid_on: null, ...over,
  };
}

/** Spin a one-off server with a custom handler. Returns {url, close, requests}. */
function serve(handler) {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const body = raw ? JSON.parse(raw) : null;
      const query = Object.fromEntries(url.searchParams);
      requests.push({ method: req.method, path: url.pathname, query, body });
      handler({ req, res, url, query, body, n: requests.length }, (status, obj, headers = {}) => {
        res.writeHead(status, { "content-type": "application/json", ...headers });
        res.end(JSON.stringify(obj));
      });
    });
  });
  return new Promise((resolve) =>
    server.listen(0, () => resolve({ url: `http://localhost:${server.address().port}`, requests, close: () => new Promise((r) => server.close(r)) })),
  );
}

const fastRetry = (url) => new Shieldz({ apiKey: "sk_test", baseUrl: url, maxRetryDelayMs: 10 });

test("retries 503 then succeeds", async () => {
  const mock = await serve(({ n }, send) => {
    if (n === 1) return send(503, { error: { type: "api_error", code: "unavailable", message: "try again" } });
    send(200, fakeInvoice());
  });
  const inv = await fastRetry(mock.url).invoices.retrieve("inv_1");
  assert.equal(inv.id, "inv_1");
  assert.equal(mock.requests.length, 2); // one retry
  await mock.close();
});

test("gives up after maxRetries and throws the last error (with requestId)", async () => {
  const mock = await serve((_ctx, send) =>
    send(503, { error: { type: "api_error", code: "unavailable", message: "down" } }, { "cf-ray": "ray123-IST" }),
  );
  const client = new Shieldz({ apiKey: "sk_test", baseUrl: mock.url, maxRetries: 2, maxRetryDelayMs: 10 });
  await assert.rejects(
    () => client.invoices.retrieve("inv_1"),
    (e) => e instanceof ShieldzError && e.status === 503 && e.requestId === "ray123-IST",
  );
  assert.equal(mock.requests.length, 3); // initial + 2 retries
  await mock.close();
});

test("honours Retry-After on 429", async () => {
  const mock = await serve(({ n }, send) => {
    if (n === 1) return send(429, { error: { code: "rate_limit", type: "rate_limit", message: "slow down" } }, { "retry-after": "0" });
    send(200, fakeInvoice());
  });
  const inv = await fastRetry(mock.url).invoices.retrieve("inv_1");
  assert.equal(inv.id, "inv_1");
  assert.equal(mock.requests.length, 2);
  await mock.close();
});

test("does NOT retry a 4xx (e.g. 400)", async () => {
  const mock = await serve((_ctx, send) => send(400, { error: { type: "invalid_request", code: "invalid_amount", message: "nope" } }));
  await assert.rejects(() => fastRetry(mock.url).invoices.create({ amount_usd_cents: 1 }), (e) => e.status === 400);
  assert.equal(mock.requests.length, 1); // no retries on 4xx
  await mock.close();
});

test("auto-attaches an idempotency_key to retryable POSTs, stable across retries", async () => {
  const keys = [];
  const mock = await serve(({ body, n }, send) => {
    keys.push(body?.idempotency_key);
    if (n === 1) return send(503, { error: { code: "unavailable", type: "api_error", message: "x" } });
    send(201, fakeInvoice({ amount_usd_cents: body.amount_usd_cents }));
  });
  await fastRetry(mock.url).invoices.create({ amount_usd_cents: 5000 });
  assert.equal(keys.length, 2);
  assert.ok(keys[0]?.startsWith("auto_"), "an idempotency_key was injected");
  assert.equal(keys[0], keys[1], "same key reused on retry (so create can't duplicate)");
  await mock.close();
});

test("does not overwrite a caller-supplied idempotency_key", async () => {
  let seen;
  const mock = await serve(({ body }, send) => { seen = body?.idempotency_key; send(201, fakeInvoice()); });
  await fastRetry(mock.url).invoices.create({ amount_usd_cents: 5000, idempotency_key: "ord_42" });
  assert.equal(seen, "ord_42");
  await mock.close();
});

test("listAll auto-paginates across cursors", async () => {
  const pages = {
    none: { object: "list", data: [fakeInvoice({ id: "inv_1" }), fakeInvoice({ id: "inv_2" })], has_more: true },
    inv_2: { object: "list", data: [fakeInvoice({ id: "inv_3" })], has_more: false },
  };
  const mock = await serve(({ query }, send) => send(200, pages[query.starting_after ?? "none"]));
  const ids = [];
  for await (const inv of fastRetry(mock.url).invoices.listAll()) ids.push(inv.id);
  assert.deepEqual(ids, ["inv_1", "inv_2", "inv_3"]);
  // page 1 (no cursor) + page 2 (starting_after=inv_2)
  assert.equal(mock.requests.length, 2);
  assert.equal(mock.requests[1].query.starting_after, "inv_2");
  await mock.close();
});
