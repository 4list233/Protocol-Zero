# Shopify Quick Start Guide

**Get your Protocol Zero products into Shopify in 3 steps.**

---

## Prerequisites

✅ You have scraped products using the Taobao scraper  
✅ File `protocol_zero_variants.csv` exists in the scraper directory  
✅ Products have been translated (or you'll use Chinese titles temporarily)  

---

## Step 1: Choose Your Margin

The system uses **target net margin** (profit after salesperson and promoter cuts):

```bash
# Interactive pricing calculator
python3 shopify_pricing_calculator.py

# Or quick comparison
python3 shopify_pricing_calculator.py --cost 50 --compare
```

**Recommended Target Margins:**
- Budget products ($0-$25): **30%** net margin
- Mid-range products ($25-$75): **30%** net margin  
- Premium products ($75+): **30%** net margin

**Note:** The system accounts for:
- ✅ Shipping cost (¥30 CNY)
- ✅ Salesperson cut (10%)
- ✅ Promoter cut (10% when applicable)
- ✅ Your target profit margin

This keeps prices within budget/mid/premium tiers while ensuring profitability.

---

## Step 2: Export to Shopify Format

### Option A: One-Command Export (Easiest)

```bash
# Use the automated workflow script (30% target margin)
./shopify_workflow.sh

# Or with custom margin
MARGIN=25 ./shopify_workflow.sh
```

### Option B: Manual Export

```bash
# Basic export with 30% target margin
python3 shopify_export.py --margin 30

# With image hosting (CDN/cloud storage)
python3 shopify_export.py \
  --margin 30 \
  --base-url "https://cdn.yourstore.com/products/"

# Advanced options
python3 shopify_export.py \
  --input protocol_zero_variants.csv \
  --output my_shopify_products.csv \
  --margin 30 \
  --exchange-rate 0.19 \
  --shipping 30 \
  --salesperson-cut 0.10 \
  --promoter-cut 0.10 \
  --base-url "https://your-cdn.com/images/"
```

**Output:** `shopify_import.csv` (ready for Shopify!)

---

## Step 3: Import to Shopify

1. **Login to Shopify Admin**
   - Go to your store's admin panel

2. **Navigate to Products**
   - Click **Products** in the left sidebar
   - Click **Import** button (top right)

3. **Upload CSV**
   - Click **Add file**
   - Select `shopify_import.csv`
   - Click **Upload and continue**

4. **Review Preview**
   - Shopify shows preview of products
   - Check that columns mapped correctly
   - Verify product count and variants

5. **Confirm Import**
   - Click **Import products**
   - Wait for processing (may take 1-5 minutes)

6. **Verify Results**
   - Go to **Products** to see your imported items
   - Check a few products:
     - ✅ Variants are correct
     - ✅ Prices look right
     - ✅ Images loaded (if URLs provided)
     - ✅ Collections assigned

---

## Post-Import Checklist

### Immediate Tasks

- [ ] **Review all products** - Check titles, descriptions, pricing
- [ ] **Update product descriptions** - Customize the auto-generated HTML
- [ ] **Verify images** - Ensure hero and variant images are correct
- [ ] **Set inventory levels** - Update stock quantities per variant
- [ ] **Publish products** - Make them live on your store

### Store Setup

- [ ] **Configure shipping rates** - Set shipping zones and prices
- [ ] **Set up tax settings** - Configure tax collection by region
- [ ] **Create collections** - Organize products beyond auto-collections
- [ ] **Add navigation menus** - Link to collections in your store menu
- [ ] **Customize theme** - Adjust store appearance and branding

### Optimization

- [ ] **SEO optimization** - Refine meta titles and descriptions
- [ ] **High-quality images** - Replace placeholder images with professional photos
- [ ] **Product photography** - Add lifestyle and detail images
- [ ] **Cross-sell setup** - Configure related products
- [ ] **Reviews app** - Install product review app

---

## Pricing Examples

### Example 1: Budget Holster (¥50 CNY Cost)

```
Target Margin: 30%
Cost: (50 + 30) × 0.19 = $15.20 CAD
Price: $15.20 / (1 - 0.10 - 0.30) = $25.33 → $24.99 CAD
After Salesperson (10%): $24.99 × 0.90 = $22.49
Profit: $22.49 - $15.20 = $7.29
True Margin: 29.17%
Collection: Budget ($0-$25) ✅
```

### Example 2: Mid-Range Vest (¥120 CNY Cost)

```
Target Margin: 30%
Cost: (120 + 30) × 0.19 = $28.50 CAD
Price: $28.50 / 0.60 = $47.50 → $46.99 CAD
After Salesperson: $46.99 × 0.90 = $42.29
Profit: $42.29 - $28.50 = $13.79
True Margin: 29.34%
Collection: Mid-Range ($25-$75) ✅
```

### Example 3: Premium Helmet (¥350 CNY Cost)

```
Target Margin: 30%
Cost: (350 + 30) × 0.19 = $72.20 CAD
Price: $72.20 / 0.60 = $120.33 → $119.99 CAD
After Salesperson: $119.99 × 0.90 = $107.99
Profit: $107.99 - $72.20 = $35.79
True Margin: 29.83%
Collection: Premium ($75+) ✅
```

**Key Points:**
- Prices stay within collection tiers
- True margins account for salesperson cut (10%)
- Promoter cut (10%) reduces margin further when used
- Target 30% margin = ~29% actual after salesperson cut

---

## Common Issues & Solutions

### ❌ "No products exported"

**Cause:** CSV has no English titles (only Chinese)

**Solution:**
```bash
# Run translation first
python3 translate.py
python3 shopify_export.py --margin 80
```

---

### ❌ "Prices seem too high/low"

**Cause:** Margin or exchange rate needs adjustment

**Solution:**
```bash
# Try different margins
python3 shopify_pricing_calculator.py --cost 100 --compare

# Adjust exchange rate if CNY/CAD rate changed
python3 shopify_export.py --margin 80 --exchange-rate 0.18
```

---

### ❌ "Images not showing in Shopify"

**Cause:** Image URLs are empty or invalid

**Solution:**
1. Export without images first
2. Use Shopify's bulk editor to add images:
   - Products > (select products) > Edit products
   - Upload images directly in Shopify

---

### ❌ "Variants not grouped properly"

**Cause:** Same product has different handles (URLs changed)

**Solution:**
- Ensure Taobao URLs are consistent in CSV
- Use URL as the grouping key (script does this automatically)
- If URLs changed, manually merge in Shopify admin

---

## Advanced Workflows

### Updating Existing Products

**To update prices after import:**

```bash
# Export with new margin
python3 shopify_export.py --margin 100

# In Shopify:
# 1. Products > Import
# 2. Check "Overwrite existing products with same handle"
# 3. Upload new CSV
```

### Batch Processing Multiple CSVs

```bash
# Process all CSV files in directory
for csv in products_*.csv; do
  output="shopify_${csv}"
  python3 shopify_export.py --input "$csv" --output "$output" --margin 80
  echo "Exported: $output"
done
```

### Custom Margins by Category

Create custom export script:

```python
from shopify_export import ShopifyExporter

exporter = ShopifyExporter(margin_percent=80)

# Override pricing for specific categories
def smart_pricing(cost_cny):
    if cost_cny < 50:
        return exporter.calculate_selling_price(cost_cny, margin=100)
    elif cost_cny < 200:
        return exporter.calculate_selling_price(cost_cny, margin=80)
    else:
        return exporter.calculate_selling_price(cost_cny, margin=60)
```

---

## Performance Tips

### Import Speed

- **Small catalogs (<100 products):** ~1 minute
- **Medium catalogs (100-500 products):** ~5 minutes
- **Large catalogs (500+ products):** ~10-15 minutes

### Optimization

```bash
# Split large CSV into smaller batches
split -l 500 shopify_import.csv batch_

# Import batches separately in Shopify
# batch_aa.csv, batch_ab.csv, batch_ac.csv, etc.
```

---

## Next Steps After Import

### 1. Marketing Setup

- [ ] Create discount codes
- [ ] Set up abandoned cart recovery
- [ ] Configure email marketing
- [ ] Add Facebook/Instagram shop integration

### 2. Operations

- [ ] Fulfill orders workflow
- [ ] Inventory management system
- [ ] Customer service tools
- [ ] Analytics and reporting

### 3. Growth

- [ ] SEO optimization
- [ ] Content marketing (blog posts)
- [ ] Social media strategy
- [ ] Paid advertising (Google/Facebook Ads)

---

## Quick Reference Commands

```bash
# Calculate pricing
python3 shopify_pricing_calculator.py

# Export products (default 50% margin)
python3 shopify_export.py

# Export with custom margin
python3 shopify_export.py --margin 100

# Complete workflow (translation + export)
./shopify_workflow.sh

# Custom workflow with environment variables
MARGIN=120 INPUT_CSV=custom.csv ./shopify_workflow.sh

# Compare different margins for a product
python3 shopify_pricing_calculator.py --cost 150 --compare
```

---

## Support Resources

### Shopify Documentation

- [CSV Import Guide](https://help.shopify.com/en/manual/products/import-export/using-csv)
- [Product Variants](https://help.shopify.com/en/manual/products/variants)
- [Collections](https://help.shopify.com/en/manual/products/collections)

### Protocol Zero Resources

- `shopify/README.md` - Complete Shopify module documentation
- `shopify/SHOPIFY_FORMAT_COMPARISON.md` - Data format details
- `shopify_export.py` - Export script source code

---

## Summary: 3-Step Process

```
1. Choose margin → python3 shopify_pricing_calculator.py --cost 100 --compare
                ↓
2. Export CSV   → python3 shopify_export.py --margin 80
                ↓
3. Import       → Shopify Admin > Products > Import > shopify_import.csv
                ↓
             🎉 Products Live!
```

---

**Ready to launch? Start with Step 1! 🚀**
