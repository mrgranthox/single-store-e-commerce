# E-Commerce Admin Role-by-Role Permissions Matrix

## Executive overview
This updated permissions matrix aligns the admin system to the **94-screen control-heavy scope**. It is designed so the frontend, backend RBAC layer, and AI coding agents share the same authority model.

The permission model separates:
- read access
- operational write access
- approval authority
- override authority
- governance or security authority

## Roles in scope
- super admin
- platform admin
- catalog manager
- inventory manager
- fulfillment manager
- finance admin
- support lead
- support agent
- content and marketing manager
- analyst / read-only admin

## Permission design principles
- route access and action access are separate
- seeing a screen does not automatically grant mutation power
- high-risk actions require dedicated permissions
- the most sensitive actions should be limited to super admin or specifically trusted roles
- confirmation dialogs do not replace backend RBAC; they complement it

## Role summaries

### Super admin
Full access across all modules, screens, sensitive actions, security workspaces, and system settings. Can manage roles, permissions, incidents, and integration controls.

### Platform admin
Broad operational access across commerce modules. Can manage day-to-day business operations, but some platform-hardening tasks and role-management capabilities may remain super-admin-only.

### Catalog manager
Controls products, variants, media, merchandising, categories, brands, and review moderation. Usually read-only outside catalog/reporting domains.

### Inventory manager
Controls stock, warehouses, inventory queues, stock movements, and adjustment actions. Read access to products, orders, and related reports.

### Fulfillment manager
Controls order-processing queues, shipment states, dispatch operations, and return intake operations. Limited outside orders/inventory/support-linked areas.

### Finance admin
Controls payments, refunds, failed payment investigations, and financial exception workflows. Typically read-only for catalog and customer-service content outside payment context.

### Support lead
Controls support queues, ticket assignment, complaint handling, customer support history, and service analytics. Limited operational visibility into orders, returns, and customers where needed.

### Support agent
Handles ticket replies, ticket resolution workflows, and customer issue handling. Usually cannot change payments, inventory, pricing, or security/system settings.

### Content and marketing manager
Controls banners, CMS pages, coupons, promotions, and campaign reporting. Typically read-only in core commerce operations.

### Analyst / read-only admin
Can inspect dashboards and reports, and optionally read selected operational screens, but cannot perform state-changing actions.

## Screen-family access matrix

### Access and shell screens
- Super admin: full
- Platform admin: full
- Catalog manager: profile/security only after login
- Inventory manager: profile/security only after login
- Fulfillment manager: profile/security only after login
- Finance admin: profile/security only after login
- Support lead: profile/security only after login
- Support agent: profile/security only after login
- Content/marketing manager: profile/security only after login
- Analyst: profile/security only after login

### Dashboard screens
- Super admin: all dashboards full
- Platform admin: all dashboards full except some security controls may be read-only
- Catalog manager: executive read, sales read, limited operations read
- Inventory manager: executive read, operations full, system-health read
- Fulfillment manager: executive read, operations full, support read where needed
- Finance admin: executive read, sales full, risk read, system-health read
- Support lead: executive read, support full, risk read
- Support agent: limited dashboard access, mainly support dashboard
- Content/marketing manager: executive read, sales read
- Analyst: read-only all non-sensitive dashboards

### Catalog screens
- Super admin: full
- Platform admin: full
- Catalog manager: full
- Inventory manager: read, plus product inventory summary read
- Fulfillment manager: read only
- Finance admin: read only
- Support lead: read product detail and reviews as needed
- Support agent: read product detail as needed
- Content/marketing manager: read all, write selected merchandising/media/content-linked product fields if allowed by policy
- Analyst: read only

Sensitive catalog actions:
- publish/unpublish product: super admin, platform admin, catalog manager
- archive product: super admin, platform admin, catalog manager
- change product price: super admin, platform admin, catalog manager where approved by policy

### Inventory and warehouse screens
- Super admin: full
- Platform admin: full
- Catalog manager: read only
- Inventory manager: full
- Fulfillment manager: read all, write selected operational updates if policy allows
- Finance admin: read only
- Support lead: limited read for issue resolution
- Support agent: no direct access or very limited read
- Content/marketing manager: no access or read-only inventory summary
- Analyst: read reports only or overview read

Sensitive inventory actions:
- stock adjustment: super admin, platform admin, inventory manager
- warehouse update: super admin, platform admin, inventory manager

### Orders and fulfillment screens
- Super admin: full
- Platform admin: full
- Catalog manager: read only
- Inventory manager: read plus fulfillment-linked visibility
- Fulfillment manager: full
- Finance admin: read all, write only where payment/refund-linked operations require it
- Support lead: read and limited support-linked operational actions
- Support agent: read limited order context from support-linked views
- Content/marketing manager: no access or read-only high-level reports
- Analyst: read only

Sensitive order actions:
- cancel order: super admin, platform admin, fulfillment manager, support lead where policy allows
- manual fulfillment override: super admin, platform admin, fulfillment manager

### Payments and finance screens
- Super admin: full
- Platform admin: full
- Catalog manager: read only or no access by policy
- Inventory manager: read only or none
- Fulfillment manager: read payment state only where operationally needed
- Finance admin: full
- Support lead: read payment/refund context and limited ticket-linked refund initiation depending on policy
- Support agent: read limited payment summary from tickets/orders
- Content/marketing manager: none
- Analyst: read reports only

Sensitive finance actions:
- approve refund: super admin, platform admin, finance admin
- mark financial exception resolved: super admin, platform admin, finance admin

### Customer screens
- Super admin: full
- Platform admin: full
- Catalog manager: read limited customer context if needed
- Inventory manager: none or limited read
- Fulfillment manager: read customer order context and addresses where operationally needed
- Finance admin: read customer payment/refund context
- Support lead: full
- Support agent: broad read, limited write via ticket-linked actions
- Content/marketing manager: read high-level customer analytics only
- Analyst: read-only customer analytics, not sensitive profiles unless approved

Sensitive customer actions:
- suspend/reactivate customer: super admin, platform admin, support lead where policy allows
- customer-account action center operations: super admin, platform admin, support lead

### Support screens
- Super admin: full
- Platform admin: full
- Catalog manager: read complaint context only if needed
- Inventory manager: read complaint context only if stock issue linked
- Fulfillment manager: read/write on shipping and delivery issue workflows where policy allows
- Finance admin: read/write where payment/refund issue linked
- Support lead: full
- Support agent: full on ticket handling except high-risk escalations
- Content/marketing manager: none
- Analyst: read analytics only

Sensitive support actions:
- assign tickets: super admin, platform admin, support lead
- close escalated complaints: super admin, platform admin, support lead

### Content and marketing screens
- Super admin: full
- Platform admin: full
- Catalog manager: read only or collaborative read
- Inventory manager: none
- Fulfillment manager: none
- Finance admin: read coupon analytics if needed
- Support lead: read only
- Support agent: none
- Content/marketing manager: full
- Analyst: read-only performance views

Sensitive marketing actions:
- publish banner/page: super admin, platform admin, content/marketing manager
- create/disable coupon: super admin, platform admin, content/marketing manager

### Reporting screens
- Super admin: full
- Platform admin: full
- Catalog manager: full on catalog-related reports, read on others as approved
- Inventory manager: full on inventory reports, read on others as approved
- Fulfillment manager: full on operational reports, read on others as approved
- Finance admin: full on finance/refund reports, read on others as approved
- Support lead: full on support reports, read on others as approved
- Support agent: limited support analytics read
- Content/marketing manager: full on marketing reports
- Analyst: full read-only across approved reports

### Audit, security, and incidents screens
- Super admin: full
- Platform admin: broad read and selected write depending on policy
- Catalog manager: usually none or limited read to own-module activity
- Inventory manager: limited read to stock-related logs if approved
- Fulfillment manager: limited read to order/ship-related logs if approved
- Finance admin: limited read to finance exceptions and payment-linked alerts
- Support lead: limited read to customer-linked activity, alerts, or fraud notes if approved
- Support agent: no access or highly restricted read-only snippets
- Content/marketing manager: none
- Analyst: read-only selected aggregated risk dashboards at most

Sensitive governance actions:
- resolve alert: super admin, platform admin, security-authorized operations lead if such role exists later
- manage incident: super admin, platform admin
- inspect admin action logs: super admin and specifically trusted platform admins only

### System control and monitoring screens
- Super admin: full
- Platform admin: broad read and selected write depending on policy
- Catalog manager: none
- Inventory manager: read system-health where needed
- Fulfillment manager: read jobs/webhooks only if operationally needed
- Finance admin: read payment/webhook monitors where relevant
- Support lead: limited read on system health if needed
- Support agent: none
- Content/marketing manager: none
- Analyst: read-only high-level system-health if approved

Sensitive system actions:
- edit settings: super admin, platform admin, and narrowly scoped owners for selected settings only
- retry jobs/webhooks: super admin, platform admin, and tightly scoped operational owners if approved

## High-risk permissions that must exist explicitly
The backend and frontend should define explicit permissions for actions such as:
- catalog.products.publish
- catalog.products.archive
- catalog.products.change_price
- inventory.adjust
- inventory.manage_warehouses
- orders.cancel
- orders.override_fulfillment
- refunds.approve
- customers.suspend
- support.assign
- support.close_escalated
- content.publish
- marketing.manage_coupons
- security.alerts.resolve
- security.incidents.manage
- settings.write
- integrations.retry_jobs
- admin.manage_roles

## Confirmation and audit requirements
The following action classes should always have confirmation dialogs and audit capture:
- destructive product changes
- stock adjustments
- order cancellation or overrides
- refund approvals
- customer suspension
- role changes
- settings changes
- alert and incident resolution
- integration retries that may alter state

## Frontend implementation guidance
The frontend should implement permissions in three layers:
1. route guards
2. component-level visibility checks
3. mutation-level action checks tied to confirmation flows

The backend must still enforce every permission server-side.
