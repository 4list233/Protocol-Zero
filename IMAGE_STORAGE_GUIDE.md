# Image Storage Guide

## Overview
Product images are now stored as **Files** directly in Notion instead of JSON file paths. This approach:
- ✅ Saves local storage space
- ✅ Leverages Notion's file management
- ✅ Allows images to be edited/replaced in Notion UI
- ✅ Provides automatic CDN delivery through Notion

## How It Works

### 1. Seeding Process (`json-to-notion.js`)
When seeding products from `products_manifest.json`:
- Reads image paths from JSON (e.g., `/images/product-123.jpg`)
- Converts them to public URLs (served by Next.js at `localhost:3000/images/`)
- Uploads to Notion as **external file references**
- Stores in `Images` (Files & media) and `Detail Image` (Files & media) properties

### 2. Notion Storage
- **Images** property: Array of file objects (main product photos)
- **Detail Image** property: Single file object (long detail image)
- Files can be:
  - External URLs (what we're using: `external: { url: "..." }`)
  - Notion-hosted files (if uploaded directly in Notion UI)

### 3. Retrieval (`notion-client.ts`)
When fetching products:
```typescript
const imageFiles = props['Images']?.files || []
const images = imageFiles.map(f => f.external?.url || f.file?.url)
```
- Extracts URLs from file objects
- Supports both external and Notion-hosted files
- Returns clean URL array for the app

## Configuration

### Environment Variable (Optional)
Add to `.env.local` if you want to use a production URL:
```bash
NEXT_PUBLIC_BASE_URL=https://yoursite.com
```

For local development, it defaults to `http://localhost:3000`

## Migration Notes

### Old Properties (Deprecated)
- `Image Paths` (Text) - Stored JSON array of paths
- `Detail Image Path` (Text) - Stored single path string

### New Properties (Active)
- `Images` (Files & media) - Array of file objects
- `Detail Image` (Files & media) - Single file object

You can keep both during transition, but the seeding script now uses the Files properties.

## Benefits

1. **No Local Storage**: Images aren't stored as paths in JSON strings
2. **Notion UI**: Edit, replace, or reorder images directly in Notion
3. **CDN Delivery**: Notion serves files through their CDN
4. **Type Safety**: Files property provides structured data
5. **Flexibility**: Mix external URLs and Notion uploads

## Next Steps

1. Run the updated seeding script: `npm run seed-notion`
2. Verify images appear in Notion's Files properties
3. Check that the shop displays images correctly
4. Consider hosting images on a CDN for production (Cloudinary, S3, etc.)

---

**Last Updated:** November 19, 2025
