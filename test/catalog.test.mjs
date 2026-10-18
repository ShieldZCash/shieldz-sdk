import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Shieldz from "../dist/esm/index.js";

/** Records every request and answers with a minimal object of the right kind. */
function startMock() {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const body = raw ? JSON.parse(raw) : null;
      requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
      const send = (status, obj) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      const kind = url.pathname.split("/")[1];
      const obj = { products: "product", prices: "price", payment_links: "payment_link", invoices: "invoice" }[kind];
      if (!obj) return send(404, { error: { type: "invalid_request", code: "not_found", message: "no route" } });
      if (req.method === "GET" && url.pathname === `/${kind}`) return send(200, { object: "list", data: [{ object: obj }] });
      send(req.method === "POST" && url.pathname === `/${kind}` ? 201 : 200, { id: `${obj}_1`, object: obj, ...body });
    });
  });
  return new Promise((resolve) =>
    server.listen(0, () => resolve({ url: `http://localhost:${server.address().port}`, requests, close: () => new Promise((r) => server.close(r)) })),
  );
}

let mock;
let sz;
before(async () => {
  mock = await startMock();
  sz = new Shieldz({ apiKey: "sk_test_x", baseUrl: mock.url, maxRetries: 0 });
});
after(() => mock.close());

test("products: create with a price, update, list", async () => {
  const p = await sz.products.create({ name: "Blue hoodie", default_price_data: { unit_amount_usd_cents: 4999 } });
  assert.equal(p.object, "product");
  await sz.products.update("prod_1", { default_price_data: { unit_amount_usd_cents: 5999 } });
  await sz.products.list({ active: true });
  const [c, u, l] = mock.requests.slice(-3);
  assert.deepEqual([c.method, c.path, c.body.default_price_data.unit_amount_usd_cents], ["POST", "/products", 4999]);
  assert.deepEqual([u.method, u.path], ["POST", "/products/prod_1"]);
  assert.deepEqual([l.method, l.path, l.query.active], ["GET", "/products", "true"]);
});

test("prices: create, archive, list by product", async () => {
  await sz.prices.create({ product: "prod_1", custom_unit_amount: { minimum_usd_cents: 500, maximum_usd_cents: 5000 } });
  await sz.prices.update("price_1", { active: false });
  await sz.prices.list({ product: "prod_1" });
  const [c, u, l] = mock.requests.slice(-3);
  assert.equal(c.body.custom_unit_amount.maximum_usd_cents, 5000);
  assert.deepEqual([u.path, u.body.active], ["/prices/price_1", false]);
  assert.equal(l.query.product, "prod_1");
});

test("payment links: create, update, retrieve, list", async () => {
  await sz.paymentLinks.create({
    line_items: [{ product: "prod_1", adjustable_quantity: { enabled: true, minimum: 1, maximum: 5 } }],
    collect_shipping_address: true,
    after_completion: { type: "redirect", redirect: { url: "https://myshop.com/thanks" } },
  });
  await sz.paymentLinks.update("plink_1", { active: false });
  await sz.paymentLinks.retrieve("plink_1");
  await sz.paymentLinks.list();
  const [c, u, r, l] = mock.requests.slice(-4);
  assert.equal(c.path, "/payment_links");
  assert.equal(c.body.line_items[0].adjustable_quantity.maximum, 5);
  assert.deepEqual([u.path, u.body.active], ["/payment_links/plink_1", false]);
  assert.deepEqual([r.method, r.path], ["GET", "/payment_links/plink_1"]);
  assert.deepEqual([l.method, l.path], ["GET", "/payment_links"]);
});

test("invoices.create sends line_items instead of an amount", async () => {
  await sz.invoices.create({
    line_items: [{ price: "price_1", quantity: 2 }, { price_data: { name: "Gift wrap", unit_amount_usd_cents: 300 } }],
    client_reference_id: "A-1043",
  });
  const req = mock.requests.at(-1);
  assert.equal(req.path, "/invoices");
  assert.equal(req.body.amount_usd_cents, undefined);
  assert.equal(req.body.line_items.length, 2);
  assert.equal(req.body.client_reference_id, "A-1043");
});
