# 🖼️ Image-to-Variant Binding - Standard Operating Procedure (SOP)

**Document Version**: 1.0  
**Last Updated**: January 13, 2026  
**Field ID**: `field_176` (Image IDs JSON)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Workflow Steps](#workflow-steps)
4. [Testing & Verification](#testing--verification)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance](#maintenance)

---

## Overview

### Purpose
This SOP documents the complete workflow for binding product images to specific variants, enabling the frontend to filter the product gallery when users select different color/style options.

### System Components
- **Scraper**: `ai_scraper.py` - Captures images and generates bindings
- **Database**: Knack field `field_176` - Stores image ID arrays as JSON
- **Frontend**: `knack-config.ts` - Reads and displays filtered images
- **Output**: `products.json` - Contains image bindings for each variant

### Data Flow
```
Taobao Product → Scraper → Image IDs → Knack DB → Frontend API → Gallery Filter
```

---

## Prerequisites

### Required Software
- Python 3.8+ with required packages
- Chrome browser (for Selenium)
- Node.js (for frontend)
- Knack account with builder access

### Required Files
- `scraper/ai_scraper.py`
- `scraper/knack_integration.py`
- `scraper/taobao_links.txt`
- `shop/lib/knack-config.ts`

### Environment Setup
```bash
# Required environment variables in shop/.env.local:
KNACK_APPLICATION_ID=your_app_id
KNACK_REST_API_KEY=your_api_key
GEMINI_API_KEY=your_gemini_key  # Optional for AI translation
```

### Knack Database
- **Field Name**: Image IDs JSON
- **Field ID**: `field_176`
- **Object**: Variants (object_7)
- **Type**: Paragraph Text
- **Status**: ✅ Created and configured

---

## Workflow Steps

### Phase 1: Scraping with Image Binding

#### Step 1.1: Prepare Product URLs

**Action**: Add Taobao URLs to input file

```bash
# File: scraper/taobao_links.txt
# Add one URL per line:

https://item.taobao.com/item.htm?id=123456789
https://item.taobao.com/item.htm?id=987654321
```

**Validation**:
- ✅ URLs are valid Taobao product pages
- ✅ Products have multiple variants (colors/sizes)
- ✅ Products have clear product images

---

#### Step 1.2: Run Scraper (Test Mode)

**Action**: Test scraper on first product only

```bash
cd scraper
python3 ai_scraper.py --test
```

**Expected Output**:
```
🚀 Starting Chrome...
✅ Knack API connected

📦 Product 1: https://item.taobao.com/item.htm?id=...
====================================================
   📝 Title (ZH): 战术背心...
   📸 Capturing images...
      → Main: 3 captured
      → Gallery: 15 captured
      → Details: 25 captured
   🔍 Extracting variants...
      → Found 12 variants via VariantExtraction
   💰 Base price: ¥202
   🖼️  Binding images to variants...
      → Generic images: 43 (shown for all variants)
      → Assigned 43 images to 12 variants
      → Image IDs: img_001, img_002, img_003, img_004, img_005...

✅ Done! 1 products scraped
   📁 Output: /scraper/ai_scraper_output
```

**Success Criteria**:
- ✅ No errors during scraping
- ✅ "Binding images to variants" section appears
- ✅ Image count > 0 for all categories
- ✅ All variants have image IDs assigned

---

#### Step 1.3: Verify Scraper Output

**Action**: Inspect JSON output for image bindings

```bash
# Check overall structure
cat ai_scraper_output/products.json | jq '.'

# Check image IDs for first variant
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids'

# Count variants with image IDs
cat ai_scraper_output/products.json | jq '.products[0].variants[] | select(.image_ids | length > 0) | .variant_name_en' | wc -l
```

**Expected Output**:
```json
{
  "products": [
    {
      "product_id": "TB123456789",
      "title_en": "Tactical Vest",
      "images": {
        "Main": ["/path/to/main_01.jpg"],
        "Catalogue": ["/path/to/catalogue_01.jpg", "..."],
        "Details": ["/path/to/detail_01.jpg", "..."]
      },
      "variants": [
        {
          "variant_name_en": "Black / S",
          "option_type_1": "Color",
          "option_value_1": "Black",
          "option_type_2": "Size",
          "option_value_2": "S",
          "price_cad": 72.99,
          "image_ids": ["img_001", "img_002", "img_003", "..."],
          "in_stock": true
        }
      ]
    }
  ]
}
```

**Validation**:
- ✅ `image_ids` array exists for each variant
- ✅ Image IDs follow format: `img_001`, `img_002`, etc.
- ✅ All variants have at least 1 image ID
- ✅ Image count matches captured images

---

#### Step 1.4: Push to Knack Database

**Action**: Run scraper with Knack integration

```bash
cd scraper
python3 ai_scraper.py --test --push-knack
```

**Expected Output**:
```
📤 Pushing to Knack...
   → Found existing product: rec_xyz123
   → Created: Black / S @ $72.99
   → Created: Black / M @ $74.99
   → Created: Black / L @ $76.99
   → Created: Olive / S @ $72.99
   ...
```

**Success Criteria**:
- ✅ No "field_176 not found" errors
- ✅ All variants created/updated successfully
- ✅ No JSON serialization errors

---

### Phase 2: Database Verification

#### Step 2.1: Check Knack Database

**Action**: Verify field_176 contains image bindings

1. Go to https://builder.knack.com/
2. Open your application
3. Navigate: **Data** → **Variants** (object_7)
4. Click on any variant record
5. Locate **Image IDs JSON** field (field_176)

**Expected Data**:
```json
["img_001","img_002","img_003","img_004","img_005","img_006","img_007","img_008","img_009","img_010","img_011","img_012","img_013","img_014","img_015","img_016","img_017","img_018","img_019","img_020","img_021","img_022","img_023","img_024","img_025","img_026","img_027","img_028","img_029","img_030","img_031","img_032","img_033","img_034","img_035","img_036","img_037","img_038","img_039","img_040","img_041","img_042","img_043"]
```

**Validation**:
- ✅ Field contains valid JSON array
- ✅ Array has multiple image IDs
- ✅ Format is consistent across all variants
- ✅ No empty or null values

---

#### Step 2.2: Verify All Variants

**Action**: Bulk check all variant records

```bash
# Query Knack API directly
curl -X GET \
  "https://api.knack.com/v1/objects/object_7/records?rows_per_page=1000" \
  -H "X-Knack-Application-Id: YOUR_APP_ID" \
  -H "X-Knack-REST-API-Key: YOUR_API_KEY" \
  | jq '.records[] | {name: .field_62, images: .field_176}'
```

**Expected Output**:
```json
{
  "name": "Black / S",
  "images": "[\"img_001\",\"img_002\",\"img_003\"]"
}
{
  "name": "Black / M",
  "images": "[\"img_001\",\"img_002\",\"img_003\"]"
}
...
```

**Validation**:
- ✅ All variants have field_176 populated
- ✅ JSON is properly escaped
- ✅ No variants missing image data

---

### Phase 3: Frontend Integration

#### Step 3.1: Verify Frontend Config

**Action**: Check that frontend is configured correctly

```bash
# Check config file
cat shop/lib/knack-config.ts | grep -A 2 "imageIdsJson"
```

**Expected Output**:
```typescript
imageIdsJson: 'field_176',     // JSON array of image IDs bound to this variant
```

**Validation**:
- ✅ Field ID matches `field_176`
- ✅ Config is in variants section
- ✅ TypeScript compiles without errors

---

#### Step 3.2: Test Frontend API

**Action**: Verify API returns image bindings

```bash
# Start frontend dev server (if not running)
cd shop
npm run dev

# In another terminal, test API
curl http://localhost:3000/api/products | jq '.products[0].variants[0] | {name: .variantName, images: .imageIdsJson}'
```

**Expected Output**:
```json
{
  "name": "Black / S",
  "images": "[\"img_001\",\"img_002\",\"img_003\",\"img_004\",\"img_005\"]"
}
```

**Validation**:
- ✅ API returns imageIdsJson field
- ✅ JSON is properly formatted
- ✅ Data matches Knack database

---

#### Step 3.3: Frontend Gallery Implementation

**Action**: Update product detail page to use image bindings

```typescript
// shop/app/shop/[productId]/page.tsx (future implementation)

// Parse image IDs from JSON
const imageIds = JSON.parse(variant.imageIdsJson || "[]");

// Filter product images by IDs
const variantImages = productImages.filter(img => 
  imageIds.includes(img.id)
);

// Display filtered gallery
<ImageGallery images={variantImages} />
```

**Note**: This step is for future implementation when frontend gallery filtering is built.

---

### Phase 4: Production Run

#### Step 4.1: Full Scraper Run

**Action**: Process all URLs from taobao_links.txt

```bash
cd scraper
python3 ai_scraper.py --push-knack
```

**Monitoring**:
- Monitor console output for errors
- Check that all products complete successfully
- Verify total time (expect ~2-3 min per product)

**Expected Output**:
```
🚀 AI Scraper V3 - 28 URLs

[1/28] 📦 Product 1: https://...
✅ Done

[2/28] 📦 Product 2: https://...
✅ Done

...

[28/28] 📦 Product 28: https://...
✅ Done

✅ Done! 28 products scraped
   📁 Output: /scraper/ai_scraper_output
```

---

#### Step 4.2: Bulk Verification

**Action**: Verify all products have image bindings

```bash
# Count total variants with image IDs
cat ai_scraper_output/products.json | jq '[.products[].variants[]] | length'

# Count variants WITH image_ids
cat ai_scraper_output/products.json | jq '[.products[].variants[] | select(.image_ids | length > 0)] | length'

# Both numbers should match!
```

**Success Criteria**:
- ✅ All products scraped successfully
- ✅ All variants have image_ids
- ✅ No errors in log
- ✅ Knack database updated

---

## Testing & Verification

### Test Checklist

**Pre-Scraping**:
- [ ] Knack field_176 exists and is type "Paragraph Text"
- [ ] Environment variables configured
- [ ] taobao_links.txt has valid URLs
- [ ] Chrome and Selenium working

**During Scraping**:
- [ ] "Binding images to variants" appears in output
- [ ] No errors or warnings
- [ ] Image counts > 0 for all categories
- [ ] All variants processed

**Post-Scraping**:
- [ ] products.json has image_ids arrays
- [ ] All variants have at least 1 image ID
- [ ] Image IDs follow format img_XXX
- [ ] Knack database updated successfully

**Frontend Verification**:
- [ ] API returns imageIdsJson field
- [ ] JSON parses correctly
- [ ] Data matches scraper output

---

### Quality Checks

#### Image Binding Quality

**Check 1: Image Count Consistency**
```bash
# All variants should have similar image counts
cat ai_scraper_output/products.json | jq '.products[0].variants[] | {name: .variant_name_en, count: (.image_ids | length)}'
```

**Expected**: All variants have same count (MVP implementation)

**Check 2: Image ID Format**
```bash
# All IDs should follow img_XXX format
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids[]'
```

**Expected**: `img_001`, `img_002`, etc.

**Check 3: No Duplicates**
```bash
# Check for duplicate image IDs in a variant
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids | unique | length'
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids | length'
```

**Expected**: Both numbers match (no duplicates)

---

## Troubleshooting

### Issue 1: Field Not Found Error

**Symptom**:
```
Error: field_176 not found in Knack
```

**Diagnosis**:
- Field doesn't exist or has different ID

**Resolution**:
1. Check Knack Builder for actual field ID
2. Update code if ID is different:
   - `scraper/knack_integration.py` line 63
   - `shop/lib/knack-config.ts` line 147
3. Re-run scraper

---

### Issue 2: Empty Image IDs

**Symptom**:
```json
{
  "image_ids": []
}
```

**Diagnosis**:
- Images not captured by scraper
- Binding logic not called
- Product page didn't load

**Resolution**:
1. Check scraper output for "📸 Capturing images"
2. Verify image counts > 0
3. Check product URL is accessible
4. Try different product with clear images

---

### Issue 3: JSON Serialization Error

**Symptom**:
```
TypeError: Object of type 'list' is not JSON serializable
```

**Diagnosis**:
- Field type is wrong in Knack
- Data structure issue

**Resolution**:
1. Verify field_176 is "Paragraph Text" not "Short Text"
2. Check image_ids is a list: `isinstance(variant.image_ids, list)`
3. Verify json.dumps() is called before pushing

---

### Issue 4: Frontend Not Receiving Data

**Symptom**:
```json
{
  "imageIdsJson": null
}
```

**Diagnosis**:
- Field not in Knack response
- Config mismatch
- Database not updated

**Resolution**:
1. Check Knack database has data in field_176
2. Verify knack-config.ts has correct field ID
3. Restart frontend dev server
4. Clear browser cache

---

### Issue 5: Scraper Hangs on Image Binding

**Symptom**:
- Scraper freezes at "🖼️ Binding images to variants..."

**Diagnosis**:
- Infinite loop in binding logic
- Too many images

**Resolution**:
1. Check image counts are reasonable (< 100 per category)
2. Look for errors in console
3. Try with --test flag on single product
4. Check available memory

---

## Maintenance

### Regular Maintenance Tasks

#### Weekly
- [ ] Check scraper success rate
- [ ] Verify all new products have image bindings
- [ ] Monitor Knack field_176 data quality
- [ ] Review error logs

#### Monthly
- [ ] Audit image binding accuracy
- [ ] Check for missing or corrupt data
- [ ] Update documentation if process changes
- [ ] Test with new product types

#### Quarterly
- [ ] Review and optimize binding logic
- [ ] Consider implementing smart color detection (Phase 2)
- [ ] Evaluate frontend gallery filtering performance
- [ ] Update SOP based on learnings

---

### Updating the System

#### Code Updates

**To update field mapping**:
```bash
# 1. Change field ID in both files
# scraper/knack_integration.py:
'imageIdsJson': 'field_XXX',

# shop/lib/knack-config.ts:
imageIdsJson: 'field_XXX',

# 2. Re-run scraper on test product
python3 ai_scraper.py --test --push-knack

# 3. Verify in Knack database
```

**To update binding logic**:
```bash
# Edit scraper/ai_scraper.py
# Modify _bind_images_to_variants() method (lines 1795-1843)

# Test changes
python3 ai_scraper.py --test

# Verify output
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids'
```

---

### Data Migration

**If you need to re-bind images for existing products**:

```bash
# 1. Export existing products from Knack
curl -X GET \
  "https://api.knack.com/v1/objects/object_7/records?rows_per_page=1000" \
  -H "X-Knack-Application-Id: YOUR_APP_ID" \
  -H "X-Knack-REST-API-Key: YOUR_API_KEY" \
  > existing_variants.json

# 2. Re-run scraper to generate new bindings
python3 ai_scraper.py --push-knack

# 3. Verify all variants updated
# Check Knack Builder → Variants → Image IDs JSON field
```

---

### Backup Procedures

**Before major changes**:

```bash
# 1. Backup scraper output
cp -r ai_scraper_output ai_scraper_output_backup_$(date +%Y%m%d)

# 2. Export Knack data
curl -X GET \
  "https://api.knack.com/v1/objects/object_7/records?rows_per_page=1000" \
  -H "X-Knack-Application-Id: YOUR_APP_ID" \
  -H "X-Knack-REST-API-Key: YOUR_API_KEY" \
  > knack_variants_backup_$(date +%Y%m%d).json

# 3. Commit code changes
git add .
git commit -m "Backup before image binding changes"
```

---

## Performance Metrics

### Target Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Scrape time per product | 2-3 min | _measure_ |
| Images captured per product | 20-50 | _measure_ |
| Variants per product | 5-20 | _measure_ |
| Image binding success rate | 100% | _measure_ |
| Knack push success rate | 100% | _measure_ |
| API response time | < 500ms | _measure_ |

### Monitoring

**Track these metrics**:
```bash
# Scraper performance
time python3 ai_scraper.py --test

# Database query time
time curl "http://localhost:3000/api/products" > /dev/null

# Image count per product
cat ai_scraper_output/products.json | jq '.products[] | {id: .product_id, images: (.images.Main | length) + (.images.Catalogue | length) + (.images.Details | length)}'
```

---

## Appendix

### Related Documentation
- `SCRAPER_AND_DATABASE_REQUIREMENTS.md` - Complete system guide
- `IMAGE_BINDING_IMPLEMENTATION_SUMMARY.md` - Technical implementation details
- `IMAGE_BINDING_TEST_PLAN.md` - Testing procedures
- `KNACK_DATABASE_SCHEMA.md` - Database field reference

### Configuration Reference

**Field Mappings**:
```python
# scraper/knack_integration.py
VARIANT_FIELDS = {
    'imageIdsJson': 'field_176',  # Image IDs array
}
```

```typescript
// shop/lib/knack-config.ts
variants: {
    imageIdsJson: 'field_176',  // Image IDs array
}
```

**Data Structure**:
```python
@dataclass
class ScrapedVariant:
    image_ids: List[str] = field(default_factory=list)
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-13 | Initial SOP creation | System |
| | | - Field ID confirmed as field_176 | |
| | | - Complete workflow documented | |
| | | - Testing procedures added | |

---

## Approval

**Prepared by**: AI Assistant  
**Reviewed by**: _pending_  
**Approved by**: _pending_  
**Effective Date**: January 13, 2026

---

**Document End** - For questions or issues, refer to troubleshooting section or consult technical documentation.
