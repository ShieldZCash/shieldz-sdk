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
} from "./types.js";

export default Shieldz;
