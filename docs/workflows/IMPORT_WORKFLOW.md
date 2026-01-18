# Complete Import Workflow: Taobao → Scraper → Knack & Notion

This guide walks you through importing new Taobao products into your shop via Knack and Notion.

## Quick Start

```bash
# 1. Add links to taobao_links.txt
# 2. Run AI scraper (scrapes, translates, calculates pricing, uploads to Knack)
cd scraper
python3 ai_scraper.py

# 3. Sync media to shop
cd ../shared/scripts
npm run sync-media

# 4. Seed to Notion (images)
npm run seed-notion

# 5. Verify products are live on shop
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

### Step 2: Run AI Scraper

```bash
cd scraper
python3 ai_scraper.py
```

**What it does (all automated)**:
- Scrapes all products from `taobao_links.txt`
- Downloads product images (Main, Catalogue, Details)
- Captures variants (colors/sizes) and CNY prices
- Translates Chinese → English with Gemini AI
- **Calculates CAD pricing with margins** (see Pricing section below)
- Filters out out-of-stock variants
- Exports CSV and JSON
- **Uploads to Knack with status = 'Active'**

**Pricing Calculation (Built-in)**:
```
Cost CAD = (Price CNY + 30 shipping) × 0.19 exchange rate
Price CAD = Cost CAD ÷ (1 - 0.10 salesperson - 0.30 margin)
```

**Output**:
- `scraper/ai_scraper_output/products.csv` - All variant data with pricing
- `scraper/ai_scraper_output/products.json` - Structured JSON
- `scraper/media/product_X_slug/` - Product images

**Options**:
```bash
python3 ai_scraper.py --skip-knack  # Scrape only, don't upload to Knack
python3 ai_scraper.py --test        # Process only first product (testing)
python3 ai_scraper.py --dry-run     # Show what would be done without changes
```

**If login required**:
```bash
python3 ai_scraper.py --login-setup
```

---

### Step 3: Sync Media to Shop

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

### Step 4: Seed to Notion (Images)

```bash
npm run seed-notion
```

**What it does**:
- Reads `shared/data/products_manifest.json`
- Creates product pages in Notion Products database
- Creates variant pages in Notion Variants database
- Uploads images as Notion Files (external URLs)

**Prerequisites**:
- `NOTION_API_KEY` in `.env`
- `NOTION_DATABASE_ID_PRODUCTS` in `.env`

**Note**: Images are stored as Notion file URLs, which are then linked to Knack records.

---

### Step 5: Verify on Shop

Products should now be visible on the shop! The AI scraper automatically:
- Sets product status to `Active`
- Sets variant status to `Active` (if in stock)
- Calculates and populates all pricing fields

**Check**:
1. Visit your shop website
2. Products should appear in the product listing
3. Each product should have calculated CAD prices and margins

---

## Pricing Formula (Built into Scraper)

The `ai_scraper.py` automatically calculates all pricing during the scraping step:

### Configuration
```python
PRICING_CONFIG = {
    'exchange_rate': 0.19,        # 1 CNY = 0.19 CAD
    'shipping_cny': 30,           # Fixed shipping per item (CNY)
    'salesperson_cut': 0.10,      # 10% of revenue to salesperson
    'promoter_cut': 0.10,         # 10% to promoter (if promo code)
    'target_margin': 0.30,        # 30% target margin on sale price
}
```

### Formulas
| Field | Formula |
|-------|---------|
| **Cost CAD** | (Price CNY + 30) × 0.19 |
| **Price CAD** | Cost CAD ÷ 0.60 (then rounded to .99) |
| **Margin Standard** | (Price × 0.90 - Cost) ÷ Price |
| **Margin Promo** | (Price × 0.90 × 0.80 - Cost) ÷ (Price × 0.90) |

### Example
For a ¥100 CNY item:
- Cost CAD = (100 + 30) × 0.19 = **$24.70**
- Price CAD = $24.70 ÷ 0.60 = $41.17 → **$40.99**
- Margin Standard = **29.7%**
- Margin Promo = **13.0%**

---

## Troubleshooting

### Scraper Issues

**Login required**:
```bash
python3 ai_scraper.py --login-setup
```

**Missing images**:
- Check `scraper/media/` folder exists
- Verify product folders are created correctly
- Review scraper logs for errors

**Translation failures**:
- Check `GEMINI_API_KEY` in `scraper/.env`
- Review logs for Gemini API errors

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
│   ├── ai_scraper.py             # Main scraper (does everything)
│   ├── ai_scraper_output/
│   │   ├── products.csv          # Output with pricing
│   │   └── products.json
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
│       └── json-to-notion.js     # Seed to Notion
└── shop/
    └── public/
        └── images/               # Images for Next.js
```

---

## Environment Variables Required

### Scraper (`scraper/.env`):
```bash
GEMINI_API_KEY=your_gemini_api_key_here
KNACK_APPLICATION_ID=your_knack_app_id
KNACK_REST_API_KEY=your_knack_api_key
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

1. **Review products in Knack**: Check that all products and variants were created with correct pricing
2. **Verify on shop**: Products should appear automatically (status is set to Active)
3. **Check images**: Ensure images display correctly on product pages

---

**Last Updated**: January 2026
