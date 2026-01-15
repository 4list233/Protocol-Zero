# 🎯 Scraper & Knack Database Requirements
## Complete Data Flow Specification for Enhanced Shop

**Created:** January 13, 2026  
**Purpose:** Define all required data, linkages, and pricing for the enhanced shop with image filtering

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Data Flow Diagram](#data-flow-diagram)
3. [Scraper Output Requirements](#scraper-output-requirements)
4. [Image Management & Linking](#image-management--linking)
5. [Knack Database Schema](#knack-database-schema)
6. [Variant & Option Structure](#variant--option-structure)
7. [Pricing Calculations](#pricing-calculations)
8. [Implementation Checklist](#implementation-checklist)

---

## 🔄 Overview

### Current State
- ✅ Enhanced shop UI with image filtering framework
- ✅ Multi-dimensional variant selector (Style × Size)
- ✅ Knack backend integration
- ⚠️ **Missing**: Image-to-variant binding in database

### Goal
Create a complete pipeline:
```
Taobao → Scraper → Knack → Frontend
   ↓         ↓        ↓        ↓
Images → Binding → Storage → Display
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: TAOBAO SCRAPING                                    │
│  ═══════════════════════                                    │
│  ┌─────────────┐                                            │
│  │  Taobao     │                                            │
│  │  Product    │                                            │
│  │  Page       │                                            │
│  └──────┬──────┘                                            │
│         │                                                    │
│         ├─► Product Title (CN + EN)                         │
│         ├─► Product URL                                     │
│         ├─► Category                                        │
│         ├─► Images (Hero + Detail)                          │
│         ├─► Variants with prices                            │
│         └─► Variant images (by color/style)                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: SCRAPER PROCESSING                                 │
│  ═══════════════════════                                    │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Gemini AI  │───▶│ Variant      │───▶│  Pricing     │  │
│  │  Translation│    │  Extraction  │    │  Calculator  │  │
│  └─────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         │                   │                    │          │
│  • CN → EN            • Parse options     • Cost CAD       │
│  • Variant names      • Identify types    • Price CAD      │
│  • Clean labels       • Map values        • Margins        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: IMAGE PROCESSING                                   │
│  ═══════════════════════                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Download    │───▶│  Organize    │───▶│  Link to     │  │
│  │  Images      │    │  by Variant  │    │  Variants    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│  • Hero images        • Group by style    • Bind images    │
│  • Detail images      • Name by ID        • Store metadata │
│  • Variant images     • Save to /public   • Create JSON    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: KNACK DATABASE                                     │
│  ═══════════════════════                                    │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Products   │────────▶│   Variants   │                 │
│  │   object_6   │  1:Many │   object_7   │                 │
│  └──────────────┘         └──────────────┘                 │
│         │                         │                         │
│  • ID (URL key)            • Option Type 1                  │
│  • Title (EN)              • Option Value 1                 │
│  • Category                • Option Type 2                  │
│  • Images metadata         • Option Value 2                 │
│                            • Price CNY/CAD                  │
│                            • Cost CAD                       │
│                            • Margins                        │
│                            • Image IDs array                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: FRONTEND DISPLAY                                   │
│  ═══════════════════════                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Fetch      │───▶│   Filter     │───▶│   Display    │  │
│  │   Product    │    │   by Style   │    │   Gallery    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│  • Load from API      • Select variant   • Show images     │
│  • Get variants       • Get image IDs    • Update price    │
│  • Get images         • Filter gallery   • Update stock    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Scraper Output Requirements

### 1. **Product-Level Data**

```python
@dataclass
class ScrapedProduct:
    # Identifiers
    url: str                    # Taobao URL
    product_id: str             # Generated ID (hash or clean URL)
    
    # Basic Info
    title_zh: str               # Original Chinese title
    title_en: str               # Translated English title
    category: str               # Product category (English)
    description_zh: str         # Original description
    description_en: str         # Translated description
    
    # Images (NEW: Enhanced Structure)
    images: List[ProductImage]  # All images with metadata
    hero_images: List[str]      # Up to 7 main gallery images
    detail_image: str           # Long detail scroll image
    
    # Variants
    variants: List[ScrapedVariant]  # All variant combinations
    
    # Metadata
    timestamp: str              # Scrape timestamp
    source_language: str        # "zh-CN"
```

### 2. **Image Data Structure** (NEW!)

```python
@dataclass
class ProductImage:
    """
    Enhanced image structure with variant binding
    """
    # Core fields
    id: str                     # Unique image ID (hash or sequential)
    url: str                    # Original Taobao URL
    local_path: str             # Saved path in /public/images/
    
    # Classification
    role: str                   # "hero" | "detail" | "variant"
    order_index: int            # Display order
    
    # Variant Binding (KEY FEATURE!)
    variant_binding: Optional[Dict] = None  # Links image to variant
    
    # Example variant_binding:
    # {
    #     "primary_option_id": "Black",    # Links to optionValue1
    #     "secondary_option_id": None       # Optional: links to optionValue2
    # }
```

**Naming Convention:**
```
Hero images:    {product-id}-hero-01.jpg ... {product-id}-hero-07.jpg
Detail image:   {product-id}-details.jpg
Variant images: {product-id}-{style}-{index}.jpg
                Example: "TB123-Black-01.jpg", "TB123-Black-02.jpg"
```

### 3. **Variant Data**

```python
@dataclass
class ScrapedVariant:
    # Display Names
    variant_name_zh: str        # Original: "S / 黑色套装"
    variant_name_en: str        # Translated: "S / Black Set"
    
    # Multi-Dimensional Options (CRITICAL!)
    option_type_1: str          # "Color" | "Style" | "Size"
    option_value_1: str         # "Black" | "Standard" | "S"
    option_type_2: Optional[str]    # "Size" | "Style" | None
    option_value_2: Optional[str]   # "M" | "套装A" | None
    
    # Pricing (CNY)
    price_cny: float            # Taobao price (¥)
    shipping_cny: float         # Allocated shipping (¥30)
    
    # Pricing (CAD) - Calculated
    cost_cad: float             # (Price + Shipping) × 0.19
    price_cad: float            # Retail price
    margin_standard: float      # Standard margin % (30.5)
    margin_promo: float         # Promo margin % (14.2)
    
    # Stock
    in_stock: bool              # Availability
    stock_quantity: Optional[int]   # Quantity if known
    
    # Images (NEW!)
    image_ids: List[str]        # List of image IDs for this variant
    
    # Metadata
    sku_key: str                # Taobao SKU identifier
```

### 4. **Example Scraped Data**

```python
# Example: Tactical Jacket with 3 colors × 4 sizes = 12 variants
ScrapedProduct(
    product_id="TB123456789",
    title_en="Tactical Combat Jacket",
    title_zh="战术作战夹克",
    category="Tactical Clothing",
    
    # Images with variant binding
    images=[
        ProductImage(
            id="img_001",
            url="https://img.alicdn.com/...",
            local_path="/images/TB123456789-hero-01.jpg",
            role="hero",
            order_index=0,
            variant_binding=None  # Generic image, shows for all variants
        ),
        ProductImage(
            id="img_002",
            url="https://img.alicdn.com/...",
            local_path="/images/TB123456789-Black-01.jpg",
            role="variant",
            order_index=1,
            variant_binding={
                "primary_option_id": "Black",  # Shows only for Black variants
                "secondary_option_id": None     # Shows for all sizes
            }
        ),
        ProductImage(
            id="img_003",
            url="https://img.alicdn.com/...",
            local_path="/images/TB123456789-OliveGreen-01.jpg",
            role="variant",
            order_index=2,
            variant_binding={
                "primary_option_id": "Olive Green",
                "secondary_option_id": None
            }
        ),
    ],
    
    variants=[
        ScrapedVariant(
            variant_name_en="Black / S",
            variant_name_zh="黑色 / S",
            option_type_1="Color",
            option_value_1="Black",
            option_type_2="Size",
            option_value_2="S",
            price_cny=202.0,
            shipping_cny=30.0,
            cost_cad=44.08,         # (202 + 30) × 0.19
            price_cad=72.99,        # Calculated
            margin_standard=30.5,
            margin_promo=14.2,
            in_stock=True,
            image_ids=["img_001", "img_002"],  # Generic + Black-specific
            sku_key="3216407936318279"
        ),
        # ... 11 more variants
    ]
)
```

---

## 🖼️ Image Management & Linking

### Image Flow

```
SCRAPING PHASE:
1. Detect all images on Taobao page
2. Download images
3. Identify which images belong to which variant:
   - If image appears in color selector → bind to that color
   - If image is in main gallery → mark as generic (no binding)
   - Detail images → always generic

STORAGE PHASE:
4. Save to /public/images/ with naming convention
5. Generate metadata JSON with variant bindings

KNACK PHASE:
6. Store image metadata in Variants table
7. Store as JSON array in new field: "Image IDs" (field_174?)

FRONTEND PHASE:
8. Fetch variant data with image_ids
9. Filter gallery based on selected variant
10. Display variant-specific images first, then generic
```

### Required Knack Field: **Variant Images**

**NEW FIELD NEEDED:**
- **Field Name:** `Image IDs JSON`
- **Field ID:** `field_174` (or next available)
- **Type:** Paragraph Text (to store JSON array)
- **Purpose:** Store list of image IDs for this variant
- **Format:** `["img_001", "img_002", "img_003"]`

**Alternative approach** (if JSON not desired):
- **Field Name:** `Primary Image URL`
- **Field ID:** `field_175`
- **Type:** Link
- **Purpose:** Main image for this variant

### Image Metadata Storage Options

**Option A: Store in Knack (Simple)**
```json
// In Variants table, field_174
{
  "image_ids": ["img_001", "img_002"],
  "primary_image": "img_001"
}
```

**Option B: Separate Images Table (Advanced)**
```
Products (1) ──── (Many) Images
                    │
                    │ binding_type: "variant"
                    │ primary_option_id: "Black"
                    │ secondary_option_id: null
```

**Recommendation:** Use **Option A** (simpler, faster, sufficient for needs)

---

## 🗄️ Knack Database Schema

### Products Table (object_6) - **NO CHANGES NEEDED**

| Field Name | Field ID | Type | Current Value | Notes |
|------------|----------|------|---------------|-------|
| ID | `field_45` | Short Text | ✅ Active | URL identifier |
| Title | `field_47` | Short Text | ✅ Active | English name |
| Title Original | `field_48` | Short Text | ✅ Active | Chinese name |
| Category | `field_50` | Multiple Choice | ✅ Active | Product category |
| URL | `field_55` | Link | ✅ Active | Taobao URL |
| Status | `field_51` | Multiple Choice | ✅ Active | Active/Draft |

### Variants Table (object_7) - **UPDATES NEEDED**

#### Existing Fields ✅
| Field Name | Field ID | Type | Purpose | Status |
|------------|----------|------|---------|--------|
| Product | `field_61` | Connection | Links to Products | ✅ Active |
| Variant Name | `field_62` | Short Text | Display name | ✅ Active |
| SKU | `field_63` | Short Text | Variant SKU | ✅ Active |
| Option Type 1 | `field_145` | Short Text | "Color", "Style" | ✅ Active |
| Option Value 1 | `field_146` | Short Text | "Black", "Standard" | ✅ Active |
| Option Type 2 | `field_147` | Short Text | "Size", "Style" | ✅ Active |
| Option Value 2 | `field_148` | Short Text | "M", "套装A" | ✅ Active |
| Price CNY | `field_64` | Number | Taobao price | ✅ Active |
| Price CAD | `field_138` | Number | Retail price | ✅ Active |
| Shipping CNY | `field_151` | Number | Shipping allocation | ✅ Active |
| **Cost CAD** | **`field_173`** | **Number** | **Landed cost** | **✅ CREATED** |
| Margin Standard | `field_154` | Number | Standard margin % | ✅ Active |
| Margin Promo | `field_155` | Number | Promo margin % | ✅ Active |
| Stock | `field_66` | Yes/No | In stock flag | ✅ Active |
| Status | `field_67` | Multiple Choice | Active/Out of Stock | ✅ Active |

#### New Fields Required ⚠️

| Field Name | Suggested ID | Type | Purpose | Priority |
|------------|--------------|------|---------|----------|
| **Image IDs JSON** | `field_174` | Paragraph Text | JSON array of image IDs | 🔴 **HIGH** |
| **Primary Image URL** | `field_175` | Link | Main variant image | 🟡 MEDIUM |
| Chinese Name | `field_149` | Short Text | Original variant name | 🟢 LOW |
| Chinese Link | `field_150` | Link | Taobao variant URL | 🟢 LOW |

---

## 🔀 Variant & Option Structure

### Multi-Dimensional Options Explained

**Taobao Structure:**
```
Product: Tactical Belt System
├─ Dimension 1: "Size" (颜色分类)
│  ├─ One Size
│  ├─ S
│  ├─ M
│  ├─ L
│  └─ XL
└─ Dimension 2: "Style" (款式)
   ├─ A款套装 → "Set A"
   ├─ B款套装 → "Set B"
   ├─ 快拆带锁棍套 → "Quick Release Baton Holster"
   └─ ... (20 styles total)

Result: 5 sizes × 20 styles = 100 variants
```

**Our Normalized Structure:**
```typescript
variant: {
    optionType1: "Size",           // Normalized dimension label
    optionValue1: "S",             // Normalized value
    optionType2: "Style",          // Second dimension (optional)
    optionValue2: "Set A",         // Translated, cleaned value
    price_cny: 202.0,
    cost_cad: 44.08,
    price_cad: 72.99,
    image_ids: ["img_001", "img_005", "img_010"]  // Links to images
}
```

### Option Type Normalization

The scraper should normalize Chinese option types to English:

```python
DIMENSION_LABELS = {
    '颜色': 'Color',
    '颜色分类': 'Color',
    '尺码': 'Size',
    '尺寸': 'Size',
    '规格': 'Size',
    '款式': 'Style',
    '类型': 'Style',
    '套餐': 'Bundle Type',
}
```

### Value Translation Examples

**Colors:**
```python
'黑色' → 'Black'
'军绿色' → 'Army Green'
'狼棕色' → 'Coyote Brown'
'游骑兵绿' → 'Ranger Green'
'MC迷彩' → 'MultiCam'
```

**Sizes:**
```python
'均码' → 'One Size'
'S/M/L/XL' → Keep as-is
'85-125cm' → Keep as-is (with unit)
'大款' → 'Large'
'小款' → 'Small'
```

**Styles:**
```python
'A款套装' → 'Set A'
'B款套装' → 'Set B'
'标准版' → 'Standard'
'升级版' → 'Upgraded'
'单个' → 'Single'
```

---

## 💰 Pricing Calculations

### Formula

```python
PRICING_CONFIG = {
    'exchange_rate': 0.19,        # 1 CNY = 0.19 CAD
    'shipping_cny': 30,           # Fixed shipping per item
    'salesperson_cut': 0.10,      # 10% of revenue
    'promoter_cut': 0.10,         # 10% (promo code only)
    'target_margin': 0.30,        # 30% target margin
}

# Step 1: Calculate Cost
cost_cny = price_cny + shipping_cny
cost_cad = cost_cny × exchange_rate

# Step 2: Calculate Retail Price
# Price = Cost / (1 - salesperson% - margin%)
divisor = 1 - salesperson_cut - target_margin
sale_price_cad = cost_cad / divisor

# Round to .99 for retail pricing
sale_price_cad = round(sale_price_cad) - 0.01

# Step 3: Calculate Actual Margins
# Standard margin (no promo)
revenue_after_salesperson = sale_price_cad × (1 - salesperson_cut)
margin_standard = (revenue_after_salesperson - cost_cad) / sale_price_cad

# Promo margin (with 10% discount + promoter cut)
promo_price = sale_price_cad × 0.90
revenue_after_cuts = promo_price × (1 - salesperson_cut - promoter_cut)
margin_promo = (revenue_after_cuts - cost_cad) / promo_price
```

### Example Calculation

```
Taobao Price: ¥202
Shipping:     ¥30
───────────────────
Total CNY:    ¥232
───────────────────
× 0.19 CAD/CNY
───────────────────
Cost CAD:     $44.08
───────────────────

Retail Price Calculation:
Divisor = 1 - 0.10 (salesperson) - 0.30 (margin)
        = 0.60

Price = $44.08 / 0.60
      = $73.47
      → Round to $72.99

Standard Margin:
Revenue after salesperson = $72.99 × 0.90 = $65.69
Profit = $65.69 - $44.08 = $21.61
Margin = $21.61 / $72.99 = 29.6% ≈ 30%

Promo Margin (10% discount):
Promo price = $72.99 × 0.90 = $65.69
Revenue after cuts = $65.69 × (1 - 0.10 - 0.10) = $52.55
Profit = $52.55 - $44.08 = $8.47
Margin = $8.47 / $65.69 = 12.9% ≈ 13%
```

### Fields to Store in Knack

```python
variant_data = {
    VARIANT_FIELDS['priceCny']: 202.0,          # field_64
    VARIANT_FIELDS['shippingCny']: 30.0,        # field_151
    VARIANT_FIELDS['costCad']: 44.08,           # field_173 ✅
    VARIANT_FIELDS['priceCad']: 72.99,          # field_138
    VARIANT_FIELDS['marginStandard']: 29.6,     # field_154 (as %)
    VARIANT_FIELDS['marginPromo']: 12.9,        # field_155 (as %)
}
```

---

## ✅ Implementation Checklist

### Phase 1: Knack Database Setup

- [ ] **1.1** Verify `field_173` (Cost CAD) exists and is Number type
- [ ] **1.2** Create `field_174` (Image IDs JSON) - Paragraph Text
- [ ] **1.3** Create `field_175` (Primary Image URL) - Link (optional)
- [ ] **1.4** Test field creation via Knack API

### Phase 2: Scraper Updates

- [ ] **2.1** Update `knack_integration.py`:
  ```python
  VARIANT_FIELDS = {
      # ... existing ...
      'costCad': 'field_173',
      'marginStandard': 'field_154',
      'marginPromo': 'field_155',
      'imageIdsJson': 'field_174',  # NEW
      'primaryImageUrl': 'field_175',  # NEW
  }
  ```

- [ ] **2.2** Update scraper to capture variant-specific images:
  ```python
  # In variant extraction logic
  def extract_variant_images(driver, variant_element):
      """
      Detect which images belong to this variant.
      Returns list of image URLs.
      """
      # Click variant option
      # Capture displayed images
      # Return image URLs
  ```

- [ ] **2.3** Implement image binding logic:
  ```python
  # Link images to variants by option value
  def bind_images_to_variants(images, variants):
      for img in images:
          # Check if image URL contains color/style keywords
          # Or: capture which images show when variant is selected
          # Set variant_binding accordingly
  ```

- [ ] **2.4** Update `ScrapedVariant` dataclass to include `image_ids`

- [ ] **2.5** Store image metadata in Knack:
  ```python
  variant_data[VARIANT_FIELDS['imageIdsJson']] = json.dumps(
      ["img_001", "img_002", "img_003"]
  )
  ```

### Phase 3: Frontend Updates

- [ ] **3.1** Update `shop/lib/knack-config.ts`:
  ```typescript
  variants: {
      // ... existing ...
      costCad: 'field_173',
      marginStandard: 'field_154',
      marginPromo: 'field_155',
      imageIdsJson: 'field_174',  // NEW
      primaryImageUrl: 'field_175',  // NEW
  }
  ```

- [ ] **3.2** Update `shop/lib/products.ts` TypeScript type:
  ```typescript
  export type ProductVariant = {
      // ... existing ...
      cost_cad?: number
      margin?: number
      margin_promo?: number
      image_ids?: string[]  // NEW
      primary_image_url?: string  // NEW
  }
  ```

- [ ] **3.3** Update product detail page image filtering:
  ```typescript
  // In app/shop/[id]/page.tsx
  useEffect(() => {
      if (!selectedVariantId) return
      
      const selectedVariant = product.variants?.find(v => v.id === selectedVariantId)
      if (!selectedVariant) return
      
      // Get image IDs for this variant
      const variantImageIds = selectedVariant.image_ids || []
      
      // Filter images by IDs
      const variantImages = product.images.all
          .filter(img => variantImageIds.includes(img.id))
          .sort((a, b) => a.order_index - b.order_index)
          .map(img => img.source_url)
      
      // Get generic images (no variant binding)
      const genericImages = product.images.all
          .filter(img => !img.variant_binding)
          .map(img => img.source_url)
      
      // Combine: variant-specific first, then generic
      setGalleryImages([...variantImages, ...genericImages])
      setSelectedImageIndex(0)
  }, [selectedVariantId])
  ```

### Phase 4: Testing

- [ ] **4.1** Test scraper on product with multiple colors
- [ ] **4.2** Verify images are correctly bound to variants in Knack
- [ ] **4.3** Test frontend image filtering:
  - Select "Black" → See black-specific images
  - Select "Olive Green" → See olive-specific images
  - Generic images appear for all variants
- [ ] **4.4** Verify pricing calculations are correct
- [ ] **4.5** Test variant availability logic
- [ ] **4.6** Test stock urgency displays

### Phase 5: Deployment

- [ ] **5.1** Run scraper on all products in `taobao_links.txt`
- [ ] **5.2** Verify all products have correct image bindings
- [ ] **5.3** Check for any missing images (404s)
- [ ] **5.4** Update documentation with final field IDs
- [ ] **5.5** Create migration script if needed

---

## 🚀 Quick Start Commands

### 1. Test Scraper (One Product)
```bash
cd scraper
python3 ai_scraper.py --test
```

### 2. Run Full Scrape
```bash
python3 ai_scraper.py
```

### 3. Dry Run (No Knack Push)
```bash
python3 ai_scraper.py --dry-run
```

### 4. Skip Knack (Testing)
```bash
python3 ai_scraper.py --skip-knack
```

### 5. View Output
```bash
cat ai_scraper_output/products.json | jq
```

---

## 📝 Summary

### Critical Changes Required

1. **Knack:**
   - ✅ `field_173` (Cost CAD) - Already created
   - ⚠️ `field_174` (Image IDs JSON) - **TO CREATE**

2. **Scraper:**
   - Add image-to-variant binding logic
   - Update `knack_integration.py` with new fields
   - Capture variant-specific images

3. **Frontend:**
   - Update TypeScript types
   - Implement image filtering by variant
   - Display variant-specific images

### Data Flow Summary

```
Taobao → Scraper → Knack → Frontend
  ↓        ↓         ↓         ↓
Images → Binding → Storage → Filtering
```

### Expected Outcome

When user selects a variant:
1. Gallery updates to show variant-specific images
2. Price updates to show variant price
3. Stock urgency shows correct availability
4. Generic images remain visible
5. Image index resets to 0

---

## 📞 Questions?

If anything is unclear, refer to:
- `ENHANCED_SHOP_IMPLEMENTATION.md` - Frontend details
- `KNACK_DATABASE_SCHEMA.md` - Database schema
- `ai_scraper.py` - Scraper implementation

**Last Updated:** January 13, 2026
