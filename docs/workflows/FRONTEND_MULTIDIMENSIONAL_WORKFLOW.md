# Frontend Multi-Dimensional Variant Workflow

## Overview: How the Frontend Displays Multi-Dimensional Variants

The frontend automatically adapts to display **1-dimensional** or **2-dimensional** variant selection based on the data structure from Knack.

---

## Data Flow: Backend → Frontend

```
┌─────────────────────┐
│   Knack Database    │
│   (Variants Table)  │
└──────────┬──────────┘
           │
           │ API Request: GET /api/products/[id]
           ▼
┌─────────────────────────────────────────────┐
│  API Route: /api/products/[id]              │
│  File: shop/app/api/products/[id]/route.ts  │
│                                              │
│  1. Fetch product from Knack                │
│  2. Fetch all variants for product          │
│  3. Map Knack fields → TypeScript types     │
│  4. Return JSON with variants array         │
└──────────┬──────────────────────────────────┘
           │
           │ JSON Response
           ▼
┌─────────────────────────────────────────────┐
│  Product Page: shop/app/shop/[id]/page.tsx  │
│                                              │
│  1. Fetch product data (useEffect)          │
│  2. Pass variants to MultiVariantSelector   │
│  3. Handle variant selection changes        │
│  4. Update displayed price                  │
└──────────┬──────────────────────────────────┘
           │
           │ Variants array prop
           ▼
┌─────────────────────────────────────────────────────┐
│  MultiVariantSelector Component                      │
│  File: shop/components/multi-variant-selector.tsx   │
│                                                       │
│  Analyzes variant structure and auto-selects UI:    │
│  • 1-D: Simple button list                          │
│  • 2-D: Two-tier Taobao-style selector              │
└─────────────────────────────────────────────────────┘
```

---

## Example 1: Two-Dimensional Variants (Size × Style)

### Data in Knack

```json
[
  {
    "id": "variant_1",
    "variantName": "S / A款套装",
    "optionType1": "Size",
    "optionValue1": "S",
    "optionType2": "Style",
    "optionValue2": "A款套装",
    "price_cny": 202,
    "price_cad": 72.99,
    "status": "Active"
  },
  {
    "id": "variant_2",
    "variantName": "S / B款套装",
    "optionType1": "Size",
    "optionValue1": "S",
    "optionType2": "Style",
    "optionValue2": "B款套装",
    "price_cny": 390,
    "price_cad": 129.99,
    "status": "Active"
  },
  {
    "id": "variant_3",
    "variantName": "M / A款套装",
    "optionType1": "Size",
    "optionValue1": "M",
    "optionType2": "Style",
    "optionValue2": "A款套装",
    "price_cny": 202,
    "price_cad": 72.99,
    "status": "Active"
  }
  // ... 100 total variants (5 sizes × 20 styles)
]
```

### Frontend Analysis (Automatic)

```typescript
// MultiVariantSelector.tsx automatically detects structure

// 1. Check if multi-dimensional
const hasStructuredOptions = variants.some(v => 
  v.optionType1 && v.optionValue1
) // → TRUE

// 2. Extract unique dimension 1 values
const option1Values = Array.from(new Set(
  variants.map(v => v.optionValue1).filter(Boolean)
)) 
// → ["S", "M", "L", "XL", "One Size"]

// 3. Extract unique dimension 2 values  
const option2Values = Array.from(new Set(
  variants.map(v => v.optionValue2).filter(Boolean)
))
// → ["A款套装", "B款套装", "C款套装", ..., "快拆D夹套"]

// 4. Get dimension labels
const dim1Label = variants[0].optionType1 // → "Size"
const dim2Label = variants[0].optionType2 // → "Style"
```

### UI Rendered (Two-Tier Selection)

```
┌────────────────────────────────────────────────┐
│ Product: Tactical Belt System                  │
├────────────────────────────────────────────────┤
│                                                 │
│ Size: (Option Type 1)                          │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌──────────┐          │
│ │ S │ │ M │ │ L │ │XL │ │One Size  │          │
│ └───┘ └───┘ └───┘ └───┘ └──────────┘          │
│   ↑ Selected                                   │
│                                                 │
│ Style: (Option Type 2)                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ A款套装   │ │ B款套装   │ │ C款套装   │        │
│ └──────────┘ └──────────┘ └──────────┘        │
│   ↑ Selected                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ D款套装   │ │快拆棍套   │ │手电套    │        │
│ └──────────┘ └──────────┘ └──────────┘        │
│                                                 │
│ ┌────────────────────────────────────────────┐ │
│ │ Selected: S / A款套装                       │ │
│ │ Price: $72.99 CAD                          │ │
│ │ (¥202 + ¥30 shipping = ¥232 × 0.19)       │ │
│ └────────────────────────────────────────────┘ │
│                                                 │
│ [ Add to Cart ]                                │
└────────────────────────────────────────────────┘
```

---

## Example 2: Single-Dimensional Variants (Style Only)

### Data in Knack

```json
[
  {
    "id": "variant_1",
    "variantName": "Standard",
    "optionType1": "Style",
    "optionValue1": "Standard",
    "optionType2": null,
    "optionValue2": null,
    "price_cny": 50,
    "price_cad": 19.99,
    "status": "Active"
  },
  {
    "id": "variant_2",
    "variantName": "Premium",
    "optionType1": "Style",
    "optionValue1": "Premium",
    "optionType2": null,
    "optionValue2": null,
    "price_cny": 75,
    "price_cad": 29.99,
    "status": "Active"
  }
]
```

### Frontend Analysis

```typescript
// 1. Check structure
const hasStructuredOptions = true // Has optionType1

// 2. Check if 2D
const hasDimension2 = variants.some(v => v.optionType2)
// → FALSE (all null)

// 3. Extract only dimension 1
const option1Values = ["Standard", "Premium", "Deluxe"]
```

### UI Rendered (Simple Button List)

```
┌────────────────────────────────────────────────┐
│ Product: T-Shirt                                │
├────────────────────────────────────────────────┤
│                                                 │
│ Style:                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│ │  Standard  │ │  Premium   │ │  Deluxe    │  │
│ └────────────┘ └────────────┘ └────────────┘  │
│       ↑ Selected                                │
│                                                 │
│ Selected: Standard                              │
│ Price: $19.99 CAD                              │
│                                                 │
│ [ Add to Cart ]                                │
└────────────────────────────────────────────────┘
```

---

## Code Deep Dive: MultiVariantSelector Logic

### Step 1: Detect Variant Structure

```typescript
// File: shop/components/multi-variant-selector.tsx

export default function MultiVariantSelector({ variants, ... }) {
  
  // Check if variants have structured options
  const isMultiDimensional = useMemo(() => {
    return variants.some(v => v.optionType1 && v.optionValue1)
  }, [variants])
  
  // If not structured, render simple list
  if (!isMultiDimensional) {
    return <SimpleVariantList variants={variants} />
  }
  
  // Otherwise, analyze dimensions...
}
```

### Step 2: Extract Unique Options

```typescript
// Get all unique values for Option 1
const uniqueOption1Values = useMemo(() => {
  const values = new Set<string>()
  variants.forEach(v => {
    if (v.optionValue1) values.add(v.optionValue1)
  })
  return Array.from(values)
}, [variants])

// Get all unique values for Option 2
const uniqueOption2Values = useMemo(() => {
  const values = new Set<string>()
  variants.forEach(v => {
    if (v.optionValue2) values.add(v.optionValue2)
  })
  return Array.from(values)
}, [variants])

// If Option 2 is empty, it's 1-dimensional
const is2D = uniqueOption2Values.length > 0
```

### Step 3: Find Variant by Selection

```typescript
// When user clicks Size "M" and Style "B款套装"
function findVariantByOptions(
  option1: string,  // "M"
  option2: string   // "B款套装"
): MultiVariant | null {
  
  // Search through all variants
  for (const variant of variants) {
    const matches1 = variant.optionValue1 === option1
    const matches2 = !option2 || variant.optionValue2 === option2
    
    if (matches1 && matches2) {
      return variant // Found: "M / B款套装"
    }
  }
  
  return null
}

// When variant found:
const selectedVariant = findVariantByOptions("M", "B款套装")
onChange(selectedVariant.id)  // Update parent component
// → Price updates to $129.99
```

### Step 4: Render UI

```typescript
return (
  <div className="variant-selector">
    {/* Dimension 1 */}
    <div className="dimension-1">
      <label>{optionType1Label}</label> {/* "Size" */}
      <div className="options">
        {uniqueOption1Values.map(value => (
          <button
            key={value}
            className={selectedOption1 === value ? 'selected' : ''}
            onClick={() => handleOption1Select(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
    
    {/* Dimension 2 (if exists) */}
    {is2D && (
      <div className="dimension-2">
        <label>{optionType2Label}</label> {/* "Style" */}
        <div className="options">
          {uniqueOption2Values.map(value => (
            <button
              key={value}
              className={selectedOption2 === value ? 'selected' : ''}
              onClick={() => handleOption2Select(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    )}
    
    {/* Selected variant display */}
    <div className="selected-info">
      <p>Selected: {selectedVariant.variantName}</p>
      <p className="price">${selectedVariant.price_cad}</p>
    </div>
  </div>
)
```

---

## Real User Flow Example

### User Journey: Buying "M / B款套装"

1. **User lands on product page**
   ```
   GET /api/products/974743803214
   → Returns product with 100 variants
   ```

2. **Page renders with Size selector showing**
   ```
   MultiVariantSelector receives variants array
   → Detects 2D structure (Size × Style)
   → Renders Size buttons: [S] [M] [L] [XL] [One Size]
   → Defaults to first size: "S"
   ```

3. **User clicks "M" size button**
   ```typescript
   handleOption1Select("M")
   → Updates selectedOption1 = "M"
   → Finds first variant with optionValue1 = "M"
   → Updates price to match "M / A款套装" (default style)
   ```

4. **User clicks "B款套装" style button**
   ```typescript
   handleOption2Select("B款套装")
   → Updates selectedOption2 = "B款套装"
   → Calls findVariantByOptions("M", "B款套装")
   → Found: variant_32 with price_cad = 129.99
   → onChange(variant_32.id)
   → Parent component updates:
       • displayPrice = $129.99
       • selectedVariantId = "variant_32"
   ```

5. **User clicks "Add to Cart"**
   ```typescript
   addItem({
     productId: "974743803214",
     productTitle: "Tactical Belt System",
     variantId: "variant_32",
     variantTitle: "M / B款套装",
     regularPrice: 129.99,
     selectedOption: "M / B款套装"  // Stored for display
   })
   → Cart shows: "Tactical Belt System - M / B款套装"
   ```

---

## Key Frontend Features

### 1. **Automatic UI Adaptation**
- Detects 1D vs 2D structure from data
- No manual configuration needed
- Works with any option type names (Size, Color, Style, etc.)

### 2. **Smart Default Selection**
```typescript
// Priority for initial selection:
1. "Single" option (if exists) → preferred for single-item purchases
2. First option in Option Value 1
3. First option in Option Value 2
```

### 3. **Out-of-Stock Filtering**
```typescript
// Scraper already filters out-of-stock variants
// Frontend receives only available variants
const activeVariants = variants.filter(v => v.status === 'Active')
```

### 4. **Price Updates in Real-Time**
```typescript
// Every selection change triggers:
useEffect(() => {
  const variant = findVariantByOptions(
    selectedOption1, 
    selectedOption2
  )
  if (variant) {
    setDisplayPrice(variant.price_cad)
    onChange(variant.id)
  }
}, [selectedOption1, selectedOption2])
```

### 5. **Mobile-Responsive**
```css
/* Buttons wrap on mobile */
.options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Full-width on small screens */
@media (max-width: 640px) {
  .option-button {
    min-width: 100px;
  }
}
```

---

## Database → Frontend Field Mapping

| Knack Field | Field ID | Frontend Property | Used For |
|-------------|----------|-------------------|----------|
| **Product** | field_61 | N/A | Links variants to product |
| **Variant Name** | field_62 | `variantName` | Display in cart/orders |
| **Option Type 1** | field_145 | `optionType1` | Dimension 1 label ("Size") |
| **Option Value 1** | field_146 | `optionValue1` | Button text ("M") |
| **Option Type 2** | field_147 | `optionType2` | Dimension 2 label ("Style") |
| **Option Value 2** | field_148 | `optionValue2` | Button text ("B款套装") |
| **Price CNY** | field_64 | `price_cny` | Display original price |
| **Price CAD** | field_138 | `price_cad` | **Main display price** |
| **Cost CAD** | field_173 | `cost_cad` | Admin views only |
| **Margin Standard** | field_154 | `margin` | Admin views only |
| **Status** | field_67 | `status` | Filter out-of-stock |

---

## Testing the Multi-Dimensional System

### Test Case 1: Verify 2D Selection
```bash
# 1. Run scraper with multi-dimensional product
cd scraper
python3 ai_scraper.py --test

# 2. Check output shows optionType1/2
cat ai_scraper_output/products.csv | grep "Option Type"

# 3. Start dev server
cd ../shop
npm run dev

# 4. Visit product page
open http://localhost:3000/shop/974743803214

# 5. Verify:
# - Two rows of buttons appear
# - First row labeled "Size" (or dimension 1)
# - Second row labeled "Style" (or dimension 2)
# - Clicking different combinations updates price
```

### Test Case 2: Verify 1D Fallback
```bash
# Use a product with only one dimension
# Should show single row of buttons
```

---

## Summary

### ✅ Frontend Already Handles Multi-Dimensional
- `MultiVariantSelector` automatically detects structure
- Adapts UI based on data (1D or 2D)
- No code changes needed for different products

### 🎯 How It Works
1. **Backend**: Scraper extracts → Knack stores with optionType/Value fields
2. **API**: `/api/products/[id]` fetches and maps fields
3. **Frontend**: MultiVariantSelector analyzes and renders appropriate UI
4. **User**: Selects options → Price updates → Adds to cart

### 🔧 Developer Notes
- Add new dimensions: Just populate optionType3/Value3 fields
- Change labels: Stored in optionType1/2 (e.g., "Color", "Material")
- Custom styling: Edit `multi-variant-selector.tsx`
- Pricing logic: All in scraper's `calculate_price_cad()`
