# Multi-Dimensional Variant System

## Overview

This document describes the enhanced variant system that supports Taobao-style multi-dimensional product options (e.g., Color + Size selection).

## Problem Statement

Taobao products typically allow customers to select from multiple option categories:
1. **Color**: Black, Brown, Grey, Camouflage, etc.
2. **Size**: S, M, L, XL, or specific sizes like 85-125cm

When scraped, these combinations become flat variant names like:
- "Black / BK"
- "Coyote Brown / CB" 
- "Wolf Grey / WG - Size M"
- "Black - 85-125cm"

The original flat structure doesn't support the UX where users first pick a color, then pick a size.

## Solution: Structured Option Fields

### Database Schema Changes

New fields added to the **Variants** table (object_7):

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Option Type 1 | field_145 | Text | First option category (e.g., "Color") |
| Option Value 1 | field_146 | Text | First option value (e.g., "Black") |
| Option Type 2 | field_147 | Text | Second option category (e.g., "Size") - nullable |
| Option Value 2 | field_148 | Text | Second option value (e.g., "M") - nullable |

### Data Model

```typescript
interface ProductVariant {
  id: string
  variantName: string        // Display name (kept for backward compat)
  sku?: string
  price_cny: number
  price_cad?: number
  stock?: number
  status: 'Active' | 'Draft' | 'Archived'
  sortOrder?: number
  
  // NEW: Structured option fields
  optionType1?: string       // e.g., "Color", "Style", "Material"
  optionValue1?: string      // e.g., "Black", "Standard", "Nylon"
  optionType2?: string       // e.g., "Size", "Length"
  optionValue2?: string      // e.g., "M", "85-125cm"
}
```

### UI Behavior

When a product has variants with structured options:

1. **Extract unique option groups** from variants
2. **Display cascading selectors**:
   - First selector: All unique optionValue1 values (grouped by optionType1)
   - Second selector: Filtered optionValue2 values based on first selection
3. **Find matching variant** based on both selections
4. **Update price/stock** display based on selected variant

### Example

Product: "Tactical Vest"

Variants in database:
| variantName | optionType1 | optionValue1 | optionType2 | optionValue2 | price_cad |
|-------------|-------------|--------------|-------------|--------------|-----------|
| Black / S | Color | Black | Size | S | 45.00 |
| Black / M | Color | Black | Size | M | 45.00 |
| Black / L | Color | Black | Size | L | 45.00 |
| Grey / S | Color | Grey | Size | S | 45.00 |
| Grey / M | Color | Grey | Size | M | 45.00 |
| Grey / L | Color | Grey | Size | L | 47.00 |

UI shows:
```
Color: [Black ▼] [Grey]
Size:  [S] [M ▼] [L]

Price: $45.00 CAD
```

## Migration Strategy

### Phase 1: Parse Existing Variant Names

Run `parse-variant-options.ts` script to:
1. Analyze all existing variant names
2. Apply pattern matching to extract:
   - Color keywords (Black, Brown, Grey, Green, etc.)
   - Size patterns (S, M, L, XL, numeric ranges)
   - Material/style indicators
3. Update variants with structured fields

### Phase 2: Update Scraper (Optional)

Enhance `scraper.py` to capture option structure during scraping:
- Detect option selectors on Taobao pages
- Store option type/value separately
- Fall back to combined name if structure not detectable

### Phase 3: Admin UI (Future)

Add ability to manually edit option fields in admin panel.

## Common Variant Patterns

### Color Patterns
- Direct colors: Black, White, Grey, Brown, Green, Blue, Red, Pink
- Tactical colors: Coyote Brown (CB), Wolf Grey (WG), Ranger Green (RG)
- Camouflage: MC, CP, MultiCam, BCP (Black Camo Pattern)
- Color codes: BK (Black), DE (Desert), OD (Olive Drab), FG (Foliage Green)

### Size Patterns
- Standard: XXS, XS, S, M, L, XL, XXL, XXXL
- Numeric: 80-110, 110-150, 150-210 (weight ranges in jin)
- Specific: 85-125cm (waist size)
- Count: 1个, 2个, 3个 (quantity)

### Style/Material Patterns
- CNC, Metal, Aluminum, Nylon, Cordura
- Standard, Universal, Upgraded
- Single, Dual, Set

## Files Changed

- `shop/lib/knack-config.ts` - Add new field mappings
- `shop/lib/knack-products.ts` - Update variant mapping
- `shop/lib/notion-client.ts` - Update types
- `shop/components/variant-selector.tsx` - New multi-dimensional UI
- `shared/scripts/parse-variant-options.js` - Migration script

