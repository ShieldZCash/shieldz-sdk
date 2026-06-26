import type { Shieldz } from "./client.js";
import type {
  Invoice,
  InvoiceCreateParams,
  InvoiceListParams,
  List,
} from "./types.js";

export class Invoices {
  constructor(private readonly client: Shieldz) {}

  create(params: InvoiceCreateParams): Promise<Invoice> {
    return this.client.request<Invoice>("POST", "/invoices", { body: params });
  }

  retrieve(id: string): Promise<Invoice> {
    return this.client.request<Invoice>(
      "GET",
      `/invoices/${encodeURIComponent(id)}`,
    );
  }

  list(params: InvoiceListParams = {}): Promise<List<Invoice>> {
    return this.client.request<List<Invoice>>("GET", "/invoices", {
      query: {
        limit: params.limit,
        starting_after: params.starting_after,
        status: params.status,
      },
    });
  }

  /** Iterate every invoice, following the cursor across pages. */
  async *listAll(
    params: InvoiceListParams = {},
  ): AsyncGenerator<Invoice, void, void> {
    let startingAfter = params.starting_after;
    for (;;) {
      const page = await this.list({ ...params, starting_after: startingAfter });
      for (const invoice of page.data) yield invoice;
      if (!page.has_more || page.data.length === 0) return;
      startingAfter = page.data[page.data.length - 1]!.id;
    }
  }
}
