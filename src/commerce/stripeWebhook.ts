import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { getFactoryOffer } from "./offers.js";

const DEFAULT_TOLERANCE_SECONDS = 300;

export type VerifiedFactoryPayment = {
  eventId: string;
  eventType: string;
  sessionId: string;
  paymentLinkId: string | null;
  paymentStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  customerEmail: string | null;
  offerId: string | null;
  projectName: string | null;
  projectUrl: string | null;
};

function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } {
  const parts = header.split(",");
  const timestamps = parts
    .filter((part) => part.startsWith("t="))
    .map((part) => Number(part.slice(2)))
    .filter(Number.isFinite);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  const timestamp = timestamps[0];
  if (!timestamp || signatures.length === 0) {
    throw new Error("INVALID_STRIPE_SIGNATURE_HEADER");
  }

  return { timestamp, signatures };
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyStripeWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS
): void {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new Error("STRIPE_SIGNATURE_TIMESTAMP_OUTSIDE_TOLERANCE");
  }

  const signedPayload = Buffer.concat([
    Buffer.from(String(timestamp) + ".", "utf8"),
    rawBody
  ]);
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  if (!signatures.some((signature) => safeHexEqual(signature, expected))) {
    throw new Error("STRIPE_SIGNATURE_MISMATCH");
  }
}

function readCustomField(
  customFields: unknown,
  key: string
): string | null {
  if (!Array.isArray(customFields)) return null;
  const field = customFields.find(
    (item) => item && typeof item === "object" && (item as { key?: unknown }).key === key
  ) as { text?: { value?: unknown } } | undefined;
  const value = field?.text?.value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractVerifiedFactoryPayment(event: unknown): VerifiedFactoryPayment | null {
  if (!event || typeof event !== "object") return null;
  const root = event as {
    id?: unknown;
    type?: unknown;
    data?: { object?: unknown };
  };
  if (typeof root.id !== "string" || typeof root.type !== "string") return null;

  if (
    root.type !== "checkout.session.completed" &&
    root.type !== "checkout.session.async_payment_succeeded"
  ) {
    return null;
  }

  const object = root.data?.object;
  if (!object || typeof object !== "object") return null;

  const session = object as {
    id?: unknown;
    payment_link?: unknown;
    payment_status?: unknown;
    amount_total?: unknown;
    currency?: unknown;
    customer_details?: { email?: unknown };
    custom_fields?: unknown;
  };

  const paymentStatus =
    typeof session.payment_status === "string" ? session.payment_status : null;

  // Money Truth: only provider-confirmed paid sessions are revenue.
  if (paymentStatus !== "paid") return null;

  const paymentLinkId =
    typeof session.payment_link === "string" ? session.payment_link : null;
  const offer =
    paymentLinkId === null
      ? undefined
      : ["launch", "pro", "enterprise"]
          .map((id) => getFactoryOffer(id))
          .find((candidate) => candidate?.stripePaymentLinkId === paymentLinkId);

  return {
    eventId: root.id,
    eventType: root.type,
    sessionId: typeof session.id === "string" ? session.id : "unknown",
    paymentLinkId,
    paymentStatus,
    amountTotal:
      typeof session.amount_total === "number" ? session.amount_total : null,
    currency: typeof session.currency === "string" ? session.currency : null,
    customerEmail:
      typeof session.customer_details?.email === "string"
        ? session.customer_details.email
        : null,
    offerId: offer?.id ?? null,
    projectName: readCustomField(session.custom_fields, "project_name"),
    projectUrl: readCustomField(session.custom_fields, "project_url")
  };
}

export function webhookSecretFromEnv(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}

export function stripeSignatureFromRequest(req: Request): string | null {
  const header = req.header("stripe-signature");
  return header?.trim() || null;
}
