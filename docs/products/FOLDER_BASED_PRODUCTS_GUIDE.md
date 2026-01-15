# Folder-Based Product Management Guide

## 🎯 Overview

Products are now stored in **individual folders** with text files instead of CSV. This makes editing much easier - just open a text file, make changes, and reseed.

## 📁 Folder Structure

```
scraper/ai_scraper_output/
├── products/
│   ├── product_001/
│   │   ├── product.txt       # Product metadata
│   │   ├── variants.txt      # All variants with pricing
│   │   └── notes.txt         # Your notes/edits
│   ├── product_002/
│   │   ├── product.txt
│   │   ├── variants.txt
│   │   └── notes.txt
│   └── ...
└── media/
    ├── product_001/
    │   ├── Main/
    │   ├── Catalogue/
    │   └── details_stitched.jpg
    └── ...
```

---

## 📝 File Formats

### product.txt
```
# Product Information

ID: 974743803214
Title (EN): Tactical Belt Set
Title (ZH): 战术腰带套装
URL: https://item.taobao.com/item.htm?id=974743803214
Category: Tactical Gear
Status: Active

# Description
High-quality tactical belt system with MOLLE attachment points.
```

### variants.txt
```
# Variants for Tactical Belt Set
# Format: Name | Price CNY | Price CAD | Margin | Status
# Edit this file to modify variants, then run: python3 folders_to_knack.py

Black / Small | 100.0 | 39.99 | 30.5% | Active
Black / Medium | 100.0 | 39.99 | 30.5% | Active
Black / Large | 110.0 | 42.99 | 30.2% | Active
Tan / Small | 100.0 | 39.99 | 30.5% | Active
Tan / Medium | 100.0 | 39.99 | 30.5% | Active
```

### notes.txt
```
# Notes for Tactical Belt Set

# Add any special notes, pricing changes, or edits here

2026-01-11: Increased margin to 32%
2026-01-10: Added new color variants
```

---

## 🔄 Workflow

### 1. Initial Setup (One Time)

Convert existing CSV/JSON to folders:
```bash
cd scraper
python3 csv_to_folders.py
```

This creates individual folders for all products.

### 2. Edit a Product

**Open the files in your text editor:**
```bash
# Open product info
open scraper/ai_scraper_output/products/product_001/product.txt

# Open variants
open scraper/ai_scraper_output/products/product_001/variants.txt
```

**Make your changes:**
- Edit product title, description, status
- Modify variant names, prices, margins
- Change variant status (Active/Inactive)
- Add/remove variants

**Example edit - Change price:**
```diff
- Black / Medium | 100.0 | 39.99 | 30.5% | Active
+ Black / Medium | 100.0 | 42.99 | 32.0% | Active
```

**Example edit - Add new variant:**
```
Green / Medium | 105.0 | 41.99 | 31.0% | Active
```

**Example edit - Disable variant:**
```diff
- Tan / XL | 120.0 | 45.99 | 30.0% | Active
+ Tan / XL | 120.0 | 45.99 | 30.0% | Inactive
```

### 3. Upload Changes

**Upload all products:**
```bash
python3 folders_to_knack.py
```

**Preview changes (dry run):**
```bash
python3 folders_to_knack.py --dry-run
```

**Upload specific product:**
```bash
python3 folders_to_knack.py --product 5
```

**Upload and sync images:**
```bash
python3 folders_to_knack.py --sync-media
```

---

## 🎨 Use Cases

### Change Product Title
1. Open `product_001/product.txt`
2. Edit `Title (EN):` line
3. Save file
4. Run: `python3 folders_to_knack.py --product 1`

### Update Variant Pricing
1. Open `product_001/variants.txt`
2. Find the variant line
3. Change price: `Black / Medium | 100.0 | 42.99 | 32.0% | Active`
4. Save file
5. Run: `python3 folders_to_knack.py --product 1`

### Add New Variant
1. Open `product_001/variants.txt`
2. Add new line: `Blue / Large | 115.0 | 44.99 | 31.0% | Active`
3. Save file
4. Run: `python3 folders_to_knack.py --product 1`

### Disable/Archive Product
1. Open `product_001/product.txt`
2. Change: `Status: Inactive`
3. Save and upload

### Bulk Price Update
Use find/replace in your text editor:
1. Open `product_001/variants.txt`
2. Find: `| 30.5% |`
3. Replace: `| 32.0% |`
4. Save and upload

---

## 🚀 Advantages

### ✅ Easy Editing
- Open text file, make changes, save
- No CSV formatting issues
- Clear, readable format
- Comments supported

### ✅ Individual Product Control
- Edit one product without touching others
- Upload only changed products
- Easy to review changes

### ✅ Version Control Friendly
- Git tracks individual file changes
- See exactly what changed per product
- Easy to revert specific products

### ✅ Notes & Documentation
- Add notes in `notes.txt`
- Track pricing changes
- Document special requirements

### ✅ No More CSV Hell
- No Excel corruption
- No delimiter issues
- No character encoding problems
- No "did I save the right file?" confusion

---

## 🛠️ Commands Reference

```bash
# Convert CSV/JSON to folders (one time)
python3 csv_to_folders.py

# Upload all products
python3 folders_to_knack.py

# Preview without uploading
python3 folders_to_knack.py --dry-run

# Upload specific product
python3 folders_to_knack.py --product 5

# Upload with media sync
python3 folders_to_knack.py --sync-media

# Check product structure
ls -la scraper/ai_scraper_output/products/product_001/

# Quick edit in VSCode
code scraper/ai_scraper_output/products/product_001/
```

---

## 📊 Example: Complete Product Edit

**Scenario:** Update pricing and add new color

**1. Open files:**
```bash
cd scraper/ai_scraper_output/products/product_005
code .
```

**2. Edit variants.txt:**
```diff
# Variants for Hydra Riser Mount
# Format: Name | Price CNY | Price CAD | Margin | Status

Black - UNITY EXPS | 38 | 21.99 | 31.2% | Active
Tan - UNITY EXPS | 38 | 21.99 | 31.2% | Active
+ Green - UNITY EXPS | 38 | 21.99 | 31.2% | Active
- Black - SIG Riser Mount | 38 | 21.99 | 31.2% | Active
+ Black - SIG Riser Mount | 38 | 23.99 | 33.0% | Active
```

**3. Add note:**
```bash
echo "2026-01-11: Added green variant, increased SIG mount margin" >> notes.txt
```

**4. Upload:**
```bash
cd ../../..
python3 folders_to_knack.py --product 5
```

**Output:**
```
📦 Hydra Riser Mount, UNITY Tactical GBRS
   ID: hydra-unity-mount
   Variants: 28
   ✅ Found existing: 695c1234...
   ✅ Updated product
   ✅ Uploaded 28 variants
```

Done! ✅

---

## 🐛 Troubleshooting

### Variant not uploading?
- Check format: `Name | Price CNY | Price CAD | Margin | Status`
- Ensure pipes `|` separate fields
- Prices must be numbers (no $ or CAD)
- Margin includes % sign

### Product not found?
- Verify folder name: `product_001`, `product_002`, etc.
- Check `product.txt` has `ID:` field
- Run with --dry-run to see what would happen

### Changes not showing?
- Clear shop cache: `rm -rf shop/.next`
- Restart dev server: `cd shop && npm run dev`
- Check Knack dashboard to verify upload

---

## 📚 Migration from CSV

If you have old scripts using CSV:

**Old way:**
```bash
python3 csv_to_knack.py
```

**New way:**
```bash
# One-time conversion
python3 csv_to_folders.py

# Then use folders
python3 folders_to_knack.py
```

All your existing upload logic works the same, just reads from folders instead!

---

## 🎉 You're All Set!

Now you can:
- ✅ Edit products in text files
- ✅ Make changes without CSV hassle
- ✅ Upload individual products
- ✅ Track changes easily
- ✅ Add notes and documentation

**Happy editing!** 🚀
