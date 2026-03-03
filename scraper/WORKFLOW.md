# Scraper Workflow

## Overview

The scraper workflow is designed to **minimize API costs** by separating scraping from translation. This allows you to:
1. **Scrape all products** without translation (no API calls)
2. **Bulk translate** all products in 2-3 API calls (vs hundreds)
3. **Upload to Knack** with complete data

## Default Behavior

**The scraper now scrapes-only by default** (no translation). This is the most cost-efficient workflow.

---

## Step-by-Step Workflow

### 1️⃣ **Scrape Products (No Translation)**

```bash
python3 ai_scraper.py
```

**What it does:**
- Scrapes product data from Taobao URLs in `taobao_links.txt`
- Captures images (Main, Gallery, Details, Variant screenshots)
- Extracts variants with Chinese names
- Saves raw data to `ai_scraper_output/products.json`
- **No API calls** = **No cost**

**Output:**
- `ai_scraper_output/products.json` (raw data with Chinese text)
- `ai_scraper_output/media/product_001/` (images)
  - `Main/` - Main product images
  - `Catalogue/` - Catalog images
  - `Details/` - Detail images
  - `variant_screenshots/` - Variant-specific hero images

---

### 2️⃣ **Bulk Translate (2-3 API Calls)**

```bash
python3 translate_deepseek.py
```

**What it does:**
- Reads `ai_scraper_output/products.json`
- Translates **ALL product titles** in 1 API call
- Translates **ALL variant names** in 1-2 API calls
- Updates `products.json` with English translations
- Uses translation cache to avoid re-translating

**Cost:** ~$0.01-0.05 for 100 products (vs ~$2-5 if translating during scraping)

**Output:**
- Updates `ai_scraper_output/products.json` with:
  - `title_en` for each product
  - `variant_name_en` for each variant
  - `product_sku` generated from English title

---

### 3️⃣ **Upload to Knack**

```bash
python3 upload_to_knack.py --with-images --product-id <N>
```

**What it does:**
- Reads translated data from `products.json`
- Uploads product and variants to Knack
- Uploads images (Main, Catalogue, Details, Variant)
- Links variant images to variants via `variantId` field

**Options:**
- `--product-id <N>` - Upload specific product (1-based index)
- `--with-images` - Upload images to Knack
- `--dry-run` - Preview without uploading

**Example:**
```bash
# Upload product #1 with images
python3 upload_to_knack.py --with-images --product-id 1

# Dry run to preview
python3 upload_to_knack.py --with-images --product-id 1 --dry-run
```

---

## Alternative: Scrape + Translate Together

If you want to translate during scraping (more expensive), use the `--translate` flag:

```bash
python3 ai_scraper.py --translate
```

**When to use:**
- Testing/debugging translation prompts
- Need immediate translated output
- Only scraping 1-2 products

**Cost:** Higher - sends product context with every API call

---

## Flags Reference

### ai_scraper.py

| Flag | Description | Default |
|------|-------------|---------|
| `--translate` | Translate during scraping | OFF (scrape-only) |
| `--push-knack` | Push to Knack after scraping | OFF (scrape-only) |
| `--test` | Test on first URL only | OFF |
| `--headless` | Run browser headless | OFF (visible) |
| `--dry-run` | Simulate Knack updates | OFF |
| `--login` | Interactive login setup | - |

### translate_deepseek.py

| Flag | Description | Default |
|------|-------------|---------|
| `--input` | Path to products.json | `ai_scraper_output/products.json` |
| `--force` | Force re-translate (ignore cache) | OFF |

### upload_to_knack.py

| Flag | Description | Default |
|------|-------------|---------|
| `--product-id <N>` | Upload specific product | Required |
| `--with-images` | Upload images to Knack | OFF |
| `--dry-run` | Preview without uploading | OFF |

---

## Complete Example Workflow

```bash
# 1. Scrape all products (no translation, no API cost)
python3 ai_scraper.py

# 2. Bulk translate (2-3 API calls total)
python3 translate_deepseek.py

# 3. Upload product #1 with images
python3 upload_to_knack.py --with-images --product-id 1

# 4. Upload product #2 with images
python3 upload_to_knack.py --with-images --product-id 2

# Continue for remaining products...
```

---

## Variant Image Flow

### During Scraping:
1. Click each variant option
2. Capture **cropped hero image** (not full page screenshot)
3. Save as `variant_screenshots/variant_001.png`, `variant_002.png`, etc.
4. Link image path to variant in `products.json`

### During Upload:
1. Scan `variant_screenshots/` folder
2. Match `variant_001.png` → `variants[0].sku`
3. Upload to Knack Product Images table with:
   - `imageType` = "Variant"
   - `variantId` = variant SKU
   - `product` = product connection

### On Frontend:
1. Fetch variant images from Knack
2. When user selects variant → display that variant's image
3. Auto-switch image when variant changes

---

## Testing & Verification

### ✅ Test Complete Workflow with Variant Images

#### Step 1: Translate Products
```bash
cd /Users/5425855/Documents/protocol-zero/scraper
python3 translate_deepseek.py
```

**Verify translation worked:**
```bash
# Check that products.json has English translations
cat ai_scraper_output/products.json | jq '.products[0] | {title_zh, title_en, variant_en: .variants[0].variant_name_en}'
```

**Expected:**
- `title_en` should be proper English (not Chinese or "Gold属" artifacts)
- `variant_name_en` should be translated (not just "Black"/"Tan")

---

#### Step 2: Dry Run Upload (Preview)
```bash
python3 upload_to_knack.py --with-images --product-id 1 --dry-run
```

**What to look for:**
```
[DRY RUN] Product: Rainbow Smoke, Glow-in-the-Dark...
[DRY RUN] Variant: Sandman Smoke Rainbow Luminous Suppressor (Black)
[DRY RUN] Would upload: Main_1.jpg (Primary)
[DRY RUN] Would upload: variant_001.png (Variant) variantId=RAINBOW-SMOKE-...-BLACK-87D0
[DRY RUN] Would upload: variant_002.png (Variant) variantId=RAINBOW-SMOKE-...-TAN-B663
```

**Key validation:**
- ✅ Variant images shown with `variantId=<SKU>`
- ✅ Each variant has a corresponding `variant_XXX.png` image
- ✅ SKU matches between variant record and image `variantId`

---

#### Step 3: Upload to Knack (Real)
```bash
python3 upload_to_knack.py --with-images --product-id 1
```

**Expected output:**
```
📤 UPLOAD TO KNACK
Uploading only product #1
📦 Product 1: Rainbow Smoke, Glow-in-the-Dark...
   → Created product record
   → Created: Sandman Smoke Rainbow... | ¥242.0 → $63.99
   → Created: Sandman Smoke Rainbow... | ¥227.0 → $59.99
   🖼️  Uploading 45 images...
   ✅ Primary: Main_1.jpg
   ✅ Gallery: Catalogue_1.jpg
   ✅ Variant: variant_001.png
   ✅ Variant: variant_002.png
   → Uploaded 45 images
```

---

#### Step 4: Verify Knack Data
```bash
# Check variant images in Knack Product Images table
python3 -c "
from integrations.knack_integration import KnackAPI, PRODUCT_IMAGES_OBJECT_KEY
api = KnackAPI()
images = api.get_records(PRODUCT_IMAGES_OBJECT_KEY)
variant_images = [img for img in images if img.get('field_190') == 'Variant']
print(f'✅ Found {len(variant_images)} variant images in Knack')
print('\nFirst 5 variant images:')
for img in variant_images[:5]:
    name = img.get('field_186', 'Unknown')
    variant_id = img.get('field_193', 'No variantId')
    print(f'  {name} → {variant_id[:50]}...')
"
```

**Expected output:**
```
✅ Found 10 variant images in Knack

First 5 variant images:
  variant_001.png → RAINBOW-SMOKE-GLOW-IN-THE-DARK-CHARGED-METAL...
  variant_002.png → RAINBOW-SMOKE-GLOW-IN-THE-DARK-CHARGED-METAL...
  variant_003.png → RAINBOW-SMOKE-GLOW-IN-THE-DARK-CHARGED-METAL...
```

**Validation:**
- ✅ `field_190` (imageType) = "Variant"
- ✅ `field_193` (variantId) = variant SKU (not empty!)
- ✅ Count matches number of variants scraped

---

#### Step 5: Test Frontend Image Switching
```bash
cd /Users/5425855/Documents/protocol-zero/shop
npm run dev
```

**Manual testing checklist:**
1. Navigate to product page: `http://localhost:3000/shop/1`
2. **Initial load:**
   - ✅ Default variant's image should display
3. **Select different variant:**
   - ✅ Main image switches to that variant's hero image
   - ✅ No flicker or delay
   - ✅ Gallery still shows all images
4. **Browser console:**
   - ✅ No errors about `variantImages`
   - ✅ No 404s for missing images
5. **Network tab:**
   - ✅ Variant images load from Knack CDN
   - ✅ Image URLs contain variant-specific filenames

---

### 🧪 Quick Validation Script

Run all checks at once:

```bash
#!/bin/bash
echo "🧪 Testing Variant Image Workflow..."
echo ""

# 1. Check products.json has variant image paths
echo "1️⃣ Checking products.json structure..."
VARIANT_COUNT=$(cat ai_scraper_output/products.json | jq '[.products[].variants[] | select(.image_path != "")] | length')
echo "   ✅ Found $VARIANT_COUNT variants with image_path"

# 2. Check variant screenshots exist
echo ""
echo "2️⃣ Checking variant screenshot files..."
SCREENSHOT_COUNT=$(find ai_scraper_output/media/*/variant_screenshots -name "*.png" 2>/dev/null | wc -l)
echo "   ✅ Found $SCREENSHOT_COUNT variant screenshot files"

# 3. Check image dimensions (should be cropped, not full-page)
echo ""
echo "3️⃣ Checking image dimensions (should be ~615x615, not 3420x1972)..."
SAMPLE_IMAGE=$(find ai_scraper_output/media/*/variant_screenshots -name "variant_001.png" | head -1)
if [ -f "$SAMPLE_IMAGE" ]; then
    file "$SAMPLE_IMAGE" | grep -o '[0-9]* x [0-9]*'
fi

# 4. Check if translation ran
echo ""
echo "4️⃣ Checking translations..."
HAS_ENGLISH=$(cat ai_scraper_output/products.json | jq '.products[0].title_en' | grep -v "null" | wc -l)
if [ $HAS_ENGLISH -gt 0 ]; then
    echo "   ✅ Products have English translations"
else
    echo "   ⚠️  No English translations - run: python3 translate_deepseek.py"
fi

echo ""
echo "✅ Validation complete!"
```

Save as `test_variant_workflow.sh` and run:
```bash
chmod +x test_variant_workflow.sh
./test_variant_workflow.sh
```

---

## Cost Comparison

### Old Workflow (Translate During Scraping):
- 100 products × 10 variants each = 1,000 API calls
- Each call sends product context (images, details)
- **Cost: ~$2-5** for 100 products

### New Workflow (Bulk Translate):
- 1 API call for all product titles
- 1-2 API calls for all variant names
- **Cost: ~$0.01-0.05** for 100 products
- **Savings: 99% reduction** 🎉

---

## Troubleshooting

### No translations in products.json
→ Run `python3 translate_deepseek.py --force`

### Translation cache showing old/bad translations
The scraper may have created poor-quality rule-based translations. Clear cache and re-translate:
```bash
rm -f ai_scraper_output/translation_cache.json
python3 translate_deepseek.py --force
```

### Variant images not showing on frontend
→ Check if variant images were uploaded:
```bash
python3 upload_to_knack.py --with-images --product-id 1 --dry-run
```
→ Should see: `[DRY RUN] Would upload: variant_001.png (Variant) variantId=PRODUCT-XXX-BLUE`

### Translation cache issues
→ Clear cache and re-translate:
```bash
rm ai_scraper_output/translation_cache.json
python3 translate_deepseek.py
```

### Images not uploading
→ Check media folder exists:
```bash
ls -la ai_scraper_output/media/product_001/
```

---

## File Structure

```
scraper/
├── ai_scraper.py              # Main scraper (scrape-only by default)
├── translate_deepseek.py      # Bulk translation (2-3 API calls)
├── upload_to_knack.py         # Upload to Knack with images
├── taobao_links.txt           # Input: Taobao URLs
├── ai_scraper_output/
│   ├── products.json          # Output: Product data
│   ├── translation_cache.json # Translation cache
│   └── media/
│       ├── product_001/
│       │   ├── Main/          # Main images
│       │   ├── Catalogue/     # Catalog images
│       │   ├── Details/       # Detail images (stitched)
│       │   └── variant_screenshots/  # Variant hero images
│       ├── product_002/
│       └── ...
```

---

## Best Practices

1. **Always scrape first, translate later** (default workflow)
2. **Use `--dry-run`** to preview uploads before committing
3. **Check translation cache** before forcing re-translation
4. **Verify variant image linking** with dry-run before uploading
5. **Upload products incrementally** (one at a time) to catch issues early
