# Google Stitch — All 19 Batch Prompts
## E-Commerce Admin Panel — 94 Screens

> BEFORE EACH BATCH: Import your DESIGN.md into the Stitch project.
> Paste it into the canvas context window as: "Apply this design system to all screens."
> Then paste the batch prompt below.

---

## ═══════════════════════════════════════
## BATCH 1 of 19 — Access & Shell (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md contents or import file]

Generate these 5 connected admin screens for an enterprise e-commerce control panel:

SCREEN 1 — Admin Login
A focused, secure login page. Split layout: left side is a deep navy panel (#13161e) with the platform logo, a tagline like "Operational control. Complete visibility.", and a subtle grid pattern. Right side is white with the login form: email field, password field, "Remember this device" checkbox, Sign In button (primary blue), Forgot password link. No social login. Add a small environment badge "Production" in the top-right corner. Include error state variant showing invalid credentials inline under the form.

SCREEN 2 — Forgot Password
Same split layout as login. Right side shows: heading "Recover your access", subtitle explaining an email will be sent, single email input field, Send Reset Link button. Below the form add a success state (green check icon, "Email sent" message, back to login link). Keep it clean — no decorative elements beyond the left panel.

SCREEN 3 — Reset Password
Same split layout. Right side: heading "Set new password", new password field with strength indicator bar (4 segments, colored red → orange → yellow → green), confirm password field, Save Password button. Add token expired error state as an alternate view with a warning icon and link back to forgot-password.

SCREEN 4 — Unauthorized / Forbidden
Full-screen content area (no sidebar since not logged in). Center-aligned: a large lock icon (64px, muted blue), heading "Access Restricted", description "You don't have permission to view this page. Contact your administrator if you believe this is an error.", two buttons: "Go to Dashboard" (primary) and "Sign out" (ghost). Background: #f0f2f7.

SCREEN 5 — Admin Profile & Session Security
Full authenticated layout with sidebar and header. Page title: "Profile & Security". Two-column layout:
Left column (65%): Profile section (avatar upload circle, name field, email field, role badge readonly, save button), Password Change section (current password, new password, confirm, update button).
Right column (35%): Active Sessions panel — table showing device name, browser, location, last active timestamp, Revoke button per row, "Revoke all other sessions" destructive button at bottom. Recent Security Events panel below — list of last 5 events (login, password change, session revoked) with timestamps.

Style rules:
- Use DM Sans for headings, IBM Plex Sans for body
- Left login panel: dark navy #13161e with subtle dot-grid SVG pattern at 5% opacity
- All inputs: 44px height, border #e5e7eb, focus ring #4f7ef8
- Primary button: #4f7ef8, white text, 8px radius
```

---

## ═══════════════════════════════════════
## BATCH 2 of 19 — Dashboards Part 1 (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

Generate these 5 connected dashboard screens for an enterprise e-commerce admin panel. All use the full authenticated shell (dark sidebar #13161e, white header, light gray content area #f0f2f7).

SCREEN 6 — Executive Dashboard Overview
The command center. 4-column KPI row at top: Total Revenue (with up trend), Orders Today, Active Customers, Open Alerts (red badge if >0). Below: 2-column layout.
Left (65%): Revenue trend line chart (last 30 days, area fill), Recent Orders table (5 rows: order #, customer name, amount, status badge, time ago).
Right (35%): Low Stock Alerts list (5 items: product name, SKU, qty remaining, "View" link), Urgent Support Tickets list (3 items: ticket #, subject, priority badge), System Health mini-panel (3 indicators: Payment Gateway green, Shipping API green, Email Service yellow).

SCREEN 7 — Sales Performance Dashboard
Page title: "Sales Performance". Date range picker top-right (Last 7d / 30d / 90d / Custom).
Row 1: 4 KPI cards — Gross Revenue, Net Revenue, Average Order Value, Discount Impact (as %).
Row 2: Full-width revenue trend bar chart with tooltip on hover. X-axis: dates. Y-axis: revenue. Two series: Gross and Net.
Row 3: 2 panels side by side — Top Products by Revenue (ranked table: rank, product name, units sold, revenue, % of total) | Payment Success Rate donut chart (success/failed/pending with legend).

SCREEN 8 — Operations Control Dashboard
Page title: "Operations Control". Focus on fulfillment and inventory action.
Row 1: 4 KPI cards — Unfulfilled Orders, Dispatch Backlog, Out-of-Stock SKUs, Avg Fulfillment Time.
Row 2: 2-column — Fulfillment queue urgency bar (stacked bar: on-time vs at-risk vs overdue) | Warehouse Stock Health table (warehouse name, total SKUs, in-stock %, low-stock count, actions).
Row 3: Recent Operational Overrides table (5 rows: admin actor, action type, entity, timestamp, reason snippet).

SCREEN 9 — Customer Service Dashboard
Page title: "Customer Service". Ownership: support team leads.
Row 1: 4 KPI cards — Open Tickets, Urgent / Breaching SLA, Avg First Response Time, Resolution Rate %.
Row 2: Ticket backlog by status — horizontal stacked bar (New / Open / Pending / On Hold / Resolved).
Row 3: 2 panels — SLA Breach Risk list (tickets with countdown timers showing time left before SLA breach) | Complaint Queue Summary (count of complaints by category: Damaged Item, Late Delivery, Wrong Item, Refund Issue).

SCREEN 10 — Risk & Security Dashboard
Page title: "Risk & Security". Dark-tinted accent on alert widgets to convey urgency.
Row 1: 4 KPI cards — Active Alerts (red if >0), Open Incidents, Flagged Transactions (last 24h), Suspended Accounts.
Row 2: Security Events Spike chart (line chart, events per hour last 24h, red threshold line).
Row 3: 2 panels — Active Alerts list (alert type, severity badge, assigned to, age) | Open Incidents list (incident title, status badge, created, owner).

Style rules for all dashboards:
- Sidebar active item: Overview group, specific dashboard highlighted
- KPI cards: white bg, 12px radius, shadow, 4-column grid
- Charts: use muted blue primary series, secondary series in #94a3b8
- All tables in panels: compact rows (44px), no outer border on panel tables
```

---

## ═══════════════════════════════════════
## BATCH 3 of 19 — System Health + Catalog Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 11 — System Health Dashboard
Page title: "System Health". Technical audience (ops, engineering).
Row 1: 4 KPI cards — Job Success Rate %, Webhook Delivery Rate %, Failed Jobs (24h), Failing Integrations count.
Row 2: Full-width Webhook Processing chart (line chart: webhooks received vs processed vs failed per hour).
Row 3: 3 panels — Background Jobs Status table (job name, last run, duration, status badge, next run) | Integration Health grid (each integration as a card: name, status dot, last ping, latency) | Recent Exceptions list (type, message snippet, timestamp, count).

SCREEN 12 — Product List
Page title: "Products". Catalog → Products active in sidebar.
Filter bar: search by name/SKU, Status dropdown (All/Active/Draft/Archived), Category dropdown, Brand dropdown, date range, Clear filters.
Bulk action bar (appears when rows checked): Publish, Unpublish, Archive, Delete (destructive).
Table columns: ☐ | Thumbnail (40px sq) | Product Name + SKU (monospace) | Category | Brand | Price | Stock | Status badge | Visibility | Actions menu (Edit, View, Analytics, Archive).
Show 25 rows. Pagination footer.
Top-right: "+ Create Product" primary button.
Include one row expanded to show a hover state with inline quick-action buttons visible.

SCREEN 13 — Product Create
Page title: "Create Product". Two-column layout.
Left (65% main form):
  Section 1 "Basic Info": Product Name, Short Description (textarea), Full Description (rich text area placeholder).
  Section 2 "Organization": Brand dropdown, Category multi-select, Tags input.
  Section 3 "SEO": Meta title, Meta description, URL slug (auto-generated, editable).
Right (35% sidebar):
  Publish panel: Status toggle (Draft/Active), Visibility toggle (Public/Private), Schedule publish datepicker, "Save Draft" ghost + "Publish" primary buttons.
  Pricing panel: Base Price, Compare Price (strikethrough), Cost per item (private).
  Inventory panel: Track inventory toggle, SKU (auto-gen), Barcode.
Show unsaved changes indicator in the header ("Unsaved changes ●").

SCREEN 14 — Product Edit
Identical layout to Product Create but pre-filled. Add:
  - "Last saved" timestamp in header
  - Unsaved changes guard (shows modal on navigate-away attempt)
  - Change history link ("View 12 changes") in the right sidebar
  - Danger zone at bottom of left column: Archive Product (with red outline button and consequence note)

SCREEN 15 — Product Detail Overview
Page title: [Product Name]. Tabs: Overview | Analytics | Variants | Media | Pricing | Inventory.
Overview tab active.
2-column layout:
Left (65%):
  Summary section: thumbnail, name, SKU, status badge, category, brand, description snippet.
  Variants Snapshot: mini-table (variant name, SKU, price, stock, status) with "+ Add Variant" link.
  Reviews Snapshot: star rating summary (avg ★ 4.2, 48 reviews), 3 recent review rows with moderation status.
Right (35%):
  Pricing Summary card: base price, compare price, cost, margin %.
  Inventory Summary card: total stock, reserved, available, low-stock threshold.
  Quick Actions: Edit Product, View Analytics, Manage Media, Archive (destructive).
  Recent Activity feed: last 5 changes (actor, action, timestamp).

Style rules:
- Tabs: underline style, #4f7ef8 active, #6b7280 inactive
- Product thumbnails: 40px squares with 4px radius, object-fit cover
- Monospace for all SKUs and IDs
```

---

## ═══════════════════════════════════════
## BATCH 4 of 19 — Catalog Deep Pages (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 16 — Product Analytics Detail
Page title: [Product Name] → Analytics tab active.
Date range picker top-right.
Row 1: 4 KPI cards — Revenue (this period), Units Sold, Return Rate %, Refund Rate %.
Row 2: Full-width Sales Trend line chart (revenue + units sold dual axis).
Row 3: 3 panels side by side — Stockout Events timeline (list of dates product went out of stock, duration) | Review Distribution bar chart (5-star breakdown) | Revenue Contribution donut (this product vs rest of catalog).

SCREEN 17 — Product Variants Management
Page title: [Product Name] → Variants tab active.
Variants table: Name, SKU (mono), Options (e.g. Size: L, Color: Blue), Price, Compare Price, Stock, Status, Actions.
"+ Add Variant" button top-right of table.
Inline edit row state: clicking Edit on a row opens an inline expanded row form (not a modal) with fields for price, stock, SKU, status.
Bulk actions bar: Update Price, Update Status, Delete Selected.

SCREEN 18 — Product Media Management
Page title: [Product Name] → Media tab active.
Gallery grid (4 columns): each media item shows image thumbnail, drag handle, "Primary" badge on first image, hover overlay with Delete icon and "Set as Primary" button.
Upload zone: dashed border, cloud icon, "Drag & drop or click to upload", accepts JPG/PNG/WebP, max 5MB.
Right panel: Variant Media Mapping — assign specific images to specific variants via dropdown per variant row.

SCREEN 19 — Product Pricing & Merchandising
Page title: [Product Name] → Pricing tab active.
Split form layout:
Left: Current Pricing section (Base Price field, Compare Price field, Cost per item field, Margin display calculated readonly), Price History table (date, old price, new price, changed by, reason).
Right: Merchandising section (Visibility toggle, Featured Product toggle, Homepage Highlight toggle, Search Rank Boost numeric input), Schedule Price Change section (date picker, new price, note field, "Schedule" button).
Warning banner if Compare Price < Base Price.
Confirmation dialog appears on price save: shows current price, new price, and asks for optional reason.

SCREEN 20 — Product Inventory Summary
Page title: [Product Name] → Inventory tab active.
Top: 3 KPI cards — Total Stock, Reserved (in orders), Available.
By Variant table: Variant, SKU (mono), Warehouse, On Hand, Reserved, Available, Reorder Level, Status badge.
Movement History section below: recent stock movements for this product (movement type, qty change, actor, warehouse, timestamp). "View all movements" link.
Low stock alert banner if any variant is below reorder level.
```

---

## ═══════════════════════════════════════
## BATCH 5 of 19 — Catalog + Inventory Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 21 — Category Management
Page title: "Categories". Two views: List view (default) and Tree view (toggle top-right).
List view: table with Name, Slug, Parent Category, Products Count, Status, Actions (Edit, Archive).
Tree view: indented hierarchy with expand/collapse arrows, drag-to-reorder handles.
Right-side drawer for Create/Edit: Category Name, Parent dropdown, Description, SEO slug, Status. Save button.
Archive confirmation dialog: shows count of products in this category, asks for confirmation.

SCREEN 22 — Brand Management
Page title: "Brands". Table: Logo (40px round), Brand Name, Slug, Products Count, Status, Actions.
"+ Add Brand" opens right-side drawer: Brand Name, Logo upload, Description, Website URL, Status toggle.
Archive confirmation shows product count impact.

SCREEN 23 — Reviews Moderation
Page title: "Reviews". Filter bar: search by product/reviewer, Status (All/Pending/Published/Hidden/Rejected), star rating filter, date range.
Table: ☐ | Product thumbnail + name | Reviewer name | Star rating (★★★★☆) | Review excerpt (truncated 80 chars) | Date | Status badge | Actions (Publish, Hide, Reject).
Clicking a row opens a right-side drawer: full review text, reviewer info, order linkage (if verified purchase), moderation history, action buttons.
Bulk actions: Publish Selected, Reject Selected.

SCREEN 24 — Inventory Overview
Page title: "Inventory". Sidebar: Inventory → Overview active.
Row 1: 4 KPI cards — Total SKUs, In Stock, Low Stock (amber), Out of Stock (red).
Filter bar: search by product/SKU, Warehouse dropdown, Status (All/In Stock/Low Stock/Out of Stock).
Master table: Product | Variant | SKU (mono) | Warehouse | On Hand | Reserved | Available | Reorder Level | Status badge | Actions.
Rows with low stock: amber left border. Rows out of stock: red left border.
"Export CSV" button top-right.

SCREEN 25 — Low Stock Queue
Page title: "Low Stock". Queue-style view (operational urgency feel).
Urgency summary banner at top: "23 SKUs below reorder threshold — 8 critical (< 5 units remaining)".
Table: Priority (1-N auto-sorted) | Product | SKU (mono) | Warehouse | On Hand | Reorder Level | Days Since Last Restock | Actions (Adjust Stock, View Product).
Rows sorted by most critical first (closest to 0). Red highlight for <5 units.
Inline "Adjust Stock" opens the adjustment console drawer.
```

---

## ═══════════════════════════════════════
## BATCH 6 of 19 — Inventory Deep (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 26 — Out-of-Stock Queue
Page title: "Out of Stock". Operational urgency.
Top banner: "14 SKUs currently unavailable — products hidden from storefront where auto-hide is enabled."
Table: Product | SKU (mono) | Warehouse | Days Out of Stock | Orders Affected (count of orders in queue missing this item) | Actions (Adjust, View Product, View Orders).
Sort: Days Out of Stock descending.
"Orders Affected" column: if >0, show as red badge link.

SCREEN 27 — Inventory Movement History
Page title: "Movement History". Immutable audit-style log.
Filter bar: Product/SKU search, Warehouse dropdown, Movement Type (Sale / Return / Adjustment / Transfer / Restock / Damage), Actor (admin user), Date range.
Table (dense rows): Timestamp (mono) | Product + Variant | SKU (mono) | Warehouse | Movement Type badge | Qty Change (+/-) | Before Qty | After Qty | Actor | Reference (order # or adjustment ID as mono link).
No edit actions — read-only. "Export" button only.

SCREEN 28 — Inventory Adjustment Console
Page title: "Adjust Stock". Workspace feel — not just a form.
Left panel (60%):
  Step 1 — Select Product: search input with autocomplete, shows selected product + variant card.
  Step 2 — Select Warehouse: warehouse radio buttons with current stock shown per warehouse.
  Step 3 — Adjustment: Current Stock (readonly), Adjustment Type (Add / Remove / Set), Qty input, New Stock preview (calculated, bold).
  Step 4 — Reason: dropdown (Damage / Restock / Error Correction / Audit / Transfer) + optional notes textarea.
  Submit button: "Apply Adjustment" — triggers confirmation dialog.
Right panel (40%): Recent adjustments for selected product (last 10 movements mini-table).
Confirmation dialog: shows product, variant, warehouse, current stock, new stock, reason. Requires typed confirmation for adjustments > 100 units.

SCREEN 29 — Warehouse List
Page title: "Warehouses". Table: Name | Location (city, country) | Total SKUs | In Stock % | Low Stock Count | Status badge | Actions (View, Edit).
"+ Add Warehouse" drawer: Name, Code (auto-gen, editable), Address fields, Contact Name, Contact Email, Status.

SCREEN 30 — Warehouse Detail
Page title: [Warehouse Name]. 2-column layout.
Left (65%): Summary section (address, code, contact, status), Stock Health panel (donut: in-stock vs low vs out-of-stock, with counts), Recent Movements table (last 10 movements: product, type, qty, timestamp).
Right (35%): Operational summary cards (Total SKUs, Total Units, Reserved, Low Stock alerts), Quick links (View Inventory, View Movements, Edit Warehouse), Linked Shipments count.
```

---

## ═══════════════════════════════════════
## BATCH 7 of 19 — Inventory Finish + Orders Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 31 — Warehouse Inventory Detail
Page title: [Warehouse Name] → Inventory. Full inventory table scoped to this warehouse.
Filter: product/SKU search, Status filter.
Table: Product | Variant | SKU (mono) | On Hand | Reserved | Available | Reorder Level | Last Movement | Status badge | Actions (Adjust, View Product).
Export button. Low/out-of-stock rows colored per design system.

SCREEN 32 — Orders List
Page title: "Orders". Central command for all orders.
Filter bar: Order # search, Customer name/email search, Payment Status dropdown, Fulfillment Status dropdown, Order Status dropdown, Date range, Clear.
Table: ☐ | Order # (mono link) | Customer | Items Count | Total | Payment Status badge | Fulfillment Status badge | Order Status badge | Placed At | Actions menu.
Bulk actions: Export, Assign Warehouse, Mark Fulfilled.
Row click navigates to Order Detail.
Top KPI strip (compact, not full cards): Today's orders | Pending Payment | Unfulfilled | Cancelled.

SCREEN 33 — Order Detail
Page title: "Order #[ORD-10042]". The single most important screen in the system.
Header: Order # (mono), placed time, current status badge, breadcrumb.
3-column layout top:
  Col 1: Customer panel (avatar, name, email, phone, account link, "View Customer" button).
  Col 2: Payment panel (amount, method, provider reference, payment status badge, "View Payment" link).
  Col 3: Fulfillment panel (warehouse assigned, shipment #, tracking, fulfillment status badge).
Items table: Product thumbnail | Name + Variant | SKU (mono) | Qty | Unit Price | Total.
Order summary: Subtotal, Discounts, Shipping, Tax, Total.
Notes section: internal notes textarea + save.
Available Actions rail (right side, vertical): Mark Fulfilled, Cancel Order (destructive), Assign Warehouse, Create Shipment, View Timeline. Each with icon.

SCREEN 34 — Order Timeline Detail
Page title: "Order #[ORD-10042] — Timeline". Timeline-first layout.
Left (65%): Full chronological event timeline. Events: Order Placed, Payment Confirmed, Fulfillment Assigned, Picked & Packed, Dispatched, Delivered, Return Initiated, Refund Issued. Each event: timestamp (mono), actor, description, linked entities (payment #, shipment #). Color-coded dots per event type.
Right (35%): Order summary card (compact), linked entities panel (Payment link, Shipment link, Return link if exists, Support tickets linked).

SCREEN 35 — Fulfillment Queue
Page title: "Fulfillment Queue". Orders awaiting picking/processing. Urgency-first.
Summary bar: "47 orders awaiting fulfillment — 12 placed >24h ago (at risk)".
Table: Priority | Order # (mono) | Placed At | Customer | Items | Warehouse Assignment | Status badge | Actions (Assign Warehouse, Start Fulfillment).
At-risk rows (>24h unfulfilled): amber left border.
Unassigned warehouse rows: show "⚠ No warehouse" in amber.
Bulk action: Assign Warehouse to Selected.
```

---

## ═══════════════════════════════════════
## BATCH 8 of 19 — Orders & Fulfillment (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 36 — Packing & Dispatch Queue
Page title: "Dispatch Queue". Orders ready for packing or courier handoff.
Table: Order # (mono) | Customer | Items | Warehouse | Carrier | Status badge (Packing / Ready / Dispatched) | Actions (Mark Packed, Assign Tracking, Dispatch).
Inline tracking input: clicking "Assign Tracking" expands an inline input row — carrier dropdown + tracking # text field + save button.
Batch dispatch action: select multiple → "Dispatch Selected" primary button.

SCREEN 37 — Shipment Detail
Page title: "Shipment #[SHP-00291]". 2-column layout.
Left (65%): Shipment summary (shipment #, created date, status badge), Items table (product, variant, qty), Carrier info (carrier name, service type, tracking #, tracking link external), Order linkage card.
Right (35%): Status timeline (compact: Created → Picked Up → In Transit → Delivered), Operational actions (Update Status, Add Tracking Event, View Tracking Events), Customer notification log (was customer notified? last email timestamp).

SCREEN 38 — Shipment Tracking Events
Page title: "Shipment #[SHP-00291] — Tracking Events".
Full-width timeline of all carrier tracking events: timestamp (mono), event code, location, description, source (carrier API vs manual entry badge).
"+ Add Manual Event" button: opens small form (event description, timestamp, optional location).
Carrier sync indicator: "Last synced 4 minutes ago" with refresh button.

SCREEN 39 — Returns Queue
Page title: "Returns". Filter bar: Status (Requested/Approved/Received/Completed/Rejected), reason, customer search, date range.
Table: Return # (mono) | Order # (mono link) | Customer | Items | Reason | Return Status badge | Refund Status badge | Created | Actions (Review, Approve, Reject).
Bulk action: Approve Selected.
Row click → Return Detail.

SCREEN 40 — Return Detail
Page title: "Return #[RET-00088]". Command page for a single return.
Header: return #, order # link, status badge, created date.
2-column:
Left (65%): Customer panel, Items being returned (table: product, variant, qty, reason per item, condition), Refund linkage (if refund created: refund #, amount, status), Timeline (return events chronological).
Right (35%): Return status action rail — current state machine shown (Requested → Approved → Item Received → Completed), action buttons per state: Approve Return (green), Reject Return (red outline), Mark as Received, Complete Return. Each sensitive action shows confirmation dialog with reason field.
```

---

## ═══════════════════════════════════════
## BATCH 9 of 19 — Orders End + Payments Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 41 — Cancellation Requests Queue
Page title: "Cancellation Requests". Operational queue for customer-initiated cancellation requests.
Summary banner: "8 pending cancellation requests — 3 for orders already in fulfillment."
Table: Request # | Order # (mono link) | Customer | Order Total | Request Reason | Order Status badge | Request Status badge | Requested At | Actions (Approve Cancellation, Reject Request).
Rows where order is already in fulfillment: amber warning badge "In Fulfillment."
Both approve and reject open confirmation dialogs with reason field.

SCREEN 42 — Payments List
Page title: "Payments". Filter bar: search by order # or payment reference, Provider dropdown (Paystack/Stripe/MTN Mobile Money/etc.), Status dropdown (Completed/Pending/Failed/Refunded), Amount range inputs, Date range, Clear.
Table: Payment # (mono) | Order # (mono link) | Customer | Amount | Provider | Method | Status badge | Created | Actions (View, View Order).
Compact KPI strip: Total Processed (period) | Success Rate % | Failed Count | Pending Count.

SCREEN 43 — Payment Detail
Page title: "Payment #[PAY-00521]". 2-column.
Left (65%): Payment summary card (amount, currency, provider, method, reference # mono), Order context (order #, customer, order total), Refunds linked (table: refund #, amount, status), Provider response JSON inspector (collapsible, monospace).
Right (35%): Status timeline (Initiated → Processing → Completed or Failed), Action buttons (View Transactions, View Order, Initiate Refund if eligible), Provider metadata card (provider transaction ID mono, gateway, processing fee).

SCREEN 44 — Payment Transaction Timeline
Page title: "Payment #[PAY-00521] — Transactions". Deep provider audit trail.
Full-width timeline. Each entry: timestamp (mono), event type badge (Initiated / Auth / Capture / Decline / Webhook Received / Callback), amount, provider message, raw response collapsible.
"Raw data" toggle: shows full provider JSON per event in monospace panel.

SCREEN 45 — Refunds Queue
Page title: "Refunds". Filter bar: Status (Pending Approval/Approved/Processing/Completed/Rejected), date range, amount range, customer search.
Urgency summary: "12 refunds pending approval — 4 awaiting >48h."
Table: Refund # (mono) | Order # | Return # | Customer | Amount | Reason | Status badge | Requested | Actions (Review, Approve, Reject).
Rows awaiting >48h: amber left border.
Bulk action: Approve Selected (with mass confirmation dialog).
```

---

## ═══════════════════════════════════════
## BATCH 10 of 19 — Payments End + Customers Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 46 — Refund Detail
Page title: "Refund #[REF-00199]". Command page.
Header: refund #, amount, status badge, linked order + return links.
2-column:
Left (65%): Refund summary (amount, reason, requested by customer or admin, original payment #), Order + payment context cards, Approval history (who approved/rejected, when, reason), Provider refund status (if sent to provider: provider refund ID mono, status, estimated completion).
Right (35%): State machine rail (Requested → Approved → Processing → Completed), Action buttons: Approve Refund (green, confirmation + reason), Reject Refund (red outline, confirmation + reason), Mark Completed (if provider confirmed). All sensitive actions confirm.

SCREEN 47 — Failed Payments Investigation
Page title: "Failed Payments". Investigation workspace.
Row 1: 4 KPI cards — Total Failed (period), Failure Rate %, Recovered (retried successfully), Revenue at Risk.
Row 2: 2 panels — Failure Reasons donut chart (Insufficient Funds / Card Declined / Timeout / Gateway Error / Fraud Block) | Provider Breakdown bar chart (failures by provider).
Row 3: Failed Payments table — Payment # (mono) | Order # | Customer | Amount | Provider | Failure Reason | Failure Time | Retry Count | Actions (View Payment, Contact Customer, Mark Resolved).

SCREEN 48 — Financial Exceptions & Reconciliation
Page title: "Financial Exceptions". Detect mismatches and unresolved issues.
Row 1: 3 KPI cards — Open Exceptions, Total Amount Discrepancy, Resolved This Week.
Filter bar: Type (Duplicate Callback / Partial Capture / Unmatched Refund / Amount Mismatch / Timeout Unresolved), Status, Date.
Exceptions table: Exception # (mono) | Type badge | Order # | Payment # | Expected Amount | Actual Amount | Discrepancy | Status badge | Detected | Actions (Investigate, Resolve, Escalate).
Exception detail drawer (on row click): full context, timeline of related events, resolution notes field, resolve button.

SCREEN 49 — Customers List
Page title: "Customers". Filter bar: Name/email/phone search, Status (Active/Suspended/Pending Verification), date joined range, Total Orders range (min-max), LTV range.
Table: ☐ | Avatar (initials circle) | Name | Email | Phone | Status badge | Total Orders | Lifetime Spend | Last Order | Joined | Actions (View, Suspend).
Row click → Customer Detail.
"Export" button top-right.
Compact KPI strip: Total Customers | Active | New This Month | Suspended.

SCREEN 50 — Customer Detail Overview
Page title: "[Customer Name]". Tabs: Overview | Activity | Orders | Support | Reviews | Risk | Actions.
Overview tab active.
Header: large avatar (initials), name, email, phone, status badge, "Joined [date]", role (Customer), quick action buttons (Send Email, View Orders, Suspend — destructive red).
2-column layout:
Left (65%): Contact & profile info card, Communication preferences card (email opt-in, SMS opt-in, notification settings — readonly), Top Metrics: total orders, LTV, avg order value, last order date, refund count, return count.
Right (35%): Account Status card (status badge, suspension reason if suspended, last login, last order date), Quick links to other tabs, Internal Notes card (last 3 notes, "+ Add Note" button).
```

---

## ═══════════════════════════════════════
## BATCH 11 of 19 — Customer Deep Pages (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 51 — Customer Activity Timeline
Page title: "[Customer Name] → Activity tab".
Full-width unified timeline. Event categories with different dot colors:
  - 🔵 Login events (device, IP, location)
  - 🟢 Orders (placed, fulfilled, delivered)
  - 🟡 Support (ticket opened, resolved)
  - 🔴 Alerts / risk events (flagged transaction, failed login burst)
  - ⚪ Reviews (submitted, moderated)
  - 🟠 Refunds / returns (requested, completed)
Filter chips above timeline: All | Logins | Orders | Support | Risk | Reviews.
Date range picker. Each event links to its source entity (order #, ticket #, etc.).

SCREEN 52 — Customer Orders History
Page title: "[Customer Name] → Orders tab".
Orders table scoped to this customer: Order # (mono link) | Date | Items | Total | Payment Status badge | Fulfillment Status badge | Order Status badge | Actions (View Order).
Summary cards above table: Total Orders, Total Spend, Avg Order Value, Return Rate %.
No filters needed (already scoped to one customer). Sort by date default.

SCREEN 53 — Customer Support History
Page title: "[Customer Name] → Support tab".
Support tickets table: Ticket # (mono link) | Subject | Category | Priority badge | Status badge | Assigned To | Created | Resolved At | Actions (View Ticket).
Summary: Total tickets, Open tickets, Avg resolution time, CSAT score if available.

SCREEN 54 — Customer Reviews History
Page title: "[Customer Name] → Reviews tab".
Reviews table: Product (thumbnail + name) | Rating (★★★☆☆) | Review excerpt | Status badge | Date | Actions (View Review, Moderate).
Pattern detection note if suspicious: "⚠ This customer has submitted 8 reviews in 3 days across unrelated products."

SCREEN 55 — Customer Risk & Security Profile
Page title: "[Customer Name] → Risk tab". Investigation-focused layout.
Row 1: Risk Score gauge (0-100, colored green/amber/red), Fraud Signals count, Open Alerts, Suspended: Yes/No.
Row 2: 3 panels — Suspicious Login Patterns (logins from multiple countries in <24h, unusual hours — table with IP, location, device, time) | Alerts & Flags (list of active alerts linked to this customer) | Refund Abuse Signals (refund rate %, total refunds, refund ratio vs platform average, note if anomalous).
Row 3: Risk Events log table (event type, description, timestamp, severity badge).
```

---

## ═══════════════════════════════════════
## BATCH 12 of 19 — Customer Actions + Support Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 56 — Customer Account Action Center
Page title: "[Customer Name] → Actions tab". Controlled mutation workspace — not a list of forms.
Layout: centered max-width 720px.
Each action is a card with: icon, title, description, consequence note, action button.
Actions:
  1. Suspend Account — red card — "Immediately prevents login and purchases. All active sessions revoked." → red "Suspend" button → confirmation dialog with reason field (required).
  2. Reactivate Account — green card — shows only if suspended — "Restores full account access." → confirmation dialog.
  3. Open Support Ticket — blue card — "Create a ticket linked to this customer." → opens ticket creation drawer.
  4. Escalate for Review — amber card — "Flag this customer account for risk team review." → confirmation + reason.
  5. Add Internal Note — neutral card — simple textarea + save (no confirmation needed).
All sensitive actions (1, 2, 4) require reason field and confirmation. All create audit log entries.

SCREEN 57 — Support Tickets List
Page title: "Support Tickets". Filter bar: Ticket # search, Subject keyword, Status (All/New/Open/Pending/On Hold/Resolved/Closed), Priority (All/Low/Medium/High/Urgent), Category, Assigned To, Date range.
Table: ☐ | Ticket # (mono) | Subject | Customer | Category | Priority badge | Status badge | Assigned To | Created | SLA Due | Actions (View, Assign, Close).
SLA Due column: green if OK, amber if <2h remaining, red if breached.
Bulk actions: Assign Selected, Close Selected.
Compact KPI strip: Open | Urgent | SLA Breaching | Resolved Today.

SCREEN 58 — Support Ticket Detail
Page title: "Ticket #[TKT-03841] — [Subject]". Full workspace.
3-panel layout:
Left (60%): Thread panel — message bubbles (customer messages right-aligned blue, agent replies left-aligned gray). Attachments shown inline. Reply composer at bottom (rich textarea, attachment button, Send button, Internal Note toggle).
Middle rail (hidden on smaller screens, shown as panel labels): entity links (linked Order #, linked Customer link, linked Return # if any).
Right (40%): Ticket metadata panel — Status badge + change button, Priority badge + change, Category, Assigned To (dropdown to reassign), Created, Last Updated. SLA countdown timer. Customer mini-card. Action buttons: Resolve Ticket, Close Ticket (with confirmation).
Internal Notes toggle: switches thread view to show internal-only notes (amber background, "Internal" badge).

SCREEN 59 — Support Queue by SLA / Priority
Page title: "Support Queue". Prioritized operational view.
Top: Urgency legend — Breached SLA (red) | <1h remaining (amber) | On track (green).
Table: Priority (auto-sorted) | Ticket # (mono) | Subject | Customer | Priority badge | Status badge | Assigned To | SLA Remaining (countdown, color-coded) | Actions (Assign, View, Escalate).
Sort: Breached first, then by SLA remaining ascending.
Unassigned tickets: "⚠ Unassigned" badge in Assigned To column.

SCREEN 60 — Pre-Purchase Inquiries Queue
Page title: "Pre-Purchase Inquiries". Buying questions before checkout.
Filter: Status, date, assigned.
Table: Ticket # (mono) | Customer / Guest | Question subject | Product linked (if any) | Status badge | Created | Actions.
Note: some rows may be from guest users (no account), shown as "Guest — [email]".
```

---

## ═══════════════════════════════════════
## BATCH 13 of 19 — Support End + Content Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 61 — Returns & Complaints Support Queue
Page title: "Complaints Queue". Support-team queue for post-purchase issues.
Filter: Category (Damaged Item / Late Delivery / Wrong Item / Refund Issue / Other), Status, Priority, date.
Table: Ticket # (mono) | Customer | Category badge | Order # link | Priority badge | Status badge | Created | Actions (View, Escalate).
Category badges use distinct colors per type.
At-risk rows: any complaint open >72h without response gets red left border.

SCREEN 62 — Support Analytics & SLA Reporting
Page title: "Support Analytics". Performance metrics for support leadership.
Row 1: 4 KPI cards — Avg First Response Time, Avg Resolution Time, CSAT Score, Resolution Rate %.
Row 2: Ticket Volume trend (bar chart, last 30 days, stacked by priority).
Row 3: 2 panels — Backlog by Status (horizontal stacked bar: New / Open / Pending / On Hold) | SLA Performance (% on-time by priority level: Urgent / High / Medium / Low — colored bar per level).
Row 4: Agent Performance table (agent name, assigned tickets, resolved, avg resolution time, CSAT — read-only).

SCREEN 63 — Banners Management
Page title: "Banners". Manage storefront promotional banners.
Filter: Status (Active/Scheduled/Expired/Draft), Position (Homepage Hero / Category Banner / etc.).
Grid view (3 columns): each banner shown as a card with thumbnail preview, title, position badge, Status badge, start/end dates, Actions (Edit, Publish/Unpublish, Delete).
"+ Create Banner" button opens right-side drawer: Title, Image upload, Link URL, Position dropdown, Start date, End date, Status. Save + Publish buttons.
Publish/Unpublish requires confirmation.

SCREEN 64 — CMS Pages Management
Page title: "CMS Pages". Static informational content (About, FAQ, Shipping Policy, etc.).
Table: Title | Slug (mono) | Last Updated | Status badge | Actions (Edit, Publish, View on site ↗).
"+ Create Page" button opens drawer: Title, Slug (auto-generated), Content (rich text area), SEO meta title/description, Status.
Publish requires confirmation.

SCREEN 65 — Coupon Management
Page title: "Coupons". Filter: Status (Active/Disabled/Expired), Type (Percentage/Fixed Amount/Free Shipping), date range, usage range.
Table: Code (mono, copy button) | Type badge | Discount | Min Order | Usage Count / Limit | Status badge | Expires | Actions (Edit, Disable, View Analytics).
"+ Create Coupon" button: Code (auto-gen toggle), Type dropdown, Value, Min Order Amount, Usage Limit, Per-Customer Limit, Expiry date, Status.
Disable action: confirmation dialog ("This will immediately stop all redemptions").
```

---

## ═══════════════════════════════════════
## BATCH 14 of 19 — Marketing + Reports Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 66 — Coupon Redemption Analytics
Page title: "Coupon Analytics". Filter: Coupon Code select, date range.
Row 1: 4 KPI cards — Total Redemptions, Total Discount Given, Revenue Attributed, Avg Order Value with Coupon.
Row 2: Redemption trend line chart (daily redemptions over period).
Row 3: 2 panels — Top Coupons by Redemption table (code mono, type, redemptions, discount total, revenue) | Potential Abuse Signals table (customer who redeemed same coupon multiple times, unusually high redemption frequency).

SCREEN 67 — Promotions Management
Page title: "Promotions". Filter: Status (Active/Scheduled/Ended/Draft), Type.
Table: Name | Type badge | Discount | Start | End | Status badge | Actions (View, Edit, Rules, Deactivate).
"+ Create Promotion" button: Name, Type (Product / Order / Shipping / BOGO), Description, Start date, End date, Status.
Row click → Promotion detail (or navigate to rules).

SCREEN 68 — Promotion Rules Detail
Page title: "[Promotion Name] — Rules". Rule-level configuration workspace.
Left (60%): Active Rules list — each rule is a card showing: Rule type badge (Product Filter / Customer Segment / Spend Threshold / Time Window), summary of conditions in plain English ("Customer must have placed at least 3 orders"), Edit and Delete per rule.
"+ Add Rule" opens inline form for new rule type selection + condition inputs.
Right (40%): Promotion summary card, Status badge, Start/end dates, Simulation panel ("Test this promotion against a sample order" — enter order amount + customer segment → shows if promotion would apply and why).

SCREEN 69 — Campaign Performance Overview
Page title: "Campaign Performance". Cross-channel performance view.
Row 1: 4 KPI cards — Total Campaign Revenue, Active Campaigns, Avg Conversion Rate %, Cost (if tracked).
Row 2: Performance by Channel bar chart (Banners / Coupons / Promotions / Email — revenue attributed per channel).
Row 3: Campaigns table — Campaign Name | Type badge | Status badge | Start | End | Impressions (if tracked) | Conversions | Revenue | Actions (View Details).

SCREEN 70 — Reports Overview
Page title: "Reports". Central reporting hub.
Layout: hub-and-spoke card grid.
8 report category cards (2 rows × 4): Sales | Products | Inventory | Customers | Support | Refunds & Returns | Marketing | (Custom — coming soon, grayed out).
Each card: icon, title, brief description, "Open Report →" link.
Date range picker at top applies globally.
Recently Viewed reports section below the grid (last 3 opened).
```

---

## ═══════════════════════════════════════
## BATCH 15 of 19 — Reports Full Suite (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 71 — Sales Analytics Report
Page title: "Sales Report". Date range picker + comparison period toggle.
Row 1: 5 KPI cards — Gross Revenue, Net Revenue, Orders, AOV, Discount Impact %.
Row 2: Revenue trend (area chart, gross vs net, dual series).
Row 3: 2 panels — Revenue by Category table (category, revenue, % of total, orders, AOV) | Payment Method breakdown donut.
Row 4: Top 10 Products by Revenue table.
Export: CSV and PDF buttons top-right.

SCREEN 72 — Product Performance Analytics
Page title: "Product Performance Report". Date range.
Row 1: 4 KPI cards — Total Products Sold (units), Revenue, Avg Return Rate %, Avg Refund Rate %.
Row 2: Top Products table (rank, product thumbnail, name, units sold, revenue, return rate, refund rate, stockout days).
Row 3: 2 panels — Category performance bar chart (revenue per category) | Products with highest return rate table (concern list for merchandising review).

SCREEN 73 — Inventory Analytics Report
Page title: "Inventory Report". Date range.
Row 1: 4 KPI cards — Total SKUs, Avg In-Stock Rate %, Low-Stock Events (period), Revenue Lost to Stockouts (estimated).
Row 2: Stock level trend (line chart: in-stock % over time).
Row 3: 2 panels — Movement patterns chart (movement type breakdown: sales / returns / adjustments / restocks) | Most Adjusted SKUs table (manual adjustments may indicate data issues).

SCREEN 74 — Customer Analytics Report
Page title: "Customer Report". Date range.
Row 1: 4 KPI cards — New Customers, Returning Customers, Churn Estimate %, Avg LTV.
Row 2: Customer growth trend line chart (new vs returning per period).
Row 3: 3 panels — Cohort repeat purchase table (simplified: month joined, % ordered again in 30/60/90d) | LTV distribution bar chart | Geographic distribution if data exists.

SCREEN 75 — Support Analytics Report
Page title: "Support Report". Date range.
Row 1: 4 KPI cards — Total Tickets, Resolved, Avg Resolution Time, CSAT %.
Row 2: Ticket volume bar chart (stacked by priority).
Row 3: 2 panels — Category breakdown donut (ticket types) | SLA performance table (by priority: Urgent / High / Medium / Low — % on-time, avg time, breach count).
```

---

## ═══════════════════════════════════════
## BATCH 16 of 19 — Reports End + Security Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 76 — Refunds & Returns Analytics
Page title: "Refunds & Returns Report". Date range.
Row 1: 4 KPI cards — Total Refunds Issued, Total Refund Amount, Return Rate %, Avg Refund Processing Time.
Row 2: Refunds trend line chart (by day/week).
Row 3: 2 panels — Return Reasons breakdown bar chart (Damaged / Wrong Item / Changed Mind / Late / Quality Issue) | Products with Highest Return Rates table.

SCREEN 77 — Marketing & Coupon Analytics
Page title: "Marketing Report". Date range.
Row 1: 4 KPI cards — Total Discount Given, Revenue Attributed to Promotions, Coupon Redemptions, Active Campaigns.
Row 2: Channel attribution bar chart (Banners / Coupons / Promotions / Organic).
Row 3: Top Performing Coupons table | Campaign ROI table (campaign, cost if tracked, revenue, ROI %).

SCREEN 78 — Audit Logs Explorer
Page title: "Audit Logs". Immutable system-wide activity log. Security & Audit section active in sidebar.
Filter bar: Actor (user search), Action Type, Entity Type, Entity ID (mono search), Date range, IP address.
Table (dense, monospace-heavy): Timestamp (mono) | Actor | Role badge | Action | Entity Type | Entity ID (mono) | IP Address | Result (Success/Fail badge) | Details icon.
Click Details: right-side drawer showing full log entry — before/after JSON diff in monospace, request headers, user-agent.
No edit or delete actions. Export only.

SCREEN 79 — Admin Action Logs Explorer
Page title: "Admin Action Logs". Sensitive admin-only mutations with before/after context. Subset of audit logs.
Filter: Actor, Action (Price Change / Account Suspend / Stock Adjust / Refund Approve / etc.), Date range.
Table: Timestamp (mono) | Admin Actor | Action badge | Entity | Before Value (truncated mono) | After Value (truncated mono) | Reason (truncated) | Details.
Diff drawer: full before/after JSON diff with colored lines (red for removed, green for added).

SCREEN 80 — User Activity Explorer
Page title: "User Activity". System-wide user activity search.
Filter: Customer email/ID, Date range, Activity Type (Login / Order / Review / Support / Refund).
Table: Timestamp (mono) | User | Activity Type badge | Description | Entity linked | IP Address | Device.
Used for investigations. No mutations — read-only.
```

---

## ═══════════════════════════════════════
## BATCH 17 of 19 — Security Core (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 81 — Alerts Center
Page title: "Alerts". Operational and security alerts command center.
Filter: Type, Severity (Critical/High/Medium/Low), Status (Open/Acknowledged/Resolved), Assigned To, Date.
Severity summary strip at top: Critical [n] | High [n] | Medium [n] | Low [n].
Table: ☐ | Alert ID (mono) | Title | Type badge | Severity badge | Status badge | Assigned To | Triggered | Age | Actions (Acknowledge, Assign, Resolve).
Critical rows: red left border. High: amber left border.
Bulk actions: Acknowledge Selected, Assign Selected.
Resolve requires confirmation + reason.

SCREEN 82 — Alert Detail
Page title: "Alert #[ALT-00441] — [Title]". Full investigation workspace.
Header: alert title, severity badge, status badge, triggered time.
2-column:
Left (65%): Alert description and context, Source details (what triggered: threshold, rule name, detection logic summary), Linked Entities (order #, customer #, payment # — each a clickable chip), Event timeline (alert created, acknowledged by, assigned to, notes added, escalated, resolved — chronological).
Right (35%): Ownership panel (current assignee, reassign dropdown, escalate button), Status action rail (Acknowledge, Assign, Resolve — each confirmation-gated), Internal Notes section (add note textarea + history).

SCREEN 83 — Security Events Explorer
Page title: "Security Events". Suspicious or security-relevant events log.
Filter: Event Type (Failed Login Burst / Account Takeover Signal / Payment Fraud Signal / Unusual Activity / IP Blocklist Hit), Severity, Status, Customer, Date range.
Table: Timestamp (mono) | Event Type badge | Severity badge | Description | Customer (if linked) | IP Address | Status badge | Actions (View, Create Alert, Mark Reviewed).
"Create Alert" on a row: creates a linked alert from this security event, opens confirmation drawer.

SCREEN 84 — Security Event Detail
Page title: "Security Event #[SEC-00188]". Investigation page.
2-column:
Left (65%): Event summary (type, description, detection source), Context entities (customer card if linked, payment card if linked, order card if linked), Raw event payload (monospace JSON inspector, collapsible), IP intelligence panel (IP, country, ISP, known bad-actor flag if available), Related events list (other events from same IP or same customer in last 7 days).
Right (35%): Status action rail (Mark Reviewed, Create Alert, Escalate), Linked Alert card if one was created, Investigation notes textarea.

SCREEN 85 — Incidents List
Page title: "Incidents". Active and historical incident backlog.
Filter: Status (Open/In Progress/Resolved/Closed), Severity, Owner, date range.
Summary: Open [n] | In Progress [n] | Resolved This Week [n].
Table: Incident # (mono) | Title | Severity badge | Status badge | Owner | Created | Last Updated | Actions (View, Assign, Close).
Open incidents sorted by severity descending.
"+ Create Incident" button: Title, Severity dropdown, Description textarea, Owner assignment.
```

---

## ═══════════════════════════════════════
## BATCH 18 of 19 — Security End + System Start (5 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 86 — Incident Detail & Investigation Workspace
Page title: "Incident #[INC-00023] — [Title]". Full incident management workspace.
Header: incident title, severity badge, status badge, created/updated.
3-section layout:
Section 1 — Summary & Linked Entities: description, affected systems, linked alerts (list), linked security events (list), linked customers/orders if relevant. Each linked entity is a chip linking to its detail page.
Section 2 — Investigation Notes: chronological notes thread (actor, timestamp, note text), add note textarea at bottom.
Section 3 — Timeline: incident lifecycle events (Created, Acknowledged, Updated, Escalated, Resolved, Closed) with actor and timestamp.
Right panel (35%): Ownership (assignee, reassign), Status action rail (Update Status, Close Incident — both require reason field + confirmation), Severity change (with confirmation).

SCREEN 87 — Risk Signals & Fraud Review
Page title: "Risk Signals". Review scored risk signals and suspicious patterns.
Row 1: 3 KPI cards — High-Risk Signals Active, Flagged Transactions (period), Accounts Under Review.
Filter: Risk Category (Payment Fraud / Account Fraud / Refund Abuse / Bot Activity), Score range (0-100), Status (New/Under Review/Dismissed/Escalated).
Risk Signals table: Signal # (mono) | Category badge | Risk Score gauge (colored 0-100) | Description | Entity linked | Detected | Status badge | Actions (Review, Escalate, Dismiss).
Signals sorted by risk score descending.
Review action: opens detail drawer with entity context + pattern analysis + action buttons.

SCREEN 88 — Settings Overview
Page title: "Settings". Central settings hub. System section in sidebar.
Layout: settings category card grid (2 rows × 3).
6 setting categories: General Commerce → Checkout & Commerce | Reviews & Moderation | Support & SLA | Notifications (coming soon, disabled) | Integrations (link to integration health) | Roles & Permissions (coming soon, disabled).
Each card: icon, title, description, "Configure →" link.
Recent changes log at bottom: last 5 settings changes (who changed, what section, when).

SCREEN 89 — Checkout & Commerce Settings
Page title: "Checkout & Commerce Settings". Dense settings form.
Left (65%) Form Sections:
  Guest Checkout: enabled/disabled toggle, explanation.
  Order Minimum: min order value numeric input.
  Payment Methods: multi-select checklist of enabled providers.
  Cancellation Window: hours after order placement that customer can self-cancel (numeric).
  Auto-Hide Out-of-Stock Products: toggle.
  Tax Settings: tax rate %, inclusive/exclusive toggle.
Right (35%): Settings change log for this section (who changed, field, old value, new value, timestamp).
"Save Changes" button: triggers confirmation dialog listing all changed fields with old → new values.

SCREEN 90 — Review & Moderation Settings
Page title: "Review & Moderation Settings".
Form: Auto-publish reviews toggle (if off, all go to moderation queue), Min order requirement to review toggle, Profanity filter toggle, Min review length (chars) numeric, Review image uploads allowed toggle, Verified purchase badge toggle.
Change log panel right.
Save with confirmation.
```

---

## ═══════════════════════════════════════
## BATCH 19 of 19 — System Final (4 screens)
## ═══════════════════════════════════════

```
Design system: [paste DESIGN.md]

SCREEN 91 — Support & SLA Settings
Page title: "Support & SLA Settings".
Form sections: Ticket Categories (list with add/remove/edit inline), Priority Levels (with SLA hours per level — Urgent: 2h, High: 8h, Medium: 24h, Low: 72h — editable numeric fields), Auto-assignment toggle, Attachment settings (max size, allowed types), Auto-close resolved tickets after N days.
Right: change log.
Save with confirmation + reason field.

SCREEN 92 — Webhooks Monitoring
Page title: "Webhooks". Inspect inbound provider webhook events.
Filter: Provider (Paystack/Stripe/MTN/Shipping provider), Event Type, Status (Received/Processing/Processed/Failed/Retrying), Date range.
Table: Webhook ID (mono) | Provider badge | Event Type | Status badge | Received (mono timestamp) | Processing Time (ms) | Retry Count | Actions (View Payload, Retry).
Failed/Retrying rows: red/amber left border.
Payload drawer: raw JSON in monospace, response status code, error message if failed.
"Retry" button: confirmation required ("This will re-trigger the webhook processing handler for this event.").
Summary strip: Received (24h) | Processed | Failed | Retry Queue.

SCREEN 93 — Jobs & Background Processing Monitor
Page title: "Background Jobs". Async job health monitor.
Summary strip: Successful (24h) | Failed (24h) | Running Now | Scheduled Next Hour.
Filter: Job Name, Status (Completed/Failed/Running/Scheduled/Retrying), Date.
Jobs table: Job ID (mono) | Job Name | Status badge | Started (mono) | Duration | Queue | Retry # | Actions (View Logs, Retry).
Failed jobs: red left border. Long-running (>expected): amber.
Job detail drawer: full logs in monospace scrollable panel, error stack trace if failed, input payload collapsible.
"Retry" button: confirmation required.

SCREEN 94 — API / Integration Health & Exception Monitor
Page title: "Integration Health". External service health and failures.
Row 1: Integration Health Grid — each integration as a status card (6 cards, 3×2 grid): Service name, Status dot (green/amber/red), Last successful ping timestamp, Avg latency ms, Error rate %. Cards with errors have red border.
Row 2: Full-width Latency Trend chart (line per integration, last 24h).
Row 3: Integration Exceptions table — Exception # (mono) | Service | Error Type | Message | Count (24h) | First Seen | Last Seen | Status badge | Actions (Acknowledge, View Details).
Detail drawer: full error stack trace in monospace, request/response in JSON inspector.
```

---

## ══════════════════════════════════════
## UNIVERSAL TIPS FOR ALL BATCHES
## ══════════════════════════════════════

### Before every batch:
1. Import DESIGN.md → paste into Stitch canvas context
2. State this at the top of every prompt: "Apply the imported design system. Dark sidebar #13161e, white header, #f0f2f7 content background. DM Sans headings, IBM Plex Sans body, JetBrains Mono for IDs/codes."

### After every batch:
1. Export Figma frames for design review
2. Export React/HTML code as starting components
3. Use "Generate next screen" for detail → timeline → analytics flows
4. Voice-tweak for density ("make table rows 48px tall, more compact")

### Experimental mode (Gemini Pro) for:
- All 6 dashboards
- Order Detail (#33)
- Customer Detail (#50)
- Incident Workspace (#86)
- Audit Logs (#78)

### Standard mode (Gemini Flash) for:
- Queue screens (more straightforward)
- Settings screens
- Simple list screens
