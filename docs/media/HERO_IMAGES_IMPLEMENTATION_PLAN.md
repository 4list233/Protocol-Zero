# Hero Images Implementation Plan
## Taobao-Style Image Gallery (6-7 Hero Images)

### Current State
- Images are stored in `/shop/public/images/`
- Pattern: `[product-id]-Main.jpg`, `[product-id]-Details_Long.jpg`
- Frontend shows: 1 main image + detail scroll image
- Thumbnails exist but only show the main image

### Target State (Taobao-Style)
- **6-7 hero images** displayed in main carousel
- Thumbnails on left (desktop) / bottom (mobile)
- Detail long image kept separate for scrolling section
- Images categorized: **Hero** (6-7 images) vs **Detail** (1 long stitched)

---

## Implementation Steps

### 1. **Update Image Naming Convention**

**Current:**
```
/images/[product-id]-Main.jpg
/images/[product-id]-Details_Long.jpg
```

**New:**
```
/images/[product-id]-hero-01.jpg
/images/[product-id]-hero-02.jpg
/images/[product-id]-hero-03.jpg
/images/[product-id]-hero-04.jpg
/images/[product-id]-hero-05.jpg
/images/[product-id]-hero-06.jpg
/images/[product-id]-hero-07.jpg (optional)
/images/[product-id]-details.jpg (long stitched image)
```

### 2. **Update Scraper Output Structure**

Modify `/scraper/sync_media.py` to copy images with new naming:

```python
# Copy Main image as hero-01
main_img → product-id-hero-01.jpg

# Copy Catalogue images as hero-02 through hero-07
cat_01.jpg → product-id-hero-02.jpg
cat_02.jpg → product-id-hero-03.jpg
cat_03.jpg → product-id-hero-04.jpg
cat_04.jpg → product-id-hero-05.jpg
cat_05.jpg → product-id-hero-06.jpg
cat_06.jpg → product-id-hero-07.jpg

# Copy stitched details
details_stitched.jpg → product-id-details.jpg
```

### 3. **Update Frontend Image Loading**

Modify `/shop/lib/knack-products.ts` → `getProductImages()`:

```typescript
function getProductImages(productId: string): { images: string[]; detailImage?: string } {
  // Generate paths for up to 7 hero images
  const heroImages: string[] = []
  for (let i = 1; i <= 7; i++) {
    const num = i.toString().padStart(2, '0')
    heroImages.push(`/images/${productId}-hero-${num}.jpg`)
  }
  
  const detailImage = `/images/${productId}-details.jpg`
  
  return {
    images: heroImages,
    detailImage: detailImage,
  }
}
```

### 4. **Update Frontend Display**

`/shop/app/shop/[id]/page.tsx` already has the thumbnail gallery structure! Just need to:
- Ensure hero images load correctly
- Filter out non-existent images (404s)
- Keep detail image separate

### 5. **Update Notion Integration (Optional - For Tracking)**

Add to Notion Products database:
- **Hero Images** (Files) - stores 6-7 main product images
- **Detail Image** (Files) - stores long stitched detail image

This allows tracking which images are hero vs detail in Notion UI.

### 6. **Image Validation in Frontend**

Add image loading validation to filter out 404s:

```typescript
// Only show images that actually exist
const validImages = await Promise.all(
  heroImages.map(async (url) => {
    const exists = await imageExists(url)
    return exists ? url : null
  })
).then(results => results.filter(Boolean))
```

---

## Folder Structure for Scraper

```
scraper/ai_scraper_output/
├── media/
│   ├── product_001/
│   │   ├── Main/           # Main hero image
│   │   │   └── image.jpg
│   │   ├── Catalogue/      # Additional hero images (2-7)
│   │   │   ├── cat_01.jpg
│   │   │   ├── cat_02.jpg
│   │   │   ├── cat_03.jpg
│   │   │   ├── cat_04.jpg
│   │   │   ├── cat_05.jpg
│   │   │   └── cat_06.jpg
│   │   └── details_stitched.jpg  # Detail scroll image
│   ├── product_002/
│   │   └── ...
```

---

## Migration Plan

### Option A: Update scraper and re-sync all images
1. Update `sync_media.py` with new naming
2. Run `python3 scraper/sync_media.py`
3. Images copied to `/shop/public/images/` with new names
4. Frontend automatically picks them up

### Option B: Manual folder organization
1. Create folder structure in scraper output
2. Move existing images into correct folders
3. Run updated sync script

---

## Testing Checklist

- [ ] Scraper creates correct folder structure
- [ ] sync_media.py copies images with hero-01 to hero-07 naming
- [ ] Frontend loads all 7 hero images
- [ ] Thumbnail gallery shows all hero images
- [ ] Detail image stays separate for scroll section
- [ ] Mobile: thumbnails scroll horizontally
- [ ] Desktop: thumbnails show vertically on left
- [ ] Images that don't exist (404) are filtered out
- [ ] Notion database tracks hero vs detail images (optional)

---

## Benefits

✅ **Taobao-style UX** - Multiple hero images with thumbnail navigation  
✅ **Better product presentation** - Show 6-7 angles/features  
✅ **Separation of concerns** - Hero images separate from detail scroll  
✅ **Scalable** - Easy to add more hero images if needed  
✅ **Performance** - Direct static serving from /public/images/  
✅ **No database changes** - Just file naming convention  

---

## Next Steps

1. ✅ Update `sync_media.py` with new image naming
2. ✅ Update `getProductImages()` in `knack-products.ts`
3. ✅ Add image validation to filter 404s
4. ⏳ Test with sample products
5. ⏳ Update Notion database schema (optional)
6. ⏳ Re-sync all images with new naming
