# Hero Images - Quick Reference

## ✅ Implementation Complete!

Your shop now supports **Taobao-style image galleries** with 6-7 hero images per product.

---

## 🎯 Current Status

- ✅ **192 hero images** migrated
- ✅ **85 detail images** available
- ✅ Frontend automatically displays up to 7 hero images
- ✅ Thumbnails work on desktop (left) and mobile (bottom)
- ✅ Backwards compatible with old naming

---

## 📸 Image Types

### Hero Images (Carousel)
**Purpose:** Main product showcase with multiple angles  
**Location:** `/shop/public/images/[product-id]-hero-01.jpg` through `hero-07.jpg`  
**Display:** Taobao-style carousel with thumbnails

### Detail Image (Scroll)
**Purpose:** Long stitched image with specs/details  
**Location:** `/shop/public/images/[product-id]-details.jpg`  
**Display:** Separate infinite scroll section

---

## 🔄 Workflow

### Adding New Products

1. **Organize scraped images:**
   ```
   scraper/ai_scraper_output/media/product_XXX/
   ├── Main/              # Primary image → hero-01
   ├── Catalogue/         # Additional angles → hero-02 to hero-07
   └── details_stitched.jpg  # Specs → details
   ```

2. **Sync to shop:**
   ```bash
   cd scraper
   python3 sync_media.py
   ```

3. **Verify:**
   ```bash
   ./test-hero-images.sh
   ```

### Updating Existing Products

1. **Check current images:**
   ```bash
   ls shop/public/images/[product-id]-hero-*.jpg
   ```

2. **If using old naming, migrate:**
   ```bash
   python3 scraper/migrate_hero_images.py
   ```

3. **Test in browser:**
   ```
   http://localhost:3000/shop/[product-id]
   ```

---

## 📱 What You'll See

### Desktop View
```
┌─────────┬──────────────┬─────────────┐
│ [Img 1] │              │  Product    │
│ [Img 2] │   Selected   │  Title      │
│ [Img 3] │   Hero       │  $99.99     │
│ [Img 4] │   Image      │  [Variant]  │
│ [Img 5] │              │  [Add Cart] │
│ [Img 6] │              │             │
│ [Img 7] │              │             │
└─────────┴──────────────┴─────────────┘
```

### Mobile View
```
┌───────────────────┐
│   Selected Hero   │
│   Image Display   │
└───────────────────┘

[Img1][Img2][Img3][Img4]→

Product Info
$99.99
Select Variant
Add to Cart Button
```

---

## 🛠️ Quick Commands

```bash
# Check status
./test-hero-images.sh

# Sync new images
cd scraper && python3 sync_media.py

# Migrate old images
python3 scraper/migrate_hero_images.py

# Start dev server
cd shop && npm run dev

# View products
open http://localhost:3000/shop
```

---

## 📁 File Naming Reference

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `[id]-main.jpg` | `[id]-hero-01.jpg` | Primary hero |
| `[id]-cat01.jpg` | `[id]-hero-02.jpg` | Second hero |
| `[id]-cat02.jpg` | `[id]-hero-03.jpg` | Third hero |
| `[id]-cat03.jpg` | `[id]-hero-04.jpg` | Fourth hero |
| `[id]-cat04.jpg` | `[id]-hero-05.jpg` | Fifth hero |
| `[id]-cat05.jpg` | `[id]-hero-06.jpg` | Sixth hero |
| `[id]-cat06.jpg` | `[id]-hero-07.jpg` | Seventh hero |
| `[id]-Details_Long.jpg` | `[id]-details.jpg` | Detail scroll |

---

## 🎨 Best Practices

### Hero Image Selection (Priority Order)

1. **hero-01**: Best product shot (front view, clean background)
2. **hero-02**: Side angle
3. **hero-03**: Back view
4. **hero-04**: 45° angle or detail closeup
5. **hero-05**: Product in use / lifestyle shot
6. **hero-06**: Feature highlight
7. **hero-07**: Packaging or accessories

### Image Specs

- **Format:** JPG, PNG, or WebP
- **Hero size:** 800x800px minimum (square)
- **Detail size:** 800-1200px width, any height
- **File size:** < 500KB per hero, < 2MB for detail
- **Quality:** Optimized for web (75-85% JPEG quality)

---

## 🐛 Troubleshooting

### Images not showing?
```bash
# Check if files exist
ls shop/public/images/[product-id]-hero-*.jpg

# Check naming pattern
# Should be: product-id-hero-01.jpg NOT product-id-hero-1.jpg

# Clear Next.js cache
rm -rf shop/.next && cd shop && npm run dev
```

### Only 1 image showing?
- Verify Catalogue/ folder has multiple images
- Check that sync_media.py ran successfully
- Look for browser console errors (F12)

### Thumbnails not clickable?
- Check browser console for JavaScript errors
- Verify validImages state is populated
- Test in different browser

---

## 📚 Documentation

- **Full Implementation:** `/HERO_IMAGES_IMPLEMENTATION_PLAN.md`
- **Scraper Guide:** `/HERO_IMAGES_SCRAPER_GUIDE.md`
- **Summary:** `/HERO_IMAGES_SUMMARY.md`
- **This File:** `/HERO_IMAGES_QUICK_REFERENCE.md`

---

## 🎉 You're All Set!

Your shop now has **Taobao-style image galleries** with:
- ✅ Up to 7 hero images per product
- ✅ Thumbnail navigation (desktop + mobile)
- ✅ Separate detail scroll section
- ✅ Automatic 404 filtering
- ✅ Backwards compatibility

Visit your shop at `http://localhost:3000/shop` to see it in action! 🚀
