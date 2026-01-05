# Variant Linking & Reference System

## Core Concept

**Active variants read and reference archived variants to populate their option lists.**

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SCRAPER OUTPUT (CSV)                                        │
│  - All clickable options from Taobao                         │
│  - Each combination = separate row                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  CLASSIFICATION SCRIPT (classify_variants.py)                │
│  1. Groups variants by product                               │
│  2. Identifies base models (no suffix)                       │
│  3. Identifies option variants (with suffix)                 │
│  4. Creates linking structure                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE IMPORT (Two-Step Process)                          │
│                                                              │
│  STEP 1: Import ARCHIVED variants first                      │
│  ┌──────────────────────────────────────────────┐           │
│  │ Archived: "1x White - XXS"                   │           │
│  │   - status: "Archived"                       │           │
│  │   - optionValue2: "XXS"                      │           │
│  │   - baseVariantId: [empty initially]         │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
│  STEP 2: Import ACTIVE variants (reads archived)            │
│  ┌──────────────────────────────────────────────┐           │
│  │ Active: "1x White"                           │           │
│  │   - status: "Active"                         │           │
│  │   - Query: Find all archived with            │           │
│  │     optionValue1 = "1x White"                │           │
│  │   - Extract: ["XXS","XS","S","M","L"]        │           │
│  │   - optionValue2: "XXS,XS,S,M,L"             │           │
│  │   - linkedArchivedVariants: [ids...]         │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
│  STEP 3: Update archived variants with base ID              │
│  ┌──────────────────────────────────────────────┐           │
│  │ Update each archived variant:                │           │
│  │   baseVariantId = active_variant_id          │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  KNACK DATABASE (Bidirectional Links)                        │
│                                                              │
│  Active Variant: "1x White"                                  │
│  ├─ status: "Active"                                         │
│  ├─ optionValue2: "XXS,XS,S,M,L" ← Extracted from archived   │
│  └─ linkedArchivedVariants: [id1, id2, id3, id4, id5]        │
│                                                              │
│  Archived Variant: "1x White - XXS"                          │
│  ├─ status: "Archived"                                       │
│  ├─ baseVariantId: active_variant_id ← Links back            │
│  └─ optionValue2: "XXS" ← Single option value                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Reads only Active variants)                       │
│  1. Fetch active variants (status = "Active")                │
│  2. Parse optionValue2: "XXS,XS,S,M,L" → Array               │
│  3. Display as dropdown selections                           │
│  4. User selects option                                      │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  ORDER PLACEMENT                                             │
│  - Stores base variant ID (active)                           │
│  - Stores selected option (e.g., "M")                        │
│  - Backend can query archived variant if needed              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Variants Table

| Field                    | Type     | Description                                    |
|--------------------------|----------|------------------------------------------------|
| `id`                     | String   | Unique variant ID                              |
| `productId`              | String   | Parent product reference                       |
| `variantName`            | String   | Display name                                   |
| `status`                 | String   | "Active" or "Archived"                         |
| `optionType1`            | String   | First option dimension (e.g., "Model")         |
| `optionValue1`           | String   | First option value (e.g., "1x White")          |
| `optionType2`            | String   | Second option dimension                        |
| `optionValue2`           | String   | **Active**: CSV list. **Archived**: Single value |
| `baseVariantId`          | String   | [Archived only] Links to active variant        |
| `linkedArchivedVariants` | Array    | [Active only] Array of archived variant IDs    |
| `priceCNY`               | Number   | Price in Chinese Yuan                          |
| `priceCAD`               | Number   | Price in Canadian Dollars                      |

---

## Example: Arm Sleeve Product

### Step 1: Scraper Output (CSV)

```csv
Product URL,Title,Variant Name,Price CNY,Price CAD
https://taobao.com/123,Arm Sleeve,1x White,100,20.20
https://taobao.com/123,Arm Sleeve,1x White - XXS,100,20.20
https://taobao.com/123,Arm Sleeve,1x White - XS,100,20.20
https://taobao.com/123,Arm Sleeve,1x White - S,100,20.20
https://taobao.com/123,Arm Sleeve,1x White - M,100,20.20
https://taobao.com/123,Arm Sleeve,1x White - L,100,20.20
```

### Step 2: Classification Output

**Archived Variants (Created First):**
```json
[
  {
    "id": "arch_001",
    "variantName": "1x White - XXS",
    "status": "Archived",
    "optionValue1": "1x White",
    "optionType2": "Size",
    "optionValue2": "XXS",
    "baseVariantId": null
  },
  {
    "id": "arch_002",
    "variantName": "1x White - XS",
    "status": "Archived",
    "optionValue1": "1x White",
    "optionType2": "Size",
    "optionValue2": "XS",
    "baseVariantId": null
  },
  ...
]
```

**Active Variant (Reads Archived):**
```json
{
  "id": "var_001",
  "variantName": "1x White",
  "status": "Active",
  "optionValue1": "1x White",
  "optionType2": "Available Sizes",
  "optionValue2": "XXS,XS,S,M,L",  // ← Extracted from archived variants
  "linkedArchivedVariants": ["arch_001", "arch_002", "arch_003", "arch_004", "arch_005"]
}
```

### Step 3: Database After Import

**Active Variant:**
```
ID: var_001
Name: "1x White"
Status: Active
Option Type 2: "Available Sizes"
Option Value 2: "XXS,XS,S,M,L"
Linked Archived: ["arch_001", "arch_002", "arch_003", "arch_004", "arch_005"]
```

**Archived Variants:**
```
ID: arch_001                      ID: arch_002
Name: "1x White - XXS"            Name: "1x White - XS"
Status: Archived                  Status: Archived
Base Variant ID: var_001          Base Variant ID: var_001
Option Value 2: "XXS"             Option Value 2: "XS"
```

### Step 4: Frontend Display

**User sees:**
- Base Model: "1x White" (button/card)
- Dropdown: Shows ["XXS", "XS", "S", "M", "L"] ← Parsed from `optionValue2`

**User selects:**
- Option: "M"

**Added to cart:**
```json
{
  "variantId": "var_001",
  "selectedOption": "M",
  "quantity": 1
}
```

### Step 5: Order Record

**Order item:**
```json
{
  "productId": "prod_123",
  "variantId": "var_001",  // Active variant
  "variantName": "1x White",
  "selectedOption": "M",  // User's choice
  "quantity": 1,
  "price": 20.20
}
```

**Backend can query:**
- Active variant for base pricing/info
- Archived variant "1x White - M" for inventory tracking (if needed)

---

## Benefits of This Architecture

### 1. **Single Source of Truth**
- Archived variants are the authoritative source for available options
- Active variants derive their option lists from archived variants
- Changes to options propagate automatically

### 2. **Easy Management**
- Add new size: Create new archived variant → Active variant auto-updates
- Remove size: Archive the option variant → Regenerate active variant list
- Admin can manage individual options without touching active variants

### 3. **Full Traceability**
- Orders reference both active variant (base model) and selected option
- Backend can look up exact archived variant if needed
- Inventory tracking can be done at option level (archived variant)

### 4. **Flexible Display**
- Frontend only queries active variants (fast, simple)
- Option parsing happens client-side (no complex queries)
- Easy to add new option types (colors, materials, etc.)

### 5. **Data Integrity**
- Bidirectional links prevent orphaned data
- Easy to validate: Does archived variant match active variant's list?
- Referential integrity maintained through ID relationships

---

## Implementation Checklist

### Classification Script (`classify_variants.py`)
- [x] Read scraped CSV
- [x] Identify base models
- [x] Identify option variants
- [x] Extract option values from archived variants
- [x] Generate `linkedArchivedVariants` array for active variants
- [x] Generate `baseVariantId` field for archived variants
- [x] Output JSON with proper structure

### Database Import
- [ ] Import archived variants first (get IDs)
- [ ] Update active variants with archived variant IDs in `linkedArchivedVariants`
- [ ] Update archived variants with active variant ID in `baseVariantId`
- [ ] Verify bidirectional linking

### Frontend
- [x] Query only active variants (status = "Active")
- [x] Parse `optionValue2` CSV string into array
- [x] Display as dropdown when `optionType2` contains "Available"
- [x] Track selected option in state
- [x] Pass `selectedOption` to cart

### Backend API
- [ ] GET `/api/products/:id` returns active variants with option lists
- [ ] POST `/api/checkout` accepts `selectedOption` field
- [ ] Order creation stores both `variantId` and `selectedOption`
- [ ] Optional: Query archived variant for inventory validation

### Admin Panel
- [ ] Display active variants with their option lists
- [ ] Allow editing of `optionValue2` CSV list
- [ ] Show linked archived variants (expandable)
- [ ] Allow adding/removing individual options (updates archived table)

---

## Key Takeaways

1. **Archived variants are NOT just historical records** - they are the active source of truth for available options

2. **Active variants READ from archived variants** - the `optionValue2` CSV list is derived from linked archived variants

3. **Frontend never queries archived variants directly** - it only reads the pre-computed option lists from active variants

4. **Orders store both base variant and selected option** - this allows tracking at the model level (active) and option level (archived)

5. **The system is designed for flexibility** - adding new options is as simple as creating new archived variants

---

## Workflow Summary

```
Scraper → Captures ALL options as individual rows
    ↓
Classify → Groups by base model, extracts options
    ↓
Archived Variants → Created first, store individual options
    ↓
Active Variants → Read archived, extract CSV list
    ↓
Frontend → Reads active, displays options as dropdown
    ↓
Order → Stores active variant ID + selected option
    ↓
Backend → Can query both active (pricing) and archived (inventory)
```

This architecture provides the perfect balance between:
- **Simplicity** (frontend only sees active variants)
- **Flexibility** (easy to add/remove options)
- **Traceability** (full history in archived variants)
- **Performance** (pre-computed option lists, no complex queries)
