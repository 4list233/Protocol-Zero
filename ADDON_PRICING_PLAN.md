# Add-on Pricing & Checkout Hardening Plan

## Goals
- Enforce pricing and promos server-side to prevent spoofing.
- Respect add-on eligibility and thresholds (global + per-variant).
- Keep client UX aligned with server rules.
- Prepare for invoice/receipt generation.

## Current State
- Client cart supports add-on pricing, threshold banner, toggles, and promo exclusion on the client.
- `/api/addons` lists add-on variants using `isAddonEligible` + `addonPrice`.
- Variant mapper now surfaces: `isAddonEligible`, `addonPrice`, `addonCost`, `addonMargin`, `minCartForAddon`, option types/values.
- Checkout API (`/api/checkout`) trusts client prices and discounts; no server validation yet.

## Gaps to Fix
- No server-side recomputation of totals or promo rules; prices can be spoofed.
- Add-on eligibility/threshold not enforced server-side; `minCartForAddon` unused.
- Promos validated only client-side (`PROMO10` stub); promos applied to add-ons if spoofed.
- Shipping always 0 in request; not recomputed.
- Add-on preview/cards assume `product.primaryImage` exists; missing static images break UI.
- No invoice/receipt output.

## Decisions / Assumptions
- Global add-on unlock threshold remains $30 CAD unless a variant sets `minCartForAddon`; use `Math.max(global, per-variant)` for that variant.
- Promo discounts apply to regular items only; add-ons are excluded.
- CAD is the source-of-truth currency; require `price_cad` for add-on items.
- Keep client UX: allow add-on toggle once unlocked; optional auto-upgrade when threshold is reached.

## Work Plan (ordered)
1) **Server-side pricing enforcement in `/api/checkout`:**
   - Fetch fresh variants by IDs from Knack.
   - Compute regular subtotal (only regular items) to determine unlock state.
   - For each item, decide allowed price:
     - If `isAddonEligible` AND `addonPrice` present AND unlock condition met for that variant (global/per-variant threshold) → use add-on price; else use regular price.
   - Recompute subtotals, shipping (0 for now), promo discount, and total; ignore client-provided amounts.
   - Reject if client sent mismatched totals or attempted add-on pricing without eligibility.

2) **Promo validation service (backend):**
   - Add simple validation (allowlist in code or Knack table) with fields: code, percent/amount, active window.
   - Apply discount only to regular subtotal; exclude add-ons.
   - Return applied promo code in response for client display.

3) **Respect `minCartForAddon`:**
   - Server: unlock per-variant when `regularSubtotal >= max(globalThreshold, variant.minCartForAddon)`.
   - Client: mirror logic in cart context & add-on preview banners.

4) **Client UX alignment:**
   - Optional: auto-upgrade eligible items to add-on when threshold met (or show “Apply add-on price” prompt).
   - Add a note when adding add-ons before unlock: “Will switch to add-on price once you hit $X.”

5) **Data hygiene & imagery:**
   - Ensure all add-on variants have `price_cad` and `addonPrice`; log/skip otherwise.
   - Add fallback image for products missing `-Main.jpg`; consider a lightweight placeholder path.

6) **Invoice/Receipt generation (next):**
   - Server-rendered printable HTML (or PDF) after order creation.
   - Include line items with flags for add-on vs regular, promo discount (regular items only), totals, payment instructions, business info.

## Testing Checklist
- Add-on item at/above threshold uses add-on price; below threshold reverts to regular (both client and server).
- Promo applies only to regular items; server rejects add-on discount spoofing.
- `minCartForAddon` higher than $30 still enforced for that variant.
- Missing image falls back gracefully.
- Checkout response totals match server recomputation; mismatches are rejected.

