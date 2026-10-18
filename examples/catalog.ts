/**
 * Sell from a catalog: a product, its price, a payment link, and an invoice
 * priced from line items.
 *
 *   SHIELDZ_API_KEY=sk_live_... npx tsx examples/catalog.ts
 */
import Shieldz, { ShieldzError } from "@shieldz/sdk";

const shieldz = new Shieldz({
  apiKey: process.env.SHIELDZ_API_KEY!,
  baseUrl: process.env.SHIELDZ_BASE_URL, // optional, defaults to https://shieldz.cash/api/v1
});

// 1. A product with its price ($49.99)
const product = await shieldz.products.create({
  name: "Blue hoodie",
  description: "Heavyweight cotton, unisex.",
  default_price_data: { unit_amount_usd_cents: 4999 },
});
console.log("product", product.id, product.default_price?.id);

// 2. Change the price. Prices never change, so this adds a new price,
//    archives the old one and moves payment links to it.
const repriced = await shieldz.products.update(product.id, {
  default_price_data: { unit_amount_usd_cents: 3999 },
});
console.log("new price", repriced.default_price?.id, repriced.default_price?.unit_amount_usd_cents);

// 3. A second price for the same product, then archive it
const bundle = await shieldz.prices.create({ product: product.id, unit_amount_usd_cents: 8999 });
await shieldz.prices.update(bundle.id, { active: false });
const prices = await shieldz.prices.list({ product: product.id });
console.log("prices", prices.data.map((p) => `${p.id} ${p.unit_amount_usd_cents} ${p.active ? "active" : "archived"}`));

// 4. A payment link: the buyer picks 1-5, and we ask for a shipping address
const link = await shieldz.paymentLinks.create({
  line_items: [{ product: product.id, quantity: 1, adjustable_quantity: { enabled: true, minimum: 1, maximum: 5 } }],
  collect_shipping_address: true,
  after_completion: { type: "hosted_confirmation", hosted_confirmation: { custom_message: "Thanks! We ship within 2 days." } },
});
console.log("link", link.url);
console.log(`buy button: <button data-shieldz-link="${link.id}">Buy now</button>`);

// 5. Your own server, your own cart: an invoice priced from line items
const invoice = await shieldz.invoices.create({
  line_items: [
    { price: repriced.default_price!.id, quantity: 2 },
    { price_data: { name: "Gift wrap", unit_amount_usd_cents: 300 } },
  ],
  client_reference_id: "A-1043",
});
console.log("invoice", invoice.id, invoice.amount_usd_cents, invoice.pay_url);

// 6. Turn the link off and archive the product
await shieldz.paymentLinks.update(link.id, { active: false });
await shieldz.products.update(product.id, { active: false });

// Errors come back as ShieldzError with a machine-readable code
try {
  await shieldz.prices.update(repriced.default_price!.id, { unit_amount_usd_cents: 1 } as never);
} catch (e) {
  if (e instanceof ShieldzError) console.log("error", e.status, e.code, e.param);
  else throw e;
}
