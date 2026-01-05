# Knack Database Schema & Field Relationships

## Database Objects Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Products   │────────▶│  Variants   │         │   Orders    │
│  object_6   │ 1:Many  │  object_7   │◀────────│  object_10  │
└─────────────┘         └─────────────┘  Many:1 └─────────────┘
       │                                               │
       │ (Images via Notion)                          │
       │ Linked by ID/SKU                             │
       ▼                                               ▼
┌─────────────┐                              ┌─────────────┐
│   Notion    │                              │    Users    │
│  Products   │                              │  object_8   │
│  Database   │                              └─────────────┘
└─────────────┘
```

---

## 1. Products Object (object_6)

### Existing Fields ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **ID** | `field_45` | Short Text | Primary identifier for URLs |
| **SKU** | `field_46` | Short Text | Product SKU |
| **Title** | `field_47` | Short Text | Product name (English) |
| **Title Original** | `field_48` | Short Text | Product name (Chinese) |
| **Description** | `field_49` | Short Text | Product description |
| **Category** | `field_50` | Multiple Choice | Product category |
| **Status** | `field_51` | Multiple Choice | Active/Draft/Discontinued |
| **Margins** | `field_134` | Number | Product-level margin % |
| **Competitor Products** | `field_135` | Short Text | Competitor links |
| **In-Stock** | `field_54` | Yes/No | Availability flag |
| **URL** | `field_55` | Link | Taobao product URL |
| **Primary Image** | `field_140` | Link | Main product image |
| **Images** | `field_57` | Short Text | Gallery images |
| **Detailed Image** | `field_141` | Link | Long detail image |
| **Created At** | `field_59` | Date/Time | Record creation |
| **Updated At** | `field_60` | Date/Time | Last update |

### Fields NOT Used (Can Ignore)
- `field_46` (SKU) - Not used, ID is primary
- `field_140`, `field_57`, `field_141` - Images now in Notion/public folder

---

## 2. Variants Object (object_7) - **PRIMARY FOCUS**

### Connection Field
| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Product** | `field_61` | Connection | Links to Products (object_6) |

### Core Variant Fields ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Status** | `field_67` | Multiple Choice | Active/Out of Stock |
| **Variant Name** | `field_62` | Short Text | Display name (e.g., "S / Black套装") |
| **Chinese name** | `field_149` | Short Text | Original Chinese name |
| **Chinese Link** | `field_150` | Short Text | Taobao variant link |
| **SKU** | `field_63` | Short Text | Variant SKU |
| **Stock** | `field_66` | Yes/No | In stock flag |
| **Sort Order** | `field_68` | Number | Display order |

### Multi-Dimensional Option Fields ✅

| Field Name | Field ID | Type | Purpose | Example |
|------------|----------|------|---------|---------|
| **Option Type 1** | `field_145` | Short Text | First dimension label | "Color", "Size" |
| **Option Value 1** | `field_146` | Short Text | First dimension value | "Black", "S" |
| **Option Type 2** | `field_147` | Short Text | Second dimension label | "Size", "Style" |
| **Option Value 2** | `field_148` | Short Text | Second dimension value | "M", "套装A" |

### Pricing Fields (CNY) ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Price CNY** | `field_64` | Number | Taobao price (¥) |
| **Shipping CNY** | `field_151` | Number | Shipping allocation (¥30) |

### Pricing Fields (CAD) - **NEW FIELD NEEDED** ⚠️

| Field Name | Field ID | Type | Purpose | Status |
|------------|----------|------|---------|--------|
| **Cost CAD** | `field_173` | Number | Landed cost | ✅ **CREATED** |
| **Price CAD** | `field_138` | Number | Selling price | ✅ Exists |
| **Margin Standard** | `field_154` | Number | Standard margin % | ✅ Exists |
| **Margin Promo** | `field_155` | Number | Promo margin % | ✅ Exists |

### Competitor Research Fields ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Competitor Price CAD** | `field_139` | Number | Canadian competitor pricing |

### Bundle/Add-on Fields ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Is Bundle** | `field_156` | Yes/No | Bundle flag |
| **Bundle Components** | `field_157` | Short Text | What's included |
| **Is Add-on Item** | `field_158` | Yes/No | Can be add-on |
| **Add-on Price CAD** | `field_159` | Number | Discounted price |
| **Add-on Cost CAD** | `field_160` | Number | Add-on cost |
| **Add-on Margin** | `field_161` | Number | Add-on margin % |
| **Min Cart for Add-on** | `field_162` | Number | Unlock threshold |

---

## 3. Orders Object (object_10)

### Existing Fields ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Order Number** | `field_94` | Short Text | Order ID |
| **User ID** | `field_95` | Connection | Links to Users |
| **Items** | `field_96` | Connection | Links to Variants |
| **Subtotal CAD** | `field_97` | Number | Items total |
| **Shipping CAD** | `field_98` | Number | Shipping cost |
| **Total CAD** | `field_99` | Number | Final total |
| **Payment Method** | `field_100` | Short Text | Payment type |
| **Payment Status** | `field_101` | Multiple Choice | Paid/Pending |
| **E-Transfer Reference** | `field_102` | Short Text | Payment ref |
| **Payment Received At** | `field_103` | Date/Time | Payment date |
| **Status** | `field_104` | Multiple Choice | Order status |
| **Shipping Info** | `field_105` | Short Text | Address |
| **Pickup Info** | `field_106` | Short Text | Pickup details |
| **Dropoff Info** | `field_107` | Short Text | Dropoff details |
| **Taobao Info** | `field_108` | Short Text | Purchase info |
| **Status History** | `field_109` | Multiple Choice | Status tracking |
| **Created At** | `field_110` | Date/Time | Order date |
| **Updated At** | `field_111` | Date/Time | Last update |
| **Order Items JSON** | `field_163` | Paragraph Text | Cart JSON |
| **Promo Code** | `field_164` | Short Text | Applied code |
| **Promo Discount CAD** | `field_165` | Number | Discount amount |

---

## 4. Users Object (object_8)

### Existing Fields ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Display Name** | `field_87` | Short Text | Public name |
| **Name** | `field_71` | Person | Full name |
| **User ID** | `field_85` | Short Text | Firebase UID |
| **Role** | `field_90` | Multiple Choice | Customer/Admin |
| **Email** | `field_72` | Email | Email address |
| **Password** | `field_73` | Password | Hashed password |
| **User Status** | `field_74` | Multiple Choice | Active/Inactive |
| **User Roles** | `field_75` | User Roles | Permissions |
| **Phone** | `field_89` | Phone | Contact number |
| **Is Active** | `field_91` | Yes/No | Active flag |
| **Created At** | `field_92` | Date/Time | Registration |
| **Updated At** | `field_93` | Date/Time | Last update |

---

## 5. Promo Codes Object

### Existing Fields ✅

| Field Name | Field ID | Type | Purpose |
|------------|----------|------|---------|
| **Code** | `field_166` | Short Text | Promo code |
| **Discount %** | `field_167` | Number | Discount percent |
| **Usage Count** | `field_168` | Number | Times used |
| **Total Discount Given** | `field_169` | Number | Total $ given |
| **Is Active** | `field_170` | Yes/No | Active flag |
| **Created At** | `field_171` | Date/Time | Creation date |
| **Last Used At** | `field_172` | Date/Time | Last use |

---

## Data Flow: Scraper → Knack → Frontend

### Step 1: Scraper Extracts Multi-Dimensional Variants

```python
# ai_scraper.py extracts:
ScrapedVariant(
    variant_name_zh="S / 黑色套装",
    variant_name_en="S / Black Set",
    option_type_1="Size",      # Dimension 1
    option_value_1="S",        # Value for Dim 1
    option_type_2="Style",     # Dimension 2
    option_value_2="Black Set",# Value for Dim 2
    price_cny=202.0,
    shipping_cny=30.0,
    cost_cad=44.08,           # (202 + 30) × 0.19
    price_cad=72.99,          # Cost / (1 - 0.30)
    margin_standard=30.5,     # Standard margin %
    margin_promo=14.2         # After promoter cuts
)
```

### Step 2: Push to Knack

```python
# knack_integration.py maps to Knack fields:
variant_data = {
    VARIANT_FIELDS['product']: [product_record_id],       # field_61
    VARIANT_FIELDS['variantName']: "S / Black Set",       # field_62
    VARIANT_FIELDS['optionType1']: "Size",                # field_145
    VARIANT_FIELDS['optionValue1']: "S",                  # field_146
    VARIANT_FIELDS['optionType2']: "Style",               # field_147
    VARIANT_FIELDS['optionValue2']: "Black Set",          # field_148
    VARIANT_FIELDS['priceCny']: 202.0,                    # field_64
    VARIANT_FIELDS['shippingCny']: 30.0,                  # field_151
    VARIANT_FIELDS['costCad']: 44.08,                     # field_173 ✅
    VARIANT_FIELDS['priceCad']: 72.99,                    # field_138
    VARIANT_FIELDS['margin']: 0.305,                      # field_154
    VARIANT_FIELDS['marginPromo']: 0.142,                 # field_155
    VARIANT_FIELDS['status']: 'Active',                   # field_67
}
```

### Step 3: Frontend Fetches & Displays

```typescript
// /api/products/[id] fetches from Knack
const variant: ProductVariant = {
    id: "rec123",
    variantName: "S / Black Set",
    optionType1: "Size",
    optionValue1: "S",
    optionType2: "Style",
    optionValue2: "Black Set",
    price_cny: 202,
    shipping_cny: 30,
    cost_cad: 44.08,
    price_cad: 72.99,
    margin: 30.5,
    margin_promo: 14.2,
    status: "Active"
}
```

---

## Multi-Dimensional Variant Examples

### Example 1: Tactical Belt System (5 Sizes × 20 Styles = 100 Variants)

```
Option Type 1: "Size"
Option Value 1: ["One Size", "S", "M", "L", "XL"]

Option Type 2: "Style"
Option Value 2: [
    "A款套装",
    "B款套装", 
    "C款套装",
    "D款套装",
    "快拆带锁棍套",
    "侧开快拆带锁手电套",
    ...20 styles total
]

Result: 5 × 20 = 100 variants
- "S / A款套装" → ¥202
- "M / B款套装" → ¥390
- "L / 快拆带锁棍套" → ¥48
```

### Example 2: T-Shirt (3 Colors × 4 Sizes = 12 Variants)

```
Option Type 1: "Color"
Option Value 1: ["Black", "White", "Gray"]

Option Type 2: "Size"
Option Value 2: ["S", "M", "L", "XL"]

Result: 3 × 4 = 12 variants
- "Black / S" → ¥89
- "Black / M" → ¥89
- "White / L" → ¥89
```

### Example 3: Single Dimension (No Option Type 2)

```
Option Type 1: "Style"
Option Value 1: ["Standard", "Premium", "Deluxe"]

Option Type 2: null
Option Value 2: null

Result: 3 variants
- "Standard" → ¥50
- "Premium" → ¥75
- "Deluxe" → ¥100
```

---

## Required Knack Updates

### ✅ Field Already Created
- **Cost CAD** (`field_173`) - Number field for landed cost

### 🔧 Update Code After Knack Changes

1. **Update `scraper/knack_integration.py`**:
```python
VARIANT_FIELDS = {
    # ... existing fields ...
    'costCad': 'field_173',        # ✅ NEW
    'marginStandard': 'field_154', # ✅ Already exists
    'marginPromo': 'field_155',    # ✅ Already exists
}
```

2. **Update `shop/lib/knack-config.ts`**:
```typescript
variants: {
    // ... existing fields ...
    costCad: 'field_173',          // ✅ NEW
    marginStandard: 'field_154',   // ✅ Already exists
    marginPromo: 'field_155',      // ✅ Already exists
}
```

3. **Update `shop/lib/products.ts` TypeScript type**:
```typescript
export type ProductVariant = {
    // ... existing fields ...
    cost_cad?: number           // ✅ NEW
    margin?: number             // ✅ NEW (from marginStandard)
    margin_promo?: number       // ✅ NEW (from marginPromo)
}
```

---

## Images & Notion Integration

### Current System
- **Primary Storage**: `/public/images/` folder
- **Notion**: Optional backup/sync for images
- **Linking**: Images linked by **Product ID** (`field_45`) or **SKU** (`field_46`)
- **Pattern**: 
  - Main: `/images/{product-id}-Main.jpg`
  - Gallery: `/images/{product-id}-Gallery-1.jpg`, etc.
  - Details: `/images/{product-id}-Details_Long.jpg`

### Image Flow
```
Scraper captures images
    ↓
Saves to shared/media/
    ↓
Synced to shop/public/images/
    ↓
(Optional) Synced to Notion via syncImagesToNotion()
    ↓
Frontend displays from /images/ (fast, no API calls)
```

---

## Summary

### ✅ What's Ready
- Multi-dimensional variant structure (Option Type 1/2, Option Value 1/2)
- Pricing calculation fields (Cost, Margin Standard, Margin Promo)
- Frontend selector component (MultiVariantSelector)
- Knack field mappings in config files

### 🎯 What You Need to Do
1. ✅ **DONE**: Create Cost CAD field (`field_173`) in Knack
2. ⏳ **TODO**: Update `knack_integration.py` with field_173
3. ⏳ **TODO**: Update `knack-config.ts` with field_173
4. ⏳ **TODO**: Test full scraper → Knack → Frontend flow

### 📊 System Capacity
- Supports unlimited products
- Supports unlimited variants per product
- Handles 2-dimensional variant options (e.g., Size × Style)
- Out-of-stock variants automatically filtered from display
