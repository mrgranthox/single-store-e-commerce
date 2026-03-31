-- CreateIndex
CREATE INDEX "Payment_providerPaymentRef_idx" ON "Payment"("providerPaymentRef");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerRef_idx" ON "PaymentTransaction"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentRef_key" ON "Payment"("provider", "providerPaymentRef");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_paymentId_providerEventType_providerRef_sta_key"
ON "PaymentTransaction"("paymentId", "providerEventType", "providerRef", "status");
