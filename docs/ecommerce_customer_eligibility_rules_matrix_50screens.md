# E-Commerce Customer Eligibility Rules Matrix

## Executive overview
This document defines the customer-facing eligibility model for the storefront and account area. It explains when the frontend should show or hide important actions, which backend state should drive those decisions, and what the UI should do when an action is not allowed.

The frontend should never invent these rules. The backend is the source of truth.

## Rules matrix

| Action / Feature | Typical screens | User state | Key backend preconditions | UI when allowed | UI when not allowed |
|---|---|---|---|---|---|
| Add to cart | Product detail, listings | Guest or auth | Product and variant purchasable; stock or backorder policy valid | Enable add-to-cart | Disable and show reason |
| Proceed to checkout | Cart | Guest or auth depending policy | Cart not empty; prices valid; stock valid; guest policy if guest | Enable checkout CTA | Show blocking issues and recovery steps |
| Apply coupon | Cart, checkout | Guest or auth depending policy | Coupon active, eligible, not expired, minimum order met | Apply and show discount | Reject and show reason |
| Guest checkout | Checkout | Guest | Guest checkout enabled by settings | Allow guest path | Prompt login or registration |
| Track order as guest | Track-order page | Guest | Guest tracking enabled; order found; identifier matches | Show order and shipment status | Show generic invalid/unavailable state |
| Write review | Reviews center; product reviews | Authenticated | Delivered/completed item; verified purchase rule if enabled; no conflicting review state | Show review CTA and form | Show ineligible message |
| Cancel order | Order detail | Authenticated or verified guest | Order still cancellable; not shipped/locked; policy window open | Show cancellation action | Hide or explain ineligibility |
| Start return request | Order detail; return wizard | Authenticated | Delivered; return window open; line item eligible; not already fully returned | Show return wizard | Show block reason |
| Request support ticket | Support center; order detail | Guest or auth depending channel | Support channel enabled | Show create-ticket flow | Show contact fallback |
| Reply to support ticket | Support ticket detail | Authenticated | Ticket belongs to user and remains reply-enabled | Show reply box | Show closed/read-only state |
| Save wishlist | Wishlist; product detail | Guest or auth depending policy | Wishlist feature enabled | Show save action | Prompt sign-in if account-only |

## Recommended response fields
- Product purchase: `isPurchasable`, `purchaseBlockReason`, `availabilityLabel`
- Checkout: `canCheckout`, `blockingIssues[]`, `priceChanges[]`, `stockIssues[]`, `guestCheckoutAllowed`
- Reviews: `canReview`, `reviewEligibilityReason`, `existingReviewId`
- Cancellation: `canCancel`, `cancellationReasonOptions[]`, `cancellationBlockReason`
- Returns: `canReturn`, `eligibleItems[]`, `ineligibleItems[]`, `returnWindowEndsAt`, `returnBlockReason`
- Support: `canCreateTicket`, `canReplyToTicket`, `canLinkOrder`, `supportChannelState`

## UI guidance
When an action is not allowed:
- do not leave users guessing
- prefer a short explanation or next step
- show policy links where relevant
- avoid exposing internal decision logic

Examples:
- “This order can no longer be cancelled because it has already been shipped.”
- “This item is not eligible for return because the return window has closed.”
- “You can review this product after delivery is completed.”

## Implementation notes
- Always read eligibility from API responses.
- Avoid duplicating business rules in client code.
- Cache eligibility only for display; re-check on submit actions.
- Keep button states, helper text, and modal messaging aligned with backend reasons.

## Final position
This eligibility matrix is the contract that keeps the 50-screen customer frontend honest. It ensures that checkout, reviews, cancellations, returns, refunds, and support follow backend policy consistently.
