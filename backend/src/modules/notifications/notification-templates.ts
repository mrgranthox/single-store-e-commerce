import type { Prisma } from "@prisma/client";

import { env } from "../../config/env";
import { prisma } from "../../config/prisma";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatCurrency = (amountCents: number | null | undefined, currency = "GHS") => {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) {
    return null;
  }

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(amountCents / 100);
};

const readAddressSnapshot = (value: Prisma.JsonValue) => {
  const record = isRecord(value) ? value : {};
  const totals = isRecord(record.normalizedTotals) ? record.normalizedTotals : {};

  return {
    fullName: typeof record.fullName === "string" ? record.fullName : null,
    email:
      typeof record.contactEmail === "string"
        ? record.contactEmail
        : typeof record.email === "string"
          ? record.email
          : null,
    currency: typeof totals.currency === "string" ? totals.currency : "GHS",
    grandTotalCents:
      typeof totals.grandTotalCents === "number" ? Math.trunc(totals.grandTotalCents) : null
  };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildRows = (rows: Array<{ label: string; value: string | null | undefined }>) =>
  rows
    .filter((row) => row.value)
    .map(
      (row) =>
        `<tr><td style="padding:8px 0;color:#5f6b7a;font-size:13px;">${escapeHtml(row.label)}</td><td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${escapeHtml(row.value!)}</td></tr>`
    )
    .join("");

const buildBulletList = (items: string[]) =>
  items.length > 0
    ? `<ul style="padding-left:20px;margin:16px 0;color:#0f172a;font-size:14px;line-height:1.6;">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

const buildParagraphs = (items: Array<string | null | undefined>) =>
  items
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join("");

const buildTextSummary = (rows: Array<{ label: string; value: string | null | undefined }>) =>
  rows
    .filter((row) => row.value)
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");

const readString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [];

const buildEmailDocument = (input: {
  preheader: string;
  title: string;
  intro: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string | null;
  detailRows?: Array<{ label: string; value: string | null | undefined }>;
}) => {
  const rows = input.detailRows ? buildRows(input.detailRows) : "";
  const textRows = input.detailRows ? buildTextSummary(input.detailRows) : "";
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";

  return {
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
            <tr>
              <td>
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(env.EMAIL_FROM_NAME ?? "E-Commerce Platform")}</p>
                <h1 style="margin:0 0 12px;color:#0f172a;font-size:28px;line-height:1.2;">${escapeHtml(input.title)}</h1>
                <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${escapeHtml(input.intro)}</p>
                ${ctaHtml}
                ${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:1px solid #e5e7eb;">${rows}</table>` : ""}
                <div style="margin-top:24px;color:#0f172a;font-size:14px;line-height:1.7;">${input.bodyHtml}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: [input.title, "", input.intro, "", textRows, "", input.ctaLabel && input.ctaUrl ? `${input.ctaLabel}: ${input.ctaUrl}` : "", ""]
      .filter(Boolean)
      .join("\n")
  };
};

const loadOrderSummary = async (orderId: string) =>
  prisma.order.findUnique({
    where: {
      id: orderId
    },
    include: {
      items: true,
      payments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      shipments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

const loadSupportTicket = async (ticketId: string) =>
  prisma.supportTicket.findUnique({
    where: {
      id: ticketId
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true
        }
      },
      messages: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    }
  });

const loadReturnRecord = async (returnId: string) =>
  prisma.return.findUnique({
    where: {
      id: returnId
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          addressSnapshot: true
        }
      },
      items: {
        include: {
          orderItem: true,
          variant: {
            include: {
              product: true
            }
          }
        }
      }
    }
  });

const loadRefundRecord = async (refundId: string) =>
  prisma.refund.findUnique({
    where: {
      id: refundId
    },
    include: {
      payment: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              addressSnapshot: true
            }
          }
        }
      }
    }
  });

export const renderNotificationEmail = async (input: {
  type: string;
  payload: Prisma.JsonValue | null;
  recipientEmail: string;
}) => {
  const payload = isRecord(input.payload) ? input.payload : {};
  const subjectFromPayload = readString(payload.subject);
  const orderNumberFromPayload = readString(payload.orderNumber) ?? "your order";
  const currencyFromPayload = readString(payload.currency) ?? "GHS";

  switch (input.type) {
    case "WELCOME": {
      const firstName = readString(payload.firstName);
      const heading = firstName ? `Welcome, ${firstName}` : "Welcome to the platform";
      const document = buildEmailDocument({
        preheader: "Your account is ready",
        title: heading,
        intro: "Your account is active and ready for orders, support, and account tracking.",
        ctaLabel: "Open Store",
        ctaUrl: readString(payload.ctaUrl) ?? env.CUSTOMER_APP_URL,
        detailRows: [
          { label: "Account email", value: input.recipientEmail }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message),
          "You can now browse the catalog, manage your account, and track future orders from one place."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Welcome to the platform",
        ...document
      };
    }
    case "EMAIL_VERIFICATION_REQUIRED": {
      const verificationUrl = readString(payload.verificationUrl);
      const expiryMinutes = readNumber(payload.expiryMinutes);
      const document = buildEmailDocument({
        preheader: "Verify your email address",
        title: "Verify your email",
        intro: "Confirm your email address to finish setting up your account.",
        ctaLabel: verificationUrl ? "Verify Email" : undefined,
        ctaUrl: verificationUrl,
        detailRows: [
          { label: "Email", value: input.recipientEmail },
          { label: "Link expires", value: expiryMinutes ? `${expiryMinutes} minutes` : null }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message),
          verificationUrl ? null : "Open your account verification flow to complete this step."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Verify your email address",
        ...document
      };
    }
    case "EMAIL_VERIFIED": {
      const document = buildEmailDocument({
        preheader: "Email address verified",
        title: "Email verified",
        intro: "Your email address has been verified successfully.",
        ctaLabel: "Go to Account",
        ctaUrl: readString(payload.ctaUrl) ?? `${env.CUSTOMER_APP_URL}/account`,
        detailRows: [
          { label: "Email", value: input.recipientEmail }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message),
          "You can continue with checkout, order tracking, and support using this verified address."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Email verified",
        ...document
      };
    }
    case "PASSWORD_RESET": {
      const resetUrl = readString(payload.resetUrl);
      const expiryMinutes = readNumber(payload.expiryMinutes);
      const document = buildEmailDocument({
        preheader: "Reset your password",
        title: "Password reset requested",
        intro: "A password reset request was received for your account.",
        ctaLabel: resetUrl ? "Reset Password" : undefined,
        ctaUrl: resetUrl,
        detailRows: [
          { label: "Email", value: input.recipientEmail },
          { label: "Link expires", value: expiryMinutes ? `${expiryMinutes} minutes` : null }
        ],
        bodyHtml: buildParagraphs([
          "If you made this request, use the secure link above to set a new password.",
          "If you did not request a password reset, you can ignore this email."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Reset your password",
        ...document
      };
    }
    case "PASSWORD_CHANGED": {
      const changedAt = readString(payload.changedAt);
      const document = buildEmailDocument({
        preheader: "Your password was changed",
        title: "Password updated",
        intro: "Your account password has been changed.",
        detailRows: [
          { label: "Email", value: input.recipientEmail },
          { label: "Changed at", value: changedAt }
        ],
        bodyHtml: buildParagraphs([
          "If you made this change, no further action is required.",
          "If this was not you, contact support immediately and secure your account."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Password changed",
        ...document
      };
    }
    case "ORDER_PAYMENT_ACTION_REQUIRED": {
      const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
      const orderNumber = orderNumberFromPayload;
      const currency = currencyFromPayload;
      const amount = typeof payload.amountCents === "number" ? payload.amountCents : null;
      const providerPayload = isRecord(payload.providerPayload) ? payload.providerPayload : {};
      const paymentChannel =
        typeof payload.paymentChannel === "string" ? payload.paymentChannel : "card";
      const order = orderId ? await loadOrderSummary(orderId) : null;
      const itemLines =
        order?.items.map((item) => `${item.quantity} x ${item.productTitleSnapshot}`) ?? [];
      const actionUrl =
        typeof providerPayload.authorizationUrl === "string"
          ? providerPayload.authorizationUrl
          : null;
      const displayText =
        typeof providerPayload.displayText === "string"
          ? providerPayload.displayText
          : paymentChannel === "mobile_money"
            ? "Complete the authorization prompt on your phone to finish this payment."
            : "Use the secure payment link to complete checkout.";

      const document = buildEmailDocument({
        preheader: `Action required for order ${orderNumber}`,
        title: "Complete your payment",
        intro: `Your order ${orderNumber} is reserved and waiting for payment confirmation.`,
        ctaLabel: actionUrl ? "Pay Now" : undefined,
        ctaUrl: actionUrl,
        detailRows: [
          { label: "Order", value: orderNumber },
          { label: "Amount", value: formatCurrency(amount, currency) },
          { label: "Channel", value: paymentChannel === "mobile_money" ? "Mobile Money" : "Card" }
        ],
        bodyHtml: `<p>${escapeHtml(displayText)}</p>${buildBulletList(itemLines)}`
      });

      return {
        subject: `Complete payment for ${orderNumber}`,
        ...document
      };
    }
    case "ORDER_CONFIRMED": {
      const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
      const order = orderId ? await loadOrderSummary(orderId) : null;
      const address = order ? readAddressSnapshot(order.addressSnapshot) : null;
      const itemLines =
        order?.items.map(
          (item) =>
            `${item.quantity} x ${item.productTitleSnapshot} (${formatCurrency(
              item.unitPriceAmountCents,
              item.unitPriceCurrency
            ) ?? item.unitPriceCurrency})`
        ) ?? [];
      const orderNumber = order?.orderNumber ?? (typeof payload.orderNumber === "string" ? payload.orderNumber : "your order");
      const document = buildEmailDocument({
        preheader: `Order ${orderNumber} is confirmed`,
        title: "Order confirmed",
        intro: `We have received your payment and your order is now confirmed.`,
        ctaLabel: "Track Order",
        ctaUrl: `${env.CUSTOMER_APP_URL}/orders/track`,
        detailRows: [
          { label: "Order", value: orderNumber },
          {
            label: "Total",
            value: formatCurrency(
              address?.grandTotalCents ?? (typeof payload.amountCents === "number" ? payload.amountCents : null),
              address?.currency ?? (typeof payload.currency === "string" ? payload.currency : "GHS")
            )
          }
        ],
        bodyHtml: `<p>Your items are now moving into fulfillment.</p>${buildBulletList(itemLines)}`
      });

      return {
        subject: `Order confirmed: ${orderNumber}`,
        ...document
      };
    }
    case "ORDER_STATUS_UPDATED": {
      const status = readString(payload.orderStatus) ?? readString(payload.status) ?? "UPDATED";
      const document = buildEmailDocument({
        preheader: `Order ${orderNumberFromPayload} updated`,
        title: "Order update",
        intro: `There is a new status update for ${orderNumberFromPayload}.`,
        ctaLabel: "View Order",
        ctaUrl: readString(payload.ctaUrl) ?? `${env.CUSTOMER_APP_URL}/orders/track`,
        detailRows: [
          { label: "Order", value: orderNumberFromPayload },
          { label: "Status", value: status }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message),
          "Open your order view for the latest fulfillment and payment timeline."
        ])
      });

      return {
        subject: subjectFromPayload ?? `Order update: ${orderNumberFromPayload}`,
        ...document
      };
    }
    case "ORDER_CANCELLED": {
      const document = buildEmailDocument({
        preheader: `Order ${orderNumberFromPayload} cancelled`,
        title: "Order cancelled",
        intro: `Your order ${orderNumberFromPayload} has been cancelled.`,
        detailRows: [
          { label: "Order", value: orderNumberFromPayload },
          {
            label: "Amount",
            value: formatCurrency(readNumber(payload.amountCents), currencyFromPayload)
          },
          { label: "Reason", value: readString(payload.reason) }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message) ?? "If a payment was already captured, the refund path will continue according to your payment provider timeline."
        ])
      });

      return {
        subject: subjectFromPayload ?? `Order cancelled: ${orderNumberFromPayload}`,
        ...document
      };
    }
    case "PAYMENT_FAILED": {
      const orderNumber = orderNumberFromPayload;
      const currency = currencyFromPayload;
      const amount = typeof payload.amountCents === "number" ? payload.amountCents : null;

      const document = buildEmailDocument({
        preheader: `Payment failed for ${orderNumber}`,
        title: "Payment failed",
        intro: `We could not confirm payment for ${orderNumber}.`,
        ctaLabel: "Try Again",
        ctaUrl: `${env.CUSTOMER_APP_URL}/checkout`,
        detailRows: [
          { label: "Order", value: orderNumber },
          { label: "Amount", value: formatCurrency(amount, currency) }
        ],
        bodyHtml:
          "<p>No value has been delivered for this payment. You can safely retry from your account or checkout page.</p>"
      });

      return {
        subject: `Payment failed: ${orderNumber}`,
        ...document
      };
    }
    case "SHIPMENT_UPDATED":
    case "SHIPMENT_DELIVERED": {
      const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber : "your order";
      const delivered = input.type === "SHIPMENT_DELIVERED";
      const trackingNumber =
        typeof payload.trackingNumber === "string" ? payload.trackingNumber : null;
      const carrier = typeof payload.carrier === "string" ? payload.carrier : null;
      const status =
        typeof payload.shipmentStatus === "string"
          ? payload.shipmentStatus
          : delivered
            ? "DELIVERED"
            : "DISPATCHED";

      const document = buildEmailDocument({
        preheader: `${orderNumber} shipment update`,
        title: delivered ? "Shipment delivered" : "Shipment update",
        intro: delivered
          ? `Your order ${orderNumber} has been delivered.`
          : `Your order ${orderNumber} is on the move.`,
        detailRows: [
          { label: "Order", value: orderNumber },
          { label: "Status", value: status },
          { label: "Carrier", value: carrier },
          { label: "Tracking", value: trackingNumber }
        ],
        bodyHtml: delivered
          ? "<p>We hope everything arrived in good condition.</p>"
          : "<p>Use your tracking number with the carrier if you need a more detailed delivery timeline.</p>"
      });

      return {
        subject: delivered ? `Delivered: ${orderNumber}` : `Shipment update: ${orderNumber}`,
        ...document
      };
    }
    case "SUPPORT_TICKET_CREATED": {
      const ticketId = readString(payload.ticketId);
      const document = buildEmailDocument({
        preheader: "Support ticket created",
        title: "Support ticket received",
        intro: "We have received your support request.",
        ctaLabel: "Open Support",
        ctaUrl: readString(payload.ctaUrl) ?? `${env.CUSTOMER_APP_URL}/support`,
        detailRows: [
          { label: "Ticket", value: ticketId },
          { label: "Order", value: readString(payload.orderNumber) }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message),
          "Our support team will review the request and reply from the support inbox."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Support ticket created",
        ...document
      };
    }
    case "SUPPORT_REPLY": {
      const ticketId = typeof payload.ticketId === "string" ? payload.ticketId : null;
      const ticket = ticketId ? await loadSupportTicket(ticketId) : null;
      const orderNumber =
        ticket?.order?.orderNumber ??
        (typeof payload.orderNumber === "string" ? payload.orderNumber : "your order");

      const document = buildEmailDocument({
        preheader: "Support replied to your ticket",
        title: "Support reply received",
        intro: "A support agent has replied to your ticket.",
        ctaLabel: "Open Support",
        ctaUrl: `${env.CUSTOMER_APP_URL}/support`,
        detailRows: [
          { label: "Ticket", value: ticketId },
          { label: "Order", value: orderNumber }
        ],
        bodyHtml: `<p>${escapeHtml(ticket?.messages[0]?.body ?? "Open your support inbox to read the latest reply.")}</p>`
      });

      return {
        subject: "Support replied to your ticket",
        ...document
      };
    }
    case "SUPPORT_TICKET_STATUS_UPDATED": {
      const ticketId = readString(payload.ticketId);
      const status = readString(payload.ticketStatus) ?? readString(payload.status);
      const document = buildEmailDocument({
        preheader: "Support ticket updated",
        title: "Support ticket update",
        intro: "There is a new status update on your support ticket.",
        ctaLabel: "Open Support",
        ctaUrl: readString(payload.ctaUrl) ?? `${env.CUSTOMER_APP_URL}/support`,
        detailRows: [
          { label: "Ticket", value: ticketId },
          { label: "Status", value: status },
          { label: "Order", value: readString(payload.orderNumber) }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message),
          "Open the support center for the full conversation history."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Support ticket updated",
        ...document
      };
    }
    case "RETURN_REQUESTED":
    case "RETURN_APPROVED":
    case "RETURN_RECEIVED":
    case "RETURN_COMPLETED": {
      const returnId = typeof payload.returnId === "string" ? payload.returnId : null;
      const returnRecord = returnId ? await loadReturnRecord(returnId) : null;
      const orderNumber =
        returnRecord?.order.orderNumber ??
        (typeof payload.orderNumber === "string" ? payload.orderNumber : "your order");
      const stateTitles: Record<string, string> = {
        RETURN_REQUESTED: "Return request received",
        RETURN_APPROVED: "Return approved",
        RETURN_RECEIVED: "Return received",
        RETURN_COMPLETED: "Return completed"
      };

      const document = buildEmailDocument({
        preheader: `${stateTitles[input.type] ?? "Return update"} for ${orderNumber}`,
        title: stateTitles[input.type] ?? "Return update",
        intro: `There is an update for the return linked to ${orderNumber}.`,
        ctaLabel: "View Returns",
        ctaUrl: `${env.CUSTOMER_APP_URL}/account/returns`,
        detailRows: [
          { label: "Order", value: orderNumber },
          { label: "Return ID", value: returnId }
        ],
        bodyHtml: buildBulletList(
          returnRecord?.items.map((item) => `${item.quantity} x ${item.variant.product.title}`) ?? []
        )
      });

      return {
        subject: `${stateTitles[input.type] ?? "Return update"}: ${orderNumber}`,
        ...document
      };
    }
    case "RETURN_REJECTED": {
      const returnId = readString(payload.returnId);
      const document = buildEmailDocument({
        preheader: `Return update for ${orderNumberFromPayload}`,
        title: "Return rejected",
        intro: `Your return request for ${orderNumberFromPayload} was not approved.`,
        ctaLabel: "View Return",
        ctaUrl: readString(payload.ctaUrl) ?? `${env.CUSTOMER_APP_URL}/account/returns`,
        detailRows: [
          { label: "Order", value: orderNumberFromPayload },
          { label: "Return ID", value: returnId },
          { label: "Reason", value: readString(payload.reason) }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message) ?? "If you need clarification, reply through support with your return reference."
        ])
      });

      return {
        subject: subjectFromPayload ?? `Return rejected: ${orderNumberFromPayload}`,
        ...document
      };
    }
    case "REFUND_APPROVED": {
      const refundId = typeof payload.refundId === "string" ? payload.refundId : null;
      const refund = refundId ? await loadRefundRecord(refundId) : null;
      const orderNumber =
        refund?.payment.order.orderNumber ??
        (typeof payload.orderNumber === "string" ? payload.orderNumber : "your order");

      const document = buildEmailDocument({
        preheader: `Refund approved for ${orderNumber}`,
        title: "Refund approved",
        intro: `Your refund request for ${orderNumber} has been approved.`,
        detailRows: [
          { label: "Order", value: orderNumber },
          {
            label: "Amount",
            value: formatCurrency(refund?.amountCents, refund?.currency ?? "GHS")
          }
        ],
        bodyHtml:
          "<p>The refund is now pending provider settlement. The final posting time depends on your payment channel and provider.</p>"
      });

      return {
        subject: `Refund approved: ${orderNumber}`,
        ...document
      };
    }
    case "REFUND_REJECTED": {
      const refundId = readString(payload.refundId);
      const document = buildEmailDocument({
        preheader: `Refund update for ${orderNumberFromPayload}`,
        title: "Refund rejected",
        intro: `Your refund request for ${orderNumberFromPayload} was not approved.`,
        detailRows: [
          { label: "Order", value: orderNumberFromPayload },
          { label: "Refund ID", value: refundId },
          { label: "Reason", value: readString(payload.reason) }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message) ?? "Contact support if you need the decision reviewed."
        ])
      });

      return {
        subject: subjectFromPayload ?? `Refund rejected: ${orderNumberFromPayload}`,
        ...document
      };
    }
    case "CUSTOMER_SUSPENDED":
    case "CUSTOMER_RESTORED": {
      const restored = input.type === "CUSTOMER_RESTORED";
      const document = buildEmailDocument({
        preheader: restored ? "Your account has been restored" : "Your account has been restricted",
        title: restored ? "Account restored" : "Account update",
        intro: restored
          ? "Your account access has been restored."
          : "Your account has been restricted pending review.",
        detailRows: [
          {
            label: "Reason",
            value: typeof payload.reason === "string" ? payload.reason : null
          }
        ],
        bodyHtml:
          typeof payload.note === "string" ? `<p>${escapeHtml(payload.note)}</p>` : "<p>If you need help, contact support.</p>"
      });

      return {
        subject: restored ? "Account restored" : "Account update",
        ...document
      };
    }
    case "LOW_STOCK_ALERT": {
      const document = buildEmailDocument({
        preheader: "Inventory threshold reached",
        title: "Low stock alert",
        intro: "A product variant has reached or crossed its reorder threshold.",
        ctaLabel: "Open Inventory",
        ctaUrl: readString(payload.ctaUrl) ?? `${env.ADMIN_APP_URL}/inventory`,
        detailRows: [
          { label: "Product", value: readString(payload.productTitle) },
          { label: "SKU", value: readString(payload.sku) },
          { label: "Warehouse", value: readString(payload.warehouseName) },
          {
            label: "Available",
            value:
              readNumber(payload.availableQuantity) !== null
                ? String(readNumber(payload.availableQuantity))
                : null
          },
          {
            label: "Reorder level",
            value:
              readNumber(payload.reorderLevel) !== null
                ? String(readNumber(payload.reorderLevel))
                : null
          }
        ],
        bodyHtml: buildParagraphs([
          readString(payload.message) ?? "Review stock availability and replenishment timing."
        ])
      });

      return {
        subject: subjectFromPayload ?? "Low stock alert",
        ...document
      };
    }
    case "ADMIN_OPERATIONAL_ALERT":
    case "SECURITY_ALERT":
    case "WEBHOOK_FAILURE":
    case "WEBHOOK_DEAD_LETTER":
    case "INVALID_WEBHOOK_SIGNATURE":
    case "SECURITY_INCIDENT_OPENED":
    case "SECURITY_INCIDENT_RESOLVED": {
      const titles: Record<string, string> = {
        ADMIN_OPERATIONAL_ALERT: "Operational alert",
        SECURITY_ALERT: "Security alert",
        WEBHOOK_FAILURE: "Webhook failure",
        WEBHOOK_DEAD_LETTER: "Webhook dead-lettered",
        INVALID_WEBHOOK_SIGNATURE: "Invalid webhook signature",
        SECURITY_INCIDENT_OPENED: "Security incident opened",
        SECURITY_INCIDENT_RESOLVED: "Security incident resolved"
      };
      const title = titles[input.type] ?? "Operational alert";
      const incidentId = readString(payload.incidentId);
      const alertId = readString(payload.alertId);
      const eventId = readString(payload.webhookEventId) ?? readString(payload.securityEventId);
      const bulletItems = readStringArray(payload.highlights);

      const document = buildEmailDocument({
        preheader: title,
        title,
        intro: readString(payload.summary) ?? readString(payload.message) ?? "An operational event needs review.",
        ctaLabel: readString(payload.ctaLabel) ?? "Open Admin",
        ctaUrl:
          readString(payload.ctaUrl) ??
          `${env.ADMIN_APP_URL}/${input.type.includes("SECURITY") ? "security" : "operations"}`,
        detailRows: [
          { label: "Severity", value: readString(payload.severity) },
          { label: "Provider", value: readString(payload.provider) },
          { label: "Alert", value: alertId },
          { label: "Incident", value: incidentId },
          { label: "Event", value: eventId },
          { label: "Entity", value: readString(payload.entityType) },
          { label: "Entity ID", value: readString(payload.entityId) },
          { label: "IP address", value: readString(payload.ipAddress) }
        ],
        bodyHtml: `${buildParagraphs([
          readString(payload.detail),
          readString(payload.reason)
        ])}${buildBulletList(bulletItems)}`
      });

      return {
        subject: subjectFromPayload ?? title,
        ...document
      };
    }
    default: {
      const subject =
        subjectFromPayload ?? "Platform update";
      const heading =
        readString(payload.heading) ?? subject;
      const message =
        readString(payload.message) ?? "There is an update related to your account.";

      const document = buildEmailDocument({
        preheader: subject,
        title: heading,
        intro: message,
        bodyHtml: `<p>${escapeHtml(message)}</p>`,
        ctaLabel:
          typeof payload.ctaLabel === "string" ? payload.ctaLabel : undefined,
        ctaUrl: typeof payload.ctaUrl === "string" ? payload.ctaUrl : null,
        detailRows: []
      });

      return {
        subject,
        ...document
      };
    }
  }
};
