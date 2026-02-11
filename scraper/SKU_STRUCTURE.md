# SKU Structure Documentation

## Overview

This document describes the SKU naming convention and relationship management for products and variants in the Protocol Zero system.

## SKU Structure

### Product SKU
**Format:** `{SLUGIFIED-TITLE}`

**Example:**
- Product Title: "Tactical Plate Carrier"
- Product SKU: `TACTICAL-PLATE-CARRIER`

**Rules:**
1. Generated from translated English title
2. All uppercase
3. Spaces replaced with hyphens
4. Special characters removed
5. Multiple consecutive hyphens collapsed to one

### Variant SKU
**Format:** `{PRODUCT-SKU}-{VARIANT-SLUG}`

**Examples:**
| Product | Variant Name | Generated SKU |
|---------|-------------|---------------|
| Tactical Plate Carrier | Black | `TACTICAL-PLATE-CARRIER-BLACK` |
| Tactical Plate Carrier | Black / Large | `TACTICAL-PLATE-CARRIER-BLACK-LARGE` |
| NVG Mount | Aluminum Tan | `NVG-MOUNT-ALUMINUM-TAN` |
| MOLLE Pouch | OD Green / 3 Pack | `MOLLE-POUCH-OD-GREEN-3-PACK` |

**Rules:**
1. Combines product SKU + variant name (slugified)
2. Results in descriptive, human-readable identifier
3. Unique across entire inventory
4. No duplicates possible due to product + variant combination

## Database Fields

### Knack Database

#### Products Object
| Field | Type | Purpose | Editable? |
|-------|------|---------|-----------|
| `ID` (field_45) | Text | Taobao product ID or hash | No |
| `SKU` (field_46) | Text | Human-readable product SKU | No* |
| `Title` (field_47) | Text | Display name (English) | **Yes** |
| `Title Original` (field_48) | Text | Original Chinese title | No |

*SKU is not editable to maintain data integrity, but Title is fully editable

#### Variants Object
| Field | Type | Purpose | Editable? |
|-------|------|---------|-----------|
| `SKU` (field_63) | Text | Unique variant identifier | No* |
| `Variant Name` (field_62) | Text | Display name (editable) | **Yes** |
| `Product` (field_61) | Connection | Links to parent product | Via UI |
| `Option Type 1` (field_145) | Text | E.g., "Color", "Style" | Yes |
| `Option Value 1` (field_146) | Text | E.g., "Black", "Standard" | Yes |
| `Option Type 2` (field_147) | Text | E.g., "Size" (optional) | Yes |
| `Option Value 2` (field_148) | Text | E.g., "Large" (optional) | Yes |

*SKU is the stable identifier used for lookups and relationships

### Notion Database

#### Products Database
- **Product ID**: Taobao product ID (links to Knack)
- **Product SKU**: Human-readable SKU
- **Name**: Product title (display)
- **Hero/Catalogue/Detail Images**: Image URLs

#### Variants Database
- **Variant SKU**: Unique variant identifier (links to Knack)
- **Name**: Variant display name
- **Product**: Relation to product page
- **Hero Image URL**: Variant-specific image

## Relationship Management

### How Relationships Work

1. **Product Identification:**
   - Primary: `product_id` (immutable Taobao ID)
   - Secondary: `product_sku` (human-readable)
   - Display: `title` (editable in Knack)

2. **Variant Identification:**
   - Primary: `sku` (immutable, descriptive)
   - Display: `variant_name` (editable in Knack)
   - Parent Link: `product` connection field (by Knack record ID)

3. **Cross-System Linking:**
   ```
   Knack Product (record_id: "abc123")
       └─ ID: "123456789"
       └─ SKU: "TACTICAL-PLATE-CARRIER"
       
   Notion Product (page_id: "xyz789")
       └─ Product ID: "123456789" ← matches Knack ID
       └─ Product SKU: "TACTICAL-PLATE-CARRIER"
       
   Knack Variant (record_id: "def456")
       └─ SKU: "TACTICAL-PLATE-CARRIER-BLACK"
       └─ Product: ["abc123"] ← connection
       
   Notion Variant (page_id: "uvw101")
       └─ Variant SKU: "TACTICAL-PLATE-CARRIER-BLACK" ← matches Knack SKU
       └─ Product: [relation to "xyz789"]
   ```

### Editing in Knack Portal

**You CAN edit (maintains relationships):**
- ✅ Product Title (display name)
- ✅ Variant Name (display name)
- ✅ Option Types and Values
- ✅ Prices, status, inventory
- ✅ Product connection (reassign variant to different product)

**You CANNOT edit (system-managed):**
- ❌ Product ID (Taobao identifier)
- ❌ Product SKU (generated from title)
- ❌ Variant SKU (generated from product + variant)

**Why this works:**
- Relationships use Knack's internal record IDs (`field_61`)
- SKUs are for human identification and external lookups
- Display names are independent of relationship integrity
- Editing "Variant Name" doesn't break the parent connection

## SKU Generation Functions

### `slugify_sku(text: str) -> str`
Converts text to SKU format:
```python
slugify_sku("Tactical Plate Carrier") 
# → "TACTICAL-PLATE-CARRIER"

slugify_sku("Black / Large")
# → "BLACK-LARGE"
```

### `generate_product_sku(title_en: str, product_id: str) -> str`
Creates product SKU from title:
```python
generate_product_sku("Tactical Plate Carrier", "123456789")
# → "TACTICAL-PLATE-CARRIER"

generate_product_sku("", "123456789")  # Fallback
# → "PRODUCT-123456789"
```

### `generate_variant_sku(product_sku: str, variant_name_en: str, variant_index: int) -> str`
Combines product and variant identifiers:
```python
generate_variant_sku("TACTICAL-PLATE-CARRIER", "Black / Large", 1)
# → "TACTICAL-PLATE-CARRIER-BLACK-LARGE"

generate_variant_sku("MOLLE-POUCH", "", 5)  # Fallback
# → "MOLLE-POUCH-VAR05"
```

## Use Cases

### 1. Finding a Variant
**By SKU (recommended):**
```python
variant = knack_api.find_record(
    VARIANTS_OBJECT_KEY,
    VARIANT_FIELDS['sku'],
    'TACTICAL-PLATE-CARRIER-BLACK-LARGE'
)
```

**By Display Name (not recommended - may have duplicates):**
```python
variant = knack_api.find_record(
    VARIANTS_OBJECT_KEY,
    VARIANT_FIELDS['variantName'],
    'Black / Large'  # ⚠️ Could match multiple products!
)
```

### 2. Updating Display Names
```javascript
// In Knack portal, you can freely edit:
Variant Name: "Black / Large" → "Matte Black / XL"

// Relationship stays intact because it uses:
- Internal record ID (not the name)
- SKU remains: "TACTICAL-PLATE-CARRIER-BLACK-LARGE"
```

### 3. Inventory Management
```python
# SKU tells you exactly what product and variant
sku = "TACTICAL-PLATE-CARRIER-BLACK-LARGE"

# You immediately know:
# - Product: Tactical Plate Carrier
# - Variant: Black / Large
# - No need to look up parent product first
```

## Benefits

1. **Human Readable**: SKUs describe what they are
2. **No Duplicates**: Product + variant combination ensures uniqueness
3. **Easy Inventory**: Scan SKU and know exactly what item it is
4. **Flexible Display**: Edit names in Knack without breaking relationships
5. **Cross-System Sync**: SKU matches across Knack, Notion, and shop
6. **Order Management**: SKUs appear on invoices, packing slips, etc.

## Migration Notes

If migrating from old `sku_key` format (e.g., "variant_1"):

1. Old variants will need SKU regeneration
2. Run migration script to generate descriptive SKUs
3. Update Notion database with new SKU field
4. Shop frontend should use SKU for product lookups
5. Display names remain fully editable in Knack portal
