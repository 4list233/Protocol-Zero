# Notion Integration Plan

## Overview
Replace manual JSON editing with Notion as the live product database. The shop reads from Notion at runtime, while JSON/TypeScript exports exist only for optional backups or one-off tooling.

---

## Current State

### Data Flow
```
Taobao Scraper → products_manifest.json → generate-products.js → products.generated.ts → Shop Pages
                       ↓
              product_overrides.json
```

### Pain Points
- ❌ Editing JSON manually is error-prone
- ❌ No rich text for descriptions
- ❌ No easy way to add categories, tags, notes
- ❌ No collaboration features
- ❌ No visual product management UI

---

## Proposed State (REVISED - Direct API Integration)

### New Data Flow
```
1. Taobao Scraper → products_manifest.json (backup/archive only)
                          ↓
2. Manual edit in VS Code (optional, for bulk operations)
                          ↓
3. json-to-notion.js → Notion Database (initial seed)
                          ↓
4. Edit in Notion UI (add descriptions, categories, manage inventory)
                          ↓
5. Shop API Route → Notion API (real-time fetch)
                          ↓
6. Shop pages read from API → Cart, Checkout, Product Pages all live data
```

**Optional fallback: Build-time fetch (SSG backup)**
```
Build time: fetch-notion.js → Notion API → products.generated.ts → Static pages
Runtime: Shop reads from static data (fast, no API calls per request) — use only when offline/cache needed.
```

### Key Benefits
- ✅ **No manual sync needed** - shop always shows latest Notion data
- ✅ **Instant updates** - edit in Notion, changes appear immediately (or on next build)
- ✅ Visual product management in Notion
- ✅ Rich descriptions with formatting, images, embeds
- ✅ Categories, tags, status tracking (Draft/Active/Discontinued)
- ✅ Team collaboration (multiple users can edit)
- ✅ Version history in Notion
- ✅ **No JSON intermediary** - Notion is the single source of truth
- ✅ Modular: All shop components read from single source
- ✅ Efficient: No duplication, consistent data everywhere
- ✅ **Scraper becomes optional** - can add products directly in Notion

---

## Notion Database Schema (Tree Structure)

### Database 1: Products (Parent)
**Database Name:** `Protocol Zero - Products`

| Property | Type | Purpose | Example |
|----------|------|---------|---------|
| **Title** | Title | Product name (English) | "WOSPORT L4G24 Night Vision Mount" |
| ID | Text | Unique slug identifier | "wosport-l4g24--" |
| SKU | Text | Base SKU (root) | "WOS-L4G24" |
| Title Original | Text | Chinese title from Taobao | "WOSPORT L4G24 夜视仪支架" |
| **Category** | Select | Product category | Gear, Apparel, Accessories, Electronics |
| **Status** | Select | Product status | Active, Draft, Discontinued, Out of Stock |
| **Description** | Rich Text | Full product description | Markdown with images, lists, formatting |
| Price CAD (Base) | Number | Default/base price in CAD | 43.43 |
| **Margin** | Number | Profit margin multiplier | 0.5 (means 50% markup) |
| **Images** | Files | Product photos (hero + gallery) | Multiple uploaded images |
| Image Paths | Text | Fallback: image paths | `/images/wosport-l4g24--Main.jpg` |
| Detail Image | Files | Long scrolling detail image | Single uploaded image |
| Detail Image Path | Text | Fallback: detail path | `/images/wosport-l4g24--Details_Long.jpg` |
| **Variants** | Relation | Link to variant options | → Product Variants database |
| Stock | Number | Global inventory count | 15 |
| URL | URL | Source Taobao link | https://item.taobao.com/... |
| Supplier Notes | Text | Internal notes | "Restock every 2 weeks" |
| Last Updated | Last Edited Time | Auto-updated timestamp | 2025-11-19 |

### Database 2: Product Variants (Children)
**Database Name:** `Protocol Zero - Product Variants`

| Property | Type | Purpose | Example |
|----------|------|---------|---------|
| **Variant Name** | Title | Option label | "Tan" or "Black" |
| **Product** | Relation | Parent product link | ← Products database |
| SKU | Text | Variant-specific SKU | "WOS-L4G24-TAN" |
| Price CNY | Number | Variant price in Yuan | 215.00 |
| Price CAD Override | Number | Override base price | 45.00 (if different from base) |
| Stock | Number | Variant-specific stock | 5 |
| Status | Select | Variant status | Active, Out of Stock |
| Sort Order | Number | Display order | 1, 2, 3... |

**Key Differences:**
- ✅ **No JSON strings** - proper Notion relations
- ✅ **Images stored once** - at product level, all variants share
- ✅ **Tree structure** - Product has many Variants
- ✅ **Notion Files property** - upload images directly, or use fallback text paths
- ✅ **Cleaner UI** - edit variants in separate rows with proper forms

---

## Implementation Components

### Primary Architecture: Runtime Notion API (Live Source of Truth)

**Goal:** Every shop experience (homepage, PDP, cart, checkout, admin) reads current data straight from Notion with zero rebuilds.

#### `shop/lib/notion-client.ts`
Utility that wraps `@notionhq/client` with typed queries.

**Responsibilities**
- Initialize the Notion client with `NOTION_API_KEY` (server-only env)
- Provide helpers: `fetchProducts()`, `fetchProductById(id)`, `fetchVariants(productPageId)`
- Abstract pagination + filtering (Status = Active)
- Convert Notion rich text → Markdown, select values → strings, files → URLs
- Merge product + variants into the Product/ProductVariant types

#### `shop/lib/notion-cache.ts`
Thin caching layer to prevent hammering the Notion API.

**Requirements**
- In-memory LRU cache (per server instance) keyed by query
- Configurable TTL (default 2 minutes) + manual `revalidateTag('notion-products')`
- Optional persistent cache via Vercel KV / Upstash (future)

#### `shop/app/api/products/route.ts` and `shop/app/api/products/[id]/route.ts`
These API routes act as the data gateway for the rest of the app.

**Features**
- GET `/api/products`: returns all active products with variants
- GET `/api/products/[id]`: single product lookup (slug or Notion page id)
- Enables client components to use `fetch('/api/products')` without exposing the Notion token to the browser
- Adds 1–5 minute cache headers + SWR revalidation hints
- Handles degraded modes (return cached JSON snapshot if Notion temporarily fails)

#### Server Utilities / Hooks
- `shop/lib/data/products.ts` exports `getProducts()` / `getProduct(id)` that call the internal client (used by server components like `app/shop/page.tsx`)
- React Query/SWR hook for client components when streaming data (`useProducts()`)
- Cart + checkout continue to use the same Product types; variant id + name stored in cart items

#### Image Handling at Runtime
- For immediate rollout, rely on existing static images hosted in `public/images` (paths stored in Notion fields)
- Future enhancement: background job that downloads Notion-hosted files to S3/public folder when new URLs detected

### Optional Fallback: Build-time Snapshot (Static Cache)

Sometimes we still want an offline snapshot (local dev on airplanes, regression testing, or if Notion API rate limits). Keep the existing script but treat it as tooling, not the source of truth.

#### `shared/scripts/fetch-notion.js`
- Same transformer as above, but writes to `shop/lib/products.generated.ts`
- Can be invoked manually (`npm run snapshot:products`) or via CI when creating backups
- Serves as last-resort data set if the runtime API is unavailable

#### `shop/lib/products.ts`
- Continue exporting `products` from `products.generated.ts`
- Runtime code first tries live API; if it fails, fall back to this snapshot (with warning banner)

> **Note:** Static snapshots are never committed as the primary source—they are treated like fixtures/backups.

### 2. Environment Variables

| File | Variable | Purpose |
|------|----------|---------|
| `shared/scripts/.env` | `NOTION_API_KEY` | Seed/snapshot scripts (node)
| `shared/scripts/.env` | `NOTION_DATABASE_ID_PRODUCTS` | Products DB ID
| `shared/scripts/.env` | `NOTION_DATABASE_ID_VARIANTS` | Variants DB ID
| `shop/.env.local` | `NOTION_API_KEY` | Runtime API routes (server-side only)
| `shop/.env.local` | `NOTION_DATABASE_ID_PRODUCTS` | Same as above
| `shop/.env.local` | `NOTION_DATABASE_ID_VARIANTS` | Same as above
| `shop/.env.local` | `NOTION_CACHE_TTL_SECONDS` | Optional override for cache TTL

**Secrets Hygiene**
- `NOTION_API_KEY` must never be exposed to the browser—only used inside API routes / server components.
- Consider separate integrations for staging vs production so tokens can be rotated independently.

**How to get IDs**
1. Go to https://www.notion.so/my-integrations → create integration → copy token.
2. Create the two databases (Products + Product Variants).
3. Share each database with the integration.
4. Copy database IDs from the URL (32-character strings) and set the env vars accordingly.

### 3. Type Updates

**`shop/lib/products.ts` (Revised for Tree Structure):**
```typescript
// Product variant (child object)
export type ProductVariant = {
  id: string                    // Notion page ID
  variantName: string           // "Tan", "Black", etc.
  sku?: string                  // Variant-specific SKU
  price_cny: number             // Price in Chinese Yuan
  price_cad?: number            // Override price (if different from base)
  stock?: number                // Variant-specific stock
  status?: 'Active' | 'Out of Stock'
  sortOrder?: number            // Display order
}

// Main product (parent object)
export type Product = {
  id: string                    // Unique slug
  sku: string                   // Base SKU
  title: string                 // Display name (English)
  title_original?: string       // Chinese title
  
  // Pricing
  price_cad: number             // Base price (used if no variants)
  margin: number                // Markup multiplier
  
  // Media
  primaryImage: string          // First image (hero)
  images: string[]              // All product images (shared by variants)
  detailLongImage?: string      // Long scrolling detail image
  
  // Metadata
  category?: string             // Gear, Apparel, etc.
  description?: string          // Rich text → Markdown
  status?: 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock'
  stock?: number                // Global stock (if not using variants)
  url?: string                  // Source Taobao link
  
  // Variants (tree structure)
  variants?: ProductVariant[]   // Child objects (no more JSON string!)
  
  // Legacy (deprecated, can remove later)
  options?: {
    name: string
    values: string[]
  }[]
}
```

**Key Changes:**
- ✅ `ProductVariant` is now a proper type (not inline object)
- ✅ Variants have their own properties (stock, status, SKU)
- ✅ Images at product level (shared by all variants)
- ✅ `price_cad` at product level is the base/default
- ✅ Variant `price_cad` is optional override

### 4. Updated Workflow (`REGENERATE.md`)

**New Section:**
```markdown
## Workflow: Managing Products with Notion (Runtime API)

### Initial Setup (One-time)
1. Create the Products + Product Variants databases (see NOTION_SETUP.md).
2. Create a Notion integration and capture the token + database IDs.
3. Add the env vars to both `shared/scripts/.env` and `shop/.env.local` (server only).
4. Seed existing catalog:
  ```zsh
  cd shared/scripts
  npm install
  npm run seed-notion
  ```
5. Start the shop:
  ```zsh
  cd ../shop
  npm install
  npm run dev
  ```
  Pages now pull live data from Notion.

### Daily Product Management
1. Edit or add products directly in Notion.
2. No CLI step required—the website reads updates on the next request.
3. If you want instant cache busting, run:
  ```zsh
  curl -X POST https://your-domain/api/revalidate/notion-products \
    -H "Authorization: Bearer <REVALIDATE_TOKEN>"
  ```
  (Optional endpoint that calls `revalidateTag`.)

### Scraper-Assisted Flow (Optional)
1. Run Taobao scraper to produce `shared/data/products_manifest.json`.
2. Run `npm run seed-notion` to push the harvested data into Notion.
3. Finish editing inside Notion (titles, categories, pricing, etc.).

### Local Development
```zsh
cd shop
NOTION_API_KEY=... NOTION_DATABASE_ID_PRODUCTS=... npm run dev
```
The dev server hits the live Notion data. For offline work, run `npm run snapshot:products` to generate a local fallback file and opt into it via `USE_PRODUCTS_SNAPSHOT=true`.

### Production Deployment
1. Ensure `NOTION_*` env vars are set in Vercel project settings.
2. Push to `main` as usual—no data files in git.
3. Vercel deploy uses the same runtime API routes, so updates appear instantly without redeploys.

### Backups / Disaster Recovery
- Run `npm run snapshot:products` weekly to keep a JSON snapshot in `backups/products-YYYYMMDD.json`.
- These snapshots are for auditing only; they do not feed the live site unless manually toggled.
```

---

## Success Criteria

### Must Have (MVP)
- ✅ Products + Variants seeded into Notion with correct relations
- ✅ Runtime API routes (`/api/products`, `/api/products/[id]`) return data from Notion
- ✅ Shop pages, cart, and checkout render using the runtime API (no rebuild required)
- ✅ Variant selection flows surface the right price/stock info
- ✅ Basic caching keeps latency low while reflecting edits within 2 minutes
- ✅ Snapshot fallback exists but is not required for normal operation

### Should Have
- ✅ Rich descriptions render (Markdown derived from Notion rich text)
- ✅ Category/status filters respected across the app
- ✅ Graceful degradation: if Notion API fails, serve last cached snapshot with banner
- ✅ Revalidation endpoint (or button) to bust cache instantly after major edits

### Could Have (Future)
- 🔮 Streaming updates via Notion webhooks → revalidateTag
- 🔮 Admin dashboard to preview Notion data + trigger revalidation
- 🔮 Automatic image syncing from Notion files to S3/public bucket
- 🔮 Inventory dashboards, low-stock alerts, analytics feedback loop

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Notion API rate limits | Medium | Implement exponential backoff, batch operations |
| Data loss during sync | High | Always backup JSON before sync, add dry-run mode |
| JSON serialization errors (variants) | Medium | Validate JSON parsing, fallback to empty arrays |
| Team member overwrites in Notion | Medium | Document "Last Synced" field, sync often |
| Integration token leaked | High | Use .env, add .env to .gitignore, rotate regularly |

---

## Implementation Phases (Runtime-first)

### Phase 1: Schema + Env (1-2 hours)
- [ ] Create/verify Products + Product Variants databases with required properties
- [ ] Create Notion integration(s) and gather tokens + DB IDs
- [ ] Add env vars to shared scripts and shop projects (local + Vercel)
- [ ] Document schema in `NOTION_SETUP.md`

### Phase 2: Data Seeding (2-3 hours)
- [ ] Implement/refresh `json-to-notion.js` to push existing JSON into Notion
- [ ] Migrate legacy variants → new Variant rows with relations
- [ ] Write verification utility (`node verify-notion-seed.js`) to confirm counts/fields
- [ ] QA a handful of products directly inside Notion

### Phase 3: Runtime Data Layer (3-4 hours)
- [ ] Add `shop/lib/notion-client.ts` (typed wrapper around @notionhq/client)
- [ ] Add caching helper with TTL + manual invalidation hooks
- [ ] Implement data transformers (rich text → markdown, files → URLs, variant sorting)
- [ ] Add `/api/products` and `/api/products/[id]` routes with caching + error handling
- [ ] Provide server utilities (`getProducts`, `getProductById`) + optional client hook (`useProducts`)

### Phase 4: UI + Feature Integration (2-3 hours)
- [ ] Update Product + ProductVariant types and all import sites
- [ ] Refactor `app/shop/page.tsx`, `app/shop/[id]/page.tsx`, cart, checkout to consume runtime data
- [ ] Ensure variant selection updates price + stock messaging
- [ ] Preserve SSR/streaming behavior (fetch data in server component where possible)

### Phase 5: Reliability + Backups (1-2 hours)
- [ ] Implement snapshot command (`npm run snapshot:products`) for offline/backup use
- [ ] Add warning banner + fallback logic if runtime fetch fails (serve snapshot/cache)
- [ ] Add `/api/revalidate/notion-products` protected endpoint for manual cache busting
- [ ] Set up monitoring/logging (e.g., capture Notion API errors in Sentry)

### Phase 6: Documentation & Handoff (1 hour)
- [ ] Update `REGENERATE.md` / `NOTION_SETUP.md` with runtime workflow
- [ ] Record operational runbook (how to revalidate, rotate tokens, debug sync issues)
- [ ] Outline future enhancements (webhooks, auto image sync)
- [ ] Final QA pass + merge

**Total Estimate: ~8-12 hours**

### Optional Automation
- [ ] Implement Notion webhook → Vercel serverless endpoint that calls `revalidateTag`
- [ ] Nightly job that writes JSON snapshots to `shared/data/backups/`

---

## Testing Checklist

Before considering implementation complete:

### Data Seeding
- [ ] Seed 5 products to Notion Products database
- [ ] Seed 10+ variants across those products (2-3 variants per product)
- [ ] Verify Relations link correctly (Product ↔ Variants)
- [ ] Upload test images via Files property
- [ ] Add rich description with formatting (bold, lists, links)

### Notion → Shop Sync
- [ ] `curl /api/products` returns full payload within 1s
- [ ] `curl /api/products/{id}` returns the requested product/variants
- [ ] Logs show cache hits after first request
- [ ] API still works after editing a product in Notion (new data visible within TTL window)
- [ ] Optional: invoke revalidation endpoint and confirm cache clears immediately
- [ ] Snapshot fallback command writes file successfully

### Shop Functionality
- [ ] Run shop dev server, products display on /shop page
- [ ] Product cards show correct title, image, base price
- [ ] Click product → detail page shows variants dropdown
- [ ] Select variant → price updates to variant-specific price
- [ ] Add product (no variant) to cart → correct data in cart
- [ ] Add product (with variant) to cart → shows variant name + price
- [ ] Go to checkout → product info accurate, variant preserved
- [ ] Test category filtering (if implemented)
- [ ] Test status filtering (only Active products visible)

### Edge Cases
- [ ] Product with 0 variants (uses base price, no dropdown)
- [ ] Product with no images (fallback image or placeholder)
- [ ] Variant with no price_cad override (uses base price_cad)
- [ ] Product with Status = Draft (should not appear in shop)
- [ ] Variant with Status = Out of Stock (disabled in dropdown)

---

## Rollback Plan

If Notion integration causes issues:

1. **Immediate:** Revert to last known good `products_manifest.json` from git
2. **Short-term:** Disable Notion sync scripts, continue manual JSON editing
3. **Long-term:** Fix bugs, re-test in separate branch before merging

**Always keep git history clean with atomic commits per phase.**

---

## Future Enhancements

Once basic sync is stable:

1. **Webhooks:** Notion database changes trigger auto-sync to GitHub
2. **Media Management:** Upload images in Notion → auto-copy to shop/public/images
3. **Search Integration:** Sync categories/descriptions to Algolia/Meilisearch
4. **Analytics:** Track which products viewed most, sync back to Notion
5. **Inventory Alerts:** Notion formula for low stock warnings
6. **Multi-language:** Add Title (French), Description (French) columns

---

## Architecture Decisions (FINALIZED)

### 1. Data Flow
**Decision:** Runtime fetch from Notion via Next.js API routes. Notion is the only source of truth; JSON/TS snapshots are optional backups.

### 2. Caching & Revalidation
**Decision:** In-memory cache per deployment with 1–5 minute TTL plus manual revalidation endpoint. Ensures fast responses while keeping data fresh.

### 3. Status Filtering
**Decision:** Filter at query time (Status = Active). Draft/Discontinued remain in Notion but never returned by the public API.

### 4. Variant Modeling
**Decision:** Separate `Product Variants` database with relation; runtime queries fetch variants alongside products. Enables clean per-variant pricing/stock.

### 5. Media Strategy
**Decision:** Prefer Notion Files for authoring convenience, but store/serve canonical images from `public/images` (or CDN). Notion file URLs are downloaded asynchronously to avoid expiring links. Text path fallback remains for scraper compatibility.

### 6. Pricing & Margin
**Decision:** Margin field stored per product in Notion; runtime pricing helper applies margin + variant overrides. `product_overrides.json` is retired.

### 7. Rich Content
**Decision:** Convert Notion rich text to Markdown/MDX at fetch time and render via `react-markdown` (server component). Keeps formatting parity with Notion.

### 8. Categories & Filters
**Decision:** Map Notion select values to string unions; UI reads them directly for filtering/badges. Adding a new category in Notion automatically surfaces in the shop (no code change required).

### 9. Fallback / Offline Mode
**Decision:** Maintain manual snapshot script that writes `products.generated.ts` + JSON backups. Runtime can opt into snapshot via env flag if Notion API is unreachable.

### 10. Security
**Decision:** Notion tokens live only in server-side environments (Vercel encrypted secrets, .env.local). API routes act as the only bridge; browsers never see the token.
