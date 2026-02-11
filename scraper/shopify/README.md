# Shopify Export Module for Protocol Zero

Complete data pipeline to transform Taobao scraper output into Shopify-compatible import CSV format.

## 📋 Overview

This module converts your scraped Taobao product data (`protocol_zero_variants.csv`) into Shopify's CSV import format, handling:

- ✅ **Product & Variant Structure** - Proper Shopify variant hierarchy
- ✅ **Automated Pricing** - Cost calculation with configurable margins
- ✅ **Collections & Tags** - Smart categorization based on product types and prices
- ✅ **Image Handling** - Hero, variant, and detail images
- ✅ **SEO Metadata** - Auto-generated titles and descriptions
- ✅ **Multi-language Support** - English titles from translated Chinese data

## 🚀 Quick Start

### Basic Usage

```bash
# Export all products with default 50% margin
python3 shopify_export.py

# Export with custom margin (100% = 2x markup)
python3 shopify_export.py --margin 100

# Use custom exchange rate
python3 shopify_export.py --exchange-rate 0.20 --margin 80
```

### Advanced Options

```bash
# Export specific CSV file
python3 shopify_export.py --input custom_products.csv --output my_shopify.csv

# Full configuration
python3 shopify_export.py \
  --input protocol_zero_variants.csv \
  --output shopify_import.csv \
  --margin 75 \
  --exchange-rate 0.19 \
  --shipping 30
```

## 📊 Data Flow

```
Taobao Scraper → protocol_zero_variants.csv → Shopify Export → shopify_import.csv → Shopify Import
```

### Input Format (protocol_zero_variants.csv)

The scraper generates this CSV with columns:
- `URL` - Taobao product URL
- `Product Title` - English translated title
- `Product Title ZH` - Original Chinese title
- `Option Name` - Variant name (e.g., "Black", "Medium")
- `Option Name ZH` - Original Chinese variant name
- `Variant URL` - Direct link to specific variant
- `Price CNY` - Cost in Chinese Yuan
- `Media Folder` - Folder containing product images
- `Main Images`, `Detail Images`, `Catalogue Images` - Image counts

### Output Format (shopify_import.csv)

Shopify-compatible CSV with all required fields:
- Product-level: Handle, Title, Description, Collections, Tags
- Variant-level: SKU, Options (Color/Size/Material), Price, Cost, Images
- SEO: Meta titles, descriptions, Google Shopping fields

## 💰 Pricing Strategy

### How Pricing Works

The module uses the **same pricing logic as csv_to_knack.py** to ensure consistency. This accounts for:

1. **Base Cost** - Taobao product cost (CNY)
2. **Shipping** - Default ¥30 CNY per item
3. **Salesperson Cut** - 10% commission
4. **Promoter Cut** - 10% commission (when applicable)
5. **Target Margin** - Your desired net profit after all cuts

### Pricing Formula

```
Total Cost (CAD) = (Product Cost CNY + Shipping CNY) × Exchange Rate

Selling Price = Total Cost / (1 - Salesperson Cut - Target Margin)

True Profit = (Selling Price × (1 - Salesperson Cut)) - Total Cost

Net Margin = (True Profit / Selling Price) × 100%
```

### Example Calculations

**Budget Tier (30% Target Margin):**
```
Product Cost:     ¥50 CNY
Shipping:         ¥30 CNY
Total Cost CNY:   ¥80 CNY
Total Cost CAD:   ¥80 × 0.19 = $15.20 CAD

Selling Price:    $15.20 / (1 - 0.10 - 0.30) = $15.20 / 0.60 = $25.33
Rounded:          $24.99 CAD

Revenue after salesperson: $24.99 × (1 - 0.10) = $22.49
True Profit:      $22.49 - $15.20 = $7.29
Net Margin:       ($7.29 / $24.99) × 100 = 29.17%

Collection: Budget ($0-$25) ✅
```

**Mid-Range Tier (30% Target Margin):**
```
Product Cost:     ¥120 CNY
Shipping:         ¥30 CNY  
Total Cost:       (120 + 30) × 0.19 = $28.50 CAD

Selling Price:    $28.50 / 0.60 = $47.50 → $46.99 CAD

After salesperson: $46.99 × 0.90 = $42.29
True Profit:      $42.29 - $28.50 = $13.79
Net Margin:       29.34%

Collection: Mid-Range ($25-$75) ✅
```

**Premium Tier (30% Target Margin):**
```
Product Cost:     ¥350 CNY
Shipping:         ¥30 CNY
Total Cost:       (350 + 30) × 0.19 = $72.20 CAD

Selling Price:    $72.20 / 0.60 = $120.33 → $119.99 CAD

After salesperson: $119.99 × 0.90 = $107.99
True Profit:      $107.99 - $72.20 = $35.79
Net Margin:       29.83%

Collection: Premium ($75+) ✅
```

### Why This Matters

- **Consistent with existing workflow** - Same pricing as Knack database
- **Accounts for all costs** - Salesperson and promoter cuts included
- **True margins** - Shows actual profit after commissions
- **Price tiers maintained** - Products fall into correct collections

## 🎨 Product Collections

Products are automatically categorized into collections based on final selling price:

- **Budget** - $0 to $25 (entry-level tactical gear)
- **Mid-Range** - $25 to $75 (quality airsoft equipment)
- **Premium** - $75+ (high-end gear and systems)
- **All Products** - Default fallback collection

### Customizing Collections

Edit `shopify_collections.json`:

```json
{
  "budget": "Budget Gear ($0-$25)",
  "mid_range": "Standard Equipment ($25-$75)",
  "premium": "Professional Grade ($75+)",
  "default": "All Tactical Gear"
}
```

## 🏷️ Tags & Categorization

### Automatic Tag Generation

The module extracts tags from:
1. **Product titles** - "holster", "vest", "helmet", "optic"
2. **Variant options** - "black", "tan", "multicam", "od green"
3. **Product types** - "tactical gear", "airsoft equipment"

### Example Tag Sets

**Holster Product:**
```
airsoft, tactical gear, holster, kydex, black, tan
```

**Plate Carrier:**
```
airsoft, tactical gear, vest, plate carrier, molle, black, coyote, multicam
```

## 📦 Shopify Import Process

### Step 1: Generate Export

```bash
python3 shopify_export.py --margin 80
```

Output: `shopify_import.csv` (ready for Shopify)

### Step 2: Upload to Shopify

1. Go to **Shopify Admin** → **Products** → **Import**
2. Click **Add file** and select `shopify_import.csv`
3. Shopify will validate the CSV
4. Review the preview (products, variants, images)
5. Click **Import products**

### Step 3: Post-Import Tasks

✅ **Verify Images** - Check hero and variant images loaded correctly  
✅ **Review Descriptions** - Customize product descriptions  
✅ **Set Inventory** - Update stock quantities  
✅ **Configure Shipping** - Set shipping rates and zones  
✅ **Add to Collections** - Manually add to additional collections  
✅ **SEO Optimization** - Refine meta titles/descriptions  

## 🖼️ Image Management

### Automatic Image URL Construction

If you provide a base URL, the module automatically constructs image URLs from your media folders:

```bash
python3 shopify_export.py \
  --margin 30 \
  --base-url "https://cdn.yourstore.com/products/"
```

### Image URL Patterns

The scraper organizes images using this naming convention:

**Hero/Main Image (Position 1):**
```
{base_url}/{media_folder}/{product_slug}_main_01.jpg
Example: https://cdn.yourstore.com/products/product_1_combat-holster/combat-holster_main_01.jpg
```

**Variant Images (Positions 2-N):**
```
{base_url}/{media_folder}/{product_slug}_{variant_slug}_variant.jpg
Example: https://cdn.yourstore.com/products/product_1_combat-holster/combat-holster_black-medium_variant.jpg
```

**Detail Images (Additional positions):**
```
{base_url}/{media_folder}/{product_slug}_detail_01.jpg
Example: https://cdn.yourstore.com/products/product_1_combat-holster/combat-holster_detail_01.jpg
```

### Image Structure in Shopify CSV

```csv
Handle,Title,Image Src,Image Position,Image Alt Text
combat-holster-123,Combat Holster,https://.../combat-holster_main_01.jpg,1,Combat Holster - Hero
combat-holster-123,,https://.../combat-holster_black-m_variant.jpg,2,Combat Holster - Black-Medium
combat-holster-123,,https://.../combat-holster_tan-m_variant.jpg,3,Combat Holster - Tan-Medium
combat-holster-123,,https://.../combat-holster_detail_01.jpg,4,Combat Holster - Details
```

### Setting Up Image Hosting

**Option 1: CDN (Recommended)**
```bash
# Upload media folders to CDN
aws s3 sync scraper/media/ s3://your-bucket/products/ --acl public-read

# Export with CDN URL
python3 shopify_export.py --base-url "https://your-cdn.cloudfront.net/products/"
```

**Option 2: Shopify Hosting**
```bash
# Export without images first
python3 shopify_export.py --margin 30

# Upload images via Shopify bulk editor after import
# Products > Select All > Edit Products > Add Images
```

**Option 3: Local Development**
```bash
# For testing, use local file paths (won't work in production)
python3 shopify_export.py --base-url "file:///Users/you/Documents/protocol-zero/scraper/media/"
```

### Image Best Practices

1. **Image Size**: 2048x2048px recommended (Shopify resizes automatically)
2. **Format**: JPG or PNG (JPG for photos, PNG for graphics)
3. **File Size**: < 5MB per image
4. **Naming**: Use scraper's automatic naming convention
5. **Alt Text**: Auto-generated as "{Product} - {Variant}"

### Without Base URL

If you don't provide `--base-url`, the CSV will have empty `Image Src` fields. You can add images later in Shopify:

1. Import products without images
2. Go to Products > Select products
3. Click "Edit products"
4. Upload images via bulk editor
5. Or add images individually per product

## 🔧 Configuration Files

### shopify_collections.json

Defines collection mapping and default tags:

```json
{
  "budget": "Budget ($0-$25)",
  "mid_range": "Mid-Range ($25-$75)",
  "premium": "Premium ($75+)",
  "default": "All Products",
  "default_tags": ["airsoft", "tactical", "protocol-zero"]
}
```

## 📈 Pricing Examples

### Budget Tier (50% Margin)

```
Taobao: ¥60 CNY → Cost: $17.10 CAD → Price: $25.65 CAD → Collection: Budget
Taobao: ¥40 CNY → Cost: $13.30 CAD → Price: $19.95 CAD → Collection: Budget
```

### Mid-Range Tier (80% Margin)

```
Taobao: ¥120 CNY → Cost: $28.50 CAD → Price: $51.30 CAD → Collection: Mid-Range
Taobao: ¥180 CNY → Cost: $39.90 CAD → Price: $71.82 CAD → Collection: Mid-Range
```

### Premium Tier (100% Margin)

```
Taobao: ¥350 CNY → Cost: $72.20 CAD → Price: $144.40 CAD → Collection: Premium
Taobao: ¥500 CNY → Cost: $100.70 CAD → Price: $201.40 CAD → Collection: Premium
```

## 🛠️ Troubleshooting

### Common Issues

**Issue:** No products exported
```bash
# Check if CSV has English titles
head -5 protocol_zero_variants.csv

# Run translation first
python3 translate.py
python3 shopify_export.py
```

**Issue:** Prices too high/low
```bash
# Adjust margin
python3 shopify_export.py --margin 60

# Adjust exchange rate
python3 shopify_export.py --exchange-rate 0.18
```

**Issue:** Missing variant options
```bash
# The scraper only extracts one dimension (Option Name)
# For multi-dimensional variants (Color + Size), you'll need to:
# 1. Update scraper to extract multiple option dimensions
# 2. Or manually split variants in Shopify post-import
```

## 📚 Advanced Usage

### Custom Pricing Strategy

For more complex pricing (tiered margins, category-specific):

```python
from shopify_export import ShopifyExporter

exporter = ShopifyExporter(margin_percent=80, exchange_rate=0.19)

# Override calculate_selling_price for custom logic
def custom_pricing(cost_cny):
    cost_cad = (cost_cny + 30) * 0.19
    
    # Tiered margins
    if cost_cad < 10:
        margin = 1.0  # 100%
    elif cost_cad < 30:
        margin = 0.8  # 80%
    else:
        margin = 0.6  # 60%
    
    return cost_cad, cost_cad * (1 + margin)

exporter.calculate_selling_price = custom_pricing
```

### Batch Processing

Process multiple CSV files:

```bash
for csv in products_*.csv; do
  python3 shopify_export.py --input "$csv" --output "shopify_${csv}"
done
```

## 🔗 Integration with Existing Workflow

### Current Workflow

```
1. scraper.py          → protocol_zero_variants.csv (raw Taobao data)
2. translate.py        → Add 'Translated Title' columns
3. classify_variants.py → JSON product structures
4. csv_to_knack.py     → Upload to Knack database
```

### New Shopify Workflow

```
1. scraper.py           → protocol_zero_variants.csv (raw Taobao data)
2. translate.py         → Add 'Translated Title' columns
3. shopify_export.py    → shopify_import.csv (Shopify format)
4. Shopify Import       → Products live in Shopify
```

**Parallel Workflows:**
- Continue using Knack for inventory management
- Use Shopify for customer-facing store
- Sync stock levels between systems

## 📖 Shopify CSV Field Reference

### Required Fields

- `Handle` - Unique product identifier (URL-friendly)
- `Title` - Product name
- `Option1 Name/Value` - First variant dimension
- `Variant SKU` - Unique SKU per variant
- `Variant Price` - Customer-facing price
- `Published` - TRUE/FALSE to make live

### Optional But Recommended

- `Body (HTML)` - Product description
- `Vendor` - Supplier/brand name
- `Type` - Product category
- `Tags` - Comma-separated keywords
- `Cost per item` - Your cost (for profit tracking)
- `Image Src` - Image URLs
- `SEO Title/Description` - Search optimization

### Full Field List

See [Shopify's CSV import documentation](https://help.shopify.com/en/manual/products/import-export/using-csv) for complete field reference.

## 🎯 Next Steps

1. **Run the exporter:**
   ```bash
   python3 shopify_export.py --margin 80
   ```

2. **Review the output:**
   ```bash
   head -20 shopify_import.csv
   ```

3. **Test import in Shopify:**
   - Import to a test store first
   - Verify product structure, pricing, images
   - Adjust configuration as needed

4. **Production import:**
   - Import to live store
   - Set inventory levels
   - Configure shipping/tax settings
   - Launch store!

## 🤝 Support

For issues or questions:
1. Check troubleshooting section above
2. Review Shopify import logs for specific errors
3. Verify CSV format matches Shopify requirements

## 📝 License

Part of the Protocol Zero project. See main project README for license details.
