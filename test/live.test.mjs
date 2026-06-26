import { test } from "node:test";
import assert from "node:assert/strict";
import Shieldz, { ShieldzError } from "../dist/esm/index.js";

// Hits real prod. Off by default so the suite stays hermetic/offline-safe.
// Run with: npm run test:live   (or SHIELDZ_LIVE_TEST=1)
const SKIP = !process.env.SHIELDZ_LIVE_TEST;
const BASE = process.env.SHIELDZ_BASE_URL ?? "https://shieldz.cash";

test("live: create a demo invoice and retrieve it via the SDK", { skip: SKIP }, async () => {
  // Seed a real invoice using the public demo endpoint (no API key needed).
  const res = await fetch(`${BASE}/api/demo/invoices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      recipient: "0x5555555555555555555555555555555555555555",
      amount_usd_cents: 2500,
      token: "USDC",
      chain: "Base",
    }),
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.ok(created.id);

  const shieldz = new Shieldz({ apiKey: "sk_test_dummy", baseUrl: `${BASE}/api/v1` });
  const inv = await shieldz.invoices.retrieve(created.id);
  assert.equal(inv.id, created.id);
  assert.equal(inv.amount_usd_cents, 2500);
  assert.equal(inv.status, "pending");
  assert.ok(inv.pay_url.includes(inv.id));
  assert.ok(inv.payment_targets.length >= 1);
});

test("live: retrieving a nonexistent invoice throws 404", { skip: SKIP }, async () => {
  const shieldz = new Shieldz({ apiKey: "sk_test_dummy", baseUrl: `${BASE}/api/v1` });
  await assert.rejects(
    () => shieldz.invoices.retrieve("definitely-not-a-real-invoice-id"),
    (e) => e instanceof ShieldzError && e.status === 404,
  );
});
