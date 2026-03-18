# Scraper Workflow Guide

Complete workflow for scraping Taobao products, translating with DeepSeek, and uploading to Knack.

## Prerequisites

### 1. Install Python Dependencies
```bash
cd scraper
pip3 install -r requirements.txt
```

Required packages:
- selenium
- requests
- Pillow
- python-dotenv

### 2. Configure Environment Variables
Create or update repo root `.env`:
```bash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
KNACK_APPLICATION_ID=your_knack_app_id_here
KNACK_REST_API_KEY=your_knack_api_key_here
```

### 3. Setup Taobao Links
Add product URLs to `scraper/taobao_links.txt` (one per line):
```
https://item.taobao.com/item.htm?id=123456789
https://item.taobao.com/item.htm?id=987654321
```

### 4. Login to Taobao (One-time Setup)
```bash
python3 scraper.py --login-setup
```
- Browser will open to Taobao
- Complete login (QR code or password)
- Press Enter after login to save session
- Session persists for future runs

## Complete Workflow

### Step 1: Scrape Products
```bash
cd scraper
python3 ai_scraper.py
```

**What it does:**
- Scrapes all products from `taobao_links.txt`
- Downloads product images (hero, gallery, details)
- Captures variants (colors/sizes) and prices
- Applies **basic rule-based translation** (fast but simple)
- Exports `protocol_zero_variants.csv`
- Exports `shared/data/products_manifest.json`

**Output folders:**
```
scraper/media/product_X_slug/
  ├── Main/Main.jpg          # Hero image
  ├── Catalogue/Catalogue_XX.jpg  # Gallery images
  └── Details/Detail_XX.jpg  # Detail section images
```

**Basic translations (rule-based):**
- 战术背心 → Tactical Vest
- 黑色 → Black
- 狼灰色 → Wolf Grey

### Step 2: Review detail images (manual)
- Open `scraper/ai_scraper_output/media/<product>/Details/`
- Delete any irrelevant images (recommended products, ads, etc.)

### Step 3: Stitch detail images
```bash
python3 utilities/stitch_details.py
```

**What it does:** creates `Details_Long.jpg` per product (only the stitched image is uploaded).

### Step 4: Translate with DeepSeek (separate step)
```bash
python3 translate_deepseek.py
```

### Step 5: Upload to Knack
```bash
python3 upload_to_knack.py --dry-run
python3 upload_to_knack.py --with-images
```

Notes:
- `ai_scraper.py` is **scrape-only**.
- `translate_deepseek.py` is the only translation step.
- Upload targets **Knack only** (Notion removed).

## Complete Command Sequence

Run all steps in order:

```bash
# 1. Scrape only
cd scraper
python3 ai_scraper.py

# 2. Manual review: delete unwanted detail images
# (open: scraper/ai_scraper_output/media/<product>/Details/)

# 3. Stitch detail images into Details_Long.jpg
python3 utilities/stitch_details.py

# 4. Translate with DeepSeek (writes products_translated.json)
python3 translate_deepseek.py

# 5. Upload to Knack
python3 upload_to_knack.py --dry-run
python3 upload_to_knack.py --with-images
```

## Output Files

After complete workflow:
- `scraper/ai_scraper_output/products.json` - Scrape output (Chinese + raw fields)
- `scraper/ai_scraper_output/products_translated.json` - DeepSeek translations applied
- `scraper/ai_scraper_output/translation_cache.json` - Cached DeepSeek translations
- `scraper/ai_scraper_output/media/<product>/Details/Details_Long.jpg` - Stitched detail image (after stitch step)

## Troubleshooting

### Missing DeepSeek API key
Add to repo root `.env`:
```bash
DEEPSEEK_API_KEY=your_key_here
```

### Re-translate
```bash
python3 translate_deepseek.py --force
```

## Tips

**Avoid duplicate API calls:**
- Translation cache persists in `ai_scraper_output/translation_cache.json`
- Re-running `translate_deepseek.py` only translates missing items unless `--force`

**Manual detail image filtering:**
After scraping, review `Details/` folders and delete unwanted images (ads, unrelated content) before stitching or seeding.

**Incremental scraping:**
Add new URLs to `taobao_links.txt` and re-run workflow.

**Price updates:**
Re-scrape to get latest prices, then re-run translation/upload as needed.

## Next Steps

After upload, your shop will display products from Knack (shop-side).

## Workflow Diagram

```
┌─────────────────────────────────────────────────────┐
│ 1. python3 ai_scraper.py                            │
│    ↓ Scrapes Taobao (no translation)                │
│    ↓ Downloads images                               │
│    ↓ Exports JSON/CSV into ai_scraper_output/       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 2. Manual review of Details/ images                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 3. python3 utilities/stitch_details.py              │
│    ↓ Creates Details_Long.jpg per product           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 4. python3 translate_deepseek.py                    │
│    ↓ DeepSeek bulk translation                      │
│    ↓ Writes products_translated.json                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 5. python3 upload_to_knack.py --with-images         │
│    ↓ Uploads products, variants, and images to Knack │
└─────────────────────────────────────────────────────┘
```
