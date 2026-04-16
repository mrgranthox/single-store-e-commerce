-- Deferred checkout: order row is created only after PSP success (webhook materialization).

CREATE TYPE "CheckoutPaymentIntentStatus" AS ENUM ('AWAITING_PAYMENT', 'FULFILLED', 'FAILED');

CREATE TABLE "CheckoutPaymentIntent" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "status" "CheckoutPaymentIntentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "checkoutSessionId" TEXT NOT NULL,
    "checkoutIdempotencyKey" TEXT NOT NULL,
    "materializationPayload" JSONB NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutPaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheckoutPaymentIntent_checkoutSessionId_key" ON "CheckoutPaymentIntent"("checkoutSessionId");

CREATE UNIQUE INDEX "CheckoutPaymentIntent_checkoutIdempotencyKey_key" ON "CheckoutPaymentIntent"("checkoutIdempotencyKey");

CREATE UNIQUE INDEX "CheckoutPaymentIntent_orderId_key" ON "CheckoutPaymentIntent"("orderId");

ALTER TABLE "CheckoutPaymentIntent" ADD CONSTRAINT "CheckoutPaymentIntent_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CheckoutPaymentIntent" ADD CONSTRAINT "CheckoutPaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Payment_orderId_idempotencyKey_key";

ALTER TABLE "Payment" ALTER COLUMN "orderId" DROP NOT NULL;

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

ALTER TABLE "Payment" ADD COLUMN "checkoutPaymentIntentId" TEXT;

CREATE INDEX "Payment_checkoutPaymentIntentId_idx" ON "Payment"("checkoutPaymentIntentId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_checkoutPaymentIntentId_fkey" FOREIGN KEY ("checkoutPaymentIntentId") REFERENCES "CheckoutPaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
