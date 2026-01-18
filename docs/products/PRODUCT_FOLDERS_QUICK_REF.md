# Product Management - Quick Reference

## 📁 Folder Structure
```
scraper/ai_scraper_output/
├── products/
│   └── product_001/
│       ├── product.txt     # Product info
│       ├── variants.txt    # Variant list
│       └── notes.txt       # Your notes
└── media/
    └── product_001/
        ├── Main/           # hero-01
        ├── Catalogue/      # hero-02 to hero-07
        └── details_stitched.jpg
```

---

## ⚡ Quick Commands

```bash
# Convert CSV to folders (one time)
python3 scraper/csv_to_folders.py

# Upload all products
python3 scraper/folders_to_knack.py

# Preview changes (dry run)
python3 scraper/folders_to_knack.py --dry-run

# Upload one product
python3 scraper/folders_to_knack.py --product 5

# Upload with images
python3 scraper/folders_to_knack.py --sync-media
```

---

## ✏️ Editing Products

### Change Price
```bash
# 1. Open file
open scraper/ai_scraper_output/products/product_001/variants.txt

# 2. Edit line
Black / Medium | 100.0 | 42.99 | 32.0% | Active

# 3. Upload
python3 scraper/folders_to_knack.py --product 1
```

### Add Variant
```bash
# Add new line to variants.txt
Green / Large | 115.0 | 44.99 | 31.0% | Active

# Upload
python3 scraper/folders_to_knack.py --product 1
```

### Disable Variant
```diff
- Tan / XL | 120.0 | 45.99 | 30.0% | Active
+ Tan / XL | 120.0 | 45.99 | 30.0% | Inactive
```

---

## 📝 File Formats

### product.txt
```
ID: product-id-here
Title (EN): Product Name
Status: Active
```

### variants.txt
```
Variant Name | Price CNY | Price CAD | Margin | Status
Black / Small | 100 | 39.99 | 30.5% | Active
```

---

## 🎯 Workflow

1. **Edit** text files in `products/product_XXX/`
2. **Save** changes
3. **Upload** with `folders_to_knack.py`
4. **Done!** ✅

---

## 💡 Tips

- Use VSCode for easy editing: `code scraper/ai_scraper_output/products/`
- Add notes in `notes.txt` to track changes
- Use `--dry-run` to preview before uploading
- Upload individual products to test changes
- Bulk edit with find/replace across multiple files

---

## 📚 Full Guide

See [FOLDER_BASED_PRODUCTS_GUIDE.md](FOLDER_BASED_PRODUCTS_GUIDE.md) for complete documentation.
