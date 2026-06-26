// Run: SHIELDZ_API_KEY=sk_test_... npx tsx examples/create-invoice.ts
import Shieldz, { ShieldzError } from "@shieldz/sdk";

const shieldz = new Shieldz(process.env.SHIELDZ_API_KEY!);

async function main() {
  try {
    const invoice = await shieldz.invoices.create({
      amount_usd_cents: 5000, // $50.00
      memo: "Order #1234",
      customer_email: "buyer@example.com",
      idempotency_key: "order_1234",
      metadata: { order_id: "1234" },
    });

    console.log("Created invoice:", invoice.id);
    console.log("Status:        ", invoice.status);
    console.log("Pay URL:       ", invoice.pay_url);
    console.log("Settles to:    ", invoice.settlement);

    const fetched = await shieldz.invoices.retrieve(invoice.id);
    console.log("Re-fetched status:", fetched.status);
  } catch (err) {
    if (err instanceof ShieldzError) {
      console.error(`Shieldz error ${err.status} ${err.type}/${err.code}: ${err.message}`);
    } else {
      throw err;
    }
  }
}

main();
