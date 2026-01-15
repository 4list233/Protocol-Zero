# Complete Import Workflow: Taobao → Scraper → Knack & Notion

This guide walks you through importing new Taobao products into your shop via Knack and Notion.

## Quick Start

```bash
# 1. Add links to taobao_links.txt
# 2. Run scraper
cd scraper
python3 scraper.py

# 3. (OPTIONAL) Translate with Gemini AI - SKIP if using Comet Browser for translation
# python3 translate.py

# 4. Sync media to shop
cd ../shared/scripts
npm run sync-media

# 5. Seed to Notion (images)
npm run seed-notion

# 6. Import to Knack (products + variants)
node csv-to-knack.js

# 7. Complete pricing in Comet Browser (translates product titles & variant names)
# Follow COMET_BROWSER_INSTRUCTIONS.md
```

---

## Detailed Steps

### Step 1: Add Taobao Links

**File**: `scraper/taobao_links.txt`

Add one Taobao URL per line:
```
https://item.taobao.com/item.htm?id=123456789
https://item.taobao.com/item.htm?id=987654321
```

**Note**: The scraper will skip products that already exist (based on URL matching).

---

### Step 2: Run Scraper

```bash
cd scraper
python3 scraper.py
```

**What it does**:
- Scrapes all products from `taobao_links.txt`
- Downloads product images (Main, Catalogue, Details)
- Captures variants (colors/sizes) and prices
- Applies basic rule-based translation
- Exports `protocol_zero_variants.csv`
- Exports `shared/data/products_manifest.json`

**Output**:
- `scraper/protocol_zero_variants.csv` - All variant data
- `scraper/media/product_X_slug/` - Product images
- `shared/data/products_manifest.json` - Shop-compatible JSON

**If login required**:
```bash
python3 scraper.py --login-setup
```

---

### Step 3: (OPTIONAL) Enhance Translations with Gemini AI

**⚠️ SKIP THIS STEP if you're using Comet Browser for translation!**

Comet Browser will translate both product titles and variant names during the pricing workflow, so this step is optional.

If you want to pre-translate product titles before importing:

```bash
cd scraper
python3 translate.py
```

**What it does**:
- Reads `protocol_zero_variants.csv`
- Uses Gemini 2.5 Pro for high-quality translation
- Updates `Translated Title` column
- Caches results in `translation_cache.json`

**Translation features**:
- ✅ Removes brand names (WOSPORT, FMA, TMC, Emerson)
- ✅ Removes proprietary model numbers
- ✅ Keeps military designations (PVS-14, AN/PEQ-15, MICH 2000)
- ✅ Keeps standard models (6094, JPC, AVS)
- ✅ Airsoft/military terminology context

**Options**:
```bash
python3 translate.py              # Translate only untranslated titles
python3 translate.py --force      # Re-translate all titles
```

**Note**: Comet Browser workflow (`COMET_BROWSER_INSTRUCTIONS.md`) will translate:
- Product titles (Step 3)
- Variant names (Step 6)
- Option types and values

So you can skip this step and let Comet Browser handle all translation.

---

### Step 3 (or 4): Sync Media to Shop

```bash
cd ../shared/scripts
npm run sync-media
```

**What it does**:
- Copies images from `scraper/media/` to `shop/public/images/`
- Updates manifest paths to match shop structure
- Ensures images are accessible at `/images/...`

**Output**:
- `shop/public/images/product_X_slug/` - Images ready for Next.js

---

### Step 4 (or 5): Seed to Notion (Images)

```bash
npm run seed-notion
```

**What it does**:
- Reads `shared/data/products_manifest.json`
- Creates product pages in Notion Products database
- Creates variant pages in Notion Variants database
- Uploads images as Notion Files (external URLs)
- Auto-translates any remaining Chinese text (fallback)

**Prerequisites**:
- `NOTION_API_KEY` in `.env`
- `NOTION_DATABASE_ID_PRODUCTS` in `.env`

**Note**: Images are stored as Notion file URLs, which are then linked to Knack records.

---

### Step 5 (or 6): Import to Knack

```bash
node csv-to-knack.js
```

**What it does**:
- Reads `scraper/protocol_zero_variants.csv`
- Creates products in Knack Products object (`object_6`)
- Creates variants in Knack Variants object (`object_7`)
- Links variants to products via connection field
- Fetches Notion image URLs and updates Knack product records
- Sets initial status to `Inactive` (you'll activate after pricing)

**Prerequisites**:
- `KNACK_APPLICATION_ID` in `.env`
- `KNACK_REST_API_KEY` in `.env`
- Products must be seeded to Notion first (Step 5)

**Output**:
- Products created in Knack with:
  - Product ID (field_45)
  - SKU (field_46)
  - Title (field_47)
  - Taobao URL (field_55)
  - Notion image URLs (field_57, field_140, field_141)
- Variants created with:
  - Variant Name (field_62) - Chinese names initially
  - Price CNY (field_64) - from scraper
  - Status (field_67) - set to `Inactive`

**Note**: The script will pause before uploading images so you can review them first.

---

## After Import: Complete Pricing Workflow

After products are imported to Knack, follow the **Comet Browser workflow** (`COMET_BROWSER_INSTRUCTIONS.md`) to:

1. **Translate product titles** (Chinese → English) - removes brands, keeps military terms
2. **Translate variant names** (Chinese → English) - colors, sizes, styles
3. **Scrape updated prices** from Taobao for each variant
4. **Find Canadian competitor products** and record prices
5. **Calculate margins** using 85% of Canadian price as reference
6. **Update variant options** (Option Type 1/2, Option Value 1/2)
7. **Set status to "Margins Added"**

This workflow handles all translation, so you don't need to run `translate.py` separately.

---

## Troubleshooting

### Scraper Issues

**Login required**:
```bash
python3 scraper.py --login-setup
```

**Missing images**:
- Check `scraper/media/` folder exists
- Verify product folders are created correctly
- Review scraper logs for errors

**Translation failures**:
- Check `GEMINI_API_KEY` in `scraper/.env`
- Review `translation_cache.json` for cached results
- Run `python3 translate.py --force` to retry

---

### Notion Issues

**Missing API key**:
- Add `NOTION_API_KEY` to `.env` file
- Get key from: https://www.notion.so/my-integrations

**Database ID not found**:
- Add `NOTION_DATABASE_ID_PRODUCTS` to `.env`
- Verify database exists and integration has access

**Images not uploading**:
- Check image paths in manifest
- Verify images exist in `scraper/media/`
- Review Notion API rate limits

---

### Knack Issues

**Missing configuration**:
- Add `KNACK_APPLICATION_ID` to `.env`
- Add `KNACK_REST_API_KEY` to `.env`
- Verify field keys match your Knack setup

**Connection errors**:
- Check API key permissions
- Verify object keys (`object_6`, `object_7`) are correct
- Review field mappings in `knack-config.ts`

**Variants not linking**:
- Verify connection field format (array with record ID)
- Check product record ID is correct
- Review Knack API response for errors

---

## File Structure

```
protocol-zero/
├── scraper/
│   ├── taobao_links.txt          # ← Add new links here
│   ├── scraper.py                 # Main scraper
│   ├── translate.py              # Gemini AI translation
│   ├── protocol_zero_variants.csv # Scraper output
│   └── media/                    # Product images
│       └── product_X_slug/
│           ├── Main/
│           ├── Catalogue/
│           └── Details/
├── shared/
│   ├── data/
│   │   └── products_manifest.json # Shop-compatible JSON
│   └── scripts/
│       ├── sync-media.js         # Copy images to shop
│       ├── json-to-notion.js     # Seed to Notion
│       └── csv-to-knack.js       # Import to Knack
└── shop/
    └── public/
        └── images/               # Images for Next.js
```

---

## Environment Variables Required

### Scraper (`scraper/.env`):
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Shop/Shared (`.env` or `shop/.env.local`):
```bash
# Notion
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID_PRODUCTS=your_database_id

# Knack
KNACK_APPLICATION_ID=your_knack_app_id
KNACK_REST_API_KEY=your_knack_api_key
```

---

## Next Steps After Import

1. **Review products in Knack**: Check that all products and variants were created
2. **Follow Comet Browser workflow**: Complete pricing and margin calculations
3. **Activate products**: Set status to `Active` in Knack after pricing is complete
4. **Verify in shop**: Check that products appear correctly on your shop website

---

**Last Updated**: [Current Date]

