# Image System Reset & Recalibration

## Summary

Successfully reset and recalibrated the entire image system to use consistent numeric product IDs from Knack.

## The Problem

The image system had multiple mismatches:
1. **Scraper** created images with slugified product titles (e.g., `2011-light-bearing-quick-draw-holster-...`)
2. **Knack** uses numeric product IDs (e.g., `709022174805`)
3. **Notion** had old mappings that didn't align with either system
4. **Shop** was trying to load images using mismatched paths

This resulted in broken images across the shop.

## The Solution

### Phase 1: Fix Local Images (Completed)

Created hard links to make images accessible via numeric IDs:
- Original: `2011-light-bearing-quick-draw-holster-with-magazin-hero-01.jpg`
- New link: `709022174805-hero-01.jpg`

**Script**: `shop/scripts/fix-image-paths.mjs`
- Uses fuzzy matching to find images by product title
- Creates hard links with numeric ID prefixes
- Result: 249 image links created

### Phase 2: Update Shop Code (Completed)

Modified `shop/lib/knack-products.ts`:
- Changed `getProductImages()` to use numeric product IDs directly
- Removed slugification logic
- Now generates paths like `/images/{productId}-hero-01.jpg`

### Phase 3: Clear Next.js Cache (Completed)

Next.js Image Optimizer was caching 400 errors:
```bash
rm -rf shop/.next
npm run dev
```

### Phase 4: Reset Notion Database (Completed ✅)

**New Scripts Created**:

1. **`shared/scripts/notion/clear-notion-images.js`**
   - Clears all image records from Notion
   - Archives all pages in the Products database

2. **`shared/scripts/notion/reseed-images-from-knack.js`**
   - Fetches products from Knack API
   - Maps images from `/shop/public/images/` using numeric IDs
   - Creates/updates Notion pages with correct image URLs

3. **`shared/scripts/notion/reset-and-reseed-images.js`**
   - Master script that runs both operations in sequence

**NPM Scripts Added**:
```json
{
  "clear-notion": "node notion/clear-notion-images.js",
  "reseed-notion": "node notion/reseed-images-from-knack.js",
  "reset-notion-images": "node notion/reset-and-reseed-images.js"
}
```

## Results

### ✅ Successfully Seeded
- **26 products** with images successfully mapped to Notion
- Images now use consistent numeric ID naming
- Image paths: `/images/{productId}-hero-{01-07}.jpg`
- Detail images: `/images/{productId}-details.jpg`

### ⚠️ Missing Images (6 products)
These products don't have matching images in `/shop/public/images/`:
1. `922372663000` - Aimpoint T2 3x Magnifier Mount
2. `890198613762` - ARSON MACHINE Rail Cable Organizer
3. `914138043076` - Claymore Plush Toy
4. `996878077277` - SIG Sauer Scope 1-6x Magnification
5. `678253192936` - WADSN PEQ-15 Red/Green Laser
6. `999630523989` - WoSporT ARC Rail Integrated Set

**Action needed**: These products need to be re-scraped or have images manually added.

## Image Naming Convention

### Current Standard (Post-Reset)
```
{numeric-product-id}-hero-01.jpg    # Primary hero image
{numeric-product-id}-hero-02.jpg    # Additional carousel images
{numeric-product-id}-hero-03.jpg
...
{numeric-product-id}-details.jpg    # Long detail/description image
{numeric-product-id}-Main.jpg       # Legacy main image (fallback)
```

### Example
For product `709022174805`:
- `/images/709022174805-hero-01.jpg`
- `/images/709022174805-hero-02.jpg`
- `/images/709022174805-details.jpg`

## How to Re-run

### Full Reset
```bash
cd shared/scripts
npm run reset-notion-images
```

### Individual Operations
```bash
# Clear only
npm run clear-notion

# Reseed only
npm run reseed-notion
```

## Future Maintenance

### Adding New Products
1. Ensure images are named with the Knack product ID
2. Place images in `/shop/public/images/`
3. Run: `npm run reseed-notion` (in shared/scripts)

### Fixing Missing Images
1. Get the product ID from Knack
2. Name images as `{productId}-hero-01.jpg`, etc.
3. Place in `/shop/public/images/`
4. Re-run reseed script

### Verifying Image Links
```bash
cd shop/scripts
node fix-image-paths.mjs
```

This will create any missing numeric ID links for new images.

## Technical Details

### Image Flow
```
Scraper → /scraper/media/ → /shop/public/images/ → Notion (URLs) → Shop Display
         (slug names)      (ID + slug links)      (ID URLs)      (Next.js Image)
```

### Why Hard Links?
- **Space efficient**: No duplicate files
- **Fast**: No file copying needed
- **Flexible**: Images accessible via multiple names
- **Safe**: Deleting one link doesn't affect the original

### Notion Storage
- Notion stores **external URLs** pointing to shop images
- Format: `https://pzairsoft.ca/images/{productId}-hero-01.jpg`
- Local dev: `http://localhost:3000/images/{productId}-hero-01.jpg`

## Rollback

If needed, you can rollback by:
1. Restore from backup: `shared/data/products_manifest.json.backup`
2. Clear Notion: `npm run clear-notion`
3. Reseed from backup manifest

## Date Completed
January 20, 2026

## Total Images Processed
- 28 Notion records cleared
- 26 products successfully reseeded
- 249 hard links created
- 6 products pending images
