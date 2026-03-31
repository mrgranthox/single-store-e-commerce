# E-Commerce Mobile Eligibility and Offline Rules Matrix

## Executive overview
This document defines the mobile-specific eligibility rules, offline behavior, sync expectations, and recovery rules for the 48-screen customer mobile app.

It exists because a mobile commerce app needs more than page design and endpoints. It also needs clear rules for:
- when users are allowed to perform certain actions
- which actions must always be verified online
- which content may be cached safely
- what the app should do when the network is unavailable or unstable
- how to recover cleanly from expired sessions, changed prices, stock drift, or partial checkout failures

The backend remains the source of truth. The mobile app should display and respect backend-driven eligibility, not invent it.

---

## 1. Core rule philosophy

### 1.1 Backend-driven eligibility
The app should not decide business-critical permissions on its own. The server must determine and return:
- purchase eligibility
- checkout readiness
- coupon validity
- order cancellation eligibility
- return eligibility
- refund request eligibility
- review eligibility
- support ticket reply eligibility where needed

### 1.2 Offline-aware but not offline-authoritative
The mobile app may cache content and preserve drafts locally, but it must not finalize sensitive commerce actions offline.

The following actions always require live backend confirmation:
- add to cart if server-backed cart is authoritative
- apply coupon
- validate checkout
- create order
- initiate payment
- request return
- request refund
- request cancellation
- submit review if review rules are server-controlled
- submit support ticket

### 1.3 Recoverable failure over silent failure
If the network fails during an action, the app should:
- preserve draft data where safe
- show a clear explanation
- offer retry
- avoid duplicate submission where possible
- fetch current state after reconnect

---

## 2. Eligibility matrix by journey

## 2.1 Catalog and purchase eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior when ineligible |
|---|---:|---:|---|---|
| View product | Yes, for visibility | Preferred | Product exists and is public | Show not found or unavailable state |
| View price | Yes | Preferred | Product is visible and price active | Show current server price only |
| Select variant | Partly | No for UI, yes for final purchase | Variant exists | Disable unavailable variants |
| Add to wishlist | Yes if account-backed | Usually yes | User auth policy or guest wishlist policy | Prompt login or save locally if supported |
| Add to cart | Yes | Yes | Product purchasable, variant valid, stock/backorder policy allows | Show reason message from backend |
| Purchase product | Yes | Yes | Product visible, active, purchasable, stock or backorder policy valid | Disable CTA and show reason |

Recommended response shape:

```json
{
  "eligibility": {
    "canPurchase": false,
    "reasonCode": "OUT_OF_STOCK",
    "reasonMessage": "This item is currently out of stock."
  }
}
```

---

## 2.2 Cart and checkout eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior |
|---|---:|---:|---|---|
| View cart | Yes | Yes | Cart exists or may be created | Refresh totals on open |
| Update quantity | Yes | Yes | Stock rules still valid | Show warning if quantity reduced |
| Apply coupon | Yes | Yes | Coupon active and applicable | Show failure reason clearly |
| Proceed to checkout | Yes | Yes | Cart valid, auth/guest policy satisfied | Block navigation if invalid |
| Save address locally during form fill | No | No | Draft only | Persist form draft safely |
| Final checkout validation | Yes | Yes | Stock, price, coupon, shipping, policy checks all pass | Must revalidate before payment |
| Create order | Yes | Yes | All validation passes | Never create offline |
| Initiate payment | Yes | Yes | Order exists and payment session valid | Retry-safe flow required |

Common eligibility reason codes:
- `CHECKOUT_STOCK_CHANGED`
- `CHECKOUT_PRICE_CHANGED`
- `CHECKOUT_COUPON_INVALID`
- `CHECKOUT_GUEST_NOT_ALLOWED`
- `CHECKOUT_SHIPPING_METHOD_INVALID`

---

## 2.3 Account and order eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior |
|---|---:|---:|---|---|
| View orders list | Yes | Yes | Auth required | Show login if unauthenticated |
| View order detail | Yes | Yes | User owns order or valid guest tracking path | Show access denied if not authorized |
| View tracking | Yes | Yes | Shipment exists | Show awaiting shipment if not shipped |
| Track guest order | Yes | Yes | Matching order number and identity check | Show not found safely without leaking data |

---

## 2.4 Cancellation eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior |
|---|---:|---:|---|---|
| Request cancellation | Yes | Yes | Order not shipped, policy window valid, payment/order state allows | Show eligibility badge on order detail |
| View cancellation result | Yes | Yes | Cancellation record exists | Refresh order state after request |

Common rules:
- cannot cancel if shipped
- may require different messaging if paid but not fulfilled
- backend should return `canCancel`, `reasonCode`, and `reasonMessage`

---

## 2.5 Return eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior |
|---|---:|---:|---|---|
| Start return wizard | Yes | Yes | Order delivered, within return window, item returnable | Hide or disable action if not allowed |
| Submit return request | Yes | Yes | At least one eligible item selected, reason present, policy satisfied | Preserve draft if network fails before submit |
| Upload evidence | Yes | Yes | Attachment type and size valid | Queue retry only if upload flow supports resumable uploads |

Common reason codes:
- `RETURN_WINDOW_EXPIRED`
- `ORDER_NOT_DELIVERED`
- `ITEM_NOT_RETURNABLE`
- `RETURN_ALREADY_EXISTS`

---

## 2.6 Refund eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior |
|---|---:|---:|---|---|
| View refund state | Yes | Yes | Refund exists or may be linked to return | Read-only timeline |
| Request refund | Yes | Yes | Policy allows direct refund request or linked return path | Show path-specific guidance |

The app should never infer refund approval logic.

---

## 2.7 Review eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior |
|---|---:|---:|---|---|
| Show write review CTA | Yes | Yes | Item delivered, review window active, user eligible | Show prompt only when eligible |
| Submit review | Yes | Yes | User owns item, review not already submitted or editable policy allows | Validate rating and text length locally, submit online |
| Edit review | Yes | Yes | Policy allows edit | Show moderation state if relevant |

Common reason codes:
- `NOT_DELIVERED_YET`
- `REVIEW_ALREADY_SUBMITTED`
- `REVIEW_WINDOW_CLOSED`
- `NOT_VERIFIED_PURCHASE`

---

## 2.8 Support eligibility

| Action | Backend-driven? | Online required? | Key conditions | Mobile behavior |
|---|---:|---:|---|---|
| Open support center | No | No for shell, yes for live data | Static or cached content available | Load cached help first if offline |
| Create support ticket | Yes | Yes | Category valid, auth policy satisfied, order link optional rules valid | Save draft locally if interrupted |
| Reply to ticket | Yes | Yes | Ticket open and reply allowed | Show closed-ticket state clearly |
| Upload support attachment | Yes | Yes | File size/type valid | Retry only when safe |

Common reason codes:
- `SUPPORT_TICKET_CLOSED`
- `SUPPORT_ATTACHMENT_INVALID`
- `SUPPORT_AUTH_REQUIRED`

---

## 3. Offline content matrix

## 3.1 Safe-to-cache content
These screens are good candidates for cache-first or stale-while-revalidate behavior:

| Screen / data | Cache recommendation | Notes |
|---|---|---|
| Home content | Cache for short window | Revalidate on app open |
| Categories | Cache | Slow-changing |
| Brand lists | Cache | Slow-changing |
| Product detail summary | Cache with revalidation | Never trust cached stock for checkout |
| Product reviews list | Cache lightly | Can be stale briefly |
| Help / FAQ | Cache | Good offline support aid |
| CMS pages and policies | Cache | Important for trust and legal access |
| About / contact | Cache | Good offline readability |

## 3.2 Must-refresh content
These screens should be treated as server-fresh before acting:

| Screen / data | Why fresh data matters |
|---|---|
| Cart totals | Prices and stock may change |
| Checkout summary | Stock, coupon, shipping, and price must be current |
| Order detail | Statuses may change after purchase |
| Tracking detail | Shipment events are time-sensitive |
| Return eligibility | Policy windows can expire |
| Refund eligibility | Dependent on current order/payment state |
| Security/session state | Sensitive and time-dependent |
| Support ticket detail | Conversation state may have changed |

---

## 4. Offline behavior by screen class

## 4.1 Discovery screens
When offline:
- show cached home, category, product, and policy content if available
- show offline banner or status indicator
- disable actions that require server confirmation if needed
- allow browsing of cached content

## 4.2 Cart screen
When offline:
- if local cart draft exists, allow viewing draft state clearly labeled
- do not promise final totals
- disable coupon application and checkout submission
- show reconnect prompt to validate cart

## 4.3 Checkout screens
When offline:
- preserve form entries locally
- disable final submission
- show that checkout requires internet connection
- allow user to continue editing draft address fields

## 4.4 Account and order screens
When offline:
- show last synced orders list if available with stale indicator
- order detail may show cached snapshot, but timeline freshness must be labeled
- tracking should show cached summary only if available and clearly marked

## 4.5 Support screens
When offline:
- show cached ticket list or ticket details if available
- allow drafting a new message locally
- require reconnect to send

---

## 5. Draft preservation rules

The app should preserve local drafts for:
- checkout shipping form
- checkout billing form if applicable
- review form draft
- support ticket draft
- support reply draft
- return request draft
- contact form draft

Draft preservation should include:
- local timestamp
- expiration or cleanup policy later
- clear UI that the draft is not yet submitted

Do not persist highly sensitive secrets in plain storage.

---

## 6. Retry and duplicate-submission rules

### 6.1 Retry-safe flows
The app should support careful retry for:
- support ticket submit
- support message submit
- review submit
- return request submit
- contact form submit

### 6.2 Idempotency expectations
The backend should support idempotency for high-risk operations such as:
- create order
- initialize payment
- request cancellation
- create return
- create refund request

### 6.3 Mobile UI rules
When a submission is in progress:
- disable repeated taps
- show progress state
- preserve payload until clear success/failure state
- on reconnect, re-fetch authoritative result before retrying if operation may have succeeded server-side

---

## 7. Session expiry and auth recovery rules

When a session expires:
- preserve safe in-progress drafts
- redirect to login or show session recovery screen
- after re-authentication, restore the interrupted route when possible
- force fresh fetch of account, cart, and post-purchase data

Do not silently discard:
- checkout draft
- support draft
- review draft
- return request draft

---

## 8. Push, local notifications, and state refresh rules

The mobile app may use push notifications for:
- order confirmed
- payment succeeded or failed
- shipment dispatched
- delivery update
- support reply
- refund update
- return status update

When the user opens from a notification:
- deep link to the relevant screen
- refresh the authoritative data from backend
- fall back gracefully if the entity is no longer accessible

---

## 9. Recommended backend fields for mobile eligibility

For order detail and post-purchase pages, a good pattern is:

```json
{
  "eligibility": {
    "canCancel": false,
    "cancelReasonCode": "ORDER_ALREADY_SHIPPED",
    "cancelReasonMessage": "This order has already been shipped and can no longer be cancelled.",
    "canReturn": true,
    "returnReasonCode": null,
    "returnReasonMessage": null,
    "canRefundRequest": true,
    "refundReasonCode": null,
    "canReview": false,
    "reviewReasonCode": "NOT_DELIVERED_YET",
    "reviewReasonMessage": "You can review this item after delivery."
  }
}
```

This keeps the mobile app simple and predictable.

---

## 10. Error handling matrix

| Situation | App behavior |
|---|---|
| Network unavailable before submit | Keep user on form, show offline message, preserve draft |
| Network lost during submit | Show uncertain state, re-fetch before retrying if operation may have succeeded |
| Session expired | Prompt re-auth, preserve draft, restore route |
| Stock changed | Refresh cart/order summary and show clear message |
| Price changed | Refresh totals and require user confirmation |
| Coupon invalidated | Remove coupon summary, show reason, let user continue |
| Order no longer eligible for return | Remove action and show policy message |
| Ticket closed before reply | Show read-only ticket state |

---

## 11. Recommended implementation order
1. define shared eligibility response patterns
2. implement cache policy by endpoint class
3. add draft preservation for forms
4. add retry and reconnect behavior for support, review, and return flows
5. add session recovery flow
6. add deep-link refresh rules for notifications

---

## 12. Final position
This mobile eligibility and offline rules matrix ensures the 48-screen mobile app is not only feature-complete, but resilient, predictable, and safe under real mobile conditions such as weak networks, app resumes, session expiry, and state drift.
