# E-Commerce Admin Page-by-Page UI Specification

## Executive overview
This document expands the admin frontend into a **94-screen page-by-page UI specification**. The goal is to remove guesswork for UI design, frontend implementation, and AI-assisted code generation.

Each screen should clearly define:
- purpose
- primary users
- sections and widgets
- filters and search behavior
- actions and confirmations
- permissions
- key backend data dependencies

## Screen groups in scope
The page set is organized into the following groups:
- access and shell
- dashboards
- catalog
- inventory
- orders and fulfillment
- payments and finance
- customers
- support
- content and marketing
- reporting
- audit, security, and incidents
- system controls and monitoring

## Global UX rules
- sensitive actions must require explicit confirmation
- high-risk actions should optionally collect a reason
- major entities should have dedicated detail pages
- timelines should be first-class UI patterns
- lists must support search, filters, pagination, and empty states
- detail pages must link to related entities
- action menus should hide or disable options based on permission

## Access and shell screens

### 1. Admin login
Purpose: secure admin entry point.
Sections: login form, forgot password link, environment badge if needed.
Actions: sign in.

### 2. Forgot password
Purpose: initiate credential recovery.
Sections: email input, success state.
Actions: send reset link.

### 3. Reset password
Purpose: set new password after recovery.
Sections: new password, confirm password, token validation state.
Actions: save new password.

### 4. Unauthorized / forbidden
Purpose: block access to restricted routes with clear navigation back.

### 5. Admin profile and session security
Purpose: manage admin profile, current sessions, and password/security actions.
Sections: profile info, active sessions, recent security events, sign-out-all action.

## Dashboard screens

### 6. Executive dashboard overview
Purpose: unified top-level view of business, operations, support, risk, and system state.
Key widgets: KPI cards, revenue trend, recent orders, low stock, urgent tickets, unresolved alerts.

### 7. Sales performance dashboard
Purpose: revenue and order-performance analytics.
Key widgets: sales trend, AOV, discount impact, top products, payment success rate.

### 8. Operations control dashboard
Purpose: fulfillment and inventory action view.
Key widgets: unfulfilled orders, dispatch backlog, stock risk, recent operational overrides.

### 9. Customer service dashboard
Purpose: service backlog and SLA view.
Key widgets: open tickets, urgent tickets, response-time summary, complaint queue, unresolved returns issues.

### 10. Risk and security dashboard
Purpose: surface suspicious activity and active governance work.
Key widgets: alerts, security-event spikes, fraud signals, open incidents.

### 11. System health dashboard
Purpose: show webhook failures, job failures, and integration health.
Key widgets: job status summary, webhook processing chart, failing integrations.

## Catalog screens

### 12. Product list
Purpose: searchable catalog control table.
Sections: filters, table, bulk action bar.
Filters: name, SKU, brand, category, status, visibility.
Actions: create, edit, archive, publish, open analytics.

### 13. Product create
Purpose: structured product creation form.
Sections: basic info, descriptions, brand/category, pricing, inventory behavior, SEO, publish state.

### 14. Product edit
Purpose: mutate product safely.
Behavior: unsaved-changes guard, confirmation on sensitive fields, audit capture.

### 15. Product detail overview
Purpose: product command center.
Sections: summary, variants snapshot, media snapshot, pricing summary, inventory summary, review snapshot, recent activity.

### 16. Product analytics detail
Purpose: dedicated analytics for one product.
Sections: sales trend, conversion proxy metrics if supported, return rate, refund rate, stockouts, review distribution, revenue contribution.

### 17. Product variants management
Purpose: manage variant rows and availability.
Sections: variants table, create/edit variant actions, stock and price columns.

### 18. Product media management
Purpose: upload, reorder, and assign media.
Sections: gallery, primary image controls, variant-specific media mapping.

### 19. Product pricing and merchandising
Purpose: manage prices, compare prices, promo readiness, and merchandising controls.
Actions: update price, update visibility, schedule publish.

### 20. Product inventory summary
Purpose: product-scoped inventory view.
Sections: stock by variant, reserved stock, warehouse summary, movement links.

### 21. Category management
Purpose: manage category hierarchy.
Views: list view and tree view.

### 22. Brand management
Purpose: manage brands and linked products.

### 23. Reviews moderation
Purpose: publish, hide, reject, and inspect customer reviews.
Sections: filters, reviews table, detail drawer, moderation actions.

## Inventory screens

### 24. Inventory overview
Purpose: master stock view.
Columns: product, variant, SKU, warehouse, on hand, reserved, available, reorder level.

### 25. Inventory low-stock queue
Purpose: action queue for low-stock items.
Focus: prioritization, reorder threshold, recent movement.

### 26. Inventory out-of-stock queue
Purpose: track unavailable items and restock urgency.

### 27. Inventory movement history
Purpose: immutable movement investigation table.
Filters: SKU, warehouse, movement type, actor, date.

### 28. Inventory adjustment console
Purpose: manual stock change workspace.
Features: current stock preview, resulting stock preview, reason field, confirmation dialog.

### 29. Warehouse list
Purpose: manage stock locations.

### 30. Warehouse detail
Purpose: warehouse-specific operational summary.
Sections: summary, stock health, recent movements, linked shipments.

### 31. Warehouse inventory detail
Purpose: per-warehouse inventory table with drill-down actions.

## Orders and fulfillment screens

### 32. Orders list
Purpose: central order queue.
Filters: order number, customer, payment status, fulfillment status, order status, date.

### 33. Order detail
Purpose: single source of truth for an order.
Sections: header summary, customer panel, items, payment, fulfillment, notes, timeline, actions.

### 34. Order timeline detail
Purpose: deep status and activity history for one order.
Events: order placed, payment confirmed, shipment events, returns, refunds, support-linked activity.

### 35. Fulfillment queue
Purpose: orders awaiting picking/processing.
Columns: order number, placed at, items, warehouse assignment, status.

### 36. Packing and dispatch queue
Purpose: orders ready for packing or courier handoff.
Actions: mark packed, assign tracking, dispatch.

### 37. Shipment detail
Purpose: shipment summary and operational actions.
Sections: shipment summary, items, courier info, tracking, related order link.

### 38. Shipment tracking events
Purpose: event-level tracking history for one shipment.

### 39. Returns queue
Purpose: manage all return requests.
Filters: status, reason, customer, date.

### 40. Return detail
Purpose: review, approve, reject, receive, and complete a return.
Sections: return summary, order linkage, items, timeline, refund linkage.

### 41. Cancellation requests queue
Purpose: centralized queue for order-cancellation decisions.

## Payments and finance screens

### 42. Payments list
Purpose: searchable payment operations table.
Filters: provider, status, amount range, date.

### 43. Payment detail
Purpose: payment summary with order context and linked refunds.

### 44. Payment transaction timeline
Purpose: provider-transaction history and verification trace for a payment.

### 45. Refunds queue
Purpose: approval and tracking queue for refunds.

### 46. Refund detail
Purpose: refund command page.
Sections: refund summary, order/payment context, approval state, provider state, timeline.

### 47. Failed payments investigation
Purpose: identify payment failures and patterns.
Widgets: failure reasons, provider breakdown, affected customers/orders.

### 48. Financial exceptions and reconciliation
Purpose: detect mismatches, partial failures, duplicate callbacks, and unresolved finance issues.

## Customer screens

### 49. Customers list
Purpose: searchable customer table.
Columns: name, email, phone, status, total orders, lifetime spend, last order date.

### 50. Customer detail overview
Purpose: 360-degree customer summary.
Sections: profile, contact, account status, communication preferences, top metrics.

### 51. Customer activity timeline
Purpose: unified timeline across login events, orders, support, reviews, refunds, and alerts.

### 52. Customer orders history
Purpose: customer-scoped orders table.

### 53. Customer support history
Purpose: customer-scoped support case history.

### 54. Customer reviews history
Purpose: moderation and behavior view across all customer reviews.

### 55. Customer risk and security profile
Purpose: fraud and security investigation view.
Sections: suspicious login patterns, alerts, risk signals, refund abuse patterns.

### 56. Customer account action center
Purpose: controlled customer actions.
Actions: suspend/reactivate, resend verification later, create internal note later, open ticket, escalate for review.
All sensitive actions must confirm and audit.

## Support screens

### 57. Support tickets list
Purpose: central ticket operations table.
Filters: ticket number, subject, status, priority, category, assignee.

### 58. Support ticket detail
Purpose: resolve issues with full context.
Sections: thread, attachments, internal notes, linked order/customer, status history, action rail.

### 59. Support queue by SLA / priority
Purpose: prioritize tickets by urgency and SLA risk.

### 60. Pre-purchase inquiries queue
Purpose: isolate buying questions and pre-order assistance.

### 61. Returns and complaints support queue
Purpose: support-team queue specifically for complaints, damaged items, and delivery issues.

### 62. Support analytics and SLA reporting
Purpose: service-performance analytics screen.
Metrics: first response time, resolution time, backlog by status, backlog by priority.

## Content and marketing screens

### 63. Banners management
Purpose: manage homepage and campaign banners.

### 64. CMS pages management
Purpose: manage static informational content.

### 65. Coupon management
Purpose: create, update, disable, and inspect coupons.

### 66. Coupon redemption analytics
Purpose: coupon-usage analytics and abuse detection support.

### 67. Promotions management
Purpose: create and manage promotion entities.

### 68. Promotion rules detail
Purpose: rule-level targeting configuration for one promotion.

### 69. Campaign performance overview
Purpose: performance view across banners, coupons, and promotions.

## Reporting screens

### 70. Reports overview
Purpose: top-level reporting hub.

### 71. Sales analytics report
Purpose: sales trends, revenue, AOV, discount impact.

### 72. Product performance analytics
Purpose: product revenue, unit sales, return rate, stockout impact.

### 73. Inventory analytics report
Purpose: stock health trends, movement patterns, low-stock exposure.

### 74. Customer analytics report
Purpose: customer growth, repeat purchase, segmentation, LTV proxies.

### 75. Support analytics report
Purpose: service performance and queue analytics.

### 76. Refunds and returns analytics
Purpose: financial and operational reporting for post-purchase exceptions.

### 77. Marketing and coupon analytics
Purpose: coupon, promotion, and campaign performance.

## Security and governance screens

### 78. Audit logs explorer
Purpose: immutable general activity explorer.
Filters: actor, action, entity, date.

### 79. Admin action logs explorer
Purpose: inspect sensitive admin mutations with before/after context.

### 80. User activity explorer
Purpose: system-wide user-activity search across entities and dates.

### 81. Alerts center
Purpose: manage operational and security alerts.
Actions: acknowledge, assign, resolve, escalate.

### 82. Alert detail
Purpose: full alert workspace with source context, ownership, and linked entities.

### 83. Security events explorer
Purpose: review suspicious or security-relevant events.

### 84. Security event detail
Purpose: event-level investigation page with user/order/payment context.

### 85. Incidents list
Purpose: incident backlog and ownership view.

### 86. Incident detail and investigation workspace
Purpose: manage a full incident.
Sections: summary, linked entities, notes, timeline, resolution.

### 87. Risk signals and fraud review
Purpose: review scored risk signals and suspicious operational patterns.

## System control and monitoring screens

### 88. Settings overview
Purpose: central settings hub.

### 89. Checkout and commerce settings
Purpose: manage guest checkout, commerce policies, and thresholds.

### 90. Review and moderation settings
Purpose: review eligibility and moderation rules.

### 91. Support and SLA settings
Purpose: ticket categories, priorities, SLA thresholds, support attachments rules.

### 92. Webhooks monitoring
Purpose: inspect inbound provider webhooks.
Actions: payload inspect, status inspect, retry later if supported.

### 93. Jobs and background processing monitor
Purpose: inspect asynchronous job health.

### 94. API / integration health and exception monitor
Purpose: monitor external service health and integration failures.

## Shared page primitives
All screens should reuse:
- page header
- filter bar
- stat card
- status badge
- data table
- entity summary card
- timeline component
- JSON inspector
- confirmation modal
- destructive action dialog
- empty state
- loading skeleton

## Sensitive action standards
The following require confirmation everywhere they appear:
- publish/unpublish
- archive
- price change
- stock adjustment
- order cancellation
- refund approval
- customer suspension
- role or settings change
- alert resolution
- incident closure

Where necessary, confirmation flows should request a reason and create an audit trail.

## Implementation guidance
A frontend or AI coding agent should implement screens in waves:
1. shell, permissions, and dashboard
2. catalog, orders, and inventory
3. customers, payments, refunds, and support
4. content, marketing, and reports
5. audit, alerts, incidents, and system monitoring
