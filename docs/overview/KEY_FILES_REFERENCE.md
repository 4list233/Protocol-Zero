# Key Files Quick Reference

**Purpose:** Fast lookup for important files when making changes

---

## 🎨 Frontend (Shop)

### **Product Pages**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `shop/app/shop/[id]/page.tsx` | ~300 | Product detail page | **Phase 1** |
| `shop/app/shop/page.tsx` | ~150 | Product listing page | Phase 1 |
| `shop/components/product-card.tsx` | ~100 | Product card component | Phase 1 |

### **Variant Selection**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `shop/components/multi-variant-selector.tsx` | ~200 | **Multi-dimensional variant picker** | **Phase 1** |
| `shop/components/variant-selector.tsx` | ~80 | Simple variant selector | Phase 1 |

### **Layout & Styling**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `shop/app/globals.css` | ~100 | Global styles | Phase 1 |
| `shop/tailwind.config.ts` | ~50 | Tailwind configuration | Phase 1 |

---

## 🗄️ Backend (Shop)

### **Knack Integration**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `shop/lib/knack-products.ts` | 837 | **Product/variant fetching from Knack** | Phases 1,2,3 |
| `shop/lib/knack-config.ts` | 243 | **Field mappings (Knack ↔ Code)** | **Phase 2** |
| `shop/lib/knack-client.ts` | ~400 | Knack API wrapper | Phase 2,3 |

### **Types & Models**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `shop/lib/types.ts` | 73 | TypeScript type definitions | Phases 1,2 |
| `shop/lib/notion-client.ts` | ~500 | Notion types (ProductRuntime, etc.) | Phases 1,2 |

### **Database**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `shop/prisma/schema.prisma` | 93 | PostgreSQL schema (clips/users only) | - |

---

## 🔧 Scraper (Python)

### **Main Scraper**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `scraper/ai_scraper.py` | 2181 | **Main scraper (Selenium + Gemini)** | **Phase 3** |
| `scraper/variant_engine.py` | ~800 | Variant extraction logic | Phase 3 |

### **Knack Integration**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `scraper/knack_integration.py` | 450+ | **Knack API wrapper (Python)** | **Phase 2,3** |

### **Product Management**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `scraper/folders_to_knack.py` | ~400 | Upload product folders → Knack | Phase 3 |
| `scraper/csv_to_folders.py` | ~300 | Convert CSV/JSON → folders | - |
| `scraper/edit_product.py` | ~200 | Interactive product editor | - |

### **Image Handling**

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `scraper/sync_media.py` | ~150 | Copy images to shop/public/images/ | Phase 3 |
| `scraper/migrate_hero_images.py` | ~200 | Migrate to hero image naming | - |

---

## 📊 Data Files

### **Product Data**

| File | Format | Purpose |
|------|--------|---------|
| `scraper/taobao_links.txt` | Plain text | **URLs to scrape (38 links)** |
| `scraper/ai_scraper_output/products/product_XXX/product.txt` | Key-value | Product metadata |
| `scraper/ai_scraper_output/products/product_XXX/variants.txt` | CSV-like | Editable variant list |
| `scraper/ai_scraper_output/products.json` | JSON | Full scraper output |
| `scraper/ai_scraper_output/products.csv` | CSV | Flat variant export |

### **Images**

| Location | Purpose |
|----------|---------|
| `scraper/ai_scraper_output/media/product_XXX/Main/` | Hero image 1 |
| `scraper/ai_scraper_output/media/product_XXX/Catalogue/` | Hero images 2-7 |
| `scraper/ai_scraper_output/media/product_XXX/details_stitched.jpg` | Long detail scroll |
| `shop/public/images/` | **Final image location (served to users)** |

---

## 📖 Documentation

### **Key Guides**

| File | Purpose | Priority |
|------|---------|----------|
| `CODEBASE_STATE_SUMMARY.md` | Complete system overview | ⭐⭐⭐ |
| `TAOBAO_INTEGRATION_PLAN.md` | 3-phase integration plan | ⭐⭐⭐ |
| `KNACK_DATABASE_SCHEMA.md` | Full Knack schema reference | ⭐⭐⭐ |
| `FOLDER_PRODUCTS_SUMMARY.md` | Folder-based products guide | ⭐⭐ |
| `HERO_IMAGES_SUMMARY.md` | Hero images system | ⭐⭐ |

### **Phase-Specific Docs**

| File | Phase | Purpose |
|------|-------|---------|
| `FRONTEND_MULTIDIMENSIONAL_WORKFLOW.md` | Phase 1 | Frontend variant workflow |
| `docs/KNACK_FIELDS_TO_ADD.md` | Phase 2 | Field addition guide |
| `scraper/NEW_WORKFLOW.md` | Phase 3 | Updated scraper workflow |

---

## 🔥 Critical Code Sections

### **Phase 1: Shop Frontend Changes**

#### 1. Product Detail Page Layout
**File:** `shop/app/shop/[id]/page.tsx`
- **Lines 1-100:** Component setup & data fetching
- **Lines 100-200:** Image gallery and thumbnails
- **Lines 200-300:** Product info & variant selector

#### 2. Multi-Dimensional Variant Selector
**File:** `shop/components/multi-variant-selector.tsx`
- **Lines 1-50:** Component props & state
- **Lines 50-150:** Variant grid rendering
- **Lines 150-200:** Selection logic & price updates

---

### **Phase 2: Database Schema Changes**

#### 1. Knack Field Mappings (TypeScript)
**File:** `shop/lib/knack-config.ts`
- **Lines 94-112:** Products object fields
- **Lines 114-148:** Variants object fields ⭐ **MOST IMPORTANT**
- **Lines 226-235:** Helper functions

#### 2. Knack Field Mappings (Python)
**File:** `scraper/knack_integration.py`
- **Lines 26-42:** Product field mappings
- **Lines 44-63:** Variant field mappings ⭐ **MOST IMPORTANT**
- **Lines 66-126:** KnackAPI class

#### 3. Product Fetching Logic
**File:** `shop/lib/knack-products.ts`
- **Lines 308-364:** mapKnackRecordToProduct()
- **Lines 369-426:** mapKnackRecordToVariant() ⭐ **NEW FIELDS GO HERE**
- **Lines 431-588:** fetchProducts() - main fetch logic

---

### **Phase 3: Scraper Updates**

#### 1. Data Models
**File:** `scraper/ai_scraper.py`
- **Lines 864-881:** ScrapedVariant dataclass ⭐ **ADD NEW FIELDS**
- **Lines 884-894:** ScrapedProduct dataclass ⭐ **ADD NEW FIELDS**

#### 2. Scraping Logic
**File:** `scraper/ai_scraper.py`
- **Lines 972-1113:** scrape_product() - main scraping
- **Lines 1115-1138:** _extract_title()
- **Lines 1685-1774:** _extract_current_price()

#### 3. Knack Upload
**File:** `scraper/ai_scraper.py`
- **Lines 1796-1882:** _push_to_knack() ⭐ **UPDATE FOR NEW FIELDS**

---

## 🎯 Where to Make Changes for Each Phase

### **Phase 1: Shop → Taobao Format**

**Primary Files:**
1. `shop/app/shop/[id]/page.tsx` - Product page layout
2. `shop/components/multi-variant-selector.tsx` - Variant picker UI
3. `shop/app/globals.css` - Styling updates

**Changes:**
- Update CSS classes for Taobao-style grid
- Modify variant selector component
- Adjust image gallery layout
- Improve mobile responsiveness

---

### **Phase 2: Database Structure**

**Primary Files:**
1. `shop/lib/knack-config.ts` (Lines 94-148) - Add new field mappings
2. `scraper/knack_integration.py` (Lines 26-63) - Add new field mappings
3. `KNACK_DATABASE_SCHEMA.md` - Document changes

**Changes:**
1. **In Knack Builder:**
   - Add new fields to Products (object_6)
   - Add new fields to Variants (object_7)
   - Note field IDs (field_XXX)

2. **In `knack-config.ts`:**
   ```typescript
   products: {
     // Add new fields here
     sellerName: 'field_XXX',
     productRating: 'field_XXX',
   }
   ```

3. **In `knack_integration.py`:**
   ```python
   PRODUCT_FIELDS = {
       # Add new fields here
       'sellerName': 'field_XXX',
       'productRating': 'field_XXX',
   }
   ```

---

### **Phase 3: Scraper → Database**

**Primary Files:**
1. `scraper/ai_scraper.py`
   - Lines 864-894: Update dataclasses
   - Lines 972-1113: Extract new data
   - Lines 1796-1882: Push new fields to Knack

2. `scraper/knack_integration.py`
   - Lines 171-219: Update product creation
   - Lines 221-280: Update variant creation

**Changes:**
1. **Add fields to dataclasses:**
   ```python
   @dataclass
   class ScrapedProduct:
       # ... existing fields ...
       seller_name: str = ""      # NEW
       product_rating: float = 0.0  # NEW
   ```

2. **Extract new data:**
   ```python
   def scrape_product(self, url: str, index: int):
       # ... existing code ...
       product.seller_name = self._extract_seller_name()
       product.product_rating = self._extract_rating()
   ```

3. **Update Knack push:**
   ```python
   product_data = {
       # ... existing fields ...
       PRODUCT_FIELDS['sellerName']: product.seller_name,
       PRODUCT_FIELDS['productRating']: product.product_rating,
   }
   ```

---

## 🔍 Quick Search Commands

### Find where fields are used:
```bash
# Search for a specific Knack field
rg "field_145" --type ts --type py

# Find variant-related code
rg "optionType1" --type ts

# Find product fetching code
rg "fetchProducts" --type ts
```

### Find component usage:
```bash
# Where is MultiVariantSelector used?
rg "MultiVariantSelector" --type tsx

# Where are images displayed?
rg "primaryImage" --type tsx
```

---

## 🚀 Common Tasks

### **Task: Add a new Knack field**
1. Add field in Knack Builder → note field ID
2. Update `shop/lib/knack-config.ts` (add to products/variants object)
3. Update `scraper/knack_integration.py` (add to PRODUCT_FIELDS/VARIANT_FIELDS)
4. Update TypeScript types if needed (`shop/lib/notion-client.ts`)

### **Task: Change variant selector UI**
1. Edit `shop/components/multi-variant-selector.tsx`
2. Update styles in `shop/app/globals.css`
3. Test on desktop and mobile

### **Task: Scrape a new field from Taobao**
1. Add field to `ScrapedProduct` dataclass (`scraper/ai_scraper.py` line 884)
2. Add extraction method (`scraper/ai_scraper.py` around line 1120)
3. Call extraction in `scrape_product()` (line 972)
4. Update `_push_to_knack()` to send to Knack (line 1796)

---

## 📞 Need to Find Something?

### "Where is the variant selector rendered?"
→ `shop/app/shop/[id]/page.tsx` + `shop/components/multi-variant-selector.tsx`

### "Where are Knack fields mapped?"
→ `shop/lib/knack-config.ts` (TypeScript) + `scraper/knack_integration.py` (Python)

### "Where does the scraper extract product data?"
→ `scraper/ai_scraper.py` lines 972-1113 (`scrape_product()`)

### "Where are images copied to the shop?"
→ `scraper/sync_media.py`

### "Where is pricing calculated?"
→ `scraper/ai_scraper.py` lines 78-121 (`calculate_price_cad()`)

### "Where are products fetched from Knack?"
→ `shop/lib/knack-products.ts` lines 431-588 (`fetchProducts()`)

---

**Quick Tip:** Use your editor's "Go to Definition" (Cmd+Click or F12) to navigate between related code sections.
