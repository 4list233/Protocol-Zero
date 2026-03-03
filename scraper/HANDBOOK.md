# Protocol Zero Scraper Handbook
## Complete Terminal Command Reference

---

## Table of Contents
1. [Setup & Login](#setup--login)
2. [Managing Taobao Links](#managing-taobao-links)
3. [Archiving Previous Data](#archiving-previous-data)
4. [Scraping Workflow](#scraping-workflow)
5. [Image Processing](#image-processing)
6. [Translation](#translation)
7. [Upload to Knack](#upload-to-knack)
8. [Troubleshooting](#troubleshooting)

---

## Setup & Login

### Initial Setup (First Time Only)
```bash
cd /Users/5425855/Documents/protocol-zero/scraper

# Install dependencies
pip3 install -r requirements.txt
```

### Re-Login to Taobao
```bash
# Launch interactive login (opens browser, logs you in, saves cookies)
python3 ai_scraper.py --login

# Follow the prompts:
# 1. Browser will open to Taobao login page
# 2. Log in manually with your credentials
# 3. Complete any verification (slider captcha, etc.)
# 4. Script will save cookies to taobao_cookies.pkl
# 5. Close browser when prompted
```

**When to re-login:**
- Cookies expired (scraper shows login errors)
- First time running scraper
- After clearing browser data

---

## Managing Taobao Links

### Add New Product Links

**Option 1: Manual Entry**
```bash
# Open the links file
nano taobao_links.txt

# Add one URL per line:
# https://item.taobao.com/item.htm?id=817287036106
# https://item.taobao.com/item.htm?id=853328243320

# Save: Ctrl+O, Enter, Ctrl+X
```

**Option 2: Bulk Paste**
```bash
# Append multiple links at once
cat >> taobao_links.txt << 'EOF'
https://item.taobao.com/item.htm?id=123456789
https://item.taobao.com/item.htm?id=987654321
EOF
```

**Option 3: From File**
```bash
# If you have links in another file
cat "scraper/data/links/taobao link scrap 1.txt" >> taobao_links.txt
```

### View Current Links
```bash
# Show all links
cat taobao_links.txt

# Count total links
wc -l taobao_links.txt

# Show links with line numbers
cat -n taobao_links.txt
```

### Remove Duplicate Links
```bash
# Remove duplicates and save
sort -u taobao_links.txt -o taobao_links.txt

# Or create backup first
cp taobao_links.txt taobao_links_backup.txt
sort -u taobao_links.txt -o taobao_links.txt
```

---

## Archiving Previous Data

### Archive Before New Scrape

**Full Archive (Recommended)**
```bash
# Create timestamped archive folder
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "ai_scraper_output/archives/archive_$TIMESTAMP"

# Move previous data to archive
mv ai_scraper_output/products.json "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true
mv ai_scraper_output/products_translated.json "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true
mv ai_scraper_output/translation_cache.json "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true

# Archive media folder (WARNING: Can be large, 1GB+)
# Only do this if you want to keep old images
mv ai_scraper_output/media "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true

echo "✅ Archived to: ai_scraper_output/archives/archive_$TIMESTAMP"
```

**Quick Archive (Data Only)**
```bash
# Archive JSON files only (keep media folder for re-use)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "ai_scraper_output/archives/archive_$TIMESTAMP"

mv ai_scraper_output/products.json "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true
mv ai_scraper_output/products_translated.json "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true
mv ai_scraper_output/translation_cache.json "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true

echo "✅ Archived data to: ai_scraper_output/archives/archive_$TIMESTAMP"
```

### Clean Slate (Delete All)
```bash
# ⚠️ WARNING: This permanently deletes all scraped data!
rm -rf ai_scraper_output/media/*
rm -f ai_scraper_output/products.json
rm -f ai_scraper_output/products_translated.json
rm -f ai_scraper_output/translation_cache.json

echo "✅ Cleaned all output data"
```

### List Archives
```bash
# Show all archives with sizes
du -sh ai_scraper_output/archives/*

# Show archives with dates
ls -lht ai_scraper_output/archives/
```

### Restore from Archive
```bash
# Replace <archive_name> with actual folder name
ARCHIVE="archive_20260303_143000"

# Restore data files
cp "ai_scraper_output/archives/$ARCHIVE/products.json" ai_scraper_output/ 2>/dev/null || true
cp "ai_scraper_output/archives/$ARCHIVE/products_translated.json" ai_scraper_output/ 2>/dev/null || true
cp "ai_scraper_output/archives/$ARCHIVE/translation_cache.json" ai_scraper_output/ 2>/dev/null || true

# Restore media (if archived)
cp -R "ai_scraper_output/archives/$ARCHIVE/media" ai_scraper_output/ 2>/dev/null || true

echo "✅ Restored from: $ARCHIVE"
```

---

## Scraping Workflow

### 1. Test Scrape (First URL Only)
```bash
# Test on first link to verify login and setup
python3 ai_scraper.py --test

# What this does:
# - Scrapes only the first URL in taobao_links.txt
# - Captures all images (Main, Catalogue, Details, Variants)
# - Does NOT translate (saves API costs)
# - Output: ai_scraper_output/products.json
```

### 2. Full Scrape (All URLs)
```bash
# Scrape all products without translation
python3 ai_scraper.py

# What this does:
# - Scrapes ALL URLs in taobao_links.txt
# - Captures all images and variant screenshots
# - Does NOT translate (scrape-only mode)
# - Creates media folders named by Taobao ID (e.g., 817287036106/)
# - Output: ai_scraper_output/products.json
```

### 3. Monitor Progress
```bash
# In another terminal, watch output folder
watch -n 5 'ls -lh ai_scraper_output/media/ | tail -20'

# Or count completed products
watch -n 5 'ls ai_scraper_output/media/ | wc -l'
```

### Common Scraping Options
```bash
# Run browser in headless mode (no visible window)
python3 ai_scraper.py --headless

# Scrape AND translate (not recommended, expensive)
python3 ai_scraper.py --translate

# Test mode with visible browser
python3 ai_scraper.py --test
```

---

## Image Processing

### Check Detail Images Need Stitching
```bash
# List products with detail images
for dir in ai_scraper_output/media/*/; do
    DETAIL_COUNT=$(ls "$dir/Details/" 2>/dev/null | grep -v "Details_Long" | wc -l)
    if [ $DETAIL_COUNT -gt 1 ]; then
        echo "$(basename $dir): $DETAIL_COUNT detail images"
    fi
done
```

### Stitch Detail Images

**Automatic Stitching (All Products)**
```bash
# Stitch all products that don't have Details_Long.jpg yet
python3 utilities/stitch_details.py

# What this does:
# - Scans all product folders in media/
# - For each product without Details_Long.jpg:
#   - Loads all Details/*.jpg images
#   - Stitches them vertically
#   - Saves as Details_Long.jpg
# - Skips products that already have Details_Long.jpg
```

**Stitch Specific Product**
```bash
# Replace <product_id> with Taobao ID
python3 utilities/stitch_details.py --product-id 817287036106
```

**Re-stitch (Force)**
```bash
# Delete existing stitched images first
find ai_scraper_output/media/*/Details -name "Details_Long.jpg" -delete

# Then re-stitch all
python3 utilities/stitch_details.py
```

### Manual Image Review/Fixing

**Open Product Images**
```bash
# Open a product's media folder in Finder
open ai_scraper_output/media/817287036106/

# View specific image types
open ai_scraper_output/media/817287036106/Main/
open ai_scraper_output/media/817287036106/Catalogue/
open ai_scraper_output/media/817287036106/Details/
open ai_scraper_output/media/817287036106/variant_screenshots/
```

**Common Manual Fixes:**
1. **Delete bad images**: Remove blurry/duplicate/watermarked images
2. **Rename for ordering**: Prefix with numbers (1_image.jpg, 2_image.jpg)
3. **Crop variant images**: If full-page screenshots, manually crop to hero image
4. **Re-stitch details**: After fixing detail images, delete Details_Long.jpg and re-run stitch

**Quick Delete Duplicates**
```bash
# Example: Delete all images with "duplicate" in name
find ai_scraper_output/media -name "*duplicate*" -delete

# Example: Delete all .DS_Store files
find ai_scraper_output/media -name ".DS_Store" -delete
```

---

## Translation

### Translate All Products (Bulk)
```bash
# Translate ALL product titles and variant names in 2-3 API calls
python3 translate_deepseek.py

# What this does:
# - Reads ai_scraper_output/products.json
# - Batch translates all product titles (1 API call)
# - Batch translates all variant names (1-2 API calls)
# - Generates product SKUs from English titles
# - Output: ai_scraper_output/products_translated.json
# - Cost: ~$0.01-0.05 for 100 products (99% cheaper than per-item)
```

### Force Re-translate (Clear Cache)
```bash
# Clear translation cache and re-translate
rm -f ai_scraper_output/translation_cache.json
python3 translate_deepseek.py

# Or use --force flag (keeps cache but ignores it)
python3 translate_deepseek.py --force
```

### Verify Translations
```bash
# Check first product's translations
cat ai_scraper_output/products_translated.json | jq '.products[0] | {
  title_zh,
  title_en,
  product_sku,
  variants: [.variants[0] | {variant_name_zh, variant_name_en, sku}]
}'

# Check all products have English titles
cat ai_scraper_output/products_translated.json | jq '.products[] | .title_en' | head -20

# Count translated products
cat ai_scraper_output/products_translated.json | jq '.products | length'
```

### Translation Troubleshooting

**Still seeing Chinese after translation?**
```bash
# 1. Check you're reading the right file
cat ai_scraper_output/products_translated.json | jq '.products[0].title_en'

# 2. If it's still Chinese, clear cache and force re-translate
rm -f ai_scraper_output/translation_cache.json
python3 translate_deepseek.py --force

# 3. If Chinese persists in products.json (not translated file), it's fine
# Upload script uses products_translated.json by default
```

---

## Upload to Knack

### 1. Dry Run (Preview Upload)
```bash
# Preview what will be uploaded WITHOUT actually uploading
python3 upload_to_knack.py --with-images --product-id 1 --dry-run

# What to check:
# ✅ Product title is in English (not Chinese)
# ✅ Variant names are in English
# ✅ Shows "Uploading X images from <media_folder>"
# ✅ Lists all image types: Main, Catalogue, Details, Variant
# ✅ Variant images show variantId=<SKU>
# ✅ Pricing shows CNY → CAD conversion
```

### 2. Upload Single Product (Test)
```bash
# Upload product #1 with images
python3 upload_to_knack.py --with-images --product-id 1

# Monitor output:
# - "Created product record" or "Found existing product"
# - "Created: <variant_name> | ¥XX → $YY" for each variant
# - "Uploading X images from <media_folder>..."
# - "✅ Primary: Main_1.jpg"
# - "✅ Gallery: Catalogue_1.jpg"
# - "✅ Detail: Details_Long.jpg"
# - "✅ Variant: variant_001.png"
# - "Uploaded X images"
```

### 3. Upload Multiple Products
```bash
# Upload products 1-5
for i in {1..5}; do
    echo "📦 Uploading product $i..."
    python3 upload_to_knack.py --with-images --product-id $i
    echo ""
done

# Upload products 1-10 with error handling
for i in {1..10}; do
    echo "📦 Uploading product $i..."
    python3 upload_to_knack.py --with-images --product-id $i || echo "⚠️ Product $i failed, continuing..."
    echo ""
done
```

### 4. Upload All Products
```bash
# Count total products first
TOTAL=$(cat ai_scraper_output/products_translated.json | jq '.products | length')
echo "Total products: $TOTAL"

# Upload all
for i in $(seq 1 $TOTAL); do
    echo "📦 Uploading product $i of $TOTAL..."
    python3 upload_to_knack.py --with-images --product-id $i
    echo ""
done
```

### Upload Options Reference

```bash
# Dry run (preview only, no upload)
python3 upload_to_knack.py --with-images --product-id 1 --dry-run

# Upload without images (data only)
python3 upload_to_knack.py --product-id 1

# Upload with images (recommended)
python3 upload_to_knack.py --with-images --product-id 1

# Upload from specific JSON file
python3 upload_to_knack.py --with-images --product-id 1 --input custom_products.json
```

### Verify Upload in Knack

**Check via Script**
```bash
# List recently uploaded products
python3 -c "
from integrations.knack_integration import KnackAPI, PRODUCTS_OBJECT_KEY
api = KnackAPI()
products = api.get_records(PRODUCTS_OBJECT_KEY)
print(f'✅ Total products in Knack: {len(products)}')
print('\nLast 5 products:')
for p in products[-5:]:
    title = p.get('field_144', 'No title')[:50]
    print(f'  - {title}')
"

# Check variant images uploaded
python3 -c "
from integrations.knack_integration import KnackAPI, PRODUCT_IMAGES_OBJECT_KEY
api = KnackAPI()
images = api.get_records(PRODUCT_IMAGES_OBJECT_KEY)
variant_imgs = [img for img in images if img.get('field_190') == 'Variant']
print(f'✅ Total variant images: {len(variant_imgs)}')
"
```

**Check in Knack UI**
1. Go to https://pzairsoft.knack.com/admin
2. Navigate to: Data → Products
3. Verify product appears with English title
4. Navigate to: Data → Product Images
5. Filter by imageType = "Variant"
6. Verify variantId field is populated

---

## Complete Workflow (Start to Finish)

### Full Production Workflow
```bash
# === STEP 0: PREPARATION ===
cd /Users/5425855/Documents/protocol-zero/scraper

# Archive previous data (optional)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "ai_scraper_output/archives/archive_$TIMESTAMP"
mv ai_scraper_output/products*.json "ai_scraper_output/archives/archive_$TIMESTAMP/" 2>/dev/null || true

# Add new Taobao links
nano taobao_links.txt
# (Paste URLs, one per line, save with Ctrl+O, Enter, Ctrl+X)

# Verify links
cat taobao_links.txt | wc -l
echo "Total links to scrape: ^^"

# === STEP 1: SCRAPE (No Translation) ===
echo "Starting scrape..."
python3 ai_scraper.py

# Wait for completion (this can take a while)
# Output: ai_scraper_output/products.json + media/<taobao_id>/ folders

# === STEP 2: IMAGE PROCESSING ===
# Stitch detail images
echo "Stitching detail images..."
python3 utilities/stitch_details.py

# Manual review (optional)
# Open folders and check images, remove bad ones, fix names, etc.
# open ai_scraper_output/media/

# === STEP 3: BULK TRANSLATION ===
echo "Translating products..."
python3 translate_deepseek.py

# Verify translations
cat ai_scraper_output/products_translated.json | jq '.products[0] | {title_en, variants: [.variants[0].variant_name_en]}'

# === STEP 4: DRY RUN TEST ===
echo "Testing upload with dry run..."
python3 upload_to_knack.py --with-images --product-id 1 --dry-run

# Review output - check for:
# ✅ English titles/variants
# ✅ Images found in media folder
# ✅ Variant images linked with variantId

# === STEP 5: UPLOAD FIRST PRODUCT ===
echo "Uploading first product (real)..."
python3 upload_to_knack.py --with-images --product-id 1

# Verify in Knack UI or via frontend
# http://localhost:3000/shop/1 (if running local dev server)

# === STEP 6: UPLOAD ALL PRODUCTS ===
TOTAL=$(cat ai_scraper_output/products_translated.json | jq '.products | length')
echo "Uploading all $TOTAL products..."

for i in $(seq 1 $TOTAL); do
    echo "📦 Uploading product $i of $TOTAL..."
    python3 upload_to_knack.py --with-images --product-id $i || echo "⚠️ Failed, continuing..."
    sleep 1  # Rate limiting
done

echo "✅ COMPLETE! Uploaded $TOTAL products to Knack"
```

---

## Troubleshooting

### Scraper Issues

**Login Failed / Cookies Expired**
```bash
# Re-login
python3 ai_scraper.py --login

# Then try scraping again
python3 ai_scraper.py --test
```

**Browser Won't Open**
```bash
# Check Chrome/Chromium installed
which google-chrome
which chromium

# Try headless mode
python3 ai_scraper.py --headless --test
```

**Scraper Hangs on Product**
```bash
# Stop with Ctrl+C
# Check products.json for partial data
cat ai_scraper_output/products.json | jq '.products | length'

# Resume: Edit taobao_links.txt to remove completed URLs
# Then run scraper again (it will append to products.json)
```

### Translation Issues

**Chinese Still Showing After Translation**
```bash
# 1. Verify translated file exists
ls -lh ai_scraper_output/products_translated.json

# 2. Clear cache and force re-translate
rm -f ai_scraper_output/translation_cache.json
python3 translate_deepseek.py --force

# 3. Check translation output
cat ai_scraper_output/products_translated.json | jq '.products[0].title_en'
```

**DeepSeek API Error**
```bash
# Check API key is set
echo $DEEPSEEK_API_KEY

# If empty, set it:
export DEEPSEEK_API_KEY="your-api-key-here"

# Or add to ~/.zshrc for persistence:
echo 'export DEEPSEEK_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### Upload Issues

**"No images found in media folder"**
```bash
# Check media folder exists
PRODUCT_ID=1
FOLDER=$(cat ai_scraper_output/products_translated.json | jq -r ".products[$PRODUCT_ID-1].media_folder")
echo "Looking for: ai_scraper_output/media/$FOLDER"
ls -la "ai_scraper_output/media/$FOLDER"

# If folder doesn't exist, check products.json media_folder field
cat ai_scraper_output/products_translated.json | jq '.products[] | .media_folder'
```

**"KeyError: field_XXX"**
```bash
# Knack field IDs may have changed
# Check integrations/knack_integration.py for correct field mappings
cat integrations/knack_integration.py | grep -A 20 "PRODUCT_FIELDS ="
```

**Upload Fails Halfway**
```bash
# Check which products were uploaded
python3 -c "
from integrations.knack_integration import KnackAPI, PRODUCTS_OBJECT_KEY
api = KnackAPI()
products = api.get_records(PRODUCTS_OBJECT_KEY)
print(f'Products in Knack: {len(products)}')
"

# Resume from next product
# If 5 products uploaded, resume with:
python3 upload_to_knack.py --with-images --product-id 6
```

### Image Issues

**Variant Images Not Switching on Frontend**
```bash
# 1. Verify variant images uploaded with variantId
python3 -c "
from integrations.knack_integration import KnackAPI, PRODUCT_IMAGES_OBJECT_KEY
api = KnackAPI()
images = api.get_records(PRODUCT_IMAGES_OBJECT_KEY)
variant_imgs = [img for img in images if img.get('field_190') == 'Variant']
print(f'Variant images: {len(variant_imgs)}')
for img in variant_imgs[:3]:
    print(f'  variantId: {img.get(\"field_193\", \"MISSING\")[:30]}...')
"

# 2. Check frontend console for errors
# Open browser dev tools: Cmd+Option+I
# Look for errors related to variantImages

# 3. Clear Next.js cache
cd ../shop
rm -rf .next
npm run dev
```

**Details_Long.jpg Too Small/Too Large**
```bash
# Check image size
file ai_scraper_output/media/*/Details/Details_Long.jpg

# Re-stitch with different settings
# Edit utilities/stitch_details.py:
# - Change max_width (line ~30) for wider/narrower output
# - Change quality (line ~50) for file size control

# Delete and re-stitch
find ai_scraper_output/media/*/Details -name "Details_Long.jpg" -delete
python3 utilities/stitch_details.py
```

---

## Quick Reference Card

```bash
# === COMMON COMMANDS ===

# Scrape all products (no translation)
python3 ai_scraper.py

# Translate all products (bulk)
python3 translate_deepseek.py

# Stitch detail images
python3 utilities/stitch_details.py

# Dry run upload
python3 upload_to_knack.py --with-images --product-id 1 --dry-run

# Upload single product
python3 upload_to_knack.py --with-images --product-id 1

# Upload all products
for i in {1..10}; do python3 upload_to_knack.py --with-images --product-id $i; done

# === VERIFICATION ===

# Count scraped products
cat ai_scraper_output/products.json | jq '.products | length'

# Count translated products
cat ai_scraper_output/products_translated.json | jq '.products | length'

# List media folders
ls ai_scraper_output/media/

# Check translation quality
cat ai_scraper_output/products_translated.json | jq '.products[0] | {title_en, variants: [.variants[0].variant_name_en]}'

# === TROUBLESHOOTING ===

# Re-login to Taobao
python3 ai_scraper.py --login

# Force re-translate
rm ai_scraper_output/translation_cache.json && python3 translate_deepseek.py

# Check Knack products
python3 -c "from integrations.knack_integration import KnackAPI, PRODUCTS_OBJECT_KEY; print(len(KnackAPI().get_records(PRODUCTS_OBJECT_KEY)), 'products')"
```

---

## File Locations Reference

```
scraper/
├── ai_scraper.py                   # Main scraper script
├── translate_deepseek.py           # Bulk translation script
├── upload_to_knack.py              # Upload to Knack script
├── taobao_links.txt                # INPUT: Taobao URLs (one per line)
├── taobao_cookies.pkl              # Saved Taobao login cookies
├── requirements.txt                # Python dependencies
├── utilities/
│   └── stitch_details.py           # Stitch detail images script
├── integrations/
│   └── knack_integration.py        # Knack API integration
├── ai_scraper_output/
│   ├── products.json               # OUTPUT: Raw scraped data (Chinese)
│   ├── products_translated.json    # OUTPUT: Translated data (English)
│   ├── translation_cache.json      # Translation cache
│   ├── media/
│   │   ├── 817287036106/           # Product media folder (Taobao ID)
│   │   │   ├── Main/               # Main product images
│   │   │   ├── Catalogue/          # Catalogue/gallery images
│   │   │   ├── Details/            # Detail images + Details_Long.jpg
│   │   │   └── variant_screenshots/ # Variant-specific images
│   │   ├── 853328243320/           # Another product...
│   │   └── ...
│   └── archives/
│       ├── archive_20260303_120000/ # Archived data
│       └── ...
├── WORKFLOW.md                     # Detailed workflow documentation
├── QUICKSTART.md                   # Quick start guide
└── HANDBOOK.md                     # This file (command reference)
```

---

## Need Help?

**Check logs:**
- Scraper output is printed to terminal (capture with `tee`):
  ```bash
  python3 ai_scraper.py 2>&1 | tee scraper_log.txt
  ```

**Report issues:**
- Check existing documentation first: WORKFLOW.md, QUICKSTART.md
- Check troubleshooting section above
- Provide command output and error messages

**API Keys:**
- DeepSeek API: Required for translation
  - Get key: https://platform.deepseek.com/
  - Set: `export DEEPSEEK_API_KEY="your-key"`
- Knack API: Required for upload (should be in .env)
  - Check: `cat .env | grep KNACK`
