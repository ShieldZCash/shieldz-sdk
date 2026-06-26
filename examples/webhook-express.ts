// Minimal Express webhook receiver.
// Run: SHIELDZ_WEBHOOK_SECRET=whsec_... npx tsx examples/webhook-express.ts
import express from "express";
import { constructEvent, SignatureVerificationError } from "@shieldz/sdk";

const app = express();
const SECRET = process.env.SHIELDZ_WEBHOOK_SECRET!;

// IMPORTANT: use the raw body for signature verification.
app.post("/webhooks/shieldz", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await constructEvent(req.body, req.header("X-Shieldz-Signature") ?? "", SECRET);

    switch (event.type) {
      case "invoice.paid":
        // Fulfill the order. Dedupe on the X-Shieldz-Delivery header —
        // deliveries are at-least-once.
        console.log("✅ paid:", event);
        break;
      case "invoice.failed":
        console.log("❌ failed:", event);
        break;
      default:
        console.log("event:", event.type);
    }
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof SignatureVerificationError) {
      console.warn("bad signature:", err.message);
      res.sendStatus(400);
      return;
    }
    res.sendStatus(500);
  }
});

app.listen(3000, () => console.log("listening on :3000/webhooks/shieldz"));
