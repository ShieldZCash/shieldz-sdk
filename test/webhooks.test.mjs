import { test } from "node:test";
import assert from "node:assert/strict";
import { verifySignature, constructEvent, SignatureVerificationError } from "../dist/esm/index.js";

const SECRET = "whsec_test_secret";
const enc = new TextEncoder();

/** Sign exactly like the Shieldz server does, for fixtures. */
async function sign(body, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { header: `t=${t},v1=${hex}`, hex, t };
}

const body = JSON.stringify({ type: "invoice.paid", id: "inv_1", amount_usd_cents: 5000 });

test("verifies a valid signature", async () => {
  const { header } = await sign(body);
  assert.equal(await verifySignature(body, header, SECRET), true);
});

test("constructEvent returns the parsed event", async () => {
  const { header } = await sign(body);
  const event = await constructEvent(body, header, SECRET);
  assert.equal(event.type, "invoice.paid");
  assert.equal(event.id, "inv_1");
});

test("accepts a Uint8Array body (edge runtimes)", async () => {
  const bytes = enc.encode(body);
  const { header } = await sign(body);
  assert.equal(await verifySignature(bytes, header, SECRET), true);
});

test("accepts either signature during rotation (multiple v1)", async () => {
  const { hex, t } = await sign(body);
  const header = `t=${t},v1=${"0".repeat(64)},v1=${hex}`;
  assert.equal(await verifySignature(body, header, SECRET), true);
});

test("rejects a wrong signature", async () => {
  const { t } = await sign(body);
  await assert.rejects(
    () => verifySignature(body, `t=${t},v1=${"a".repeat(64)}`, SECRET),
    (e) => e instanceof SignatureVerificationError && /no matching/.test(e.message),
  );
});

test("rejects a tampered body", async () => {
  const { header } = await sign(body);
  await assert.rejects(
    () => verifySignature(body + " ", header, SECRET),
    SignatureVerificationError,
  );
});

test("rejects the wrong secret", async () => {
  const { header } = await sign(body);
  await assert.rejects(() => verifySignature(body, header, "whsec_other"), SignatureVerificationError);
});

test("rejects a stale timestamp (default 5 min tolerance)", async () => {
  const old = Math.floor(Date.now() / 1000) - 3600;
  const { header } = await sign(body, SECRET, old);
  await assert.rejects(
    () => verifySignature(body, header, SECRET),
    (e) => e instanceof SignatureVerificationError && /tolerance/.test(e.message),
  );
});

test("honours a custom tolerance / now override", async () => {
  const t = 1_000_000;
  const { header } = await sign(body, SECRET, t);
  assert.equal(await verifySignature(body, header, SECRET, { now: t + 10, toleranceSeconds: 60 }), true);
});

test("rejects malformed / missing headers", async () => {
  await assert.rejects(() => verifySignature(body, "", SECRET), SignatureVerificationError);
  await assert.rejects(() => verifySignature(body, "garbage", SECRET), SignatureVerificationError);
  await assert.rejects(() => verifySignature(body, "v1=abc", SECRET), SignatureVerificationError); // no t=
});
