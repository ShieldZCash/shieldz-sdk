export type InvoiceStatus = "pending" | "paid" | "expired" | "failed";
export type Mode = "live" | "test";

export interface Settlement {
  /** Settlement chain code, e.g. "BASE", "ARB", "OP", "POLY", "ETH". */
  chain: string;
  /** Settlement asset, e.g. "USDC", "USDT". */
  asset: string;
  /** The address funds settle to (the merchant's own wallet). */
  address: string;
}

/** A per-chain receive target the buyer can pay. */
export interface PaymentTarget {
  chain_id: string;
  asset_symbol: string | null;
  address: string;
  /** Amount in the chain's atomic units (string to preserve precision). */
  amount_atomic: string;
}

export interface Invoice {
  /** Unguessable public id; also the path segment in `pay_url`. */
  id: string;
  object: "invoice";
  amount_usd_cents: number;
  memo: string | null;
  settlement: Settlement;
  customer_email: string | null;
  metadata: unknown;
  status: InvoiceStatus;
  /** Unix milliseconds. */
  expires_at: number;
  paid_after_expiry: boolean;
  submitted_tx_hash: string | null;
  /** Unix milliseconds. */
  created_at: number;
  /** Unix milliseconds; null until paid. */
  paid_at: number | null;
  mode: Mode;
  /** The hosted checkout URL to send your customer to. */
  pay_url: string;
  zcash: {
    u1_address: string;
    amount_zec_atomic: string;
    zec_usd_rate_at_creation: number | null;
  } | null;
  /** Legacy single-chain fields (kept for backward compatibility). */
  payment_chain_id: string | null;
  payment_address: string | null;
  payment_amount_atomic: string | null;
  payment_targets: PaymentTarget[];
  paid_on: {
    chain_id: string;
    asset_symbol: string | null;
    tx_hash: string | null;
  } | null;
  /** Present and `true` when an idempotency_key replay returned the original invoice. */
  idempotent_replay?: boolean;
}

export interface InvoiceCreateParams {
  /** Required. Integer USD cents, 100–10,000,000. */
  amount_usd_cents: number;
  memo?: string;
  customer_email?: string;
  /** 300–86,400. Defaults to 1,800 (30 min). */
  expires_in_seconds?: number;
  /** Replaying the same key returns the original invoice instead of creating a duplicate. */
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  /** Override the dashboard default settlement target for this invoice. */
  settlement?: Settlement;
}

export interface InvoiceListParams {
  /** 1–100, default 50. */
  limit?: number;
  /** Pagination cursor (an invoice id). */
  starting_after?: string | number;
  status?: InvoiceStatus;
}

export interface List<T> {
  object: "list";
  data: T[];
  has_more: boolean;
}

export type WebhookEventType = "invoice.paid" | "invoice.failed" | (string & {});

/** A verified webhook payload. Shape varies by event type; `type` is always present. */
export interface WebhookEvent {
  type: WebhookEventType;
  [key: string]: unknown;
}
