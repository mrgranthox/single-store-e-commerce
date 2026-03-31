# E-Commerce Mobile Page-by-Page UI Specification

**Scope:** 48-Screen Customer Mobile App Scope

## Executive Overview

This document defines the mobile page-by-page UI specification for the customer-facing mobile app. It takes the mobile architecture into implementation detail so a frontend engineer or AI coding agent can build the app screen by screen with less guessing.

The mobile app is designed as a conversion-friendly, post-purchase-aware commerce experience covering discovery, evaluation, checkout, account management, tracking, support, reviews, returns, refunds, and trust content.

### Planning Position

- Mobile app scope: **48 screens**
- Web admin scope: **94 screens**
- Web customer scope: **50 screens**
- Combined platform scope: **192 screens**

## Design Principles

1. **Mobile-first conversion.** Product discovery, product detail, cart, and checkout must reduce friction.
2. **Post-purchase support is first-class.** Orders, tracking, support, returns, refunds, and reviews are core areas, not afterthoughts.
3. **Backend-driven eligibility.** The mobile app must not invent rules for reviews, returns, refunds, cancellations, or guest tracking.
4. **Consistent navigation.** Tab navigation should handle core browsing while nested stacks handle detail and post-purchase flows.

## Screen Inventory Summary

### Storefront and discovery screens

1. Home
2. Shop / Catalog
3. Category
4. Subcategory
5. Brand
6. Search
7. Search results
8. Product detail
9. Product media gallery
10. Product reviews
11. Campaign / Collection landing

### Cart and checkout screens

12. Cart
13. Checkout shell
14. Checkout shipping
15. Checkout delivery method
16. Checkout payment
17. Checkout review
18. Checkout success
19. Guest order tracking

### Auth and identity screens

20. Welcome / auth chooser
21. Login
22. Register
23. Forgot password
24. Reset password
25. Verify email / OTP

### Account and post-purchase screens

26. Account dashboard
27. Profile
28. Addresses
29. Orders list
30. Order detail
31. Shipment tracking detail
32. Returns list
33. Return request wizard
34. Refunds list
35. Reviews center
36. Write or edit review
37. Security and sessions
38. Preferences and communication settings

### Support and service screens

39. Support center
40. Create support ticket
41. Support tickets list
42. Support ticket detail / chat
43. Complaints / issue reporting
44. Help / FAQ center

### Content and trust screens

45. Contact
46. About / brand story
47. Shipping and returns policy hub
48. Privacy / Terms / Legal hub

## Storefront and discovery screens

### 1. Home

**Route:** `/(tabs)/home`

**Purpose:** Main discovery and merchandising screen.

**Core sections / behaviors:**

- Hero campaign banners
- Featured categories
- Trending/best-selling products
- Promo shortcuts and trust highlights

### 2. Shop / Catalog

**Route:** `/(tabs)/shop`

**Purpose:** Primary product browsing screen.

**Core sections / behaviors:**

- Filter entry
- Sort controls
- Product grid/list
- Quick add-to-cart support where appropriate

### 3. Category

**Route:** `/categories/:categorySlug`

**Purpose:** Focused browsing inside a category.

**Core sections / behaviors:**

- Category hero/title
- Subcategory shortcuts
- Filtered product listing
- Sticky sort/filter actions

### 4. Subcategory

**Route:** `/categories/:categorySlug/:subcategorySlug`

**Purpose:** High-intent browsing screen for a narrow product segment.

**Core sections / behaviors:**

- Breadcrumb/back navigation
- Product list
- Refinement filters
- Empty-state suggestions

### 5. Brand

**Route:** `/brands/:brandSlug`

**Purpose:** Brand-specific merchandising page.

**Core sections / behaviors:**

- Brand story block
- Brand products
- Brand filters
- Campaign highlights

### 6. Search

**Route:** `/search`

**Purpose:** Search input and recent/popular search surface.

**Core sections / behaviors:**

- Search box
- Recent searches
- Popular terms
- Suggested categories

### 7. Search results

**Route:** `/search/results`

**Purpose:** Keyword-based product discovery results.

**Core sections / behaviors:**

- Query summary
- Result count
- Filters and sorting
- No-results recovery suggestions

### 8. Product detail

**Route:** `/products/:productSlug`

**Purpose:** Primary conversion page for a product.

**Core sections / behaviors:**

- Media carousel
- Price + variant selector
- Stock and shipping cues
- Add to cart / buy now / wishlist
- Clear loading, recoverable error, and empty-state handling where relevant
- Mobile-safe sticky primary action where it improves completion

### 9. Product media gallery

**Route:** `/products/:productSlug/media`

**Purpose:** Immersive full-screen media viewer.

**Core sections / behaviors:**

- Swipe gallery
- Zoom later-ready
- Thumbnail strip
- Back-to-product action

### 10. Product reviews

**Route:** `/products/:productSlug/reviews`

**Purpose:** Dedicated review browsing and rating breakdown page.

**Core sections / behaviors:**

- Rating histogram
- Review filters
- Review list
- Write-review CTA when eligible

### 11. Campaign / Collection landing

**Route:** `/collections/:slug`

**Purpose:** Mobile-friendly promotional landing page.

**Core sections / behaviors:**

- Collection hero
- Offer messaging
- Curated products
- CTA sections

## Cart and checkout screens

### 12. Cart

**Route:** `/cart`

**Purpose:** Review cart before checkout.

**Core sections / behaviors:**

- Cart items
- Quantity controls
- Coupon entry
- Sticky checkout summary
- Clear loading, recoverable error, and empty-state handling where relevant
- Mobile-safe sticky primary action where it improves completion

### 13. Checkout shell

**Route:** `/checkout`

**Purpose:** Wrapper for the mobile checkout flow.

**Core sections / behaviors:**

- Step indicator
- Order summary drawer
- Back navigation
- Policy/trust links

### 14. Checkout shipping

**Route:** `/checkout/shipping`

**Purpose:** Collect contact and shipping information.

**Core sections / behaviors:**

- Contact details
- Address form
- Saved addresses
- Delivery notes
- Clear loading, recoverable error, and empty-state handling where relevant
- Mobile-safe sticky primary action where it improves completion

### 15. Checkout delivery method

**Route:** `/checkout/delivery`

**Purpose:** Select shipping/delivery method.

**Core sections / behaviors:**

- Available methods
- Price and ETA
- Method details
- Proceed CTA

### 16. Checkout payment

**Route:** `/checkout/payment`

**Purpose:** Initiate payment and confirm billing details.

**Core sections / behaviors:**

- Payment method/provider block
- Billing summary
- Error handling
- Continue CTA
- Clear loading, recoverable error, and empty-state handling where relevant
- Mobile-safe sticky primary action where it improves completion

### 17. Checkout review

**Route:** `/checkout/review`

**Purpose:** Final review before purchase.

**Core sections / behaviors:**

- Items summary
- Address summary
- Delivery summary
- Final pay CTA
- Clear loading, recoverable error, and empty-state handling where relevant
- Mobile-safe sticky primary action where it improves completion

### 18. Checkout success

**Route:** `/checkout/success`

**Purpose:** Order confirmation page.

**Core sections / behaviors:**

- Success state
- Order number
- Track order CTA
- Continue shopping CTA

### 19. Guest order tracking

**Route:** `/track-order`

**Purpose:** Track order without full account access when policy allows.

**Core sections / behaviors:**

- Order lookup form
- Status summary
- Shipment state
- Support CTA

## Auth and identity screens

### 20. Welcome / auth chooser

**Route:** `/welcome`

**Purpose:** Entry screen that routes users to login, register, or continue browsing.

**Core sections / behaviors:**

- Brand intro
- Login CTA
- Create account CTA
- Browse as guest CTA

### 21. Login

**Route:** `/login`

**Purpose:** Authenticate existing users.

**Core sections / behaviors:**

- Email/password form
- Forgot password link
- Register CTA
- Login action

### 22. Register

**Route:** `/register`

**Purpose:** Create customer account.

**Core sections / behaviors:**

- Name/email/password
- Terms acceptance
- Marketing opt-in
- Create account CTA

### 23. Forgot password

**Route:** `/forgot-password`

**Purpose:** Request password reset.

**Core sections / behaviors:**

- Email form
- Submit CTA
- Success confirmation
- Back to login

### 24. Reset password

**Route:** `/reset-password`

**Purpose:** Set a new password.

**Core sections / behaviors:**

- New password
- Confirm password
- Reset CTA
- Error/success feedback

### 25. Verify email / OTP

**Route:** `/verify-email`

**Purpose:** Complete verification where required.

**Core sections / behaviors:**

- Verification state
- Resend option
- Success message
- Continue CTA

## Account and post-purchase screens

### 26. Account dashboard

**Route:** `/account`

**Purpose:** Main customer hub after login.

**Core sections / behaviors:**

- Recent orders
- Support shortcuts
- Pending reviews
- Account management shortcuts

### 27. Profile

**Route:** `/account/profile`

**Purpose:** Manage personal details.

**Core sections / behaviors:**

- Editable profile fields
- Save changes CTA
- Validation feedback
- Success state

### 28. Addresses

**Route:** `/account/addresses`

**Purpose:** Manage shipping and billing addresses.

**Core sections / behaviors:**

- Saved addresses
- Add/edit forms
- Default address controls
- Delete confirmation

### 29. Orders list

**Route:** `/account/orders`

**Purpose:** Browse order history.

**Core sections / behaviors:**

- Order cards/list
- Status badges
- Filters later-ready
- Open order CTA

### 30. Order detail

**Route:** `/account/orders/:orderId`

**Purpose:** Customer truth page for an order.

**Core sections / behaviors:**

- Items and totals
- Payment and fulfillment status
- Timeline summary
- Eligible actions
- Clear loading, recoverable error, and empty-state handling where relevant
- Mobile-safe sticky primary action where it improves completion

### 31. Shipment tracking detail

**Route:** `/account/orders/:orderId/tracking`

**Purpose:** Dedicated shipment timeline page.

**Core sections / behaviors:**

- Tracking status
- Tracking events
- ETA messaging
- Support shortcut

### 32. Returns list

**Route:** `/account/returns`

**Purpose:** Track all return requests.

**Core sections / behaviors:**

- Return records
- Status badges
- Linked order summary
- View/request return CTA

### 33. Return request wizard

**Route:** `/account/orders/:orderId/return`

**Purpose:** Submit eligible return requests.

**Core sections / behaviors:**

- Item selection
- Reason selection
- Evidence upload later-ready
- Review and submit
- Inline validation with preserved form state on recoverable errors

### 34. Refunds list

**Route:** `/account/refunds`

**Purpose:** Track refund status history.

**Core sections / behaviors:**

- Refund records
- Amounts
- Status badges
- Linked order details

### 35. Reviews center

**Route:** `/account/reviews`

**Purpose:** Manage pending and submitted reviews.

**Core sections / behaviors:**

- Pending review prompts
- Submitted reviews
- Moderation states
- Edit/write CTA

### 36. Write or edit review

**Route:** `/account/reviews/:reviewId?`

**Purpose:** Compose or revise a review.

**Core sections / behaviors:**

- Rating selector
- Title/comment fields
- Submit action
- Eligibility messaging
- Inline validation with preserved form state on recoverable errors

### 37. Security and sessions

**Route:** `/account/security`

**Purpose:** Password and session-security management.

**Core sections / behaviors:**

- Change password
- Active sessions later-ready
- Recent security activity later-ready
- Logout other sessions later-ready

### 38. Preferences and communication settings

**Route:** `/account/preferences`

**Purpose:** Manage notification and communication choices.

**Core sections / behaviors:**

- Order updates
- Promotional emails
- SMS preferences
- Save CTA

## Support and service screens

### 39. Support center

**Route:** `/support`

**Purpose:** Primary entry point for help and service.

**Core sections / behaviors:**

- Issue categories
- FAQ shortcuts
- Create ticket CTA
- Order-help shortcuts

### 40. Create support ticket

**Route:** `/support/new`

**Purpose:** Open a new customer support case.

**Core sections / behaviors:**

- Subject/category
- Optional order link
- Message field
- Attachments where enabled
- Inline validation with preserved form state on recoverable errors

### 41. Support tickets list

**Route:** `/account/support`

**Purpose:** View all support conversations.

**Core sections / behaviors:**

- Ticket list
- Status badges
- Last updated
- Open ticket CTA

### 42. Support ticket detail / chat

**Route:** `/account/support/:ticketId`

**Purpose:** Conversation thread and case details.

**Core sections / behaviors:**

- Ticket summary
- Message thread
- Reply form
- Attachment previews
- Clear loading, recoverable error, and empty-state handling where relevant
- Mobile-safe sticky primary action where it improves completion

### 43. Complaints / issue reporting

**Route:** `/support/issues`

**Purpose:** Structured issue reporting experience.

**Core sections / behaviors:**

- Wrong item
- Damaged item
- Late delivery
- Payment/account issue paths

### 44. Help / FAQ center

**Route:** `/help`

**Purpose:** Self-service support and common answers.

**Core sections / behaviors:**

- FAQ categories
- Common answers
- Search later-ready
- Escalate to support CTA

## Content and trust screens

### 45. Contact

**Route:** `/contact`

**Purpose:** Formal customer contact page.

**Core sections / behaviors:**

- Contact form
- Support channels
- Business information
- Response expectations

### 46. About / brand story

**Route:** `/about`

**Purpose:** Trust and brand story page.

**Core sections / behaviors:**

- About content
- Values/trust section
- Brand story
- Shop CTA

### 47. Shipping and returns policy hub

**Route:** `/pages/policies`

**Purpose:** Combined policy hub for operational transparency.

**Core sections / behaviors:**

- Shipping policy summary
- Returns policy summary
- Policy links
- Support shortcuts

### 48. Privacy / Terms / Legal hub

**Route:** `/pages/legal`

**Purpose:** Legal information center.

**Core sections / behaviors:**

- Privacy policy
- Terms
- Data use notes
- Contact/legal support info

## Shared Mobile UI Patterns

- Reusable components should include product cards, badge/status chips, price display, rating display, cart row, order summary card, shipment tracker, review card, FAQ accordion, support message thread, and full-screen confirmation sheet.
- Sensitive or irreversible actions should use clear confirmations, for example deleting an address, abandoning checkout, cancelling an eligible order, or submitting a return request.
- Every major screen should support loading, empty, no-results, and retry states.

## Navigation Model

- Primary tabs: Home, Shop, Wishlist, Cart, Account
- Modal or stacked flows: Search, product media, checkout steps, support flows, review flows, and return/refund flows
- Deep links should support product pages, order detail, shipment tracking, support ticket detail, and campaign pages

## Implementation Order

1. App shell and navigation
2. Discovery stack: home, shop, category, search, product detail
3. Cart and checkout flow
4. Auth flow
5. Account, orders, tracking
6. Reviews, returns, refunds
7. Support and help
8. Trust/legal content and finishing polish

## Final Position

This 48-screen mobile UI specification gives the customer mobile app the same implementation depth as the rest of the system pack. It is intended to be practical, agent-friendly, and ready to drive mobile UI development screen by screen.
