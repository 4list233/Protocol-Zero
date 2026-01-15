# 🖼️ Image Binding Quick Start

## TL;DR

**Goal**: Link product images to variants so frontend can filter gallery by selected color/style.

**What I Did** (✅ Complete):
- Added `image_ids` field to scraper data structure
- Implemented image binding logic (all images → all variants for MVP)
- Updated Knack field mappings in backend + frontend
- Pushed image IDs as JSON to Knack database

**What YOU Do** (⚠️ Required):
1. Create `field_174` in Knack Builder (5 minutes)
2. Test scraper (1 minute)
3. Done!

---

## 🎯 Your Action Items

### Step 1: Create Knack Field (5 min)

```
1. Go to Knack Builder
2. Data → Variants (object_7)
3. Add Field:
   - Name: "Image IDs JSON"
   - Type: Paragraph Text
4. Verify field ID = field_174
5. Save
```

### Step 2: Test Scraper (1 min)

```bash
cd scraper
python3 ai_scraper.py --test --push-knack
```

**Look for:**
```
🖼️  Binding images to variants...
   → Generic images: 15 (shown for all variants)
   → Assigned 15 images to 12 variants
   → Image IDs: img_001, img_002, img_003...
```

### Step 3: Verify Output

```bash
# Check JSON output
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids'

# Should see:
# ["img_001", "img_002", "img_003", ...]
```

---

## 📊 What Changed

### Code Files Updated:
- ✅ `scraper/knack_integration.py` → Added `imageIdsJson: 'field_174'`
- ✅ `scraper/ai_scraper.py` → Added `image_ids` field + binding logic
- ✅ `shop/lib/knack-config.ts` → Added `imageIdsJson: 'field_174'`

### Data Flow:
```
Scraper
  ↓ Assigns image IDs to each variant
  ↓ ["img_001", "img_002", ...]
  ↓
Knack (field_174)
  ↓ Stores JSON array
  ↓
Frontend API
  ↓ Returns imageIdsJson
  ↓
Product Page
  ↓ Filters gallery by selected variant
```

---

## 🧪 Testing Checklist

- [ ] Created `field_174` in Knack Builder
- [ ] Ran `python3 ai_scraper.py --test --push-knack`
- [ ] Saw "Binding images to variants" in output
- [ ] Checked `products.json` has `image_ids` arrays
- [ ] Verified Knack has JSON data in `field_174`
- [ ] Frontend API returns `imageIdsJson` for variants

---

## 🚨 Troubleshooting

**"field_174 doesn't exist"**
→ Go create it in Knack Builder (Step 1 above)

**"image_ids is empty"**
→ Check that scraper captured images (look for "📸 Capturing images..." in output)

**"JSON serialization error"**
→ Make sure you created the field as "Paragraph Text" not "Short Text"

---

## 📚 More Info

- Full implementation details: `IMAGE_BINDING_IMPLEMENTATION_SUMMARY.md`
- Complete workflow: `SCRAPER_AND_DATABASE_REQUIREMENTS.md`
- Knack schema: `KNACK_DATABASE_SCHEMA.md`

---

**Ready?** Create that field and test! 🚀
