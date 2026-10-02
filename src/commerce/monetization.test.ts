import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractVerifiedFactoryPayment,
  verifyStripeWebhookSignature
} from "./stripeWebhook.js";
import { FACTORY_OFFERS } from "./offers.js";
import { renderPricingPage } from "./pricingPage.js";

describe("Factory monetization", () => {
  it("publishes exactly three live fixed-price offers", () => {
    expect(FACTORY_OFFERS.map((offer) => offer.id)).toEqual([
      "launch",
      "pro",
      "enterprise"
    ]);
    expect(FACTORY_OFFERS.map((offer) => offer.priceBrl)).toEqual([
      197,
      497,
      1497
    ]);
    expect(
      FACTORY_OFFERS.every((offer) => offer.paymentUrl.startsWith("https://buy.stripe.com/"))
    ).toBe(true);
  });

  it("renders pricing without exposing Stripe secret material", () => {
    const html = renderPricingPage();
    expect(html).toContain("Transforme seu sistema em software para agentes.");
    expect(html).toContain("R$ 197");
    expect(html).toContain("R$ 497");
    expect(html).toContain("R$ 1.497");
    expect(html).toContain("Stripe LIVE");
    expect(html).not.toContain("sk_live_");
    expect(html).not.toContain("whsec_");
  });

  it("verifies a Stripe-style webhook signature", () => {
    const body = Buffer.from('{"id":"evt_123","type":"checkout.session.completed"}');
    const secret = "whsec_test_only_for_unit_test";
    const timestamp = 1_700_000_000;
    const signature = createHmac("sha256", secret)
      .update(Buffer.concat([Buffer.from(String(timestamp) + "."), body]))
      .digest("hex");

    expect(() =>
      verifyStripeWebhookSignature(
        body,
        "t=" + timestamp + ",v1=" + signature,
        secret,
        timestamp
      )
    ).not.toThrow();
  });

  it("rejects invalid Stripe signatures", () => {
    const body = Buffer.from('{"id":"evt_123"}');
    expect(() =>
      verifyStripeWebhookSignature(
        body,
        "t=1700000000,v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "whsec_test_only_for_unit_test",
        1_700_000_000
      )
    ).toThrow("STRIPE_SIGNATURE_MISMATCH");
  });

  it("counts only paid checkout sessions as verified payments", () => {
    const launch = FACTORY_OFFERS[0]!;
    const paid = extractVerifiedFactoryPayment({
      id: "evt_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_live_paid",
          payment_link: launch.stripePaymentLinkId,
          payment_status: "paid",
          amount_total: 19700,
          currency: "brl",
          customer_details: { email: "buyer@example.com" },
          custom_fields: [
            {
              key: "project_name",
              text: { value: "Acme Agent" }
            },
            {
              key: "project_url",
              text: { value: "https://example.com" }
            },
            {
              key: "project_brief",
              text: { value: "Criar um plugin que audite URLs e gere um relatório técnico." }
            }
          ]
        }
      }
    });

    expect(paid).toMatchObject({
      eventId: "evt_paid",
      sessionId: "cs_live_paid",
      offerId: "launch",
      paymentStatus: "paid",
      amountTotal: 19700,
      currency: "brl",
      projectName: "Acme Agent",
      projectUrl: "https://example.com",
      projectBrief:
        "Criar um plugin que audite URLs e gere um relatório técnico."
    });

    const unpaid = extractVerifiedFactoryPayment({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_live_unpaid",
          payment_link: launch.stripePaymentLinkId,
          payment_status: "unpaid",
          amount_total: 19700,
          currency: "brl"
        }
      }
    });

    expect(unpaid).toBeNull();
  });
});
