import type { Shieldz } from "./client.js";
import type {
  List,
  PaymentLink,
  PaymentLinkCreateParams,
  PaymentLinkUpdateParams,
  Price,
  PriceCreateParams,
  Product,
  ProductCreateParams,
  ProductUpdateParams,
} from "./types.js";

const enc = encodeURIComponent;

/** Things you sell. A product's price lives on `default_price`. */
export class Products {
  constructor(private readonly client: Shieldz) {}

  create(params: ProductCreateParams): Promise<Product> {
    return this.client.request<Product>("POST", "/products", { body: params });
  }

  retrieve(id: string): Promise<Product> {
    return this.client.request<Product>("GET", `/products/${enc(id)}`);
  }

  /** `default_price_data` adds a new price, archives the old one and moves payment links to it. */
  update(id: string, params: ProductUpdateParams): Promise<Product> {
    return this.client.request<Product>("POST", `/products/${enc(id)}`, { body: params });
  }

  list(params: { active?: boolean } = {}): Promise<List<Product>> {
    return this.client.request<List<Product>>("GET", "/products", { query: { active: params.active } });
  }
}

/** What a product costs. A price's amount never changes; archive it and add a new one. */
export class Prices {
  constructor(private readonly client: Shieldz) {}

  create(params: PriceCreateParams): Promise<Price> {
    return this.client.request<Price>("POST", "/prices", { body: params });
  }

  retrieve(id: string): Promise<Price> {
    return this.client.request<Price>("GET", `/prices/${enc(id)}`);
  }

  /** Archive (`active: false`) or restore a price. */
  update(id: string, params: { active: boolean }): Promise<Price> {
    return this.client.request<Price>("POST", `/prices/${enc(id)}`, { body: params });
  }

  list(params: { product?: string } = {}): Promise<List<Price>> {
    return this.client.request<List<Price>>("GET", "/prices", { query: { product: params.product } });
  }
}

/** Hosted order pages (`/l/plink_…`), also opened by the widget's buy button. */
export class PaymentLinks {
  constructor(private readonly client: Shieldz) {}

  create(params: PaymentLinkCreateParams): Promise<PaymentLink> {
    return this.client.request<PaymentLink>("POST", "/payment_links", { body: params });
  }

  retrieve(id: string): Promise<PaymentLink> {
    return this.client.request<PaymentLink>("GET", `/payment_links/${enc(id)}`);
  }

  /** The URL stays the same; `active: false` turns the link off. */
  update(id: string, params: PaymentLinkUpdateParams): Promise<PaymentLink> {
    return this.client.request<PaymentLink>("POST", `/payment_links/${enc(id)}`, { body: params });
  }

  list(): Promise<List<PaymentLink>> {
    return this.client.request<List<PaymentLink>>("GET", "/payment_links");
  }
}
