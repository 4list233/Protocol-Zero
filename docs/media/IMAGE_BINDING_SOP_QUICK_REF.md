# 🖼️ Image Binding SOP - Quick Reference Card

**Field ID**: `field_176` (Image IDs JSON)  
**Status**: ✅ Configured and operational

---

## 🚀 Standard Workflow

### 1. Add Product URLs
```bash
# Edit file:
scraper/taobao_links.txt

# Add one URL per line
```

### 2. Run Scraper (Test)
```bash
cd scraper
python3 ai_scraper.py --test
```
**Look for**: "🖼️ Binding images to variants..."

### 3. Verify Output
```bash
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids'
```
**Expected**: `["img_001", "img_002", ...]`

### 4. Push to Knack
```bash
python3 ai_scraper.py --test --push-knack
```
**Look for**: "📤 Pushing to Knack..." with no errors

### 5. Verify Database
```
Knack Builder → Variants → Check field_176
```
**Expected**: JSON array in "Image IDs JSON" field

---

## ✅ Success Checklist

**Scraping Phase**:
- [ ] "Binding images to variants" appears
- [ ] Image counts > 0 (Main, Gallery, Details)
- [ ] All variants have image_ids in JSON

**Database Phase**:
- [ ] No "field not found" errors
- [ ] field_176 populated with JSON arrays
- [ ] All variants have data

**Frontend Phase**:
- [ ] API returns imageIdsJson
- [ ] JSON parses correctly
- [ ] Data matches scraper output

---

## 🚨 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "field_176 not found" | Check Knack Builder - verify field exists |
| Empty image_ids | Check scraper captured images (look for 📸) |
| JSON error | Verify field type is "Paragraph Text" |
| Frontend null data | Restart dev server, check config has field_176 |

---

## 📊 What Gets Created

**Per Product**:
- 20-50 images captured (hero + gallery + details)
- Image IDs generated: img_001, img_002, img_003...
- Each variant gets full image array (MVP)

**Example Output**:
```json
{
  "variant_name_en": "Black / S",
  "image_ids": ["img_001", "img_002", ..., "img_043"],
  "price_cad": 72.99
}
```

**In Knack (field_176)**:
```
["img_001","img_002","img_003","img_004",...]
```

---

## 🔍 Verification Commands

```bash
# Test scraper
python3 ai_scraper.py --test

# Check JSON has image_ids
jq '.products[0].variants[0].image_ids' ai_scraper_output/products.json

# Count variants with images
jq '.products[0].variants[] | select(.image_ids | length > 0)' ai_scraper_output/products.json | wc -l

# Test API
curl http://localhost:3000/api/products | jq '.products[0].variants[0].imageIdsJson'
```

---

## 📚 Full Documentation

- **Complete SOP**: `IMAGE_BINDING_SOP.md`
- **Implementation**: `IMAGE_BINDING_IMPLEMENTATION_SUMMARY.md`
- **Testing**: `IMAGE_BINDING_TEST_PLAN.md`
- **Action Plan**: `YOUR_ACTION_PLAN.md`

---

## 🎯 Performance Targets

- ⏱️ 2-3 minutes per product
- 🖼️ 20-50 images per product
- 📦 5-20 variants per product
- ✅ 100% binding success rate

---

**Ready to run?** Start with Step 1! 🚀
