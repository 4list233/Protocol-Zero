# Taobao Format Integration - 3-Phase Plan

**Goal:** Align the entire pipeline (Shop → Database → Scraper) with Taobao's product structure

---

## 📋 Overview

You have 38 Taobao product links ready to scrape. The plan is to:

1. **Phase 1:** Update shop frontend to match Taobao format
2. **Phase 2:** Modify database structure
3. **Phase 3:** Update scraper to directly upload to shop

---

## 🎯 Phase 1: Shop → Taobao Format

### **Current Shop Status**

✅ **Already Taobao-Like:**
- Multi-dimensional variant selector (Size × Style)
- 7 hero images with thumbnail carousel
- Individual variant pricing
- Detail image scroll section

❓ **What Needs Review:**
- Layout/styling compared to actual Taobao pages
- Variant selector UX
- Product information display
- Mobile responsiveness

### **Key Files to Modify**

```
shop/
├── app/shop/[id]/page.tsx           # Product detail page
├── components/
│   ├── multi-variant-selector.tsx   # Variant picker
│   ├── product-card.tsx             # Product cards
│   └── variant-selector.tsx         # Simple selector
├── lib/
│   ├── knack-products.ts            # Product fetching
│   └── types.ts                     # TypeScript types
```

### **Action Items**

1. **Compare with Real Taobao Pages**
   - Open sample Taobao product: https://item.taobao.com/item.htm?id=969220337986
   - Screenshot key UI elements:
     - Variant selector grid
     - Price display
     - Product title/description
     - Image gallery layout
   
2. **Identify UI Gaps**
   - [ ] Variant selector matches Taobao grid style?
   - [ ] Price display shows CNY + CAD?
   - [ ] Image carousel has same behavior?
   - [ ] Mobile layout matches Taobao app?

3. **Frontend Changes Needed**
   - Update `multi-variant-selector.tsx` styling
   - Modify product detail page layout
   - Add any missing Taobao-specific elements

### **Testing Checklist**

- [ ] Visit `/shop/[product-id]` for each product type
- [ ] Test variant selection on desktop
- [ ] Test variant selection on mobile
- [ ] Verify images load (all 7 hero images)
- [ ] Check pricing displays correctly
- [ ] Validate out-of-stock variants are hidden

---

## 🗄️ Phase 2: Database Structure Changes

### **Current Knack Schema**

**Products (object_6):**
- 15 fields (ID, Title, Status, URL, etc.)
- Images NOT stored in Knack (only in public folder + Notion)

**Variants (object_7):**
- 30+ fields including:
  - Multi-dimensional options (Type1/Value1, Type2/Value2)
  - Pricing (CNY, CAD, Cost, Margins)
  - Status, Stock, Sort Order
  - Add-on pricing fields

### **Questions to Answer**

1. **What's missing from current schema?**
   - Additional product metadata?
   - New variant attributes?
   - Taobao-specific fields (seller info, ratings, reviews)?

2. **What needs restructuring?**
   - Different field relationships?
   - New connection objects?
   - Field type changes?

3. **What about images?**
   - Keep current system (public folder + Notion backup)?
   - Store image URLs in Knack?
   - Change naming convention?

### **Proposed Changes (Example)**

If you want to add Taobao-specific fields:

**Products Object (object_6):**
```javascript
// New fields to add in Knack:
- Seller Name (field_XXX)          // Taobao store name
- Product Rating (field_XXX)       // 4.8/5.0
- Review Count (field_XXX)         // Number of reviews
- Monthly Sales (field_XXX)        // Monthly sales count
- Taobao Category (field_XXX)      // Original Taobao category
- Brand (field_XXX)                // Product brand if available
```

**Variants Object (object_7):**
```javascript
// Existing fields are comprehensive, but could add:
- Taobao Variant ID (field_XXX)    // Original Taobao SKU
- Variant Image URL (field_XXX)    // Individual variant image
- Stock Quantity (field_XXX)       // Actual stock count
```

### **Action Items**

1. **Review Current Fields**
   - Open Knack Builder
   - Review Products (object_6) fields
   - Review Variants (object_7) fields
   - Document what's missing

2. **Add New Fields in Knack**
   - Create new fields as needed
   - Note field IDs (field_XXX)
   - Update `KNACK_DATABASE_SCHEMA.md`

3. **Update Field Mappings**
   - `shop/lib/knack-config.ts` (TypeScript)
   - `scraper/knack_integration.py` (Python)

---

## 🔧 Phase 3: Scraper → Shop Direct Upload

### **Current Scraper Flow**

```
ai_scraper.py
  ↓ Scrapes Taobao
ai_scraper_output/
  ├── products/product_XXX/
  │   ├── product.txt
  │   ├── variants.txt
  │   └── notes.txt
  └── media/product_XXX/
      ├── Main/
      ├── Catalogue/
      └── details_stitched.jpg
  ↓ Manual editing (optional)
folders_to_knack.py --push-knack
  ↓ Uploads to Knack
shop/public/images/
  ↓ Manual sync_media.py
Frontend displays products
```

### **Goal: Streamlined Upload**

```
ai_scraper.py --push-knack
  ↓ Scrapes + uploads in one step
  ↓ Auto-syncs images
  ↓ No manual intervention needed
Frontend displays immediately
```

### **Changes Required**

1. **Update `ai_scraper.py`**
   - Add new fields to `ScrapedProduct` and `ScrapedVariant` dataclasses
   - Extract Taobao-specific data (seller, ratings, etc.)
   - Map to new Knack fields

2. **Update `knack_integration.py`**
   - Add new field mappings from Phase 2
   - Update `PRODUCT_FIELDS` and `VARIANT_FIELDS` dicts
   - Ensure all new fields are sent to Knack

3. **Update Image Sync**
   - Auto-run `sync_media.py` after scraping?
   - Or build image sync into scraper?
   - Ensure images are in correct format for shop

4. **Add Validation**
   - Check all required fields are present
   - Validate image formats
   - Ensure pricing calculations are correct

### **Testing Checklist**

- [ ] Scrape test product with `--push-knack`
- [ ] Verify all fields populate in Knack
- [ ] Check images appear in `/shop/public/images/`
- [ ] Validate product displays correctly in shop
- [ ] Test multi-dimensional variants work
- [ ] Verify pricing is accurate

---

## 🔄 Complete Workflow (After All Phases)

```bash
# 1. Add Taobao URL to links file
echo "https://item.taobao.com/item.htm?id=123456" >> scraper/taobao_links.txt

# 2. Run scraper with auto-upload
cd scraper
python3 ai_scraper.py --push-knack

# 3. Images auto-sync (or run manually)
python3 sync_media.py

# 4. Product appears in shop immediately
# Visit: http://localhost:3000/shop/[product-id]

# 5. Done! ✅
```

---

## 📝 Detailed File Changes

### **Phase 1 Files:**

1. `shop/app/shop/[id]/page.tsx`
   - Update layout to match Taobao
   - Improve variant selector display
   - Add any missing UI elements

2. `shop/components/multi-variant-selector.tsx`
   - Style as Taobao grid
   - Improve mobile layout
   - Add hover effects

3. `shop/lib/knack-products.ts`
   - Ensure all variant data is fetched
   - Add new fields if needed

### **Phase 2 Files:**

1. `shop/lib/knack-config.ts` (Lines 94-148)
   ```typescript
   products: {
     // ... existing fields ...
     sellerName: 'field_XXX',      // NEW
     productRating: 'field_XXX',    // NEW
     reviewCount: 'field_XXX',      // NEW
   },
   variants: {
     // ... existing fields ...
     taobaoVariantId: 'field_XXX',  // NEW
     variantImageUrl: 'field_XXX',  // NEW
   }
   ```

2. `scraper/knack_integration.py` (Lines 26-63)
   ```python
   PRODUCT_FIELDS = {
       # ... existing fields ...
       'sellerName': 'field_XXX',     # NEW
       'productRating': 'field_XXX',  # NEW
       'reviewCount': 'field_XXX',    # NEW
   }
   
   VARIANT_FIELDS = {
       # ... existing fields ...
       'taobaoVariantId': 'field_XXX',  # NEW
       'variantImageUrl': 'field_XXX',  # NEW
   }
   ```

3. `KNACK_DATABASE_SCHEMA.md`
   - Document all new fields
   - Update data flow diagrams

### **Phase 3 Files:**

1. `scraper/ai_scraper.py`
   - Update `ScrapedProduct` dataclass (lines 884-894)
   - Update `ScrapedVariant` dataclass (lines 864-881)
   - Add extraction logic for new fields
   - Update `_push_to_knack()` method (lines 1796-1882)

2. `scraper/knack_integration.py`
   - Update `find_product()` (lines 171-219)
   - Update field mappings throughout

3. `scraper/sync_media.py`
   - Ensure compatibility with new naming
   - Add auto-run option

---

## 🎯 Immediate Next Steps

### **To Start Phase 1:**

1. **Open a sample Taobao product** in your browser
   - Pick one from `taobao_links.txt`
   - Example: https://item.taobao.com/item.htm?id=969220337986

2. **Compare with your shop's product page**
   ```bash
   cd shop
   npm run dev
   # Visit: http://localhost:3000/shop/[existing-product-id]
   ```

3. **Document differences:**
   - Screenshot both pages
   - List specific UI elements that need changes
   - Note styling differences

4. **Make incremental changes:**
   - Start with layout
   - Then variant selector
   - Then details/styling

---

## 🚀 Success Criteria

### **Phase 1 Complete When:**
- [ ] Shop looks and feels like Taobao product pages
- [ ] Multi-dimensional variants work seamlessly
- [ ] All hero images display correctly
- [ ] Mobile and desktop layouts are optimized

### **Phase 2 Complete When:**
- [ ] All necessary Knack fields exist
- [ ] Field mappings are updated in code
- [ ] Schema is documented in `KNACK_DATABASE_SCHEMA.md`

### **Phase 3 Complete When:**
- [ ] Scraper extracts all new fields
- [ ] `--push-knack` uploads everything correctly
- [ ] Images sync automatically
- [ ] Products display immediately in shop

---

## 📞 Questions Before Starting

1. **Phase 1 (Shop):**
   - Do you have specific Taobao design requirements?
   - Should we match Taobao exactly or use as inspiration?
   - Any functionality from Taobao you want to add?

2. **Phase 2 (Database):**
   - What Taobao data do you want to store?
   - Seller info, ratings, reviews?
   - Shipping estimates, delivery times?
   - Product specifications/attributes?

3. **Phase 3 (Scraper):**
   - Should scraper auto-upload or manual trigger?
   - Image sync automatic or manual?
   - Need dry-run mode for testing?

---

**Ready to start Phase 1!** Let me know which Taobao elements are most important to you.
