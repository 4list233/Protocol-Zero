# Image Display Fix Summary

## Problem
Product images were not displaying in the shop because:
1. The frontend was aggressively validating ALL image paths with HEAD requests
2. Non-existent image paths (like hero-07 for products with only 6 images) were causing issues
3. Images exist in `/public/images/` but the validation was filtering them out

## Solution Implemented

### 1. **Simplified Image Path Generation** ([knack-products.ts](../shop/lib/knack-products.ts))
- Updated `getProductImages()` to generate paths for hero-01 through hero-07 and Main.jpg
- Added proper TypeScript typing for return value including `legacyDetailImage`
- Images are generated as:
  - `/images/{productId}-hero-01.jpg` (primary)
  - `/images/{productId}-Main.jpg` (legacy fallback)
  - `/images/{productId}-hero-02.jpg` through `hero-07.jpg` (additional carousel images)
  - `/images/{productId}-details.jpg` (detail image)

### 2. **Removed Aggressive Frontend Validation** ([page.tsx](../shop/app/shop/[id]/page.tsx))
- Removed the HEAD request validation that was checking every image path
- Now trusts the backend to provide valid image paths
- Added `onError` handlers to Image components to gracefully handle 404s
- Implemented a state-based error tracking system to remove broken images from the carousel

### 3. **Fixed TypeScript Types**
- Updated `ProductVariant` type in:
  - [products.ts](../shop/lib/products.ts)
  - [notion-client.ts](../shop/lib/notion-client.ts)
- Removed `shipping_cny` from variant output (internal use only)
- Added `cost_cad`, `margin`, `margin_promo` to type definitions

## Files Modified
1. `/shop/lib/knack-products.ts` - Image path generation
2. `/shop/app/shop/[id]/page.tsx` - Frontend image display logic
3. `/shop/lib/products.ts` - Type definitions
4. `/shop/lib/notion-client.ts` - Type definitions

## How It Works Now
1. **Backend**: `fetchProductById()` → `mapKnackRecordToProduct()` → `getProductImages(productId)`
   - Generates image paths directly from product ID
   - Returns array of all possible image paths
   - No API calls to Notion for images

2. **Frontend**: Product page receives image paths
   - Displays images directly
   - Next.js Image component handles 404s gracefully with built-in error handling
   - `onError` handler removes broken images from state

3. **Image Storage**: Images are in `/public/images/` with naming pattern:
   - `{productId}-hero-{01-07}.jpg`
   - `{productId}-Main.jpg` (legacy)
   - `{productId}-details.jpg`

## Testing
To test the fix:

```bash
# 1. Build and start the dev server
cd shop
npm run dev

# 2. Visit shop pages
# - Main shop: http://localhost:3000/shop
# - Test product: http://localhost:3000/shop/586117181099

# 3. Check browser console for image loading errors
# - Should see images displaying correctly
# - No 404 errors for hero-01.jpg or Main.jpg
# - Hero-07.jpg may 404 (gracefully handled) if product has fewer images
```

## Next Steps for Re-scraping
When you're ready to redo the scraping:

1. **Run scraper** to get new product data and images
2. **Run sync_media.py** to copy images to `/public/images/`
3. **Ensure naming matches**:
   - Primary: `{productId}-hero-01.jpg`
   - Additional: `{productId}-hero-02.jpg` through `hero-07.jpg`
   - Details: `{productId}-details.jpg`

4. **Upload to Knack** with product IDs matching image filenames
5. Images will automatically display based on product ID

No changes needed to Notion - images are now served directly from the file system.
