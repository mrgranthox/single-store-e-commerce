# Email Template Matrix

Date: 2026-03-27

## Customer account and auth

- `WELCOME`
- `EMAIL_VERIFICATION_REQUIRED`
- `EMAIL_VERIFIED`
- `PASSWORD_RESET`
- `PASSWORD_CHANGED`

## Customer commerce and post-purchase

- `ORDER_PAYMENT_ACTION_REQUIRED`
- `ORDER_CONFIRMED`
- `ORDER_STATUS_UPDATED`
- `ORDER_CANCELLED`
- `PAYMENT_FAILED`
- `SHIPMENT_UPDATED`
- `SHIPMENT_DELIVERED`
- `RETURN_REQUESTED`
- `RETURN_APPROVED`
- `RETURN_RECEIVED`
- `RETURN_COMPLETED`
- `RETURN_REJECTED`
- `REFUND_APPROVED`
- `REFUND_REJECTED`

## Customer service and account status

- `SUPPORT_TICKET_CREATED`
- `SUPPORT_REPLY`
- `SUPPORT_TICKET_STATUS_UPDATED`
- `CUSTOMER_SUSPENDED`
- `CUSTOMER_RESTORED`

## Admin and operational

- `LOW_STOCK_ALERT`
- `ADMIN_OPERATIONAL_ALERT`
- `SECURITY_ALERT`
- `WEBHOOK_FAILURE`
- `WEBHOOK_DEAD_LETTER`
- `INVALID_WEBHOOK_SIGNATURE`
- `SECURITY_INCIDENT_OPENED`
- `SECURITY_INCIDENT_RESOLVED`

## Notes

- All templates render both HTML and plain text.
- Templates accept payload-first data, with optional database lookups when entity IDs are present.
- The current implementation is in [notification-templates.ts](/home/edward-nyame/Desktop/E-commerce/backend/src/modules/notifications/notification-templates.ts).
- Delivery is handled through Brevo SMTP / Nodemailer in [email.ts](/home/edward-nyame/Desktop/E-commerce/backend/src/config/email.ts) and [notifications.service.ts](/home/edward-nyame/Desktop/E-commerce/backend/src/modules/notifications/notifications.service.ts).
