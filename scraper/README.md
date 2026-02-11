# Taobao Product Scraper

A Python-based web scraper for extracting product information and media from Taobao listings.

## Features

- **Comprehensive Media Extraction**: Downloads all product images including main photos, variant photos, and detail photos
- **Smart Naming System**: Organized file naming convention for easy identification
- **Variant Support**: Captures all color/size options with their specific images
- **Translation**: Automatically translates Chinese product titles to English
- **CSV Export**: Saves all product data in a structured format
- **🆕 Shopify Integration**: Export scraped data directly to Shopify CSV format (see [Shopify Export](#shopify-export))

## Quick Links

- [Setup](#setup)
- [Usage](#output)
- [Media Naming Convention](#media-naming-convention)
- [**🛒 Shopify Export**](#shopify-export) ← Export to Shopify!
- [Troubleshooting](#troubleshooting)

---

## Shopify Export

**NEW:** Export your scraped Taobao products directly to Shopify-compatible CSV format!

### Quick Start

```bash
# 1. Scrape products from Taobao
python3 scraper.py

# 2. Translate titles (recommended)
python3 translate.py

# 3. Export to Shopify format
python3 shopify_export.py --margin 80

# 4. Upload shopify_import.csv to your Shopify store
```

### Features

✅ **Automated Pricing** - Calculate CAD prices with configurable margins  
✅ **Smart Collections** - Auto-categorize into Budget/Mid-Range/Premium tiers  
✅ **Variant Handling** - Proper Shopify variant structure with options  
✅ **Tag Generation** - Extract relevant tags from titles and variants  
✅ **SEO Ready** - Auto-generate meta titles and descriptions  

### Tools

- **`shopify_export.py`** - Main export script
- **`shopify_pricing_calculator.py`** - Interactive pricing tool
- **`shopify_workflow.sh`** - Automated complete workflow
- **`shopify/`** - Complete documentation folder

### Documentation

📖 **[shopify/QUICK_START.md](shopify/QUICK_START.md)** - Get started in 3 steps!  
📚 **[shopify/README.md](shopify/README.md)** - Complete Shopify export guide  
🔄 **[shopify/SHOPIFY_FORMAT_COMPARISON.md](shopify/SHOPIFY_FORMAT_COMPARISON.md)** - Format reference  
📋 **[shopify/INDEX.md](shopify/INDEX.md)** - Documentation index  

### Example Usage

```bash
# Calculate optimal pricing
python3 shopify_pricing_calculator.py --cost 100 --compare

# Export with 80% margin
python3 shopify_export.py --margin 80

# Or use the automated workflow
./shopify_workflow.sh
```

**Learn more:** See the [shopify/](shopify/) documentation folder for complete guides.

---

## Media Naming Convention

The scraper organizes downloaded media using the following naming pattern:

### Main Product Photos (Front Page)
```
{product-slug}_main_{index}.jpg
```
These are the primary product images shown in the gallery/carousel. Use these as the main front-page images.

**Example:** `womens-winter-coat_main_01.jpg`, `womens-winter-coat_main_02.jpg`

### Variant-Specific Photos (Color/Size Options)
```
{product-slug}_{variant-slug}_variant.jpg
```
Each color or size variant gets its own image showing the specific option selected.

**Example:** 
- `womens-winter-coat_red_variant.jpg`
- `womens-winter-coat_large_variant.jpg`
- `womens-winter-coat_blue-xl_variant.jpg`

### Detail Photos (Product Description)
```
{product-slug}_detail_{index}.jpg
```
These are additional detail images from the product description section (measurements, close-ups, materials, etc.).

**Example:** `womens-winter-coat_detail_01.jpg`, `womens-winter-coat_detail_02.jpg`

## Directory Structure

```
media/
└── product_{index}_{product-slug}/
    ├── {product-slug}_main_01.jpg
    ├── {product-slug}_main_02.jpg
    ├── {product-slug}_red_variant.jpg
    ├── {product-slug}_blue_variant.jpg
    ├── {product-slug}_detail_01.jpg
    └── {product-slug}_detail_02.jpg
```

## Setup

1. **Prerequisites:**
   - Chrome browser installed
   - ChromeDriver (included in project)
   - Python 3.x

2. **Install dependencies:**
   ```bash
   pip install selenium googletrans==4.0.0rc1 requests
   ```

3. **Start Chrome with remote debugging:**
   ```bash
   # macOS/Linux
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="./chrome_profile"
   
   # Windows
   chrome.exe --remote-debugging-port=9222 --user-data-dir="./chrome_profile"
   ```

4. **Add Taobao URLs:**
   Edit `taobao_links.txt` and add one product URL per line.

5. **Run the scraper:**
   ```bash
   python3 scraper.py
   ```

## Output

- **CSV File:** `protocol_zero_variants.csv` - Contains all product data
- **Media Folder:** `media/` - Organized folders for each product with all downloaded images
- **Screenshot Backup:** `screenshots/` - Fallback screenshots if direct download fails

## CSV Columns

| Column | Description |
|--------|-------------|
| URL | Original Taobao product URL |
| Product Title | Original Chinese title |
| Translated Title | English translation |
| Option Name | Variant name (color, size, etc.) |
| Price | Product price (if available) |
| Media Folder | Folder name containing all media |
| Variant Image | Specific image for this variant |
| Main Images | Count of main product images |
| Detail Images | Count of detail images |
| Variant Images | Count of variant-specific images |

## Using the Media Files

### For E-commerce Platforms:
1. **Front Page/Hero Images:** Use `*_main_*.jpg` files
2. **Color/Size Swatches:** Use `*_variant.jpg` files
3. **Product Details/Description:** Use `*_detail_*.jpg` files

### Recommended Image Usage:
- **Main Image (Hero):** `{product}_main_01.jpg`
- **Gallery Images:** `{product}_main_02.jpg` through `{product}_main_05.jpg`
- **Variant Switcher:** Show corresponding `{product}_{variant}_variant.jpg` when user selects that option
- **Description Section:** Display all `{product}_detail_*.jpg` images in sequence

## Notes

- The scraper requires Chrome to be running with remote debugging enabled
- Login to Taobao manually in the Chrome instance before running
- Large products with many variants may take several minutes to scrape
- Image quality is preserved from the original source

## Troubleshooting

- **Timeout errors:** Manually solve any CAPTCHAs in the Chrome window
- **Missing images:** Check if selectors need updating (Taobao may change their HTML)
- **Translation failures:** The scraper will continue and mark translations as failed

## License

MIT License - See LICENSE file for details
