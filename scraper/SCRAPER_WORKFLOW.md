# Scraper Workflow Guide

Complete workflow for scraping Taobao products, translating with Gemini AI, and seeding to Notion.

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
- google-generativeai

### 2. Configure Environment Variables
Create or update `scraper/.env`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
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
python3 scraper.py
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

### Step 2: Enhance Translations with Gemini AI
```bash
python3 translate.py
```

**What it does:**
- Reads `protocol_zero_variants.csv`
- Uses **Gemini 2.5 Pro** for high-quality translation
- Updates `Translated Title` column with AI translations
- Caches results in `translation_cache.json`

**Gemini translation features:**
- ✅ Removes brand names (WOSPORT, FMA, TMC, Emerson)
- ✅ Removes proprietary model numbers (TB-FMA-0023, HLD-2)
- ✅ Keeps military designations (PVS-14, AN/PEQ-15, MICH 2000)
- ✅ Keeps standard models (6094, JPC, AVS plate carriers)
- ✅ Airsoft/military terminology context
- ✅ E-commerce friendly naming

**Example:**
```
Before: WOSPORT战术头盔FAST高切版FMA款PVS-14夜视仪支架
After:  FAST High-Cut Tactical Helmet with PVS-14 NVG Mount
```

**Options:**
```bash
python3 translate.py              # Translate only untranslated titles
python3 translate.py --force      # Re-translate all titles
python3 translate.py --input custom.csv  # Custom CSV file
```

### Step 3: Sync Media to Shop
```bash
cd ../shared/scripts
npm run sync-media
```

**What it does:**
- Copies images from `scraper/media/` to `shop/public/images/`
- Updates manifest paths to match shop structure
- Ensures images are accessible at `/images/...`

### Step 4: Seed to Notion
```bash
npm run seed-notion
```

**What it does:**
- Reads `shared/data/products_manifest.json`
- Creates product pages in Notion Products database
- Creates variant pages in Notion Variants database
- Uploads images as Notion Files (external URLs)
- Auto-translates any remaining Chinese text (fallback)

**Note:** Seeding script now includes JavaScript translation fallback for any titles missed by Gemini.

## Complete Command Sequence

Run all steps in order:

```bash
# 1. Scrape products with basic translation
cd /Users/5425855/Documents/protocol-zero/scraper
python3 scraper.py

# 2. Enhance with Gemini AI translation
python3 translate.py

# 3. Sync media to shop public folder
cd ../shared/scripts
npm run sync-media

# 4. Seed to Notion
npm run seed-notion

# 5. Verify in shop (optional)
cd ../../shop
npm run dev
# Open http://localhost:3000/shop
```

## Output Files

After complete workflow:
- `scraper/protocol_zero_variants.csv` - Full product data with AI translations
- `scraper/translation_cache.json` - Cached Gemini translations (saves API calls)
- `shared/data/products_manifest.json` - Shop-compatible JSON
- `shop/public/images/product_X_slug/` - Images ready for Next.js

## Troubleshooting

### Scraper stuck on login
```bash
python3 scraper.py --login-setup
```
Complete login manually and save session.

### Translation rate limits
Gemini free tier: 15 requests/minute. Script includes automatic rate limiting.

### Missing Gemini API key
Add to `scraper/.env`:
```bash
GEMINI_API_KEY=your_key_here
```
Get key from: https://aistudio.google.com/apikey

### Images not showing in shop
Ensure `sync-media` step completed successfully. Check that:
- `shop/public/images/` contains product folders
- Manifest paths start with `/images/...`

### Re-translate specific products
```bash
# Edit CSV to clear 'Translated Title' for specific rows
python3 translate.py  # Will only translate empty rows
```

## Tips

**Avoid duplicate API calls:**
- Translation cache persists in `translation_cache.json`
- Re-running `translate.py` only translates new/empty titles
- Use `--force` only when needed

**Manual detail image filtering:**
After scraping, review `Details/` folders and delete unwanted images (ads, unrelated content) before stitching or seeding.

**Incremental scraping:**
Add new URLs to `taobao_links.txt` and re-run workflow. Existing products won't be duplicated in CSV.

**Price updates:**
Re-scrape to get latest prices. Notion seeding will create new pages (no upsert yet - see enhancement roadmap).

## Next Steps

After seeding, your shop will display products live from Notion:
- Visit `/shop` for product listing
- Visit `/shop/[id]` for product details
- Variant selection and cart work with live data
- Images served from Next.js public folder

## Workflow Diagram

```
┌─────────────────────────────────────────────────────┐
│ 1. python3 scraper.py                               │
│    ↓ Scrapes Taobao → Basic translation             │
│    ↓ Downloads images                               │
│    ↓ Exports CSV + JSON manifest                    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 2. python3 translate.py                             │
│    ↓ Reads CSV                                      │
│    ↓ Gemini AI translation (airsoft/military)       │
│    ↓ Updates CSV with enhanced titles               │
│    ↓ Caches results                                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 3. npm run sync-media                               │
│    ↓ Copies scraper/media → shop/public/images      │
│    ↓ Updates manifest paths                         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 4. npm run seed-notion                              │
│    ↓ Reads manifest                                 │
│    ↓ Creates Notion product + variant pages         │
│    ↓ Uploads images as Files                        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 5. Shop displays live Notion data                   │
│    ↓ Runtime API fetches from Notion                │
│    ↓ Images served from /images/                    │
│    ↓ Variants, pricing, stock all dynamic           │
└─────────────────────────────────────────────────────┘
```
