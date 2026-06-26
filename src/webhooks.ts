import type { WebhookEvent } from "./types.js";

// Verification runs on the Web Crypto API so it works on any runtime (Node 18+,
// Deno, Bun, Workers, Edge), which is why it's async.

export class SignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureVerificationError";
  }
}

export interface VerifyOptions {
  /** Max allowed clock skew in seconds. Default 300. */
  toleranceSeconds?: number;
  /** Override "now" (unix seconds), for testing. */
  now?: number;
}

const encoder = new TextEncoder();

function bodyToString(body: string | Uint8Array): string {
  return typeof body === "string" ? body : new TextDecoder().decode(body);
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++)
    out += bytes[i]!.toString(16).padStart(2, "0");
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Prefer the global SubtleCrypto; fall back to node:crypto on older Node only.
// The dynamic specifier keeps non-Node bundlers from resolving it.
async function getSubtle(): Promise<SubtleCrypto> {
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g?.subtle) return g.subtle;
  const spec = "node:crypto";
  const nodeCrypto = (await import(spec)) as { webcrypto: Crypto };
  return nodeCrypto.webcrypto.subtle;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const subtle = await getSubtle();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(sig);
}

/**
 * Verify a Shieldz webhook signature. Pass the raw request body, not a
 * re-serialized object. Header: `t=<unix>,v1=<hex>[,v1=<hex>]` (multiple v1
 * values during the 24h rotation overlap); the signed payload is `${t}.${body}`.
 * Resolves true, or rejects with {@link SignatureVerificationError}.
 */
export async function verifySignature(
  rawBody: string | Uint8Array,
  signatureHeader: string,
  signingSecret: string,
  options: VerifyOptions = {},
): Promise<boolean> {
  if (!signatureHeader)
    throw new SignatureVerificationError("missing signature header");
  if (!signingSecret)
    throw new SignatureVerificationError("missing signing secret");

  const parts = signatureHeader.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || signatures.length === 0) {
    throw new SignatureVerificationError("malformed signature header");
  }

  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(Number(t)) || Math.abs(now - Number(t)) > tolerance) {
    throw new SignatureVerificationError("timestamp outside tolerance");
  }

  const expected = await hmacSha256Hex(
    signingSecret,
    `${t}.${bodyToString(rawBody)}`,
  );
  const matched = signatures.some((sig) => constantTimeEqual(sig, expected));
  if (!matched) throw new SignatureVerificationError("no matching signature");
  return true;
}

/** Verify the signature and return the parsed event. */
export async function constructEvent(
  rawBody: string | Uint8Array,
  signatureHeader: string,
  signingSecret: string,
  options?: VerifyOptions,
): Promise<WebhookEvent> {
  await verifySignature(rawBody, signatureHeader, signingSecret, options);
  return JSON.parse(bodyToString(rawBody)) as WebhookEvent;
}
