# Variant System Architecture - Visual Summary

## 🎯 Core Principle

**Archived variants are the SOURCE OF TRUTH for available options.**  
**Active variants READ and EXTRACT options from their linked archived variants.**

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TAOBAO SCRAPER                                │
│  Scrapes ALL clickable options → Each becomes a CSV row          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CSV OUTPUT (All Variants)                        │
│                                                                  │
│  1x White                    ← Base model                        │
│  1x White - XXS             ← Option variant                     │
│  1x White - XS              ← Option variant                     │
│  1x White - S               ← Option variant                     │
│  1x White - M               ← Option variant                     │
│  1x White - L               ← Option variant                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLASSIFICATION SCRIPT                               │
│         (classify_variants.py)                                   │
│                                                                  │
│  Step 1: Group by product URL                                    │
│  Step 2: Identify base models (no suffix)                        │
│  Step 3: Identify option variants (with suffix)                  │
│  Step 4: Create archived variants (SOURCE OF TRUTH)              │
│  Step 5: Extract options from archived variants                  │
│  Step 6: Create active variants with extracted option lists      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     JSON OUTPUT                                  │
│                                                                  │
│  {                                                               │
│    "archived_variants": [     ← Created FIRST                    │
│      {                                                           │
│        "id": "arch_001",                                         │
│        "variantName": "1x White - XXS",                          │
│        "status": "Archived",                                     │
│        "baseVariantId": "var_001",  ← Links to active            │
│        "optionValue2": "XXS"        ← SOURCE OF TRUTH            │
│      },                                                          │
│      { "variantName": "1x White - XS", "optionValue2": "XS" },   │
│      { "variantName": "1x White - S", "optionValue2": "S" }      │
│    ],                                                            │
│    "active_variants": [       ← Created SECOND (reads archived)  │
│      {                                                           │
│        "id": "var_001",                                          │
│        "variantName": "1x White",                                │
│        "status": "Active",                                       │
│        "optionValue2": "XXS,XS,S",  ← EXTRACTED from archived    │
│        "linkedArchivedVariants": ["arch_001", "arch_002", ...]   │
│      }                                                           │
│    ]                                                             │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  KNACK DATABASE                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────┐             │
│  │ ARCHIVED VARIANTS (Source of Truth)            │             │
│  ├────────────────────────────────────────────────┤             │
│  │ ID: arch_001                                   │             │
│  │ Name: "1x White - XXS"                         │             │
│  │ Status: Archived                               │             │
│  │ Base Variant ID: var_001  ──────────┐          │             │
│  │ Option Value: "XXS" ← SOURCE        │          │             │
│  └─────────────────────────────────────┼──────────┘             │
│                                        │                        │
│  ┌─────────────────────────────────────┼──────────┐             │
│  │ ACTIVE VARIANTS (Reads from Above)  │          │             │
│  ├─────────────────────────────────────┼──────────┤             │
│  │ ID: var_001  ←──────────────────────┘          │             │
│  │ Name: "1x White"                               │             │
│  │ Status: Active                                 │             │
│  │ Linked Archived: [arch_001, arch_002, ...]     │             │
│  │ Option Value: "XXS,XS,S" ← EXTRACTED           │             │
│  └────────────────────────────────────────────────┘             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND                                    │
│                                                                  │
│  Query: GET /api/products/:id?status=Active                      │
│                                                                  │
│  Receives:                                                       │
│  {                                                               │
│    "id": "var_001",                                              │
│    "name": "1x White",                                           │
│    "optionType2": "Available Sizes",                             │
│    "optionValue2": "XXS,XS,S,M,L"  ← Pre-computed from archived  │
│  }                                                               │
│                                                                  │
│  Frontend parses: "XXS,XS,S,M,L".split(',')                      │
│  Displays: Dropdown with ["XXS", "XS", "S", "M", "L"]            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  USER SELECTION                                  │
│                                                                  │
│  User clicks: "1x White" variant button                          │
│  User selects: "M" from dropdown                                 │
│  Clicks: "Add to Cart"                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CART ITEM                                   │
│                                                                  │
│  {                                                               │
│    "variantId": "var_001",      ← Active variant                 │
│    "variantName": "1x White",                                    │
│    "selectedOption": "M",       ← User's selection               │
│    "quantity": 1,                                                │
│    "price": 20.20                                                │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ORDER RECORD                                 │
│                                                                  │
│  Knack Order Item:                                               │
│  {                                                               │
│    "productId": "prod_123",                                      │
│    "variantId": "var_001",      ← Base model (active)            │
│    "variantName": "1x White",                                    │
│    "selectedOption": "M",       ← Specific option selected       │
│    "quantity": 1,                                                │
│    "price": 20.20                                                │
│  }                                                               │
│                                                                  │
│  Backend can query:                                              │
│  - Active variant "var_001" for pricing/base info                │
│  - Archived variant "1x White - M" for inventory (if needed)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Linking Relationships

### Forward Link (Archived → Active)
```
Archived Variant: "1x White - XXS"
    ├─ baseVariantId: "var_001"
    └─ Links TO active variant
```

### Backward Link (Active → Archived)
```
Active Variant: "1x White"
    ├─ linkedArchivedVariants: ["arch_001", "arch_002", ...]
    └─ Links TO multiple archived variants
```

### Bidirectional Integrity
```
Active ←──────────┬──────────→ Archived
                  │
      baseVariantId = var_001
      linkedArchivedVariants = [arch_001, arch_002, ...]
```

---

## 📋 Database Schema Comparison

### ❌ WRONG: Active variants store options independently

```
Active Variant:
  - optionValue2: "XXS,XS,S"  ← Manually entered, no link to source

Archived Variant:
  - optionValue2: "XXS"  ← Disconnected from active variant
```

**Problem:** Options can become out of sync. No single source of truth.

---

### ✅ CORRECT: Active variants READ from archived variants

```
Archived Variants (Source of Truth):
  arch_001:
    - variantName: "1x White - XXS"
    - optionValue2: "XXS"  ← SOURCE
    - baseVariantId: "var_001"
  
  arch_002:
    - variantName: "1x White - XS"
    - optionValue2: "XS"  ← SOURCE
    - baseVariantId: "var_001"

Active Variant (Derived):
  var_001:
    - variantName: "1x White"
    - optionValue2: "XXS,XS"  ← EXTRACTED from [arch_001, arch_002]
    - linkedArchivedVariants: ["arch_001", "arch_002"]
```

**Benefits:** 
- Single source of truth (archived variants)
- Options always in sync
- Easy to add/remove options (update archived, regenerate active)

---

## 🎬 Complete Workflow Example

### 1️⃣ Scraper Output (CSV)
```csv
Product URL,Variant Name,Price CNY
https://taobao.com/123,1x White,100
https://taobao.com/123,1x White - XXS,100
https://taobao.com/123,1x White - XS,100
https://taobao.com/123,1x White - S,100
```

### 2️⃣ Classification Script Processes
```python
# Step 1: Create archived variants (SOURCE OF TRUTH)
archived_variants = [
    {"id": "arch_001", "variantName": "1x White - XXS", "optionValue2": "XXS", "baseVariantId": "var_001"},
    {"id": "arch_002", "variantName": "1x White - XS", "optionValue2": "XS", "baseVariantId": "var_001"},
    {"id": "arch_003", "variantName": "1x White - S", "optionValue2": "S", "baseVariantId": "var_001"}
]

# Step 2: Extract options from archived variants
options = [v["optionValue2"] for v in archived_variants]  # ["XXS", "XS", "S"]

# Step 3: Create active variant with extracted options
active_variant = {
    "id": "var_001",
    "variantName": "1x White",
    "optionValue2": ",".join(options),  # "XXS,XS,S" ← DERIVED
    "linkedArchivedVariants": ["arch_001", "arch_002", "arch_003"]
}
```

### 3️⃣ Database Import
```sql
-- Import archived variants FIRST
INSERT INTO variants (id, name, status, optionValue2, baseVariantId)
VALUES 
  ('arch_001', '1x White - XXS', 'Archived', 'XXS', 'var_001'),
  ('arch_002', '1x White - XS', 'Archived', 'XS', 'var_001'),
  ('arch_003', '1x White - S', 'Archived', 'S', 'var_001');

-- Import active variant SECOND (reads from archived)
INSERT INTO variants (id, name, status, optionValue2, linkedArchivedVariants)
VALUES ('var_001', '1x White', 'Active', 'XXS,XS,S', ['arch_001', 'arch_002', 'arch_003']);
```

### 4️⃣ Frontend Display
```tsx
// Fetch only active variants
const variant = await getVariant('var_001');  // status = "Active"

// Parse options
const options = variant.optionValue2.split(',');  // ["XXS", "XS", "S"]

// Display dropdown
<select>
  {options.map(opt => <option value={opt}>{opt}</option>)}
</select>
```

### 5️⃣ User Selects Option
```tsx
// User clicks "1x White" button
// User selects "S" from dropdown
// User clicks "Add to Cart"

addToCart({
  variantId: 'var_001',        // Active variant
  selectedOption: 'S',         // User's choice
  quantity: 1
});
```

### 6️⃣ Order Created
```json
{
  "orderId": "order_789",
  "items": [
    {
      "variantId": "var_001",        // Base model (active)
      "variantName": "1x White",
      "selectedOption": "S",         // Specific option selected
      "quantity": 1,
      "price": 20.20
    }
  ]
}
```

### 7️⃣ Backend Processing
```typescript
// Get base variant info (pricing, images, etc.)
const baseVariant = await db.variants.findOne({ id: 'var_001' });

// Optionally get archived variant for inventory tracking
const archivedVariant = await db.variants.findOne({ 
  baseVariantId: 'var_001',
  optionValue2: 'S'  // Find the specific option
});

// Process order with full details
await processOrder({
  baseVariant,
  selectedOption: 'S',
  archivedVariant  // For inventory management
});
```

---

## 🎯 Key Takeaways

1. **Archived variants = Source of truth** for available options
2. **Active variants = Derived data** extracted from archived variants
3. **Frontend only queries active variants** for simplicity
4. **Orders store both** base variant ID + selected option
5. **Backend can query archived variants** when needed for inventory
6. **Bidirectional linking** maintains data integrity
7. **Easy to update**: Modify archived → Regenerate active options list

---

## ✅ Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Scraper captures all options | ✅ Complete | Already working |
| Classification script | ✅ Complete | Creates linking structure |
| Archived variants created | ✅ Complete | With baseVariantId |
| Active variants extract options | ✅ Complete | With linkedArchivedVariants |
| Frontend reads active only | ✅ Complete | Parses optionValue2 |
| Cart tracks selectedOption | ✅ Complete | Passed through checkout |
| Order stores variant + option | ✅ Complete | Full traceability |
| Database import process | 🔧 Pending | Manual import for now |
| Admin panel editing | 🔧 Pending | Edit options via archived variants |

---

## 📚 Reference Documents

- **VARIANT_LINKING_REFERENCE.md** - Detailed explanation of linking architecture
- **COMPLETE_VARIANT_WORKFLOW.md** - Full technical workflow documentation
- **QUICK_START_VARIANT_WORKFLOW.md** - Step-by-step user guide
- **classify_variants.py** - Classification script with linking logic
