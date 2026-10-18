import { Shieldz } from "./client.js";

export { Shieldz } from "./client.js";
export type { ShieldzOptions } from "./client.js";
export { ShieldzError } from "./errors.js";
export type { ShieldzApiErrorBody } from "./errors.js";
export { verifySignature, constructEvent, SignatureVerificationError } from "./webhooks.js";
export type { VerifyOptions } from "./webhooks.js";
export type {
  Invoice,
  InvoiceStatus,
  InvoiceCreateParams,
  InvoiceListParams,
  Settlement,
  PaymentTarget,
  List,
  Mode,
  WebhookEvent,
  WebhookEventType,
  LineItem,
  LineItemParams,
  ShippingAddress,
  Product,
  ProductCreateParams,
  ProductUpdateParams,
  Price,
  PriceData,
  PriceCreateParams,
  PaymentLink,
  PaymentLinkCreateParams,
  PaymentLinkUpdateParams,
  PaymentLinkLineParams,
  AfterCompletion,
} from "./types.js";
export { Products, Prices, PaymentLinks } from "./catalog.js";

export default Shieldz;
