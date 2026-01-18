# 🧪 Image Binding Test Plan

## Test Without Knack Field (Test Now)

You can test the image binding logic **before** creating the Knack field:

```bash
cd scraper

# Test scraper without pushing to Knack
python3 ai_scraper.py --test

# Expected output:
# 📸 Capturing images...
#    → Main: 3 captured
#    → Gallery: 15 captured
#    → Details: 25 captured
# 🖼️  Binding images to variants...
#    → Generic images: 43 (shown for all variants)
#    → Assigned 43 images to 12 variants
#    → Image IDs: img_001, img_002, img_003, img_004, img_005...
```

### Verify JSON Output:

```bash
# Check if image_ids are in the output
cat ai_scraper_output/products.json | jq '.products[0].variants[0]'

# Should see:
# {
#   "variant_name_en": "Black / S",
#   "option_type_1": "Color",
#   "option_value_1": "Black",
#   "image_ids": ["img_001", "img_002", "img_003", ...],
#   ...
# }
```

### Check All Variants Have Image IDs:

```bash
# Count variants with image_ids
cat ai_scraper_output/products.json | jq '.products[0].variants | length'
cat ai_scraper_output/products.json | jq '.products[0].variants[] | select(.image_ids | length > 0) | .variant_name_en'

# All variant names should be listed
```

---

## Test With Knack Field (After Creating field_174)

Once you've created `field_174` in Knack Builder:

```bash
cd scraper

# Test with Knack push
python3 ai_scraper.py --test --push-knack

# Expected output includes:
# 📤 Pushing to Knack...
#    → Found existing product: rec_abc123
#    → Created: Black / S @ $72.99
#    → Created: Black / M @ $72.99
#    ...
```

### Verify in Knack:

1. Open Knack Builder
2. Go to **Data** → **Variants**
3. Open any variant record
4. Check **Image IDs JSON** field
5. Should see: `["img_001","img_002","img_003",...]`

---

## Test Frontend API (After Knack Push)

```bash
cd shop

# Start dev server (if not running)
npm run dev

# In another terminal:
curl http://localhost:3000/api/products | jq '.products[0].variants[0] | {name: .variantName, images: .imageIdsJson}'

# Expected:
# {
#   "name": "Black / S",
#   "images": "[\"img_001\",\"img_002\",\"img_003\"]"
# }
```

---

## Test Image Filtering (Future Frontend Feature)

Once frontend implements gallery filtering:

1. Visit product page: `http://localhost:3000/shop/[product-id]`
2. Select different variants (Black, Olive, etc.)
3. Gallery should update to show only relevant images
4. All images show for now (MVP - all variants have all images)

---

## Success Metrics

### ✅ Phase 1: Code Works (Test Now)
- [ ] Scraper runs without errors
- [ ] JSON output contains `image_ids` arrays
- [ ] All variants have at least 1 image ID
- [ ] Image IDs follow format `img_001`, `img_002`, etc.

### ✅ Phase 2: Database Integration (After field_174 Created)
- [ ] Knack field `field_174` exists
- [ ] Scraper pushes to Knack successfully
- [ ] Knack records show JSON arrays in **Image IDs JSON**
- [ ] No serialization errors

### ✅ Phase 3: Frontend Integration (After API Update)
- [ ] Frontend API returns `imageIdsJson`
- [ ] JSON can be parsed into array
- [ ] Product page can access image IDs
- [ ] Gallery filtering works (future feature)

---

## Debugging Commands

### Check Scraper Logs:
```bash
# Run with verbose output
python3 ai_scraper.py --test 2>&1 | tee scraper_test.log
grep "image" scraper_test.log -i
```

### Validate JSON Structure:
```bash
# Check if image_ids is an array
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids | type'
# Should return: "array"

# Check image_ids count
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids | length'
# Should return: number > 0
```

### Test Knack API Directly:
```bash
# Get variant from Knack
curl -X GET \
  "https://api.knack.com/v1/objects/object_7/records" \
  -H "X-Knack-Application-Id: YOUR_APP_ID" \
  -H "X-Knack-REST-API-Key: YOUR_API_KEY" \
  | jq '.records[0].field_174'

# Should return: "["img_001","img_002",...]"
```

---

## Quick Test Script

Save this as `test_image_binding.sh`:

```bash
#!/bin/bash
set -e

echo "🧪 Testing Image Binding Implementation"
echo "========================================"

echo ""
echo "Step 1: Run scraper (without Knack push)..."
cd scraper
python3 ai_scraper.py --test

echo ""
echo "Step 2: Check JSON output..."
if [ -f "ai_scraper_output/products.json" ]; then
    echo "✅ products.json exists"
    
    variant_count=$(cat ai_scraper_output/products.json | jq '.products[0].variants | length')
    echo "✅ Found $variant_count variants"
    
    with_images=$(cat ai_scraper_output/products.json | jq '.products[0].variants[] | select(.image_ids | length > 0) | .variant_name_en' | wc -l)
    echo "✅ $with_images variants have image_ids"
    
    if [ "$variant_count" -eq "$with_images" ]; then
        echo "🎉 SUCCESS: All variants have image bindings!"
    else
        echo "⚠️  WARNING: Some variants missing image_ids"
    fi
else
    echo "❌ ERROR: products.json not found"
    exit 1
fi

echo ""
echo "✅ Test complete! Ready to create field_174 in Knack."
```

Run it:
```bash
chmod +x test_image_binding.sh
./test_image_binding.sh
```

---

**Next**: Run the test now, then create `field_174` in Knack!
