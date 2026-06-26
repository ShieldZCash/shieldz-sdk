import { ShieldzError } from "./errors.js";
import { Invoices } from "./invoices.js";

const VERSION = "0.2.1";
const DEFAULT_BASE_URL = "https://shieldz.cash/api/v1";

export interface ShieldzOptions {
  /** Your secret API key (`sk_live_…` or `sk_test_…`). */
  apiKey: string;
  /** Override the API base URL. Default: https://shieldz.cash/api/v1 */
  baseUrl?: string;
  /** Custom fetch. Defaults to global fetch (Node 18+). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Retries for transient failures (network, timeout, 429, 5xx). Default 2; 0 disables. */
  maxRetries?: number;
  /** Cap on a single backoff delay, in ms. Default 8000. */
  maxRetryDelayMs?: number;
}

type Query = Record<string, string | number | boolean | undefined>;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export class Shieldz {
  readonly invoices: Invoices;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxRetryDelayMs: number;

  constructor(options: ShieldzOptions | string) {
    const opts: ShieldzOptions =
      typeof options === "string" ? { apiKey: options } : options;
    if (!opts.apiKey) throw new Error("Shieldz: `apiKey` is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = opts.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new Error(
        "Shieldz: global fetch is unavailable (need Node 18+); pass `fetch` in options",
      );
    }
    this.doFetch = f;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.maxRetries = Math.max(0, opts.maxRetries ?? 2);
    this.maxRetryDelayMs = opts.maxRetryDelayMs ?? 8_000;
    this.invoices = new Invoices(this);
  }

  async request<T>(
    method: string,
    path: string,
    opts: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    // Attach an idempotency_key to a retryable POST so retries can't duplicate.
    let body = opts.body;
    if (
      method === "POST" &&
      this.maxRetries > 0 &&
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      (body as Record<string, unknown>).idempotency_key == null
    ) {
      body = {
        ...(body as Record<string, unknown>),
        idempotency_key: `auto_${randomId()}`,
      };
    }

    const serialized = body !== undefined ? JSON.stringify(body) : undefined;

    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let res: Response;
      try {
        res = await this.doFetch(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": `shieldz-node/${VERSION}`,
          },
          body: serialized,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt < this.maxRetries) {
          await sleep(this.backoff(attempt));
          attempt++;
          continue;
        }
        throw new ShieldzError(0, {
          type: "connection_error",
          code: controller.signal.aborted ? "timeout" : "network_error",
          message: err instanceof Error ? err.message : "request failed",
        });
      } finally {
        clearTimeout(timer);
      }

      if (RETRYABLE_STATUS.has(res.status) && attempt < this.maxRetries) {
        const retryAfter = this.parseRetryAfter(res.headers.get("retry-after"));
        await sleep(retryAfter ?? this.backoff(attempt));
        attempt++;
        continue;
      }

      const requestId =
        res.headers.get("x-request-id") ?? res.headers.get("cf-ray");
      const text = await res.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          if (!res.ok) {
            throw new ShieldzError(
              res.status,
              {
                type: "api_error",
                code: "non_json_response",
                message: text.slice(0, 500),
              },
              requestId,
            );
          }
        }
      }

      if (!res.ok) {
        const envelope = (data as { error?: Record<string, string> }).error ?? {};
        throw new ShieldzError(res.status, envelope, requestId);
      }
      return data as T;
    }
  }

  private backoff(attempt: number): number {
    const base = Math.min(this.maxRetryDelayMs, 500 * 2 ** attempt);
    return Math.floor(base * (0.5 + Math.random() * 0.5));
  }

  private parseRetryAfter(value: string | null): number | null {
    if (!value) return null;
    const secs = Number(value);
    if (!Number.isFinite(secs) || secs < 0) return null;
    return Math.min(this.maxRetryDelayMs, Math.ceil(secs * 1000));
  }
}
