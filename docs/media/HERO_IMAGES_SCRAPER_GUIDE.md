# Hero Images - Scraper Output Organization Guide

## Overview
This guide explains how to organize scraped images so they display correctly as hero images (carousel) vs detail images (scroll).

## Image Categories

### 1. **Hero Images** (6-7 images)
These are the main product images shown in the Taobao-style carousel with thumbnails.

**What to include:**
- Main product image (different angles)
- Product in use / lifestyle shots
- Close-ups of key features
- Color/variant options
- Packaging shots
- Size comparison images

**Where they go:**
```
scraper/ai_scraper_output/media/product_XXX/
├── Main/              # Primary hero image
│   └── image.jpg
└── Catalogue/         # Additional hero images (2-7)
    ├── cat_01.jpg     # Will become hero-02
    ├── cat_02.jpg     # Will become hero-03
    ├── cat_03.jpg     # Will become hero-04
    ├── cat_04.jpg     # Will become hero-05
    ├── cat_05.jpg     # Will become hero-06
    └── cat_06.jpg     # Will become hero-07
```

### 2. **Detail Images** (1 long stitched image)
The detailed product description image(s) stitched into one long vertical scroll.

**What to include:**
- Product specifications
- Material details
- Sizing charts
- Installation instructions
- Warranty information
- Technical diagrams

**Where they go:**
```
scraper/ai_scraper_output/media/product_XXX/
└── details_stitched.jpg  # Long vertical image
```

---

## Workflow

### Step 1: Organize Scraped Images

After scraping, organize images into folders:

```bash
# Example product folder structure
media/product_001/
├── Main/
│   └── main_image.jpg          # Best product shot (front view)
├── Catalogue/
│   ├── angle_side.jpg          # Side view
│   ├── angle_back.jpg          # Back view
│   ├── detail_closeup.jpg      # Feature closeup
│   ├── usage_lifestyle.jpg     # In-use shot
│   └── packaging.jpg           # Box/packaging
└── details_stitched.jpg        # Long stitched specs image
```

### Step 2: Run Sync Script

Once images are organized, sync them to the shop:

```bash
cd scraper
python3 sync_media.py
```

**Output:**
```
shop/public/images/
├── product-id-hero-01.jpg    # From Main/
├── product-id-hero-02.jpg    # From Catalogue/cat_01
├── product-id-hero-03.jpg    # From Catalogue/cat_02
├── product-id-hero-04.jpg    # From Catalogue/cat_03
├── product-id-hero-05.jpg    # From Catalogue/cat_04
├── product-id-hero-06.jpg    # From Catalogue/cat_05
├── product-id-hero-07.jpg    # From Catalogue/cat_06
└── product-id-details.jpg    # From details_stitched.jpg
```

### Step 3: Verify in Shop

Visit the product page in your shop:
```
http://localhost:3000/shop/[product-id]
```

You should see:
- ✅ 6-7 hero images in carousel
- ✅ Thumbnails on left (desktop) or bottom (mobile)
- ✅ Detail image in scroll section below

---

## Image Requirements

### Hero Images
- **Format:** JPG, PNG, or WebP
- **Size:** 800x800px minimum (square aspect ratio recommended)
- **File size:** < 500KB per image (optimized)
- **Count:** 1-7 images (minimum 1, recommended 5-7)

### Detail Image
- **Format:** JPG or PNG
- **Width:** 800-1200px
- **Height:** Variable (can be very long - 5000px+)
- **File size:** < 2MB (optimized)

---

## Tips for Best Results

### Hero Image Selection Priority

1. **hero-01 (Main/)**: Best product shot
   - Clean background
   - Well-lit
   - Shows full product
   - Front-facing angle

2. **hero-02 to hero-04 (Catalogue/)**: Essential angles
   - Side view
   - Back view
   - 45° angle

3. **hero-05 to hero-07 (Catalogue/)**: Details & context
   - Close-up of key features
   - Product in use
   - Packaging/accessories

### Detail Image Creation

Use the scraper's image stitching:
```python
# In scraper code
stitch_images_vertically(
    image_paths=[
        'spec_sheet.jpg',
        'sizing_chart.jpg',
        'materials.jpg',
        'warranty.jpg'
    ],
    output_path='details_stitched.jpg',
    max_width=1200,
    spacing=0  # No gap between images
)
```

---

## Migrating Existing Images

If you have existing images with old naming:

```bash
cd scraper
python3 migrate_hero_images.py
```

This will convert:
- `product-id-main.jpg` → `product-id-hero-01.jpg`
- `product-id-cat01.jpg` → `product-id-hero-02.jpg`
- `product-id-Details_Long.jpg` → `product-id-details.jpg`

---

## Troubleshooting

### Images not showing?
- Check file names match pattern: `[product-id]-hero-01.jpg`
- Verify files exist in `/shop/public/images/`
- Check browser console for 404 errors
- Clear Next.js cache: `rm -rf shop/.next`

### Only 1-2 images showing?
- Ensure Catalogue/ folder has multiple images
- Check that images are named sequentially (cat_01, cat_02, etc.)
- Verify sync_media.py copied all files

### Detail image not loading?
- Check file is named `[product-id]-details.jpg`
- Verify file is in `/shop/public/images/`
- Check frontend console for errors

---

## Example: Complete Product Setup

```bash
# 1. Organize images
media/product_tactical-vest-001/
├── Main/
│   └── vest_front.jpg
├── Catalogue/
│   ├── vest_back.jpg
│   ├── vest_side.jpg
│   ├── vest_closeup_molle.jpg
│   ├── vest_worn_model.jpg
│   └── vest_packaging.jpg
└── details_stitched.jpg

# 2. Run sync
python3 sync_media.py

# 3. Verify output
ls shop/public/images/tactical-vest-001-*
# Should show:
# tactical-vest-001-hero-01.jpg
# tactical-vest-001-hero-02.jpg
# tactical-vest-001-hero-03.jpg
# tactical-vest-001-hero-04.jpg
# tactical-vest-001-hero-05.jpg
# tactical-vest-001-hero-06.jpg
# tactical-vest-001-details.jpg

# 4. Test in browser
open http://localhost:3000/shop/tactical-vest-001
```

✅ You should see a Taobao-style product page with 6 hero images!
