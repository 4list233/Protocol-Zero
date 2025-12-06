# New Workflow: Comet-Based Translation & Data Entry

## Overview

This workflow uses **Comet Browser** for intelligent translation and data entry, eliminating the need for Gemini AI translation. The scraper collects minimal raw data, and Comet handles translation, option parsing, and price input using context from the Taobao page.

## Workflow Steps

### Step 1: Scrape Products (Minimal Data Collection)

```bash
cd scraper
python3 scraper.py
```

**What the scraper does:**
- ✅ Scrapes all products from `taobao_links.txt`
- ✅ Downloads product images (hero, gallery, details)
- ✅ Captures **Chinese product names** (stays in Chinese)
- ✅ Captures **Chinese variant names** (stays in Chinese)
- ✅ Captures **variant-specific purchase URLs** (URL after clicking each variant)
- ✅ Exports `protocol_zero_variants.csv` with raw Chinese data
- ✅ Exports `shared/data/products_manifest.json`

**What the scraper does NOT do:**
- ❌ No translation (Comet handles this)
- ❌ No price extraction (Comet handles this)
- ❌ No option parsing (Comet handles this)

**CSV Output Fields:**
- `URL` - Base product URL
- `Product Title` - Chinese product name (stays in Chinese)
- `Product Title ZH` - Chinese product name
- `Option Name` - Chinese variant name (stays in Chinese)
- `Option Name ZH` - Chinese variant name
- `Variant URL` - **Variant-specific purchase URL** (captured when variant is clicked)
- `Media Folder` - Image folder name
- `Main Images`, `Detail Images`, `Catalogue Images` - Image counts

### Step 2: Comet Browser Data Entry & Translation

**Setup:**
1. Open Comet Browser
2. Load the instruction file: `COMET_VARIANT_INPUT_INSTRUCTIONS.md` or `COMET_VARIANT_PROMPT.txt`
3. Use auto-continue script to keep Comet running:
   ```bash
   python3 comet_auto_continue.py
   ```

**What Comet does:**
1. **Opens each variant URL** from the CSV
2. **Translates product name** using Taobao page context:
   - Reads Chinese product title from page
   - Translates to English with context
   - Updates "Product Title" field in Knack
3. **Translates variant name** using page context:
   - Reads Chinese variant name from page
   - Translates to English with context
   - Updates "Variant Name" field in Knack
   - **Puts translated version in Description field** (similar to current workflow)
4. **Parses variant options** from page context:
   - Identifies Color, Size, Style options
   - Fills in Option Type 1/Value 1 and Option Type 2/Value 2 fields
5. **Extracts prices** from Taobao page:
   - Reads price in CNY
   - Inputs into Price CNY field
   - Calculates/inputs Price CAD (if applicable)
6. **Inputs variant-specific purchase URL**:
   - Uses the Variant URL from CSV
   - Inputs into new "Purchase URL" field in Knack

**Comet Input Fields in Knack:**
- Product Title (translated from Chinese)
- Variant Name (translated from Chinese)
- Description (translated variant name)
- Option Type 1 (field_145) - "Color", "Size", or "Style"
- Option Value 1 (field_146) - Normalized value
- Option Type 2 (field_147) - Secondary dimension if exists
- Option Value 2 (field_148) - Secondary value if exists
- Price CNY (extracted from page)
- Price CAD (calculated/input)
- Purchase URL (variant-specific URL from CSV)
- Stock status (if visible on page)

### Step 3: Sync Media to Shop

```bash
cd ../shared/scripts
npm run sync-media
```

**What it does:**
- Copies images from `scraper/media/` to `shop/public/images/`
- Updates manifest paths to match shop structure

### Step 4: Import to Knack

Use your existing CSV-to-Knack import script or manual import:
- Products and variants are created in Knack
- Comet fills in translation and option fields
- Images are linked via media folder paths

## Complete Command Sequence

```bash
# 1. Scrape products (minimal data - Chinese names, images, variant URLs)
cd /Users/5425855/Documents/protocol-zero/scraper
python3 scraper.py

# 2. Start Comet Browser with instructions
# - Open COMET_VARIANT_INPUT_INSTRUCTIONS.md
# - Load CSV with variant URLs
# - Run auto-continue script:
python3 comet_auto_continue.py

# 3. Comet processes each variant:
# - Opens variant URL
# - Translates product/variant names
# - Parses options (Color/Size/Style)
# - Extracts prices
# - Inputs into Knack

# 4. Sync media to shop
cd ../shared/scripts
npm run sync-media

# 5. Verify in shop
cd ../../shop
npm run dev
# Open http://localhost:3000/shop
```

## Key Differences from Old Workflow

| Old Workflow | New Workflow |
|-------------|-------------|
| Scraper does basic translation | Scraper keeps Chinese names |
| Gemini AI translates titles | Comet translates with page context |
| Scraper extracts prices | Comet extracts prices from page |
| Manual option parsing | Comet parses options from page |
| No variant URLs | Variant-specific URLs captured |
| Translation in CSV | Translation in Knack (by Comet) |

## Advantages

1. **Better Context**: Comet sees the actual Taobao page, enabling better translation
2. **Accurate Option Parsing**: Comet learns from page structure to identify Color/Size/Style
3. **Real-time Prices**: Comet extracts current prices from the live page
4. **Variant URLs**: Each variant has its own purchase URL for direct access
5. **No API Costs**: No Gemini API needed
6. **Better Quality**: Context-aware translation vs. rule-based

## Required Knack Fields

Ensure these fields exist in your Knack Variants object:

| Field | Key | Type | Description |
|-------|-----|------|-------------|
| Variant Name | field_62 | Text | Translated variant name (Comet fills) |
| Option Type 1 | field_145 | Text | "Color", "Size", or "Style" |
| Option Value 1 | field_146 | Text | Normalized value |
| Option Type 2 | field_147 | Text | Secondary dimension (nullable) |
| Option Value 2 | field_148 | Text | Secondary value (nullable) |
| Purchase URL | field_XXX | URL | Variant-specific purchase URL (NEW - needs to be created) |
| Description | field_XXX | Text | Translated variant name (Comet fills) |

**Action Required:** Create the "Purchase URL" field in Knack Variants object and note the field key.

## Troubleshooting

### Scraper not capturing variant URLs
- Ensure variants are clicked successfully
- Check that page updates after clicking (URL may change)
- Increase wait time if needed: `time.sleep(1.0)`

### Comet not translating correctly
- Ensure Comet has access to the full Taobao page
- Check that instruction file is loaded correctly
- Verify variant URL is accessible

### Missing variant URLs in CSV
- Re-run scraper with updated code
- Check that variant buttons are clickable
- Verify URL changes after clicking variant

## Next Steps

1. **Create Purchase URL field in Knack** - Add new URL field to Variants object
2. **Update CSV import script** - Include Variant URL field mapping
3. **Test workflow** - Run scraper → Comet → Verify in Knack
4. **Monitor Comet** - Use auto-continue script to keep it running

