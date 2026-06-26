/** The error envelope Shieldz returns: `{ error: { type, code, message, param? } }`. */
export interface ShieldzApiErrorBody {
  type: string;
  code: string;
  message: string;
  param?: string;
}

/** Thrown for any non-2xx response from the Shieldz API. */
export class ShieldzError extends Error {
  /** HTTP status code (0 for connection/timeout errors before a response). */
  readonly status: number;
  /** Error class, e.g. "invalid_request", "auth_error", "rate_limit". */
  readonly type: string;
  /** Machine-readable code, e.g. "invalid_amount", "invoice_not_found". */
  readonly code: string;
  /** The request field that caused the error, when applicable. */
  readonly param?: string;
  /** Correlation id for the request (the `cf-ray`), to quote to support. */
  readonly requestId?: string | null;

  constructor(
    status: number,
    body: Partial<ShieldzApiErrorBody>,
    requestId?: string | null,
  ) {
    super(body.message ?? `Shieldz API error (HTTP ${status})`);
    this.name = "ShieldzError";
    this.status = status;
    this.type = body.type ?? "api_error";
    this.code = body.code ?? "unknown";
    this.param = body.param;
    this.requestId = requestId ?? null;
  }
}
