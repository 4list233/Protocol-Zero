# Protocol Zero — Product Pipeline Workflow

> Canonical guide. Replaces all older workflow docs (SCRAPER_WORKFLOW.md, WORKFLOW_GUIDE.md, etc.)

---

## Overview

```
taobao_links.txt
      │
      ▼
  SCRAPE + TRANSLATE          ← ai_scraper.py (Claude batch translation built in)
      │
      ▼
  MANUAL REVIEW               ← you: check images, spot-check prices/variants
      │
      ▼
  STITCH DETAIL IMAGES        ← utilities/stitch_details.py
      │
      ▼
  UPLOAD TO KNACK             ← upload_to_knack.py --with-images
      │
      ▼
  VERIFY                      ← tools/verify_knack_data.py
      │
      ▼
  WEBSITE (live from Knack)   ← shop at pzairsoft.ca
```

---

## Prerequisites

```bash
cd scraper
source .venv/bin/activate       # or: python3 -m venv .venv && pip install -r requirements.txt
```

Required `.env` (in repo root):
```
ANTHROPIC_API_KEY=...           # For batch translation
KNACK_APPLICATION_ID=...
KNACK_REST_API_KEY=...
```

---

## Step 1 — Scrape + Translate

```bash
cd scraper
python3 ai_scraper.py
```

**What it does:**
- Opens Taobao in Chrome (uses saved session from `cookies.json`)
- Scrapes every URL in `scraper/taobao_links.txt` (one per line)
- Extracts: title, variants (color/size), prices (CNY), stock
- Downloads images into `ai_scraper_output/media/{taobao_id}/`
- Runs **batch Claude translation** (2 API calls total — one for all titles, one for all variants)
- Calculates CAD pricing with margins
- Saves output to `ai_scraper_output/products.json` and `products.csv`

**Output structure:**
```
scraper/ai_scraper_output/
  ├── products.json           ← structured data (used by upload_to_knack.py)
  ├── products.csv            ← spreadsheet view for manual review
  ├── translation_cache.json  ← caches translations (avoids repeat API calls)
  └── media/
      └── {taobao_id}/        ← e.g., 741196802456/
          ├── Main/
          │   └── main_01.jpg
          ├── Catalogue/
          │   ├── catalogue_01.jpg
          │   └── catalogue_02.jpg
          └── Details/
              ├── detail_01.jpg
              ├── detail_02.jpg
              └── ...
```

**Flags:**
```bash
python3 ai_scraper.py --test        # Only process first URL (for testing)
python3 ai_scraper.py --headless    # Run Chrome headless
python3 ai_scraper.py --login       # Re-do Taobao login (if session expired)
python3 ai_scraper.py --no-api      # Skip Claude API — rule-based translation only
```

> **Note:** `--push-knack` flag exists but skip it — upload manually after review (Step 4).

---

## Step 2 — Manual Review

Open `scraper/ai_scraper_output/` in Finder or VS Code and:

### Images (`media/{taobao_id}/`)
- **Main/**: Should have exactly 1 clear hero image. Delete duds.
- **Catalogue/**: Keep 3–8 best gallery shots. Delete duplicates/blurry.
- **Details/**: Keep spec/detail images. Delete ads, unrelated banners.

### Data (`products.csv`)
Open in Numbers/Excel and spot-check:
- **Title (EN)**: Does it make sense? Fix obvious mistranslations.
- **Variant names**: Are options meaningful? (e.g., "Black / L" not "黑色 / L")
- **Price CAD**: Does the selling price look reasonable?
- **In Stock**: Are out-of-stock variants correctly flagged?

If you edit the CSV, you'll need to regenerate `products.json`:
```bash
# (no script yet — manual JSON edit or re-scrape that product)
```

---

## Step 3 — Stitch Detail Images

```bash
cd scraper
python3 utilities/stitch_details.py
```

**What it does:**
- Finds all `detail_*.jpg` files in each product's `Details/` folder
- Combines them vertically into `Details_Long.jpg` (max width 1200px, seamless)
- This stitched image is what gets uploaded to Knack (not the individual files)

```bash
python3 utilities/stitch_details.py 741196802456   # Specific product only
python3 utilities/stitch_details.py --confirm       # Skip confirmation prompt
```

---

## Step 4 — Upload to Knack

```bash
cd scraper

# Preview first (no writes)
python3 upload_to_knack.py --dry-run

# Upload products + variants
python3 upload_to_knack.py

# Upload images to Knack Product Images table (object_14)
python3 upload_to_knack.py --with-images
```

**What it does:**
- Reads `ai_scraper_output/products.json`
- Creates/updates product records in Knack (`object_6`)
  - Sets: `field_45` (slug/ID), `field_46` (SKU), `field_47` (title), `field_55` (Taobao URL)
- Creates/updates variant records in Knack (`object_7`)
  - Sets: `field_61` (product connection), `field_63` (SKU), `field_62` (name), options, pricing
  - Deduplicates by variant SKU (globally unique hash — safe across products)
- With `--with-images`: uploads to `object_14` (Product Images)
  - Main image → `imageType: Primary`
  - Catalogue images → `imageType: Gallery`
  - Details_Long.jpg → `imageType: Detail`
  - Each image linked to its product via `field_188`

**Flags:**
```bash
python3 upload_to_knack.py --dry-run              # Preview, no writes
python3 upload_to_knack.py --with-images          # Include image upload
python3 upload_to_knack.py --product-id 3         # Only product #3 (1-based)
python3 upload_to_knack.py --input custom.json    # Use different JSON file
```

---

## Step 5 — Verify

```bash
cd scraper
python3 tools/verify_knack_data.py
python3 tools/verify_knack_data.py --verbose      # Show individual problem records
```

**What it checks:**
- All products have slug (`field_45`) and SKU (`field_46`)
- All products have at least 1 linked variant
- All variants have a SKU (`field_63`)
- No orphaned variants (every variant linked to a valid product)
- No orphaned images (every image linked to a valid product)
- No duplicate variant SKUs

Exit code 0 = clean, 1 = critical issues found.

---

## Adding New Products

1. Add URLs to `scraper/data/links/taobao_links.txt` (one per line)
2. Run from Step 1. The scraper skips already-scraped URLs by default (checks `products.json`).
3. Upload only new products:
   ```bash
   python3 upload_to_knack.py --product-id 30    # If it's product #30
   ```

---

## Re-seeding from Scratch

If Knack data is corrupted or you want a clean slate:

```bash
cd scraper

# 1. Clear all Knack data (order matters: variants → images → products)
python3 clear_knack_data.py

# 2. Upload fresh
python3 upload_to_knack.py --dry-run
python3 upload_to_knack.py --with-images

# 3. Verify
python3 tools/verify_knack_data.py
```

---

## Knack Schema Reference

| Object | Key | Purpose |
|--------|-----|---------|
| Products | `object_6` | One record per product |
| Variants | `object_7` | One record per size/color combo |
| Product Images | `object_14` | Images linked to products |

**Products (`object_6`) key fields:**

| Field | ID | Value |
|-------|----|-------|
| Slug/ID | `field_45` | Taobao numeric ID (e.g., `741196802456`) |
| SKU | `field_46` | Generated slug (e.g., `TACTICAL-VEST`) |
| Title | `field_47` | English title |
| URL | `field_55` | Taobao source URL |
| Status | `field_51` | `Active` |

**Variants (`object_7`) key fields:**

| Field | ID | Value |
|-------|----|-------|
| Product link | `field_61` | Connection to `object_6` |
| Name | `field_62` | e.g., `Black / Large` |
| SKU | `field_63` | Unique hash (e.g., `TACTICAL-VEST-BLACK-L-A3B2`) |
| Option Type 1 | `field_145` | e.g., `Color` |
| Option Value 1 | `field_146` | e.g., `Black` |
| Option Type 2 | `field_147` | e.g., `Size` |
| Option Value 2 | `field_148` | e.g., `L` |
| Price CAD | `field_138` | Selling price |
| Total Cost CAD | `field_153` | Cost basis |

**Product Images (`object_14`) key fields:**

| Field | ID | Value |
|-------|----|-------|
| Product link | `field_188` | Connection to `object_6` |
| Image file | `field_189` | Uploaded file |
| Type | `field_190` | `Primary` / `Gallery` / `Detail` |
| Sort order | `field_191` | 0 = first |

---

## How the Shop Uses This Data

```
User visits /shop → GET /api/products
  ↓
knack-products.ts fetches:
  1. All active products (object_6, field_51 = Active)
  2. All product images (object_14) — preloaded and grouped by product
  3. All variants (object_7) — matched to products via field_61
  ↓
Each product returns:
  - primaryImage  ← from object_14 where imageType = Primary
  - images[]      ← from object_14 where imageType = Gallery
  - detailImage   ← from object_14 where imageType = Detail
  - variants[]    ← from object_7 sorted by price_cad asc
  ↓
Product URL: /shop/{field_45}   ← uses the Taobao numeric ID as slug
```

---

## Script Locations

```
scraper/
  ai_scraper.py                     ← Step 1: scrape + translate
  upload_to_knack.py                ← Step 4: seed to Knack
  clear_knack_data.py               ← Wipe Knack clean
  utilities/
    stitch_details.py               ← Step 3: stitch detail images
    translate.py                    ← Standalone translator (rarely needed)
  tools/
    verify_knack_data.py            ← Step 5: integrity check
    check_knack_products.py         ← Quick product count check
  integrations/
    knack_integration.py            ← KnackAPI class + field mappings
  data/
    links/
      taobao_links.txt              ← Input: product URLs
    exports/
      knack_database_export.json    ← Snapshot of Knack data
  ai_scraper_output/                ← Generated (gitignored)
    products.json
    products.csv
    translation_cache.json
    media/
      {taobao_id}/
        Main/
        Catalogue/
        Details/
```
