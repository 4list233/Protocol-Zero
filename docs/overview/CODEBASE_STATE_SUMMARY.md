# Protocol Zero - Codebase State Summary
**Generated:** January 13, 2026

This document summarizes the current state of the codebase, key changes since last session, and the path forward for Taobao format integration.

---

## 🎯 Current Project Structure

```
protocol-zero/
├── scraper/              # Python scraper (Selenium + Gemini AI)
│   ├── ai_scraper.py             # Main scraper
│   ├── variant_engine.py         # Variant extraction
│   ├── knack_integration.py      # Knack API wrapper
│   ├── folders_to_knack.py       # Upload from folders → Knack
│   ├── csv_to_folders.py         # Convert CSV → folders
│   └── ai_scraper_output/
│       ├── products/             # ✨ NEW: Folder-based structure
│       │   └── product_XXX/
│       │       ├── product.txt   # Editable product metadata
│       │       ├── variants.txt  # Editable variant list
│       │       └── notes.txt     # Your notes
│       └── media/                # Downloaded images
│           └── product_XXX/
│               ├── Main/         # Hero image 1
│               ├── Catalogue/    # Hero images 2-7
│               └── details_stitched.jpg  # Long scroll image
│
├── shop/                 # Next.js 15 e-commerce frontend
│   ├── app/              # Next.js app router
│   ├── lib/              # Business logic
│   │   ├── knack-products.ts     # Knack product API
│   │   ├── knack-config.ts       # Field mappings
│   │   └── types.ts              # TypeScript types
│   ├── components/       # React components
│   ├── public/images/    # ✨ Product images (served directly)
│   └── prisma/           # PostgreSQL schema (clips/users only)
│
└── shared/               # Bridge between scraper & shop
    ├── data/             # JSON manifests
    └── scripts/          # Sync scripts
```

---

## 📊 Database Architecture

### **Primary Stack:**
- **Knack** → Products, Variants, Orders (main business data)
- **PostgreSQL (Prisma)** → Clips, Users, Comments (social features only)
- **Notion** → Optional image backup (linked by Product ID/SKU)
- **Public Folder** → `/shop/public/images/` (primary image storage, no API calls)

### **Key Knack Objects:**

| Object | Key | Purpose | Fields |
|--------|-----|---------|--------|
| Products | `object_6` | Product catalog | 15 fields (ID, Title, Status, URL, etc.) |
| Variants | `object_7` | Product variants | 30+ fields (multi-dimensional, pricing, margins) |
| Orders | `object_10` | Customer orders | 20+ fields (payment, shipping, status) |
| Users | `object_8` | Customer accounts | 12 fields (Firebase UID, role, email) |

### **Critical Variant Fields:**

```typescript
{
  // Connection
  product: 'field_61',              // Links to Products
  
  // Basic Info
  variantName: 'field_62',          // "S / Black Set"
  status: 'field_67',               // Active/Out of Stock
  
  // Multi-Dimensional Options
  optionType1: 'field_145',         // "Size", "Color", "Style"
  optionValue1: 'field_146',        // "S", "Black", "Standard"
  optionType2: 'field_147',         // "Style" (nullable)
  optionValue2: 'field_148',        // "Set A" (nullable)
  
  // Pricing
  priceCny: 'field_64',             // ¥202
  shippingCny: 'field_151',         // ¥30 (fixed)
  costCad: 'field_173',             // $44.08 ((202+30) × 0.19)
  priceCad: 'field_138',            // $72.99 (selling price)
  marginStandard: 'field_154',      // 30.5% (standard margin)
  marginPromo: 'field_155',         // 14.2% (after promoter cuts)
}
```

---

## 🔥 Recent Major Changes

### 1. **Folder-Based Product Structure** ✨ NEW

**What Changed:**
- Products now stored as individual folders instead of single CSV
- Each product has editable text files: `product.txt`, `variants.txt`, `notes.txt`
- Makes editing much easier - just click, edit, save, re-upload

**Location:** `scraper/ai_scraper_output/products/product_XXX/`

**Tools Created:**
- `csv_to_folders.py` - Convert CSV/JSON → folders
- `folders_to_knack.py` - Upload folders → Knack
- `edit_product.py` - Interactive editor

**Example Folder:**
```
product_001/
├── product.txt      # ID, Title, URL, Category, Status
├── variants.txt     # Name | Price CNY | Price CAD | Margin | Status
└── notes.txt        # Your editing notes
```

**Status:** ✅ Implemented and documented

---

### 2. **Hero Images System** ✨ NEW

**What Changed:**
- Changed from 1 main image → 7 hero images (Taobao-style carousel)
- New naming convention: `[product-id]-hero-01.jpg` through `hero-07.jpg`
- Details image separate: `[product-id]-details.jpg`
- Frontend has Taobao-style thumbnail gallery

**Image Flow:**
```
Scraper captures images
    ↓
Saves to media/product_XXX/Main/ + Catalogue/
    ↓
sync_media.py copies to shop/public/images/
    ↓
Frontend displays from /images/ (no API calls)
```

**Status:** ✅ Implemented and documented

---

### 3. **Multi-Dimensional Variants** ✅ STABLE

**Supports:**
- 2-dimensional variants (e.g., Size × Style, Color × Size)
- Automatic extraction from Taobao variant selectors
- Individual pricing per variant combination

**Example:**
```python
# Product: Tactical Belt System
# Dimensions: 5 Sizes × 20 Styles = 100 variants

Variant("S / A款套装", price_cny=202)
Variant("M / B款套装", price_cny=390)
Variant("L / 快拆带锁棍套", price_cny=48)
```

**Status:** ✅ Production ready

---

### 4. **AI Scraper V3** ✅ STABLE

**Features:**
- Gemini AI translation (Chinese → English)
- Multi-model fallback (5 models with rate limit handling)
- Batch translation for efficiency
- DOM + Vision-based price extraction
- Click-based variant detection

**Usage:**
```bash
# Test mode
python3 ai_scraper.py --test

# Full scrape (no Knack push)
python3 ai_scraper.py

# Push to Knack
python3 ai_scraper.py --push-knack
```

**Status:** ✅ Production ready

---

## 🔄 Current Data Flow

### **Scraper → Knack → Shop**

```
1. SCRAPE (ai_scraper.py)
   └─> Taobao URL → Extract variants + images + prices
   
2. SAVE (ai_scraper_output/)
   └─> products/product_XXX/product.txt + variants.txt
   └─> media/product_XXX/Main + Catalogue + Details
   
3. UPLOAD (folders_to_knack.py)
   └─> Push products + variants to Knack
   
4. SYNC (sync_media.py)
   └─> Copy images to shop/public/images/
   
5. DISPLAY (shop frontend)
   └─> Fetch from Knack API
   └─> Display images from /images/ folder
```

---

## 📋 Taobao Format Requirements

Based on `taobao_links.txt`, here's what you're scraping:

### **Link Format:**
```
https://item.taobao.com/item.htm?id=969220337986&...
https://detail.tmall.com/item.htm?id=823946437927&...
```

### **Current Scraper Handles:**
- ✅ Multi-dimensional variants (Size, Color, Style)
- ✅ Individual variant pricing (click detection)
- ✅ Image extraction (Main, Gallery, Details)
- ✅ Chinese → English translation
- ✅ CNY → CAD pricing calculation

### **What Needs Adjustment:**
- 🔧 Shop frontend to display Taobao-style multi-dimensional selectors
- 🔧 Database schema might need additional fields (you mentioned changes)
- 🔧 Scraper to match new database structure

---

## 🎯 Next Steps: Your Requirements

You mentioned:

### 1. **First: Make changes to shop to match Taobao format**
   - Update frontend components to display multi-dimensional variants
   - Ensure product pages show Size × Style grids
   - Validate pricing display matches Taobao expectations

### 2. **Second: Change database structure**
   - Identify which fields need to be added/modified
   - Update Knack objects and field mappings
   - Document new schema

### 3. **Third: Update scraper to match new database**
   - Modify `ai_scraper.py` to output new fields
   - Update `knack_integration.py` field mappings
   - Test full pipeline: Scrape → Knack → Shop

---

## 🔍 Key Files to Review

### **Shop (Frontend & Backend):**
- `shop/lib/knack-products.ts` - Product fetching logic
- `shop/lib/knack-config.ts` - Field mappings
- `shop/components/multi-variant-selector.tsx` - Variant selector component
- `shop/app/shop/[id]/page.tsx` - Product detail page

### **Scraper:**
- `scraper/ai_scraper.py` - Main scraper (lines 1-2181)
- `scraper/variant_engine.py` - Variant extraction
- `scraper/knack_integration.py` - Knack API wrapper

### **Documentation:**
- `KNACK_DATABASE_SCHEMA.md` - Full schema reference
- `FOLDER_PRODUCTS_SUMMARY.md` - Folder structure guide
- `HERO_IMAGES_SUMMARY.md` - Image system guide

---

## 🚀 Quick Commands

### **Scraper:**
```bash
# Test scrape (first URL only)
python3 scraper/ai_scraper.py --test

# Full scrape
python3 scraper/ai_scraper.py

# Push to Knack
python3 scraper/ai_scraper.py --push-knack

# Edit product
python3 scraper/edit_product.py --search "belt"

# Upload specific product
python3 scraper/folders_to_knack.py --product 5
```

### **Shop:**
```bash
# Dev server
cd shop && npm run dev

# Build production
cd shop && npm run build

# Database sync
cd shop && npx prisma db push
```

---

## 📊 Current Statistics

- **Products scraped:** 28 products in backups
- **Taobao links:** 38 URLs in `taobao_links.txt`
- **Variants per product:** Average ~64 variants (multi-dimensional)
- **Image types:** 3 (Main, Gallery, Details)
- **Hero images per product:** Up to 7
- **Database objects:** 6 (Products, Variants, Orders, Users, Clips, Signups)

---

## 🎨 Frontend Components Status

- ✅ `MultiVariantSelector` - Multi-dimensional variant picker
- ✅ Product card with hero images
- ✅ Cart drawer with variant tracking
- ✅ Checkout with order creation
- ✅ Taobao-style image gallery (7 hero images + thumbnails)

---

## 🔐 Environment Variables Required

### **Shop (.env.local):**
```bash
# Knack
KNACK_APPLICATION_ID=...
KNACK_REST_API_KEY=...

# Notion (optional)
NOTION_API_KEY=...
NOTION_DATABASE_ID_PRODUCTS=...

# Firebase Auth
NEXT_PUBLIC_FIREBASE_API_KEY=...
FIREBASE_ADMIN_PROJECT_ID=...

# Database
DATABASE_URL=postgresql://...

# Gemini AI
GEMINI_API_KEY=...
```

---

## ✅ What's Working

1. ✅ Scraper extracts multi-dimensional variants from Taobao
2. ✅ AI translation (Chinese → English)
3. ✅ Individual variant pricing with Vision API
4. ✅ Folder-based product editing
5. ✅ Hero images system (7 images + detail scroll)
6. ✅ Knack integration with full field mapping
7. ✅ Frontend displays variants and pricing
8. ✅ Cart system with variant tracking

---

## 🔧 What Needs Work (Per Your Request)

### **Phase 1: Shop → Taobao Format**
- Review frontend variant display
- Ensure multi-dimensional selectors match Taobao UX
- Validate pricing/margin display

### **Phase 2: Database Changes**
- Identify new fields needed
- Update Knack schema
- Update field mappings in code

### **Phase 3: Scraper → Database**
- Update scraper to populate new fields
- Ensure direct upload to shop works
- Test end-to-end pipeline

---

## 📞 Ready for Next Steps

I'm now up to date on your codebase. Let me know:

1. **What specific Taobao format elements do you want in the shop?**
   - Different variant selector style?
   - Additional product information?
   - Specific layout changes?

2. **What database changes are you planning?**
   - New fields?
   - Schema restructuring?
   - Different relationships?

3. **How should the scraper upload to shop?**
   - Direct to Knack API?
   - Generate files for manual import?
   - Sync via shared folder?

---

**Last Updated:** January 13, 2026
**Status:** 🟢 Ready for Phase 1 (Shop Changes)
