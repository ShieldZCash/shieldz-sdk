import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Shieldz, { ShieldzError } from "../dist/esm/index.js";

function fakeInvoice(over = {}) {
  return {
    id: "inv_123", object: "invoice", amount_usd_cents: 5000, memo: null,
    settlement: { chain: "BASE", asset: "USDC", address: "0xabc" },
    customer_email: null, metadata: null, status: "pending", expires_at: 0,
    paid_after_expiry: false, submitted_tx_hash: null, created_at: 0, paid_at: null,
    mode: "test", pay_url: "https://shieldz.cash/pay/inv_123", zcash: null,
    payment_chain_id: null, payment_address: null, payment_amount_atomic: null,
    payment_targets: [], paid_on: null, ...over,
  };
}

/** A tiny mock of the Shieldz API that records every request it receives. */
function startMock() {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const reqBody = raw ? JSON.parse(raw) : null;
      requests.push({
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        auth: req.headers["authorization"],
        contentType: req.headers["content-type"],
        body: reqBody,
      });
      const send = (status, obj) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.method === "POST" && url.pathname === "/invoices") {
        if (!reqBody || reqBody.amount_usd_cents < 100) {
          return send(400, { error: { type: "invalid_request", code: "invalid_amount", message: "too small", param: "amount_usd_cents" } });
        }
        return send(201, fakeInvoice({ amount_usd_cents: reqBody.amount_usd_cents, memo: reqBody.memo ?? null }));
      }
      if (req.method === "GET" && url.pathname === "/invoices/inv_123") return send(200, fakeInvoice());
      if (req.method === "GET" && url.pathname === "/invoices/missing") {
        return send(404, { error: { type: "invalid_request", code: "invoice_not_found", message: "not found" } });
      }
      if (req.method === "GET" && url.pathname === "/invoices") {
        return send(200, { object: "list", data: [fakeInvoice()], has_more: false });
      }
      if (url.pathname === "/slow") return; // never responds → timeout test
      send(404, { error: { type: "invalid_request", code: "not_found", message: "no route" } });
    });
  });
  return new Promise((resolve) =>
    server.listen(0, () =>
      resolve({ url: `http://localhost:${server.address().port}`, requests, close: () => new Promise((r) => server.close(r)) }),
    ),
  );
}

let mock;
let shieldz;
before(async () => {
  mock = await startMock();
  shieldz = new Shieldz({ apiKey: "sk_test_abc", baseUrl: mock.url });
});
after(() => mock.close());

test("constructor requires an apiKey", () => {
  assert.throws(() => new Shieldz({ apiKey: "" }), /apiKey/);
  assert.throws(() => new Shieldz(""), /apiKey/);
});

test("invoices.create sends a signed POST and returns the invoice", async () => {
  const inv = await shieldz.invoices.create({ amount_usd_cents: 5000, memo: "Order #1" });
  assert.equal(inv.id, "inv_123");
  assert.equal(inv.amount_usd_cents, 5000);
  const req = mock.requests.at(-1);
  assert.equal(req.method, "POST");
  assert.equal(req.path, "/invoices");
  assert.equal(req.auth, "Bearer sk_test_abc");
  assert.equal(req.contentType, "application/json");
  assert.equal(req.body.amount_usd_cents, 5000);
  assert.equal(req.body.memo, "Order #1");
  // POSTs get an auto idempotency_key so retries can't duplicate.
  assert.match(req.body.idempotency_key, /^auto_/);
});

test("invoices.retrieve does a GET by id", async () => {
  const inv = await shieldz.invoices.retrieve("inv_123");
  assert.equal(inv.id, "inv_123");
  assert.equal(mock.requests.at(-1).method, "GET");
  assert.equal(mock.requests.at(-1).path, "/invoices/inv_123");
});

test("invoices.list forwards query params", async () => {
  const page = await shieldz.invoices.list({ limit: 25, status: "paid" });
  assert.equal(page.object, "list");
  assert.equal(page.has_more, false);
  assert.equal(page.data.length, 1);
  const q = mock.requests.at(-1).query;
  assert.equal(q.limit, "25");
  assert.equal(q.status, "paid");
  assert.equal("starting_after" in q, false); // undefined params are omitted
});

test("maps the error envelope to ShieldzError", async () => {
  await assert.rejects(
    () => shieldz.invoices.create({ amount_usd_cents: 1 }),
    (e) => {
      assert.ok(e instanceof ShieldzError);
      assert.equal(e.status, 400);
      assert.equal(e.type, "invalid_request");
      assert.equal(e.code, "invalid_amount");
      assert.equal(e.param, "amount_usd_cents");
      return true;
    },
  );
});

test("404 retrieve throws ShieldzError invoice_not_found", async () => {
  await assert.rejects(
    () => shieldz.invoices.retrieve("missing"),
    (e) => e instanceof ShieldzError && e.status === 404 && e.code === "invoice_not_found",
  );
});

test("times out with a connection_error", async () => {
  const fast = new Shieldz({ apiKey: "sk_test_abc", baseUrl: mock.url, timeoutMs: 150, maxRetries: 0 });
  await assert.rejects(
    () => fast.request("GET", "/slow"),
    (e) => e instanceof ShieldzError && e.status === 0 && e.code === "timeout",
  );
});

test("normalizes a trailing slash in baseUrl", async () => {
  const c = new Shieldz({ apiKey: "sk_test_abc", baseUrl: mock.url + "/" });
  const inv = await c.invoices.retrieve("inv_123");
  assert.equal(inv.id, "inv_123");
  assert.equal(mock.requests.at(-1).path, "/invoices/inv_123"); // no double slash
});
