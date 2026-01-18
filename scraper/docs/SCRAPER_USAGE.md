# AI Scraper Usage Guide

## Overview

The `ai_scraper.py` script scrapes Taobao product pages, extracts variant information, translates Chinese text to English, and calculates CAD pricing with margins.

## Prerequisites

1. **Python 3.10+** with dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. **Chrome browser** installed

3. **Environment variables** in `shop/.env.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   KNACK_APPLICATION_ID=your_knack_app_id
   KNACK_REST_API_KEY=your_knack_api_key
   ```

4. **Taobao login** (first time setup):
   ```bash
   python3 ai_scraper.py --login
   ```

## Command Line Options

```bash
python3 ai_scraper.py [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--help` | Show help message |
| `--login` | Interactive login setup (opens browser for Taobao login) |
| `--test` | Test on first URL only |
| `--headless` | Run browser in headless mode (no visible window) |
| `--push-knack` | Push to Knack after scraping (default: scrape only) |
| `--dry-run` | Simulate Knack updates without making changes |
| `--no-api` | No API calls (DOM/rule-based translation only) |
| `--batch-translate` | Batch all translations at end (more efficient) |

## Usage Examples

### Basic Scraping (Recommended)
```bash
# Scrape all URLs, skip Knack upload
python3 ai_scraper.py
```

### Test Mode
```bash
# Test on first URL only
python3 ai_scraper.py --test
```

### Batch Translation (API Efficient)
```bash
# Collect all texts, translate in single API call at end
python3 ai_scraper.py --batch-translate
```

### Headless Mode
```bash
# Run without visible browser window
python3 ai_scraper.py --headless
```

### Push to Knack
```bash
# Scrape AND upload to Knack database
python3 ai_scraper.py --push-knack
```

### Dry Run (Preview Knack Changes)
```bash
# See what would be uploaded without making changes
python3 ai_scraper.py --push-knack --dry-run
```

### No API Mode (Offline)
```bash
# Use only rule-based translation (no Gemini API)
python3 ai_scraper.py --no-api
```

## Input File

Add Taobao product URLs to `taobao_links.txt` (one per line):
```
https://item.taobao.com/item.htm?id=123456789
https://item.taobao.com/item.htm?id=987654321
# Lines starting with # are ignored
```

## Output Files

After scraping, find results in the `output/` directory:

| File | Description |
|------|-------------|
| `products.json` | Full product data with all variants and pricing |
| `products.csv` | Spreadsheet-friendly format for review |

## Media Files

Images are saved in `media/` directory:
```
media/
├── product_1_tactical-vest/
│   ├── Main/
│   │   └── main_01.jpg
│   ├── Catalogue/
│   │   ├── catalogue_01.jpg
│   │   └── catalogue_02.jpg
│   └── Details/
│       ├── detail_01.jpg
│       └── detail_02.jpg
└── product_2_molle-pouch/
    └── ...
```

## Pricing Configuration

The scraper calculates CAD prices using these settings (in `ai_scraper.py`):

```python
PRICING_CONFIG = {
    'shipping_cny': 30,        # ¥30 shipping per item
    'exchange_rate': 0.19,     # 1 CNY = 0.19 CAD
    'salesperson_cut': 0.10,   # 10% salesperson commission
    'promoter_cut': 0.10,      # 10% promoter commission
    'target_margin': 0.30,     # 30% target margin
}
```

### Pricing Formula
1. **Cost CAD** = (Price CNY + Shipping) × Exchange Rate
2. **Price CAD** = Cost CAD ÷ (1 - Target Margin)
3. **Margin Standard** = After salesperson cut (10%)
4. **Margin Promo** = After salesperson + promoter cuts (20%)

## Translation Rules

The AI translator follows these rules:

1. **KEEP** all model numbers and codes (e.g., `HL-ACC-73-T`, `L4G24`, `6094`)
2. **REMOVE** only Chinese brand names (WUKONG, WOSPORT, JUNMA)
3. **TRANSLATE** materials: Metal, Aluminum, Polymer, Nylon
4. **TRANSLATE** colors: Black, Tan, OD Green, Grey, Brown
5. **USE** tactical terminology: Plate Carrier, MOLLE, Pouch, Holster

## Workflow

### Step 1: Scrape Products
```bash
python3 ai_scraper.py --batch-translate
```

### Step 2: Review Output
- Check `output/products.csv` for data accuracy
- Review images in `media/` folder
- Stitch detail images if needed (`Details_Long.jpg`)

### Step 3: Upload to Knack (After Review)
```bash
python3 upload_to_knack.py --dry-run    # Preview first
python3 upload_to_knack.py --sync-media # Upload + sync images
```

## Troubleshooting

### Login Issues
```bash
# Re-run login setup
python3 ai_scraper.py --login
```

### Rate Limiting
The scraper automatically handles Gemini API rate limits with 15-second delays and model fallback chain:
`gemini-2.5-flash → gemini-2.5-flash-lite → gemini-3-flash → gemma-3-27b`

### Timeout Errors
If products time out, they may have complex page structures. Try running again or use `--no-api` for offline mode.

### No Variants Found
Some products use non-standard variant selectors. The scraper will attempt multiple detection methods (structured → click enumeration → fallback).

## Upload Script

After scraping and review, use `upload_to_knack.py`:

```bash
python3 upload_to_knack.py --help

Options:
  --dry-run         Preview without uploading
  --sync-media      Sync images to shop/public/images
  --product-id N    Upload specific product only
```
