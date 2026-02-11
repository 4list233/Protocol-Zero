# Shopify Module Index

Complete documentation for exporting Protocol Zero Taobao scraper data to Shopify.

---

## 📚 Documentation

### 🚀 Getting Started

**[QUICK_START.md](./QUICK_START.md)** - Start here!
- 3-step process from CSV to Shopify
- Prerequisites and setup
- Common issues and solutions
- Post-import checklist

### 📖 Comprehensive Guide

**[README.md](./README.md)** - Complete documentation
- Full feature overview
- Data flow and architecture
- Pricing strategies and calculations
- Collections, tags, and categorization
- Image management
- Configuration options
- Advanced usage and customization

### 🔄 Format Reference

**[SHOPIFY_FORMAT_COMPARISON.md](./SHOPIFY_FORMAT_COMPARISON.md)** - Technical deep dive
- Taobao CSV vs Shopify CSV structure
- Field mapping reference
- Transformation logic examples
- Pricing calculation formulas
- Variant option handling

---

## 🛠️ Tools

### Core Export Tool

**`../shopify_export.py`** - Main export script
```bash
python3 shopify_export.py --margin 80
```

Converts `protocol_zero_variants.csv` → `shopify_import.csv`

### Pricing Calculator

**`../shopify_pricing_calculator.py`** - Interactive pricing tool
```bash
python3 shopify_pricing_calculator.py
```

Features:
- Calculate single prices
- Compare multiple margins
- Suggest margin for target price
- Price range analysis

### Automated Workflow

**`../shopify_workflow.sh`** - Complete automation
```bash
./shopify_workflow.sh
```

Handles:
- Translation checking
- CSV validation
- Export execution
- Output verification

---

## 📁 File Structure

```
scraper/
├── shopify_export.py              # Main export script
├── shopify_pricing_calculator.py  # Pricing tool
├── shopify_workflow.sh            # Automated workflow
├── shopify_collections.json       # Collection configuration
├── shopify_import.csv             # Generated output (ready for Shopify)
│
└── shopify/                       # Documentation folder
    ├── INDEX.md                   # This file
    ├── QUICK_START.md             # Quick start guide
    ├── README.md                  # Complete documentation
    └── SHOPIFY_FORMAT_COMPARISON.md  # Format reference
```

---

## 🎯 Usage Examples

### Basic Usage

```bash
# 1. Calculate optimal margin
python3 shopify_pricing_calculator.py --cost 100 --compare

# 2. Export with chosen margin
python3 shopify_export.py --margin 80

# 3. Upload shopify_import.csv to Shopify
# (Products > Import in Shopify Admin)
```

### Advanced Usage

```bash
# Custom exchange rate and shipping
python3 shopify_export.py \
  --margin 100 \
  --exchange-rate 0.20 \
  --shipping 25

# Specific input/output files
python3 shopify_export.py \
  --input custom_products.csv \
  --output my_shopify_export.csv \
  --margin 90

# Automated workflow with environment variables
MARGIN=120 INPUT_CSV=premium_items.csv ./shopify_workflow.sh
```

---

## 🔑 Key Concepts

### Pricing Formula

```
Total Cost (CAD) = (Product Cost CNY + Shipping CNY) × Exchange Rate
Selling Price (CAD) = Total Cost × (1 + Margin%)
```

### Collections

Products automatically categorized by price:
- **Budget**: $0 - $25
- **Mid-Range**: $25 - $75
- **Premium**: $75+

### Variants

Each color/size/style variation becomes a Shopify variant:
```
Product: Combat Holster
├── Variant 1: Black - Medium
├── Variant 2: Black - Large
└── Variant 3: Tan - Medium
```

---

## 📊 Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│  TAOBAO SCRAPER WORKFLOW                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  scraper.py runs
                          ↓
          protocol_zero_variants.csv created
          (Raw data with Chinese titles)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  TRANSLATION (OPTIONAL BUT RECOMMENDED)                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  translate.py runs
                          ↓
          Adds 'Translated Title' columns
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  SHOPIFY EXPORT                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
            shopify_export.py processes
                          ↓
          - Groups products by URL
          - Calculates CAD prices with margin
          - Generates SKUs and handles
          - Assigns collections and tags
          - Formats for Shopify import
                          ↓
              shopify_import.csv created
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  SHOPIFY IMPORT                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
          Upload to Shopify Admin
          (Products > Import)
                          ↓
          Products live in Shopify! 🎉
```

---

## ⚙️ Configuration

### Default Settings

```python
{
  "margin_percent": 50.0,      # 50% markup
  "exchange_rate": 0.19,       # CNY to CAD
  "shipping_cny": 30.0,        # Shipping per item
}
```

### Collection Mapping

Edit `shopify_collections.json`:

```json
{
  "budget": "Budget ($0-$25)",
  "mid_range": "Mid-Range ($25-$75)",
  "premium": "Premium ($75+)",
  "default": "All Products"
}
```

---

## 📋 Shopify CSV Fields

### Required Fields
- Handle (product ID)
- Title (product name)
- Variant Price (selling price)
- Published (TRUE/FALSE)

### Recommended Fields
- Body (HTML) (description)
- Vendor (brand/supplier)
- Tags (keywords)
- Cost per item (for profit tracking)
- Image Src (product images)
- Variant SKU (inventory tracking)

### Optional Fields
- SEO Title/Description
- Compare At Price (for sales)
- Collections
- Inventory settings
- Shipping settings

---

## 🎓 Learning Path

### Beginner

1. Read [QUICK_START.md](./QUICK_START.md)
2. Run `shopify_pricing_calculator.py` to understand pricing
3. Export a test CSV with `shopify_export.py`
4. Review the output CSV in Excel/Google Sheets
5. Import to Shopify test store

### Intermediate

1. Read [README.md](./README.md) for full features
2. Customize `shopify_collections.json`
3. Experiment with different margins
4. Understand variant option splitting
5. Set up image CDN integration

### Advanced

1. Read [SHOPIFY_FORMAT_COMPARISON.md](./SHOPIFY_FORMAT_COMPARISON.md)
2. Modify `shopify_export.py` for custom logic
3. Create category-specific pricing rules
4. Integrate with inventory management
5. Automate full scrape-to-Shopify pipeline

---

## 🔧 Troubleshooting

### Script Errors

**Problem:** `ModuleNotFoundError: No module named 'X'`
```bash
# Install missing dependencies
pip3 install -r requirements.txt
```

**Problem:** `FileNotFoundError: protocol_zero_variants.csv`
```bash
# Run scraper first
python3 scraper.py
```

### Data Issues

**Problem:** Prices are $0.00
```bash
# Check Price CNY column has values
head protocol_zero_variants.csv | cut -d',' -f8

# If empty, re-run scraper or manually add prices
```

**Problem:** Chinese titles in Shopify
```bash
# Run translation
python3 translate.py
python3 shopify_export.py
```

### Shopify Import Issues

**Problem:** "Handle must be unique"
- Duplicate products in CSV
- Solution: Check for duplicate URLs in input CSV

**Problem:** "Invalid variant option"
- Option name/value mismatch
- Solution: Ensure all variants have consistent option structure

---

## 📞 Support

### Documentation
- This documentation set (start with QUICK_START.md)
- Shopify's official CSV import guide
- Main scraper README.md

### Common Questions

**Q: Can I change margins after import?**
A: Yes! Export new CSV with different margin, then re-import with "Overwrite existing products" checked.

**Q: How do I add more images?**
A: Either provide image URLs in the CSV, or use Shopify's bulk editor post-import.

**Q: What if I have 3 variant dimensions (Color, Size, Material)?**
A: Shopify supports up to 3 option dimensions. Update scraper to extract all three, or split manually in Shopify.

**Q: Can I sync inventory between Knack and Shopify?**
A: Not directly with this module, but you can build a sync script using both APIs.

---

## 🚀 Quick Commands Reference

```bash
# Pricing calculator
python3 shopify_pricing_calculator.py
python3 shopify_pricing_calculator.py --cost 100 --compare

# Export
python3 shopify_export.py
python3 shopify_export.py --margin 80
python3 shopify_export.py --input custom.csv --output output.csv

# Automated workflow
./shopify_workflow.sh
MARGIN=100 ./shopify_workflow.sh

# View output
head -50 shopify_import.csv
wc -l shopify_import.csv
```

---

## 📈 Success Metrics

After import, track:
- ✅ Product count (matches expected)
- ✅ Variant count (all variations imported)
- ✅ Price ranges (correct margins applied)
- ✅ Collection distribution (Budget/Mid/Premium split)
- ✅ Image coverage (percentage with images)
- ✅ Tag coverage (products properly tagged)

---

## 🎉 You're Ready!

Start with **[QUICK_START.md](./QUICK_START.md)** and get your products into Shopify today!

Questions? Review the comprehensive [README.md](./README.md) for detailed explanations.

---

**Last Updated:** 2026-01-20  
**Version:** 1.0  
**Maintainer:** Protocol Zero Team
