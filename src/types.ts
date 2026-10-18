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
  /** What was bought, priced by Shieldz from your catalog (null for a plain amount). */
  line_items: LineItem[] | null;
  /** The payment link the invoice came from (`plink_…`). */
  payment_link: string | null;
  /** Shipping address from the payment link page. Only returned to your API key. */
  shipping: ShippingAddress | null;
  /** Your own order or cart id. */
  client_reference_id: string | null;
  /** Present and `true` when an idempotency_key replay returned the original invoice. */
  idempotent_replay?: boolean;
}

/** One line of a priced invoice, snapshotted when it was created. */
export interface LineItem {
  price: string | null;
  product: string | null;
  name: string;
  quantity: number;
  unit_amount_usd_cents: number;
  amount_usd_cents: number;
}

export interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

/** A line of a new invoice: a catalog price, or an inline `price_data`. */
export type LineItemParams =
  | { price: string; quantity?: number; /** Only for a customer-chosen price. */ amount_usd_cents?: number }
  | { price_data: { name: string; unit_amount_usd_cents: number }; quantity?: number };

export type InvoiceCreateParams = InvoiceCreateBase &
  (
    | { /** Integer USD cents, 100–10,000,000. */ amount_usd_cents: number; line_items?: never }
    | { /** Shieldz adds these up; the total must be $1–$100,000. */ line_items: LineItemParams[]; amount_usd_cents?: never }
  );

export interface InvoiceCreateBase {
  memo?: string;
  customer_email?: string;
  /** 300–86,400. Defaults to 1,800 (30 min). */
  expires_in_seconds?: number;
  /** Replaying the same key returns the original invoice instead of creating a duplicate. */
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  /** Override the dashboard default settlement target for this invoice. */
  settlement?: Settlement;
  /** Your own order or cart id, echoed on the invoice and its webhooks. */
  client_reference_id?: string;
  /** Public https URL the paid checkout returns the buyer to. */
  return_url?: string;
}

/** A fixed price, or a range the customer chooses from (tips, donations). */
export type PriceData =
  | { unit_amount_usd_cents: number }
  | { custom_unit_amount: { minimum_usd_cents?: number; maximum_usd_cents?: number; preset_usd_cents?: number } };

export interface Price {
  id: string;
  object: "price";
  product: string;
  active: boolean;
  /** null when the customer chooses the amount. */
  unit_amount_usd_cents: number | null;
  custom_unit_amount: {
    minimum_usd_cents: number | null;
    maximum_usd_cents: number | null;
    preset_usd_cents: number | null;
  } | null;
  created_at: number;
}

export interface Product {
  id: string;
  object: "product";
  name: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  default_price: Price | null;
  created_at: number;
  updated_at: number;
}

export interface ProductCreateParams {
  name: string;
  description?: string;
  /** Public https URL. */
  image_url?: string;
  default_price_data?: PriceData;
}

export interface ProductUpdateParams {
  name?: string;
  description?: string | null;
  image_url?: string | null;
  active?: boolean;
  /** Another active price of this product. */
  default_price?: string;
  /** Adds a new price, archives the old one and moves payment links to it. */
  default_price_data?: PriceData;
}

export type PriceCreateParams = PriceData & { product: string };

export interface PaymentLinkLineParams {
  /** A price ID, or `product` for that product's default price. */
  price?: string;
  product?: string;
  quantity?: number;
  adjustable_quantity?: { enabled: boolean; minimum?: number; maximum?: number };
}

export type AfterCompletion =
  | { type: "hosted_confirmation"; hosted_confirmation?: { custom_message?: string | null } }
  | { type: "redirect"; redirect: { url: string } };

export interface PaymentLinkCreateParams {
  line_items: PaymentLinkLineParams[];
  collect_email?: boolean;
  collect_shipping_address?: boolean;
  after_completion?: AfterCompletion;
}

export interface PaymentLinkUpdateParams extends Partial<PaymentLinkCreateParams> {
  active?: boolean;
}

export interface PaymentLink {
  id: string;
  object: "payment_link";
  /** Share this, or put `<button data-shieldz-link="{id}">` on your site. */
  url: string;
  active: boolean;
  line_items: Array<{
    price: Price | null;
    product: { id: string; name: string; image_url: string | null; active: boolean } | null;
    quantity: number;
    adjustable_quantity: { enabled: boolean; minimum?: number; maximum?: number };
  }>;
  collect_email: boolean;
  collect_shipping_address: boolean;
  after_completion: AfterCompletion;
  paid_count: number;
  paid_usd_cents: number;
  created_at: number;
  updated_at: number;
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
