# E-Commerce Customer Page-by-Page UI Specification (50 Screens)

## Executive overview
This document defines the page-by-page UI structure for the customer-facing side of the single-store e-commerce system. It expands the storefront architecture into an implementation-ready screen inventory covering discovery, evaluation, checkout, account management, reviews, support, returns, refunds, and trust content.

This specification is sized for a **50-screen customer experience** and is intended to reduce ambiguity for frontend engineers, designers, and AI coding agents.

## Planning position
- Customer frontend target: **50 screens**
- Design intent: conversion-focused storefront with first-class post-purchase service
- Product context: single-store now, future multi-store ready
- Target outputs: route map, screen purpose, major sections, actions, and implementation order

## Screen inventory

### A. Storefront and discovery (12)
1. Home  
2. Shop / all products  
3. Category page  
4. Subcategory page  
5. Brand page  
6. Search results  
7. Product detail  
8. Product media gallery view  
9. Product reviews full page  
10. Product Q&A / pre-purchase inquiry page  
11. Campaign / landing page  
12. Wishlist  

### B. Cart and checkout (8)
13. Cart  
14. Checkout shell  
15. Checkout shipping step  
16. Checkout payment step  
17. Checkout review step  
18. Checkout success  
19. Guest order tracking  
20. Saved cart / recently viewed screen  

### C. Auth and identity (6)
21. Login  
22. Register  
23. Forgot password  
24. Reset password  
25. Verify email  
26. Session expired / recovery page  

### D. Customer account hub (12)
27. Account dashboard  
28. Profile  
29. Addresses  
30. Orders list  
31. Order detail  
32. Shipment tracking detail  
33. Returns list  
34. Return request wizard  
35. Refunds list  
36. Reviews center  
37. Security and sessions  
38. Preferences and communication settings  

### E. Support and service (6)
39. Support center  
40. Create support ticket  
41. Support tickets list  
42. Support ticket detail  
43. Complaints / issue reporting page  
44. Help / FAQ center  

### F. Content and trust (6)
45. Contact page  
46. About page  
47. Shipping policy  
48. Returns policy  
49. Privacy policy  
50. Terms and conditions  

## Core route map
- `/`
- `/shop`
- `/categories/:categorySlug`
- `/categories/:categorySlug/:subcategorySlug`
- `/brands/:brandSlug`
- `/search`
- `/products/:productSlug`
- `/products/:productSlug/media`
- `/products/:productSlug/reviews`
- `/products/:productSlug/questions`
- `/campaigns/:slug`
- `/wishlist`
- `/cart`
- `/checkout`
- `/checkout/shipping`
- `/checkout/payment`
- `/checkout/review`
- `/checkout/success`
- `/track-order`
- `/saved-items`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/session-expired`
- `/account`
- `/account/profile`
- `/account/addresses`
- `/account/orders`
- `/account/orders/:orderId`
- `/account/orders/:orderId/tracking`
- `/account/returns`
- `/account/orders/:orderId/return`
- `/account/refunds`
- `/account/reviews`
- `/account/security`
- `/account/preferences`
- `/support`
- `/support/new`
- `/account/support`
- `/account/support/:ticketId`
- `/support/issues`
- `/help`
- `/contact`
- `/about`
- `/pages/shipping-policy`
- `/pages/returns-policy`
- `/pages/privacy-policy`
- `/pages/terms`

## Key screen definitions
### Home
**Purpose:** main discovery and merchandising page.  
**Sections:** hero, featured categories, featured products, campaigns, trust blocks, support shortcut.  
**Primary actions:** browse category, open product, start search, explore campaign.

### Shop / all products
**Purpose:** broad catalog browsing surface.  
**Sections:** listing header, filter bar, sort control, product grid, pagination or infinite scroll.  
**Filters:** category, brand, price, rating, availability, variant attributes.

### Product detail
**Purpose:** convert evaluation into purchase.  
**Sections:** media gallery, price, variants, stock, add-to-cart, wishlist, shipping/returns highlights, description, specs, reviews, related products.  
**Important behaviors:** variant changes update price/media/availability; clear unavailable state; mobile sticky add-to-cart.

### Cart
**Purpose:** final review before checkout.  
**Sections:** item list, quantity controls, coupon entry, order summary, stock/price warnings, checkout CTA.

### Checkout
**Purpose:** complete purchase with minimal friction.  
**Shipping step:** contact, address, shipping method.  
**Payment step:** provider flow, billing if needed.  
**Review step:** final order summary and pay CTA.

### Checkout success
**Purpose:** confirm purchase and guide next steps.  
**Sections:** order number, confirmation message, next steps, track-order CTA, guest-to-account prompt where allowed.

### Account dashboard
**Purpose:** customer hub with recent orders, support shortcuts, pending reviews, returns/refunds snapshot, and profile/preferences shortcuts.

### Order detail
**Purpose:** single truth page for a customer order, including payment, shipment, support links, and backend-driven eligibility for cancel/return/review.

### Return request wizard
**Purpose:** guided return flow with item selection, reason capture, comments, and later optional evidence upload.

### Support ticket detail
**Purpose:** conversation screen with message thread, attachments, linked order context, reply form, and status indicator.

### Help / FAQ
**Purpose:** self-service page that reduces support load and escalates into support flows when needed.

### Policy pages
These provide trust, legal clarity, and clear support expectations. They should be CMS-driven where practical.

## Shared UI patterns
- Product card
- Price display
- Rating display
- Badge system
- Review card
- Order summary card
- Shipment tracker
- Support thread
- Trust/policy block
- Empty states
- Loading skeletons

## Eligibility-driven UI
The frontend should only show critical post-purchase actions when backend eligibility allows them. This includes review creation, cancellation, return initiation, refund visibility, guest order tracking, and support ticket linkage to orders.

## Implementation order
1. Storefront shell, home, shop, category, search, product detail, cart  
2. Auth basics, checkout shell and steps, checkout success  
3. Account dashboard, orders, profile, addresses  
4. Reviews, support, guest tracking, returns, refunds  
5. Full review page, product inquiry, campaigns, help, legal pages, security/preferences

## Final position
This 50-screen customer UI spec is designed to match the depth of the 94-screen admin system. It treats discovery, conversion, trust, and post-purchase service as equal parts of the product experience.
