# Complete Workflow Guide: Scrape → Knack → Notion → Website

## Quick Start

```bash
# Run complete workflow (interactive)
cd /Users/5425855/Documents/protocol-zero
./workflow.sh

# Or run in stages:
./workflow.sh --skip-review          # Skip manual image review
./workflow.sh --skip-scrape          # Start from existing scraped data
./workflow.sh --skip-stitch          # Skip image stitching
```

---

## Detailed Workflow Steps

### Step 1: Scrape + Translate + Calculate (Automated)

**What happens:**
- Scraper visits each URL in `taobao_links.txt`
- Extracts product info, variants, and prices
- Translates Chinese → English with Gemini
- Calculates CAD pricing with margins
- Captures images (Main, Gallery, Details)
- Filters out out-of-stock variants

**Output:**
```
scraper/ai_scraper_output/
  ├── products.csv          # All products + variants with pricing
  ├── products.json         # Structured JSON data
  └── screenshots/          # Raw screenshots

scraper/media/
  └── product_{n}_{slug}/
      ├── Main/             # Main product images
      │   └── Main.jpg
      ├── Catalogue/        # Gallery images
      │   ├── Gallery_01.jpg
      │   └── Gallery_02.jpg
      └── Details/          # Detail images (to be stitched)
          ├── Detail_01.jpg
          ├── Detail_02.jpg
          └── ...
```

**CSV Structure (29 products):**
```csv
URL,Product ID,Title (EN),Title (ZH),
Variant Name (EN),Variant Name (ZH),
Option Type 1,Option Value 1,
Option Type 2,Option Value 2,
Price CNY,Shipping CNY,Cost CAD,Price CAD,
Margin %,Margin Promo %,
SKU Key,In Stock,
Main Images,Gallery Images,Detail Images
```

**Command:**
```bash
cd scraper
python3 ai_scraper.py --skip-knack
```

---

### Step 2: Manual Image Review (You)

**What to do:**
1. Open `scraper/media/` folder
2. Review each product's images:
   - **Main/**: Should have 1 clear main image
   - **Catalogue/**: Gallery images showing product from different angles
   - **Details/**: Specification/detail images (will be stitched)
3. Delete any:
   - Blurry or low-quality images
   - Duplicate images
   - Placeholder images
   - Irrelevant screenshots
4. Optionally rename to improve sorting

**Image Naming Convention:**
```
product_001_tactical-belt/
  ├── Main/
  │   └── Main.jpg                    ← Keep
  ├── Catalogue/
  │   ├── Gallery_01.jpg              ← Keep best 3-5
  │   ├── Gallery_02.jpg
  │   └── Gallery_03.jpg
  └── Details/
      ├── Detail_01.jpg               ← Keep all relevant
      ├── Detail_02.jpg
      ├── Detail_03.jpg
      └── Detail_04.jpg
```

**Quality Checklist:**
- ✅ Main image: Clear, high-res, shows product well
- ✅ Gallery: Multiple angles, color variants, details
- ✅ Details: Specifications, measurements, features
- ❌ Screenshots with UI elements
- ❌ Blurry or pixelated images
- ❌ Watermarked competitor images

---

### Step 3: Stitch Detail Images (Automated)

**What happens:**
- Finds all `Detail_*.jpg` files in each product's `Details/` folder
- Resizes to max width 1200px
- Combines vertically into one long scrollable image
- Saves as `Details_Long.jpg`

**Before:**
```
Details/
  ├── Detail_01.jpg  (1200x800)
  ├── Detail_02.jpg  (1200x600)
  └── Detail_03.jpg  (1200x900)
```

**After:**
```
Details/
  ├── Detail_01.jpg
  ├── Detail_02.jpg
  ├── Detail_03.jpg
  └── Details_Long.jpg  (1200x2300) ← NEW
```

**Command:**
```bash
cd scraper
python3 stitch-details.py
```

---

### Step 4: Copy Images to Public Folder (Automated)

**What happens:**
- Copies all reviewed images from `scraper/media/` to `shop/public/images/`
- Renames with product slug prefix
- Makes images accessible to frontend

**File Mapping:**
```
scraper/media/product_001_tactical-belt/Main/Main.jpg
  → shop/public/images/974743803214-Main.jpg

scraper/media/product_001_tactical-belt/Details/Details_Long.jpg
  → shop/public/images/974743803214-Details_Long.jpg
```

**Command:**
```bash
rsync -av scraper/media/ shop/public/images/
```

---

### Step 5: Port to Knack Database (Automated)

**What happens:**
- Reads `products.csv` with all scraped data
- For each product:
  - Creates/updates product record in Knack
  - Creates/updates variant records
  - Links variants to product (field_61)
  - Populates all fields:
    - Multi-dimensional options (Type 1/2, Value 1/2)
    - Pricing (CNY, CAD, Cost, Margin)
    - Status, SKU, etc.

**Knack Structure:**
```
Products (object_6)
  ├── ID: 974743803214
  ├── Title: Tactical Belt System
  ├── URL: https://item.taobao.com/...
  └── Status: Active

Variants (object_7) - Connected to Products
  ├── Variant 1:
  │   ├── Variant Name: "S / A款套装"
  │   ├── Option Type 1: "Size"
  │   ├── Option Value 1: "S"
  │   ├── Option Type 2: "Style"
  │   ├── Option Value 2: "A款套装"
  │   ├── Price CNY: 202
  │   ├── Shipping CNY: 30
  │   ├── Cost CAD: 44.08
  │   ├── Price CAD: 72.99
  │   ├── Margin Standard: 30.5
  │   └── Margin Promo: 14.2
  ├── Variant 2: ...
  └── Variant 100: ...
```

**Command:**
```bash
cd scraper
python3 ai_scraper.py        # Push all products
# OR
python3 ai_scraper.py --test # Push only first product (testing)
```

**What gets created:**
- ✅ 29 product records
- ✅ ~2000+ variant records (varies by product)
- ✅ All multi-dimensional options populated
- ✅ All pricing calculations included
- ✅ Out-of-stock variants excluded

---

### Step 6: Sync Images to Notion (Automated)

**What happens:**
- Reads products from Knack (by ID)
- Uploads images to Notion database
- Links images to products by Product ID or SKU
- Creates Notion pages if they don't exist

**Notion Structure:**
```
Products Database (in Notion)
  ├── ID: 974743803214 (links to Knack)
  ├── SKU: (optional)
  ├── Title: "Image record for 974743803214"
  ├── Images: [Main.jpg, Gallery_01.jpg, ...]
  └── Detail Image: [Details_Long.jpg]
```

**Command:**
```bash
cd shared/scripts
node sync-media.js
```

**What gets synced:**
- ✅ Main images
- ✅ Gallery images (Catalogue)
- ✅ Stitched detail images (Details_Long)
- ❌ Raw detail images (not needed)
- ❌ Screenshots (already processed)

---

### Step 7: Verify on Website (Manual)

**Frontend Data Flow:**
```
User visits /shop/[id]
  ↓
API: GET /api/products/[id]
  ↓
Fetches from Knack:
  • Product info
  • All variants with pricing
  • Multi-dimensional options
  ↓
Fetches images from:
  • /images/ folder (fast)
  • OR Notion (fallback)
  ↓
Renders page with:
  • MultiVariantSelector (2D selection)
  • Price display
  • Image gallery
  • Add to cart
```

**Testing Steps:**

1. **Start dev server:**
```bash
cd shop
npm run dev
```

2. **Open product page:**
```
http://localhost:3000/shop/974743803214
```

3. **Verify Multi-Dimensional Selector:**
   - ✅ Two rows of buttons (Size, Style)
   - ✅ Clicking updates price
   - ✅ Shows all in-stock variants
   - ❌ No out-of-stock variants shown

4. **Verify Images:**
   - ✅ Main image displays
   - ✅ Gallery images swipeable
   - ✅ Details_Long shows scrollable specs
   - ✅ No broken image links

5. **Verify Pricing:**
   - ✅ Prices match CSV
   - ✅ Different variants show different prices
   - ✅ Format: $XX.99 CAD

6. **Test Cart:**
   - ✅ Add to cart works
   - ✅ Shows variant name (e.g., "M / B款套装")
   - ✅ Price correct in cart

---

## Troubleshooting

### Issue: Images not showing on website

**Check:**
1. Images exist in `shop/public/images/`
2. Filenames match pattern: `{product-id}-Main.jpg`
3. No special characters in filenames
4. Try hard refresh: Cmd+Shift+R

**Fix:**
```bash
# Re-copy images
cd /Users/5425855/Documents/protocol-zero
rsync -av scraper/media/ shop/public/images/
```

---

### Issue: Variants not showing multi-dimensional selector

**Check Knack fields:**
1. Open Knack Builder → Variants object
2. Verify variant has:
   - Option Type 1: "Size" (or similar)
   - Option Value 1: "M" (actual value)
   - Option Type 2: "Style" (or null)
   - Option Value 2: "B款套装" (or null)

**If missing:**
```bash
# Re-run scraper
cd scraper
python3 ai_scraper.py --test
```

---

### Issue: Pricing incorrect or missing

**Check CSV output:**
```bash
head -5 scraper/ai_scraper_output/products.csv
```

**Verify columns exist:**
- Price CNY
- Shipping CNY (should be 30)
- Cost CAD (calculated)
- Price CAD (calculated)
- Margin % (should be ~30)

**If wrong:**
1. Check `PRICING_CONFIG` in `ai_scraper.py`
2. Re-run scraper
3. Re-push to Knack

---

### Issue: Notion sync fails

**Check credentials:**
```bash
# In shop/.env.local
NOTION_API_KEY=secret_xxx
NOTION_DATABASE_ID_PRODUCTS=xxx
```

**Verify database:**
1. Open Notion
2. Check Products database exists
3. Has columns: ID, SKU, Images, Detail Image

**Re-sync:**
```bash
cd shared/scripts
node sync-media.js
```

---

## File Locations Reference

```
protocol-zero/
├── scraper/
│   ├── taobao_links.txt              # Input: 29 URLs
│   ├── ai_scraper.py                 # Main scraper
│   ├── stitch-details.py             # Image stitcher
│   ├── knack_integration.py          # Knack API
│   ├── ai_scraper_output/
│   │   ├── products.csv              # Output: All data
│   │   └── products.json
│   └── media/                        # Output: Images
│       └── product_{n}_{slug}/
├── shared/
│   └── scripts/
│       └── sync-media.js             # Notion sync
├── shop/
│   ├── public/
│   │   └── images/                   # Public images
│   ├── lib/
│   │   ├── knack-products.ts         # Knack fetcher
│   │   ├── knack-config.ts           # Field mappings
│   │   └── products.ts               # Types
│   ├── components/
│   │   └── multi-variant-selector.tsx # 2D selector
│   └── app/
│       └── shop/[id]/
│           └── page.tsx               # Product page
└── workflow.sh                        # Master script
```

---

## Next Steps After Workflow

1. **Production Deployment:**
```bash
cd shop
npm run build
vercel deploy --prod
```

2. **Add More Products:**
   - Add URLs to `taobao_links.txt`
   - Run `./workflow.sh` again

3. **Update Existing Products:**
   - Scraper will update existing records
   - Won't create duplicates (matches by Product ID)

4. **Monitor Knack:**
   - Check record counts
   - Verify no duplicate variants
   - Review pricing accuracy

5. **Customer Testing:**
   - Share staging URL
   - Test multi-dimensional selection
   - Verify cart & checkout flow
