# E-Commerce Admin Expanded Screen Inventory

## Executive overview
This document locks the admin frontend scope for the e-commerce platform at **94 total screens** (72 core + 22 extended). It replaces the earlier lighter admin estimate and reflects the user's requirement for an admin that controls the system *to the teeth*.

The revised admin scope assumes:
- single-store operations now
- future multi-store readiness later
- deep detail pages for major entities
- dedicated queue pages for day-to-day operations
- dedicated analytics pages for executive and module-level performance
- dedicated governance pages for audit, security, alerts, incidents, and system health
- confirmation dialogs, reason capture, and approval patterns across sensitive actions

## Scope position
The correct planning numbers are now:
- **72 core screens** for build planning
- **22 extended screens** if every optional analytics, investigation, and integration view is split into its own route later

For implementation planning, the official number is **94 total screens** (72 core + 22 extended).

## Why the count is higher
A real operations-heavy admin is much larger than a standard CRUD dashboard because major entities need multiple screens:
- a list view
- one or more detail views
- a timeline or activity page
- analytics or performance views
- queue-oriented operational views
- a dedicated action center for sensitive changes where applicable

## Official 94-screen inventory

### A. Admin access and shell (5)
1. Admin login
2. Forgot password
3. Reset password
4. Unauthorized / forbidden
5. Admin profile and session security

### B. Dashboard and oversight (6)
6. Executive dashboard overview
7. Sales performance dashboard
8. Operations control dashboard
9. Customer service dashboard
10. Risk and security dashboard
11. System health dashboard

### C. Catalog and merchandising (12)
12. Product list
13. Product create
14. Product edit
15. Product detail overview
16. Product analytics detail
17. Product variants management
18. Product media management
19. Product pricing and merchandising
20. Product inventory summary
21. Category management
22. Brand management
23. Reviews moderation

### D. Inventory and warehouses (8)
24. Inventory overview
25. Inventory low-stock queue
26. Inventory out-of-stock queue
27. Inventory movement history
28. Inventory adjustment console
29. Warehouse list
30. Warehouse detail
31. Warehouse inventory detail

### E. Orders and fulfillment (10)
32. Orders list
33. Order detail
34. Order timeline detail
35. Fulfillment queue
36. Packing and dispatch queue
37. Shipment detail
38. Shipment tracking events
39. Returns queue
40. Return detail
41. Cancellation requests queue

### F. Payments and financial control (7)
42. Payments list
43. Payment detail
44. Payment transaction timeline
45. Refunds queue
46. Refund detail
47. Failed payments investigation
48. Financial exceptions and reconciliation

### G. Customers and customer intelligence (8)
49. Customers list
50. Customer detail overview
51. Customer activity timeline
52. Customer orders history
53. Customer support history
54. Customer reviews history
55. Customer risk and security profile
56. Customer account action center

### H. Support and service operations (6)
57. Support tickets list
58. Support ticket detail
59. Support queue by SLA / priority
60. Pre-purchase inquiries queue
61. Returns and complaints support queue
62. Support analytics and SLA reporting

### I. Content, marketing, and growth (7)
63. Banners management
64. CMS pages management
65. Coupon management
66. Coupon redemption analytics
67. Promotions management
68. Promotion rules detail
69. Campaign performance overview

### J. Reporting and analytics (8)
70. Reports overview
71. Sales analytics report
72. Product performance analytics
73. Inventory analytics report
74. Customer analytics report
75. Support analytics report
76. Refunds and returns analytics
77. Marketing and coupon analytics

### K. Audit, alerts, security, and incidents (10)
78. Audit logs explorer
79. Admin action logs explorer
80. User activity explorer
81. Alerts center
82. Alert detail
83. Security events explorer
84. Security event detail
85. Incidents list
86. Incident detail and investigation workspace
87. Risk signals and fraud review

### L. System control and observability (7)
88. Settings overview
89. Checkout and commerce settings
90. Review and moderation settings
91. Support and SLA settings
92. Webhooks monitoring
93. Jobs and background processing monitor
94. API / integration health and exception monitor

## Core build target
The screens numbered 1 through 72 form the **core implementation target**. Screens 73 through 94 are still highly valuable, but can be treated as the first wave of post-core split-outs if scheduling requires it.

To meet the user's control requirements, however, the design language and data contracts should already anticipate all 94 views.

## Confirmation-dialog and approval expectations
The screen inventory assumes system-wide confirmation patterns for sensitive actions, such as:
- product publish / unpublish
- product archive
- price change
- manual stock adjustment
- order cancellation
- refund approval
- return approval or rejection
- customer suspension or reactivation
- role / permission change
- sensitive settings change
- alert resolution
- incident closure
- webhook replay or job retry when supported

For sensitive actions, the UI should support:
- affected entity summary
- change preview or impact note
- optional reason field
- confirm and cancel actions
- audit capture on final confirmation

## Recommended implementation planning number
Use **94 total screens** as the official planning number for design, staffing, time estimation, API scope, and frontend architecture.
