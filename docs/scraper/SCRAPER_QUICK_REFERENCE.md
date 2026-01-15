# 🚀 Scraper & Database Quick Reference

## 🎯 What You Need to Do

### 1. **Create ONE New Knack Field** ⚠️

```
Field Name:  Image IDs JSON
Field ID:    field_174 (or next available)
Field Type:  Paragraph Text
Object:      Variants (object_7)
Purpose:     Store array of image IDs per variant
Format:      ["img_001", "img_002", "img_003"]
```

### 2. **Update Scraper Files**

#### `knack_integration.py` (Line ~51)
```python
VARIANT_FIELDS = {
    # ... existing fields ...
    'costCad': 'field_173',           # ✅ Already exists
    'marginStandard': 'field_154',    # ✅ Already exists  
    'marginPromo': 'field_155',       # ✅ Already exists
    'imageIdsJson': 'field_174',      # ⚠️ ADD THIS
}
```

#### `ai_scraper.py` - Add Image Binding
```python
@dataclass
class ScrapedVariant:
    # ... existing fields ...
    image_ids: List[str] = field(default_factory=list)  # ⚠️ ADD THIS

def extract_variant_images(driver, variant_option):
    """
    NEW FUNCTION: Detect which images show for this variant
    """
    # Click variant option
    variant_option.click()
    time.sleep(1)
    
    # Capture currently displayed images
    image_elements = driver.find_elements(By.CSS_SELECTOR, 'img.J_UlThumb')
    image_urls = [img.get_attribute('src') for img in image_elements]
    
    return image_urls
```

### 3. **Update Frontend Config**

#### `shop/lib/knack-config.ts` (Line ~133)
```typescript
variants: {
    // ... existing fields ...
    costCad: 'field_173',          // ✅ Already added
    marginStandard: 'field_154',   // ✅ Already added
    marginPromo: 'field_155',      // ✅ Already added
    imageIdsJson: 'field_174',     // ⚠️ ADD THIS
}
```

---

## 📊 Data Structure

### How Images Link to Variants

```
Product: Tactical Jacket
├─ Generic Images (show for all variants)
│  ├─ img_001: Hero image 1
│  ├─ img_002: Hero image 2
│  └─ img_007: Detail scroll image
│
├─ Variant: "Black / S"
│  └─ image_ids: ["img_001", "img_003", "img_004", "img_007"]
│                   ↑ generic  ↑ Black   ↑ Black   ↑ generic
│
├─ Variant: "Olive Green / S"
│  └─ image_ids: ["img_001", "img_005", "img_006", "img_007"]
│                   ↑ generic  ↑ Olive   ↑ Olive   ↑ generic
│
└─ Variant: "Black / M"
   └─ image_ids: ["img_001", "img_003", "img_004", "img_007"]
                   ↑ Same as Black/S (color determines images)
```

**Rule:** Images are linked by **primary option (Color/Style)**, not size!

---

## 💰 Pricing Formula (Quick Reference)

```python
# Input from Taobao
price_cny = 202.0
shipping_cny = 30.0

# Step 1: Cost
cost_cad = (202 + 30) × 0.19 = 44.08

# Step 2: Retail Price
sale_price = 44.08 / (1 - 0.10 - 0.30)
           = 44.08 / 0.60
           = 73.47 → $72.99 (rounded to .99)

# Step 3: Margins
margin_standard = 30.5%  # No promo
margin_promo = 14.2%     # With 10% discount
```

**Store in Knack:**
- `field_64`: `202.0` (Price CNY)
- `field_151`: `30.0` (Shipping CNY)
- `field_173`: `44.08` (Cost CAD)
- `field_138`: `72.99` (Price CAD)
- `field_154`: `30.5` (Margin Standard %)
- `field_155`: `14.2` (Margin Promo %)

---

## 🔄 Complete Data Flow

```
1. SCRAPER EXTRACTS:
   ├─ Product info
   ├─ Variants (with options)
   ├─ Images (download all)
   └─ Link images to variants by color

2. SCRAPER PUSHES TO KNACK:
   ├─ Create/Update Product record
   ├─ Create/Update Variant records
   │  └─ Include image_ids JSON
   └─ Store pricing calculations

3. FRONTEND FETCHES FROM KNACK:
   ├─ Load product + variants
   ├─ Parse image_ids from JSON
   └─ Filter gallery by selected variant

4. USER SELECTS VARIANT:
   ├─ Gallery updates to variant images
   ├─ Price updates
   └─ Stock status updates
```

---

## 🧪 Testing Checklist

```bash
# 1. Test scraper on one product
cd scraper
python3 ai_scraper.py --test

# 2. Check output
cat ai_scraper_output/products.json | jq '.variants[0]'

# Look for:
# - image_ids array populated
# - cost_cad calculated
# - margin_standard/promo calculated

# 3. Check Knack
# Visit Knack Builder → Variants table
# Verify field_174 has JSON data

# 4. Test frontend
# Visit http://localhost:3000/shop/[product-id]
# Select different variants
# Verify gallery updates
```

---

## 🚨 Common Issues

### Issue 1: Images Don't Change
**Cause:** `image_ids` not populated in Knack  
**Fix:** Re-run scraper with image binding logic

### Issue 2: All Variants Show Same Images
**Cause:** All variants have same `image_ids`  
**Fix:** Scraper needs to detect variant-specific images

### Issue 3: Pricing Incorrect
**Cause:** Wrong formula or missing fields  
**Fix:** Check `calculate_price_cad()` function

---

## 📝 Files to Modify

### Scraper (Python)
1. `knack_integration.py` - Add `field_174` to `VARIANT_FIELDS`
2. `ai_scraper.py` - Add `image_ids` to `ScrapedVariant`
3. `ai_scraper.py` - Implement image binding logic

### Frontend (TypeScript)
1. `shop/lib/knack-config.ts` - Add `field_174` mapping
2. `shop/lib/products.ts` - Add `image_ids` to type
3. `shop/app/shop/[id]/page.tsx` - Already has filtering logic ✅

### Knack Builder
1. Create `field_174` (Image IDs JSON) in Variants table

---

## 🎯 Priority Order

1. **HIGH**: Create `field_174` in Knack ⚠️
2. **HIGH**: Update `knack_integration.py` with field mappings
3. **MEDIUM**: Add image binding to scraper
4. **MEDIUM**: Update frontend config
5. **LOW**: Test and iterate

---

## 📞 Need Help?

See full documentation:
- `SCRAPER_AND_DATABASE_REQUIREMENTS.md` - Complete guide
- `ENHANCED_SHOP_IMPLEMENTATION.md` - Frontend details
- `KNACK_DATABASE_SCHEMA.md` - Database reference

**Quick Questions:**
- "How do I detect variant images?" → See `extract_variant_images()` example above
- "What format for image_ids?" → `["img_001", "img_002"]` JSON array
- "How to test?" → Run `python3 ai_scraper.py --test`
