# Field Inheritance & Product Linking - Implementation Guide

## 🎯 Core Requirements

When archived variants are created, they MUST:
1. **Link to the SAME product** as the active variant (`productId`)
2. **Duplicate ALL pricing fields** from the base variant
3. **Duplicate ALL media fields** from the base variant
4. **Work consistently** across all product types (Arm Sleeve, Knee Pads, Helmet Pouch, etc.)

---

## 📋 Complete Field Mapping

### Product Linking
```
Product: "Extended Honeycomb Sports Arm Sleeve"
  productId: "prod_1234"
  ├─ Active Variant: "1x White"
  │    └─ productId: "prod_1234" ← SAME
  └─ Archived Variants:
       ├─ "1x White - XXS" → productId: "prod_1234" ← SAME
       ├─ "1x White - XS"  → productId: "prod_1234" ← SAME
       ├─ "1x White - S"   → productId: "prod_1234" ← SAME
       └─ "1x White - M"   → productId: "prod_1234" ← SAME
```

**Result:** All variants (active + archived) connect to the same product record.

---

## 💰 Pricing Fields (Inherited from Base Variant)

| Field Name | Description | Example | Duplicated to Archived? |
|------------|-------------|---------|------------------------|
| `price` | Original Taobao price | "100" | ✅ YES |
| `priceCNY` | Price in Chinese Yuan | "100.00" | ✅ YES |
| `priceCAD` | Converted price in CAD | "20.20" | ✅ YES |
| `shippingCAD` | Shipping cost in CAD | "5.00" | ✅ YES |
| `finalCAD` | Total cost (price + shipping) | "25.20" | ✅ YES |
| `priceCADOverride` | Manual price override | "" (empty, can be set later) | ✅ YES |
| `competitorPrice` | Competitor comparison price | "" (empty, can be set later) | ✅ YES |
| `margin` | Profit margin percentage | "" (empty, can be set later) | ✅ YES |

**Example:**
```json
// Base Variant: "1x White"
{
  "priceCNY": "100.00",
  "priceCAD": "20.20",
  "shippingCAD": "5.00",
  "finalCAD": "25.20",
  "margin": "0.35"  // 35% margin
}

// Archived Variant: "1x White - M" (INHERITS ALL)
{
  "priceCNY": "100.00",      // ← Duplicated
  "priceCAD": "20.20",       // ← Duplicated
  "shippingCAD": "5.00",     // ← Duplicated
  "finalCAD": "25.20",       // ← Duplicated
  "margin": "0.35"           // ← Duplicated
}
```

---

## 📸 Media Fields (Inherited from Base Variant)

| Field Name | Description | Example | Duplicated to Archived? |
|------------|-------------|---------|------------------------|
| `mediaFolder` | Folder path for media | "product_1_arm-sleeve" | ✅ YES |
| `mainImages` | Count of main product images | "5" | ✅ YES |
| `detailImages` | Count of detail images | "10" | ✅ YES |
| `catalogueImages` | Count of catalogue images | "3" | ✅ YES |

**Example:**
```json
// Base Variant: "1x White"
{
  "mediaFolder": "product_1_arm-sleeve-white",
  "mainImages": "5",
  "detailImages": "10",
  "catalogueImages": "3"
}

// Archived Variant: "1x White - M" (INHERITS ALL)
{
  "mediaFolder": "product_1_arm-sleeve-white",  // ← Duplicated
  "mainImages": "5",                            // ← Duplicated
  "detailImages": "10",                         // ← Duplicated
  "catalogueImages": "3"                        // ← Duplicated
}
```

---

## 🔤 Identification Fields

| Field Name | Description | Example (Base) | Example (Archived) |
|------------|-------------|----------------|-------------------|
| `sku` | Stock Keeping Unit | "HL-ACC-73-T" | "HL-ACC-73-T-M" (adds option suffix) |
| `variantName` | Display name | "1x White" | "1x White - M" (adds option) |
| `variantNameZH` | Chinese name | "1x白色" | "1x白色 - M" |
| `translatedName` | English translation | "1x White" | "1x White - M" |

---

## 🔗 Linking Fields

| Field Name | Active Variant | Archived Variant |
|------------|----------------|------------------|
| `productId` | ✅ Links to product | ✅ Links to SAME product |
| `baseVariantId` | ❌ null/empty | ✅ Links to active variant |
| `linkedArchivedVariants` | ✅ Array of archived IDs | ❌ null/empty |

---

## 📦 Complete Example: Arm Sleeve Product

### Product Record
```json
{
  "id": "prod_1234",
  "title": "Extended Honeycomb Sports Arm Sleeve",
  "category": "Protective Gear",
  "url": "https://item.taobao.com/item.htm?id=123456"
}
```

### Active Variant (Base Model)
```json
{
  "id": "var_001",
  "productId": "prod_1234",              // ← Links to product
  "variantName": "1x White",
  "variantNameZH": "1件白色",
  "translatedName": "1x White",
  "status": "Active",
  "optionType1": "Model",
  "optionValue1": "1x White",
  "optionType2": "Available Sizes",
  "optionValue2": "XXS,XS,S,M,L",        // ← Extracted from archived
  "linkedArchivedVariants": ["arch_001", "arch_002", "arch_003", "arch_004", "arch_005"],
  
  // Pricing (source of truth for this variant)
  "price": "100",
  "priceCNY": "100.00",
  "priceCAD": "20.20",
  "shippingCAD": "5.00",
  "finalCAD": "25.20",
  "priceCADOverride": "",
  "competitorPrice": "30.00",
  "margin": "0.35",
  
  // Media
  "mediaFolder": "product_1_arm-sleeve-white",
  "mainImages": "5",
  "detailImages": "10",
  "catalogueImages": "3",
  
  // Inventory
  "sku": "ARM-001-1X-WHITE",
  "stock": 100
}
```

### Archived Variant 1 (Option: XXS)
```json
{
  "id": "arch_001",
  "productId": "prod_1234",              // ← SAME product as active
  "variantName": "1x White - XXS",
  "variantNameZH": "1件白色 - XXS",
  "translatedName": "1x White - XXS",
  "status": "Archived",
  "baseVariantId": "var_001",            // ← Links to active variant
  "optionType1": "Model",
  "optionValue1": "1x White",
  "optionType2": "Size",
  "optionValue2": "XXS",                 // ← Single option (source of truth)
  
  // Pricing (DUPLICATED from active variant)
  "price": "100",                        // ← Inherited
  "priceCNY": "100.00",                  // ← Inherited
  "priceCAD": "20.20",                   // ← Inherited
  "shippingCAD": "5.00",                 // ← Inherited
  "finalCAD": "25.20",                   // ← Inherited
  "priceCADOverride": "",                // ← Inherited
  "competitorPrice": "30.00",            // ← Inherited
  "margin": "0.35",                      // ← Inherited
  
  // Media (DUPLICATED from active variant)
  "mediaFolder": "product_1_arm-sleeve-white",  // ← Inherited
  "mainImages": "5",                            // ← Inherited
  "detailImages": "10",                         // ← Inherited
  "catalogueImages": "3",                       // ← Inherited
  
  // Inventory
  "sku": "ARM-001-1X-WHITE-XXS",         // ← SKU with option suffix
  "stock": 0                             // ← Archived = no stock
}
```

### Archived Variant 2 (Option: M)
```json
{
  "id": "arch_004",
  "productId": "prod_1234",              // ← SAME product
  "variantName": "1x White - M",
  "status": "Archived",
  "baseVariantId": "var_001",
  "optionValue2": "M",
  
  // ALL pricing fields duplicated (same as above)
  "priceCNY": "100.00",
  "priceCAD": "20.20",
  "shippingCAD": "5.00",
  "finalCAD": "25.20",
  "competitorPrice": "30.00",
  "margin": "0.35",
  
  // ALL media fields duplicated (same as above)
  "mediaFolder": "product_1_arm-sleeve-white",
  "mainImages": "5",
  "detailImages": "10",
  
  "sku": "ARM-001-1X-WHITE-M",
  "stock": 0
}
```

---

## 🦵 Example: Knee Pads Product (Different Structure)

### Active Variant
```json
{
  "id": "var_101",
  "productId": "prod_5678",
  "variantName": "Black Knee Pads",
  "optionValue2": "S,M,L,XL",
  
  "priceCNY": "85.00",
  "priceCAD": "17.50",
  "margin": "0.40",
  
  "mediaFolder": "product_5_knee-pads-black",
  "mainImages": "4"
}
```

### Archived Variants (SAME inheritance pattern)
```json
[
  {
    "id": "arch_101",
    "productId": "prod_5678",           // ← SAME product
    "variantName": "Black Knee Pads - S",
    "baseVariantId": "var_101",
    "optionValue2": "S",
    "priceCNY": "85.00",                // ← Inherited
    "priceCAD": "17.50",                // ← Inherited
    "margin": "0.40",                   // ← Inherited
    "mediaFolder": "product_5_knee-pads-black",  // ← Inherited
    "sku": "KNEE-001-BLACK-S"
  },
  {
    "id": "arch_102",
    "productId": "prod_5678",           // ← SAME product
    "variantName": "Black Knee Pads - M",
    "baseVariantId": "var_101",
    "optionValue2": "M",
    "priceCNY": "85.00",                // ← Inherited
    "priceCAD": "17.50",                // ← Inherited
    "margin": "0.40",                   // ← Inherited
    "mediaFolder": "product_5_knee-pads-black",  // ← Inherited
    "sku": "KNEE-001-BLACK-M"
  }
]
```

---

## 🎒 Example: Helmet Pouch Product (Color Variants)

### Active Variant
```json
{
  "id": "var_201",
  "productId": "prod_9999",
  "variantName": "Tactical MOLLE Pouch",
  "optionValue2": "Black,Coyote Brown,Ranger Green,MultiCam",
  
  "priceCNY": "45.00",
  "priceCAD": "9.50",
  "shippingCAD": "3.00",
  "finalCAD": "12.50",
  
  "mediaFolder": "product_2_molle-pouch"
}
```

### Archived Variants (Color options)
```json
[
  {
    "id": "arch_201",
    "productId": "prod_9999",           // ← SAME product
    "variantName": "Tactical MOLLE Pouch - Black",
    "optionValue2": "Black",
    "priceCNY": "45.00",                // ← Inherited
    "priceCAD": "9.50",                 // ← Inherited
    "shippingCAD": "3.00",              // ← Inherited
    "finalCAD": "12.50",                // ← Inherited
    "mediaFolder": "product_2_molle-pouch",  // ← Inherited
    "sku": "POUCH-001-BLACK"
  },
  {
    "id": "arch_202",
    "productId": "prod_9999",           // ← SAME product
    "variantName": "Tactical MOLLE Pouch - MultiCam",
    "optionValue2": "MultiCam",
    "priceCNY": "45.00",                // ← Inherited (SAME pricing)
    "priceCAD": "9.50",                 // ← Inherited
    "shippingCAD": "3.00",              // ← Inherited
    "finalCAD": "12.50",                // ← Inherited
    "mediaFolder": "product_2_molle-pouch",  // ← Inherited (SAME media)
    "sku": "POUCH-001-MULTICAM"
  }
]
```

---

## ✅ Validation Checklist

When implementing archived variants, verify:

### Product Linking
- [ ] Active variant has `productId`
- [ ] ALL archived variants have SAME `productId`
- [ ] Query `SELECT * FROM variants WHERE productId = 'prod_1234'` returns both active AND archived

### Pricing Fields
- [ ] Active variant has all pricing fields (priceCNY, priceCAD, shippingCAD, finalCAD, margin, competitorPrice)
- [ ] Each archived variant has IDENTICAL pricing fields
- [ ] No pricing fields are null/missing in archived variants

### Media Fields
- [ ] Active variant has media fields (mediaFolder, mainImages, detailImages, catalogueImages)
- [ ] Each archived variant has IDENTICAL media fields
- [ ] No media fields are null/missing in archived variants

### Linking Fields
- [ ] Archived variant has `baseVariantId` pointing to active variant
- [ ] Active variant has `linkedArchivedVariants` array with archived IDs
- [ ] Bidirectional linking is complete

### SKU Generation
- [ ] Active variant SKU: "ARM-001-1X-WHITE"
- [ ] Archived variant SKU: "ARM-001-1X-WHITE-M" (adds option suffix)
- [ ] SKUs are unique across all variants

### Cross-Product Compatibility
- [ ] Pattern works for Arm Sleeve (size options)
- [ ] Pattern works for Knee Pads (size options)
- [ ] Pattern works for Helmet Pouch (color options)
- [ ] Pattern works for any product with variant options

---

## 🔧 Implementation in classify_variants.py

The script now:
1. Generates consistent `productId` from product URL (hash-based)
2. Assigns SAME `productId` to active and archived variants
3. Duplicates ALL pricing fields from base variant to archived
4. Duplicates ALL media fields from base variant to archived
5. Generates SKU with option suffix for archived variants
6. Creates bidirectional links (baseVariantId ↔ linkedArchivedVariants)

**Usage:**
```bash
python3 classify_variants.py protocol_zero_variants.csv output.json
```

**Output verification:**
```json
{
  "products": [
    {
      "id": "prod_1234",
      "active_variants": [
        {
          "productId": "prod_1234",
          "priceCNY": "100.00",
          "mediaFolder": "product_1_arm-sleeve"
        }
      ],
      "archived_variants": [
        {
          "productId": "prod_1234",      // ← SAME
          "priceCNY": "100.00",          // ← DUPLICATED
          "mediaFolder": "product_1_arm-sleeve"  // ← DUPLICATED
        }
      ]
    }
  ]
}
```

---

## 📊 Database Import Order

1. **Import Products** → Get product IDs
2. **Import Active Variants** → Get active variant IDs
3. **Import Archived Variants** → Link via baseVariantId and productId
4. **Verify Linking** → Check that all variants share same productId

---

## 🎯 Benefits of This Approach

1. **Single Product Connection**: All variants (active + archived) connect to same product
2. **Consistent Pricing**: Archived variants inherit pricing from base variant
3. **Consistent Media**: Archived variants inherit media from base variant
4. **Easy Admin Management**: Change pricing on base variant, bulk update archived
5. **Cross-Product Compatibility**: Works for any product type (sizes, colors, quantities)
6. **Inventory Tracking**: Can track stock at option level (archived variant)
7. **Order Fulfillment**: Know exact option selected, query archived variant for details

---

## 📚 Related Documentation

- **VARIANT_ARCHITECTURE_VISUAL.md** - Visual workflow and data flow
- **VARIANT_LINKING_REFERENCE.md** - Detailed linking architecture
- **COMPLETE_VARIANT_WORKFLOW.md** - End-to-end workflow documentation
- **classify_variants.py** - Implementation script
