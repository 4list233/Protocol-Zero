# Protocol Zero — Category Management, New Arrivals & OG Embeds Spec

## Overview

Three interconnected features to improve the storefront experience:

1. **Category Management** — Reorganize /shop from a flat product grid into Netflix-style category rows with dedicated category pages
2. **New Arrivals** — Dedicated /new-arrivals route with configurable "new" window for promotional sharing
3. **OG Embed Previews** — Auto-generated Open Graph cards for product pages showing hero image, title, price, and category

---

## 1. Category Management

### 1.1 Shop Page Redesign (`/shop`)

**Layout: Netflix-style horizontal category rows**

- Each active category renders as a horizontal scrollable row
- Row header shows category name + product count + "View All →" link to `/shop/category/[slug]`
- **Products per row (responsive):** 6 on desktop (≥1280px), 4 on tablet (≥768px), 2 on mobile (<768px)
- Row size is configurable from admin settings
- Categories with **zero active products are hidden** from the page entirely

**Row ordering: By latest activity**

- Categories containing the most recently added products (by `field_59` created date) float to the top
- Admin can override with manual drag-and-drop ordering from `/admin/settings`

**"New Arrivals" row**

- A special pinned row at the **top** of `/shop` labeled "New Arrivals"
- Shows products within the configurable "new" window (default: admin-set number of days)
- Links "View All →" to `/new-arrivals`

**"NEW" badge on product cards**

- Products within the "new" window display a small "NEW" badge/ribbon on the top-left corner of their product card
- Badge appears globally — on `/shop` rows, category pages, `/new-arrivals`, and search results

**Mobile behavior: Horizontal swipe rows**

- Each category row scrolls horizontally via touch/swipe gestures
- Snap-to-card scroll behavior for clean UX
- Left/right arrow buttons visible on desktop (hidden on mobile, replaced by swipe)

**Search behavior: Global + per-category**

- `/shop` retains a global search bar
- When search is active, results display in a flat grid (overrides the Netflix row layout)
- Results are **grouped by category** with category sub-headers
- Individual category pages (`/shop/category/[slug]`) have their own **local search** scoped to that category's products

### 1.2 Dedicated Category Pages (`/shop/category/[slug]`)

**Route:** `/shop/category/[slug]` (e.g., `/shop/category/helmets`)

- Slug is the lowercase, hyphenated category name (e.g., "Vests" → `vests`, "Eye Wear" → `eyewear`)
- No route conflict with `/shop/[id]` (product detail pages)

**Page layout:**

- **Auto-styled header:** Gradient background + category name + product count. No custom hero banner upload required. Consistent styling auto-generated per category using a color palette rotation or category-based hue.
- **Product grid below header:** Standard responsive grid (same as current shop grid layout)
- **Local search bar:** Scoped to this category only
- **Sort dropdown:** User-selectable with options:
  - Newest first (default — `field_59` descending)
  - Alphabetical (A-Z)
  - Price: Low to High (cheapest variant `price_cad`)
  - Price: High to Low

**Empty categories:** If a category page is accessed via direct URL but has zero products, show a "No products in this category" message with a link back to `/shop`.

### 1.3 Category Slugs

Derive from existing `field_50` values in Knack. Slug generation:

| Category       | Slug            |
|----------------|-----------------|
| Accessories    | `accessories`   |
| Clothing       | `clothing`      |
| Communications | `communications`|
| Eyewear        | `eyewear`       |
| Footwear       | `footwear`      |
| Gloves         | `gloves`        |
| Helmets        | `helmets`       |
| Pouches        | `pouches`       |
| Vests          | `vests`         |
| Other          | `other`         |

Custom admin-added categories: slugify using `toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`.

---

## 2. New Arrivals

### 2.1 Route: `/new-arrivals`

**Purpose:** Shareable promotional link. When running promotions, this URL is sent directly to customers via text, social, etc.

**"New" definition:** Products where `field_59` (Knack created date) is within the last N days, where N is the admin-configured "new window" value.

**Layout:** Netflix-style category rows (same as `/shop`), but **filtered to only show products within the new window**.

- Categories with zero new products are hidden
- If zero products total are new, show a "Check back soon for new arrivals!" message
- Products sorted newest first within each category row

**SEO/Sharing:** This page gets custom OG metadata (see Section 3).

### 2.2 Admin Configuration

**Location:** `/admin/settings` page (existing)

**New controls:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| New Arrivals Window | Number input (days) | 30 | How many days a product is considered "new" |
| Category Display Order | Drag-and-drop list | By latest activity | Override automatic ordering of category rows on /shop |
| Row Size | Number input | 6 | Max products shown per category row on desktop (tablet = floor(n * 0.66), mobile = 2) |

**Storage:** These settings should be stored in Knack (new settings object) or as a lightweight API-backed config — NOT localStorage, since these are storefront-wide settings that apply to all visitors.

---

## 3. OG Embed Previews

### 3.1 Product Pages (`/shop/[id]`)

**Implementation:** Next.js `generateMetadata` + OG Image Route (`/api/og/product/[id]`)

**Dynamic OG tags per product:**

```
og:title        → Product title
og:description  → Product description (truncated to 155 chars) or fallback to category + price
og:image        → Auto-generated OG card (see below)
og:url          → Canonical product URL
og:type         → product
og:price:amount → Cheapest variant price_cad
og:price:currency → CAD
```

**Twitter Card tags:**

```
twitter:card        → summary_large_image
twitter:title       → Product title
twitter:description → Same as og:description
twitter:image       → Same as og:image
```

### 3.2 Auto-Generated OG Card Design

**Endpoint:** `/api/og/product/[id]` — uses Next.js `ImageResponse` (from `next/og`)

**Card layout (1200×630px): Product-centric**

- **Background:** Dark/branded background (Protocol Zero brand colors)
- **Center:** Product `primaryImage` — scaled to fit with padding, maintaining aspect ratio
- **Bottom bar:** Semi-transparent overlay with:
  - Product title (left-aligned, white text, bold)
  - Price: `From $XX.XX CAD` (right-aligned)
- **Top-left corner:** Category tag pill (e.g., "Helmets") with subtle background
- **Top-left (below category):** "NEW" badge — only if product is within the new arrivals window
- **Bottom-right or corner:** Protocol Zero logo watermark (subtle, small)

**Technical considerations:**

- `ImageResponse` runs on the Edge runtime — must fetch product data and image within the handler
- Product images from Knack CDN must be fetched as `ArrayBuffer` for embedding in the `ImageResponse`
- Cache the generated OG images aggressively (`Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`) — 1 day fresh, 7 day stale
- Fallback: If product image fails to load, use a branded placeholder with just the title

### 3.3 /new-arrivals Page OG

**Static-ish OG tags:**

```
og:title       → "New Arrivals — Protocol Zero Airsoft"
og:description → "Check out the latest gear drops at Protocol Zero Airsoft."
og:image       → /api/og/new-arrivals (auto-generated card showing a collage of the 3-4 newest product images)
og:url         → /new-arrivals
```

### 3.4 Pages NOT getting custom OG treatment

- `/shop` — keeps existing generic OG tags
- `/shop/category/[slug]` — keeps generic OG tags (not requested)

---

## 4. Technical Implementation Plan

### 4.1 New Files

| File | Purpose |
|------|---------|
| `app/shop/category/[slug]/page.tsx` | Dedicated category page |
| `app/new-arrivals/page.tsx` | New arrivals page |
| `app/api/og/product/[id]/route.tsx` | OG image generator for products |
| `app/api/og/new-arrivals/route.tsx` | OG image generator for new-arrivals page |
| `lib/categories.ts` | Category slug utilities (slugify, lookup, color mapping) |
| `components/category-row.tsx` | Reusable Netflix-style horizontal scroll row |
| `components/product-card-badge.tsx` | "NEW" badge overlay component |
| `components/sort-dropdown.tsx` | Sort selector for category pages |

### 4.2 Modified Files

| File | Changes |
|------|---------|
| `app/shop/page.tsx` | Replace flat grid with category rows layout, add New Arrivals top row |
| `app/shop/[id]/page.tsx` | Add `generateMetadata` for dynamic OG tags |
| `app/admin/settings/page.tsx` (or equivalent) | Add new arrivals window, category order, row size controls |
| `lib/admin-categories.ts` | Add slug generation, color mapping |
| `app/api/products/route.ts` | Optionally add sort-by-date support for new arrivals queries |
| `lib/knack-products.ts` | Ensure `field_59` (created date) is included in product fetch and exposed to frontend |

### 4.3 Data Flow

```
Knack (field_59 created_at) → API → Frontend
                                  ↓
                        Compare against admin "new window" setting
                                  ↓
                        isNew = createdAt > (now - windowDays)
                                  ↓
                    Show badge / Include in /new-arrivals
```

### 4.4 Caching Strategy

- **Product data:** Existing 5-minute cache unchanged
- **OG images:** 24-hour CDN cache with 7-day stale-while-revalidate
- **Admin settings:** Fetch on page load, cache client-side for session duration
- **Category pages:** SSR or ISR with same revalidation as /shop

### 4.5 Edge Cases

- **Product with no category:** Falls into "Other" or "Uncategorized" row
- **Product with unknown/new category:** Dynamically create row, auto-generate slug
- **OG image generation failure:** Fallback to static branded image with title text only
- **Zero new products:** /new-arrivals shows "Check back soon" message
- **Admin sets window to 0 days:** Effectively disables new arrivals feature (hide row + badge)
- **Product image fails to load in OG generator:** Use placeholder with title + price text

---

## 5. Migration & Rollout

1. **Phase 1:** Category infrastructure — slug utilities, category-row component, admin settings
2. **Phase 2:** Shop page redesign — Netflix rows, New Arrivals top row, mobile swipe
3. **Phase 3:** Category pages — `/shop/category/[slug]` with sort, search, auto-styled headers
4. **Phase 4:** New Arrivals — `/new-arrivals` route, "NEW" badges on cards
5. **Phase 5:** OG embeds — `generateMetadata`, OG image generation API routes

No database migration needed — all data fields already exist in Knack (`field_59` for dates, `field_50` for categories). Admin settings storage is the only new data requirement.
