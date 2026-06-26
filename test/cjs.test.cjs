// Proves the CommonJS build is require()-able and exposes the same surface.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("../dist/cjs/index.js");
const subtle = globalThis.crypto?.subtle ?? require("node:crypto").webcrypto.subtle;

test("CJS build loads via require() with named + default exports", () => {
  assert.equal(typeof sdk.Shieldz, "function");
  assert.equal(typeof sdk.default, "function"); // default export
  assert.equal(typeof sdk.ShieldzError, "function");
  assert.equal(typeof sdk.verifySignature, "function");
  assert.equal(typeof sdk.constructEvent, "function");

  const client = new sdk.Shieldz("sk_test_cjs");
  assert.equal(typeof client.invoices.create, "function");
  assert.equal(typeof client.invoices.listAll, "function");
  assert.throws(() => new sdk.Shieldz(""), /apiKey/);
});

test("CJS webhook verify works (async / WebCrypto)", async () => {
  const enc = new TextEncoder();
  const secret = "whsec_cjs";
  const t = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ type: "invoice.paid", id: "inv_1" });
  const key = await subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await subtle.sign("HMAC", key, enc.encode(`${t}.${body}`));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const event = await sdk.constructEvent(body, `t=${t},v1=${hex}`, secret);
  assert.equal(event.type, "invoice.paid");
});
