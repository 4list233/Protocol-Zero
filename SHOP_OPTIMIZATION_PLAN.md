# Shop Optimization Plan

## Analysis Date: November 18, 2025

---

## 1. Current Architecture Issues

### 1.1 Data Flow Problems
- **Fragmented Data Sources**: Product data exists in multiple places:
  - `scraper/protocol_zero_variants.csv` (raw scrape output)
  - `shared/data/products_manifest.json` (intermediate format)
  - `shop/lib/products.generated.ts` (shop consumption layer)
  - `shop/lib/products.ts` (base products with hardcoded samples)
  
- **Translation Inconsistency**: 
  - Original Chinese titles stored but never displayed
  - `title` vs `title_en` confusion in different components
  - Some components check `title_en || title`, others just use `title`

- **Price Calculation Scattered**:
  - Base CNY price in CSV
  - CAD conversion in scraper
  - Margin applied in `getDisplayPrice()` helper
  - Variant-specific pricing not consistently applied

- **Image Path Duplication**:
  - Paths hardcoded in manifest exporter
  - Repeated logic in sync-media.js
  - Different naming conventions (product_1_wosport vs wosport-l4g24--)

### 1.2 Redundant Code Patterns

#### Product Display (repeated 3+ times):
```tsx
// shop/page.tsx
<h3>{product.title_en || product.title}</h3>
<span>${getDisplayPrice(product).toFixed(2)}</span>

// shop/[id]/page.tsx  
<h1>{product.title_en || product.title}</h1>
<span>${getDisplayPrice(product, selectedOption).toFixed(2)}</span>

// cart/page.tsx
<h3>{item.product.title_en || item.product.title}</h3>
<p>${getDisplayPrice(item.product).toFixed(2)} CAD each</p>
```

#### Image Fallback Logic (repeated):
```tsx
// Multiple places:
src={product.primaryImage || product.images[0]}
src={item.product.primaryImage || item.product.images?.[0] || '/images/placeholder.png'}
```

### 1.3 Hardcoded Values

**"When We Play" Schedule** - Scattered across `app/page.tsx`:
- Hours: `"12PM-10PM"`, `"12PM-11PM"`, `"10AM-12AM"`, `"10AM-11PM"` (lines 228-235)
- Pricing: `$50`, `$25`, late-night specials (lines 47-61)
- Special events: "50% OFF", "SPEEDSOFT", "FREE RENTAL" (lines 63-76)
- Day mappings: Mon=0, Sun=6 adjustment logic (line 226)

**Base Products** - `shop/lib/products.ts` (lines 28-73):
- 4 hardcoded products (MOLLE PDA, M67 grenades, M26)
- Never used if `generatedProducts` exists
- Duplicates data structure

---

## 2. Proposed Unified Architecture

### 2.1 Single Source of Truth: `shared/data/`

```
shared/
  data/
    products_manifest.json          # Master product catalog
    product_overrides.json          # Per-product manual adjustments (margin, etc)
    schedule_config.json            # NEW: When We Play schedule
    pricing_rules.json              # NEW: Base prices, late-night, discounts
```

### 2.2 Data Schema Standardization

#### Product Schema (Canonical):
```typescript
{
  id: string                 // Unique slug
  sku: string                // Auto-generated
  title: string              // ALWAYS translated English (remove title_en)
  title_original?: string    // Chinese (never displayed, archival only)
  price_cad: number          // Base price before margin
  margin: number             // Per-item markup (from overrides or default 0.35)
  primaryImage: string       // Hero image path
  images: string[]           // Gallery images
  detailLongImage?: string   // Stitched detail scroll image
  url: string                // Taobao source URL
  category?: string
  description?: string
  variants?: Array<{
    option: string
    price_cny: number
    price_cad: number
  }>
}
```

**Changes**:
- Remove `title_en` — `title` is ALWAYS the English translation
- Remove `title_original` from generated output (keep in manifest for reference only)
- `margin` always present (default or override)

#### Schedule Schema (NEW):
```json
{
  "weekdays": {
    "0": {  // Monday
      "name": "Monday",
      "hours": "12PM-10PM",
      "basePrice": 50,
      "discount": 0.5,
      "discountLabel": "50% OFF",
      "lateNightPrice": null
    },
    "1": { "name": "Tuesday", ... },
    "2": {  // Wednesday
      "name": "Wednesday",
      "hours": "12PM-10PM",
      "basePrice": 50,
      "discount": null,
      "discountLabel": "SPEEDSOFT",
      "lateNightPrice": 25,
      "lateNightHours": "7PM-10PM"
    },
    ...
  }
}
```

---

## 3. Refactoring Plan

### Phase 1: Consolidate Data Sources ✓

- [x] Scraper exports to `shared/data/products_manifest.json`
- [x] Generator reads manifest → `products.generated.ts`
- [x] **Remove base products fallback** in `shop/lib/products.ts`
- [x] **Simplify Product type** - single `title` field only

### Phase 2: Centralize Display Logic

#### 2A. Create Display Helpers (`shop/lib/display-helpers.ts`):
```typescript
export function getProductTitle(product: Product): string {
  return product.title  // Always translated
}

export function getProductImage(product: Product): string {
  return product.primaryImage || product.images?.[0] || '/images/placeholder.png'
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function getProductPrice(product: Product, variantOption?: string): number {
  // All pricing logic in ONE place
  let base = product.price_cad
  if (variantOption && product.variants) {
    const variant = product.variants.find(v => v.option === variantOption)
    if (variant?.price_cad > 0) base = variant.price_cad
  }
  const margin = product.margin ?? 0.35
  return Math.round(base * (1 + margin) * 100) / 100
}
```

#### 2B. Replace all inline logic with helpers:
- [x] `shop/page.tsx` - product cards
- [x] `shop/[id]/page.tsx` - detail page
- [x] `cart/page.tsx` - cart items
- [x] `components/product-card.tsx`

### Phase 3: Extract Schedule Configuration

#### 3A. Create `shared/data/schedule_config.json`:
```json
{
  "venue": {
    "name": "Protocol Zero",
    "timezone": "America/Toronto"
  },
  "weekSchedule": [
    {
      "dayIndex": 0,
      "name": "Monday",
      "hours": { "open": "12:00", "close": "22:00" },
      "pricing": {
        "base": 50,
        "discounted": 25,
        "discountType": "50% OFF"
      }
    },
    {
      "dayIndex": 1,
      "name": "Tuesday",
      "hours": { "open": "12:00", "close": "22:00" },
      "pricing": {
        "base": 50,
        "discounted": 25,
        "discountType": "50% OFF"
      }
    },
    {
      "dayIndex": 2,
      "name": "Wednesday",
      "hours": { "open": "12:00", "close": "22:00" },
      "pricing": {
        "base": 50,
        "special": "SPEEDSOFT",
        "lateNight": { "hours": "19:00-22:00", "price": 25 }
      }
    },
    {
      "dayIndex": 3,
      "name": "Thursday",
      "hours": { "open": "12:00", "close": "22:00" },
      "pricing": {
        "base": 50,
        "special": "FREE RENTAL",
        "lateNight": { "hours": "19:00-22:00", "price": 25 }
      }
    },
    {
      "dayIndex": 4,
      "name": "Friday",
      "hours": { "open": "12:00", "close": "23:00" },
      "pricing": {
        "base": 50,
        "lateNight": { "hours": "20:00-23:00", "price": 25 }
      }
    },
    {
      "dayIndex": 5,
      "name": "Saturday",
      "hours": { "open": "10:00", "close": "24:00" },
      "pricing": {
        "base": 50,
        "lateNight": { "hours": "21:00-24:00", "price": 25 }
      }
    },
    {
      "dayIndex": 6,
      "name": "Sunday",
      "hours": { "open": "10:00", "close": "23:00" },
      "pricing": {
        "base": 50,
        "lateNight": { "hours": "20:00-23:00", "price": 25 }
      }
    }
  ]
}
```

#### 3B. Create Schedule Hooks (`shop/lib/schedule.ts`):
```typescript
import scheduleConfig from '@/shared/data/schedule_config.json'

export type DaySchedule = {
  dayIndex: number
  name: string
  hours: string
  basePrice: number
  discountedPrice?: number
  discountLabel?: string
  lateNightPrice?: number
  lateNightHours?: string
}

export function getWeekSchedule(): DaySchedule[] {
  return scheduleConfig.weekSchedule.map(day => ({
    dayIndex: day.dayIndex,
    name: day.name,
    hours: formatHours(day.hours),
    basePrice: day.pricing.base,
    discountedPrice: day.pricing.discounted,
    discountLabel: day.pricing.discountType || day.pricing.special,
    lateNightPrice: day.pricing.lateNight?.price,
    lateNightHours: day.pricing.lateNight?.hours
  }))
}

function formatHours(hours: { open: string, close: string }): string {
  // Convert 24h to 12h format with AM/PM
  return `${to12Hour(hours.open)}-${to12Hour(hours.close)}`
}

function to12Hour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (h === 0) return `12:${m.toString().padStart(2,'0')}AM`
  if (h < 12) return `${h}:${m.toString().padStart(2,'0')}AM`
  if (h === 12) return `12:${m.toString().padStart(2,'0')}PM`
  return `${h-12}:${m.toString().padStart(2,'0')}PM`
}
```

#### 3C. Refactor `app/page.tsx`:
Replace 300+ lines of schedule logic with:
```tsx
import { getWeekSchedule } from '@/lib/schedule'

const schedule = getWeekSchedule()

{schedule.map((day, index) => (
  <DayCard key={day.dayIndex} day={day} index={index} />
))}
```

### Phase 4: Component Extraction

#### Create Reusable Components:
- [x] `components/product-card.tsx` - unified product display
- [x] `components/schedule-day-card.tsx` - day schedule display
- [ ] `components/price-display.tsx` - consistent price formatting

---

## 4. Migration Steps (Prioritized)

### Step 1: Schema Cleanup (IMMEDIATE)
1. **Update manifest exporter** (`shared/scripts/export_manifest.py`):
   - Set `title` to translated version
   - Remove `title_en` from output
   - Keep `title_original` for reference only
   
2. **Update Product type** (`shop/lib/products.ts`):
   ```typescript
   export type Product = {
     id: string
     sku: string
     title: string              // ONLY translated title
     price_cad: number
     margin: number             // Always present
     primaryImage: string
     images: string[]
     detailLongImage?: string
     url: string
     category?: string
     description?: string
     variants?: Variant[]
   }
   ```

3. **Update all components** to use `product.title` directly (no fallback checks)

### Step 2: Pricing Unification (HIGH PRIORITY)
1. Rename `getDisplayPrice` → `getProductPrice` for clarity
2. Ensure ALL components import and use `getProductPrice()`
3. Remove any inline `product.price_cad` references
4. Verify cart total calculation uses unified helper

### Step 3: Schedule Extraction (MEDIUM PRIORITY)
1. [x] Create `shared/data/schedule_config.json`
2. [x] Create `shop/lib/schedule.ts` helper
3. [x] Refactor `app/page.tsx` to use helper
4. [x] Extract `<DayCard>` component

### Step 4: Image Handling (MEDIUM PRIORITY)
1. Create `getProductImage()` helper with fallback logic
2. Replace all inline image path logic
3. Standardize media folder naming in scraper

### Step 5: Remove Dead Code (LOW PRIORITY)
1. Delete `baseProducts` array from `products.ts`
2. Remove unused CSV direct reads
3. Clean up duplicate type definitions

---

## 5. File Structure After Refactor

```
shop/
  lib/
    products.ts              # Type definitions + import generated
    products.generated.ts    # Auto-generated from manifest
    display-helpers.ts       # NEW: getProductTitle, getProductImage, formatPrice
    pricing.ts               # NEW: getProductPrice (moved from products.ts)
    schedule.ts              # NEW: getWeekSchedule, schedule helpers
    cart.ts                  # Uses pricing.ts helpers
    
  components/
    product-card.tsx         # NEW: Reusable product display
    schedule-day-card.tsx    # NEW: Extracted from page.tsx
    price-display.tsx        # NEW: Consistent formatting
    
  app/
    page.tsx                 # Simplified with schedule helpers
    shop/
      page.tsx               # Uses ProductCard component
      [id]/page.tsx          # Uses display helpers
    cart/
      page.tsx               # Uses display helpers

shared/
  data/
    products_manifest.json   # Master catalog (title = translated)
    product_overrides.json   # Per-item adjustments
    schedule_config.json     # NEW: When We Play config
    
  scripts/
    export_manifest.py       # Outputs clean schema
    generate-products.js     # Applies overrides + generates TS
    sync-media.js            # Copies images to shop
```

---

## 6. Testing Checklist

After each phase:
- [ ] Shop listing shows correct translated titles
- [ ] Product detail page displays correct price with margin
- [ ] Cart shows matching prices
- [ ] Variant selection updates price correctly
- [ ] Schedule displays correct hours/pricing
- [ ] Images load with proper fallbacks
- [ ] No console errors
- [ ] TypeScript compiles without errors

---

## 7. Future Enhancements

### Admin Panel Integration
- Edit margins via UI (update `product_overrides.json`)
- Edit schedule via UI (update `schedule_config.json`)
- Bulk price adjustments
- Inventory management

### API Layer
- `GET /api/products` - serve from manifest
- `GET /api/schedule` - serve from config
- `POST /api/admin/products` - update overrides
- Webhook to regenerate products.generated.ts

### Analytics
- Track most viewed products
- Price sensitivity analysis
- Schedule attendance correlation

---

## 8. Immediate Action Items

**TODAY**:
1. ✅ Document current architecture issues
2. ✅ Update manifest schema (remove title_en confusion)
3. ✅ Create display-helpers.ts with unified functions
4. ✅ Update shop/page.tsx to use helpers

**THIS WEEK**:
1. ✅ Create schedule_config.json
2. ✅ Create schedule.ts helpers
3. ✅ Refactor app/page.tsx schedule section
4. ✅ Extract reusable components

**NEXT WEEK**:
1. Remove dead code (baseProducts, unused imports)
2. Add admin UI for overrides
3. Performance optimization
4. Documentation update

---

## Notes

- All changes should maintain backward compatibility during migration
- Test each phase independently before moving to next
- Keep git commits atomic (one phase per commit)
- Update TODO.md as tasks complete
