# Complete Variant Workflow - End-to-End Implementation

## Overview
This document outlines the complete workflow from Taobao scraping through order fulfillment, with base model variants and option selection.

---

## Workflow Steps

### 1. **Taobao Scraper** (Data Collection)

**Goal:** Scrape ALL clickable options from Taobao product pages

**Process:**
```
Product: Arm Sleeve
  ├─ Click "1x White" → Scrape as variant
  ├─ Click "Size XS" → Scrape as variant (1x White - XS)
  ├─ Click "Size S" → Scrape as variant (1x White - S)
  ├─ Click "Size M" → Scrape as variant (1x White - M)
  ├─ Click "2x White" → Scrape as variant
  ├─ Click "Size XS" → Scrape as variant (2x White - XS)
  └─ ...and so on
```

**Output:** CSV with ALL variants (base + option combinations)

**Current Scraper Status:** ✅ Already captures all clickable options

---

### 2. **Variant Classification** (Data Processing)

**Goal:** Separate base models from option variants AND establish linking relationships

**Classification Logic:**
```python
def classify_variant(variant_name):
    # Base model patterns (no size/color suffix)
    if matches_base_pattern(variant_name):
        return "BASE_MODEL"  # Keep active
    # Option variant patterns (includes size/color)
    if matches_option_pattern(variant_name):
        return "OPTION_VARIANT"  # Archive
```

**Example Classification with Linking:**

1. **Archived Variants Created First** (Source of Truth):
   - "1x Extended Honeycomb Sports Arm Sleeve – White - XXS"
     - Status: `Archived`
     - `baseVariantId`: Links to active "1x White"
     - `optionValue2`: `"XXS"` (individual value)
   - "1x Extended Honeycomb Sports Arm Sleeve – White - XS"
   - "1x Extended Honeycomb Sports Arm Sleeve – White - S"
   - ...etc

2. **Active Variant Reads Archived** (Derives Options):
   - "1x Extended Honeycomb Sports Arm Sleeve – White"
     - Status: `Active`
     - `linkedArchivedVariants`: Array of archived variant IDs
     - `optionValue2`: `"XXS,XS,S,M,L"` (extracted from linked archived variants)

**Key Insight:** Active variants don't store options independently - they READ and EXTRACT from linked archived variants!

**Output:** 
- Archived variants with `baseVariantId` linking (source of truth for options)
- Active variants with `linkedArchivedVariants` and extracted `optionValue2` (derived from archived)

---

### 3. **Knack Database Structure**

**Products Table:**
- `id`, `title`, `description`, `category`, `images`

**Variants Table (with Bidirectional Linking):**
```
┌──────────────┬────────────────────────────┬──────────┬──────────────────┬─────────────────┬────────────────────────┐
│ id           │ title                      │ status   │ baseVariantId    │ optionValue2    │ linkedArchivedVariants │
├──────────────┼────────────────────────────┼──────────┼──────────────────┼─────────────────┼────────────────────────┤
│ var_001      │ 1x White Arm Sleeve        │ Active   │ null             │ XXS,XS,S,M,L    │ [arch_1,arch_2,arch_3] │
│              │                            │          │                  │ (from archived) │                        │
├──────────────┼────────────────────────────┼──────────┼──────────────────┼─────────────────┼────────────────────────┤
│ arch_1       │ 1x White Arm Sleeve - XXS  │ Archived │ var_001 ←────────┤ XXS (source)    │ null                   │
├──────────────┼────────────────────────────┼──────────┼──────────────────┼─────────────────┼────────────────────────┤
│ arch_2       │ 1x White Arm Sleeve - XS   │ Archived │ var_001 ←────────┤ XS (source)     │ null                   │
├──────────────┼────────────────────────────┼──────────┼──────────────────┼─────────────────┼────────────────────────┤
│ arch_3       │ 1x White Arm Sleeve - S    │ Archived │ var_001 ←────────┤ S (source)      │ null                   │
└──────────────┴────────────────────────────┴──────────┴──────────────────┴─────────────────┴────────────────────────┘
                                                         ↑
                                                         └─ Links back to base variant
```

**Key Fields:**
- `status`: "Active" (base models) or "Archived" (option variants - source of truth)
- `baseVariantId`: [Archived only] Links archived variant to its base active variant
- `linkedArchivedVariants`: [Active only] Array of archived variant IDs that it reads from
- `optionType2`: Label for dropdown (e.g., "Available Sizes")
- `optionValue2`: 
  - **For active variants**: Comma-separated list extracted from linked archived variants
  - **For archived variants**: Single option value (SOURCE OF TRUTH)

---

### 4. **Frontend Product Page** (Display & Selection)

**API Endpoint:** `GET /api/products/:id`

**Response Structure:**
```json
{
  "id": "prod_123",
  "title": "Extended Honeycomb Sports Arm Sleeve",
  "variants": [
    {
      "id": "var_001",
      "variantName": "1x White Arm Sleeve",
      "status": "Active",
      "price_cad": 25.00,
      "stock": 50,
      "optionType1": "Quantity/Color",
      "optionValue1": "1x White",
      "optionType2": "Available Sizes",
      "optionValue2": "XXS,XS,S,M,L"
    },
    {
      "id": "var_002",
      "variantName": "2x White Arm Sleeve",
      "status": "Active",
      "price_cad": 45.00,
      "stock": 30,
      "optionType1": "Quantity/Color",
      "optionValue1": "2x White",
      "optionType2": "Available Sizes",
      "optionValue2": "XXS,XS,S,M,L"
    }
  ]
}
```

**Frontend Display:**
```tsx
// /app/shop/[id]/page.tsx
<MultiVariantSelector
  variants={product.variants.filter(v => v.status === 'Active')}
  selectedVariantId={selectedVariantId}
  onChange={setSelectedVariantId}
  onOption2Change={setSelectedOption2}  // Captures "M" from dropdown
  selectedOption2={selectedOption2}
/>
```

**User Experience:**
1. User sees base model buttons: "1x White", "2x White", "1x Black", etc.
2. User selects "1x White"
3. Dropdown appears: "Select Size: XXS, XS, S, M, L"
4. User selects "M"
5. Click "Add to Cart"

---

### 5. **Cart & Checkout** (Order Preparation)

**Cart Item Structure:**
```typescript
{
  productId: "prod_123",
  productTitle: "Extended Honeycomb Sports Arm Sleeve",
  variantId: "var_001",  // Base model: "1x White"
  variantTitle: "1x White Arm Sleeve",
  selectedOption: "M",   // User's size selection
  quantity: 2,
  regularPrice: 25.00
}
```

**Cart Display:**
```
Product: Extended Honeycomb Sports Arm Sleeve
Variant: 1x White Arm Sleeve
Size/Option: M
Quantity: 2
Price: $25.00 each
```

**Checkout API Payload:**
```json
{
  "items": [
    {
      "productId": "prod_123",
      "variantId": "var_001",
      "variantTitle": "1x White Arm Sleeve",
      "selectedSize": "M",
      "quantity": 2,
      "unitPriceCad": 25.00
    }
  ]
}
```

---

### 6. **Order Creation** (Backend Processing)

**API Endpoint:** `POST /api/checkout`

**Knack Order Record:**
```json
{
  "orderId": "ORD-2025-001",
  "customerId": "cust_456",
  "items": [
    {
      "productId": "prod_123",
      "productTitle": "Extended Honeycomb Sports Arm Sleeve",
      "variantId": "var_001",
      "variantTitle": "1x White Arm Sleeve",
      "selectedOption": "Size: M",  // ← Tracked in order
      "quantity": 2,
      "unitPrice": 25.00,
      "totalPrice": 50.00
    }
  ],
  "totalAmount": 50.00,
  "status": "placed"
}
```

**Order Display (Admin/Customer):**
```
Order #ORD-2025-001
─────────────────────
Item: Extended Honeycomb Sports Arm Sleeve
Model: 1x White Arm Sleeve
Option: Size M      ← Clear tracking of selection
Qty: 2 × $25.00 = $50.00
```

---

## Implementation Checklist

### ✅ Already Complete
- [x] Scraper captures all clickable options
- [x] MultiVariantSelector detects comma-separated options
- [x] MultiVariantSelector shows dropdown for option selection
- [x] Product page tracks selectedOption2
- [x] Cart stores selectedOption in CartItem
- [x] Cart displays selectedOption
- [x] Checkout displays selectedOption
- [x] Checkout API sends selectedSize to backend

### 🔧 To Implement

#### **Scraper Enhancement**
- [ ] Add metadata field to identify base vs. option variants
- [ ] Export classification hints in CSV (e.g., `variant_type` column)

#### **Variant Classification Script**
- [ ] Create Python/Node script to process scraped data
- [ ] Identify base model patterns (no size/color suffix)
- [ ] Extract option values from variant names
- [ ] Generate `optionValue2` comma-separated list for base models
- [ ] Set `status` field (Active/Archived) for all variants
- [ ] Upload to Knack with correct structure

#### **API Enhancement**
- [ ] `GET /api/products/:id` - Filter to only return Active variants
- [ ] `GET /api/products/:id/options` - Return archived variants for option parsing (if needed)
- [ ] `POST /api/checkout` - Store `selectedSize` in Knack order items

#### **Admin Panel** (Optional)
- [ ] `/admin/products` - Display base variants with option lists
- [ ] Allow manual editing of `optionValue2` (comma-separated list)
- [ ] Show archived variants for reference

---

## Data Flow Summary

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. TAOBAO SCRAPER                                                │
│    Captures ALL clickable options → CSV with all variants        │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. VARIANT CLASSIFICATION SCRIPT                                 │
│    • Identifies base models (Active)                             │
│    • Archives option variants                                    │
│    • Extracts option values                                      │
│    • Builds comma-separated option lists                         │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. KNACK DATABASE                                                │
│    • Active variants: Base models with optionValue2 CSV list     │
│    • Archived variants: Individual options (for reference)       │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. FRONTEND (/app/shop/[id])                                     │
│    • Fetches active variants only                                │
│    • Parses optionValue2 into dropdown options                   │
│    • User selects base variant + option                          │
│    • Adds to cart with selectedOption                            │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. CART & CHECKOUT                                               │
│    • Displays: Variant + Selected Option                         │
│    • Sends to API: variantId + selectedSize                      │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. ORDER RECORD (KNACK)                                          │
│    • Stores: Product + Variant + Option                          │
│    • Trackable in admin panel and order confirmations            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Create Variant Classification Script**
   - Parse scraped CSV
   - Identify base models
   - Generate option lists
   - Output formatted for Knack import

2. **Update Knack Schema**
   - Add `status` field (Active/Archived)
   - Ensure `optionType2` and `optionValue2` exist
   - Add `selectedOption` to Order Items

3. **Test End-to-End**
   - Scrape → Classify → Import → Display → Order
   - Verify all tracking works correctly

4. **Admin Panel Updates**
   - Display base variants with editable option lists
   - Show archived variants for reference
