# 🎯 Your Action Plan - Image Binding Setup

## What's Done ✅

**Code Implementation (Complete)**:
- ✅ Backend scraper updated with image binding logic
- ✅ Frontend config updated with field mappings
- ✅ Data structure includes `image_ids` field
- ✅ Knack push includes JSON serialization
- ✅ Documentation created (5 guides)

**You don't need to write any code!**

---

## What You Need to Do ⚠️

### Action 1: Create Knack Field (5 minutes)

**Steps**:
1. Open browser → https://builder.knack.com/
2. Log into your Airsoft application
3. Click **Data** in left sidebar
4. Find **Variants** (should say "object_7")
5. Click **Add Field** button
6. Fill in:
   ```
   Field Name: Image IDs JSON
   Field Type: Paragraph Text
   Description: JSON array of image IDs bound to this variant
   ```
7. Click **Save**
8. **Important**: Verify the field ID shows as `field_174`
   - Hover over the field name to see the ID
   - If it's different, note the actual ID

**If Field ID is NOT field_174**:
You'll need to update 2 files:
```bash
# Update these lines with the actual field ID:
scraper/knack_integration.py:63
shop/lib/knack-config.ts:147
```

---

### Action 2: Test Without Knack (2 minutes)

**Purpose**: Verify the code works before pushing to database.

```bash
cd scraper
python3 ai_scraper.py --test
```

**What to look for**:
```
📸 Capturing images...
   → Main: 3 captured
   → Gallery: 15 captured  
   → Details: 25 captured
🖼️  Binding images to variants...
   → Generic images: 43 (shown for all variants)
   → Assigned 43 images to 12 variants
   → Image IDs: img_001, img_002, img_003, img_004, img_005...
✅ Done! 1 products scraped
```

**Success = "Binding images to variants" appears**

---

### Action 3: Verify JSON Output (1 minute)

```bash
cd scraper
cat ai_scraper_output/products.json | jq '.products[0].variants[0].image_ids'
```

**Expected**:
```json
[
  "img_001",
  "img_002",
  "img_003",
  "img_004",
  ...
]
```

**Success = Array of image IDs appears**

---

### Action 4: Test With Knack Push (2 minutes)

**Only after creating field_174!**

```bash
cd scraper
python3 ai_scraper.py --test --push-knack
```

**What to look for**:
```
📤 Pushing to Knack...
   → Found existing product: rec_xyz123
   → Created: Black / S @ $72.99
   → Created: Black / M @ $74.99
   ...
```

**Success = No errors, variants created/updated**

---

### Action 5: Verify Knack Database (1 minute)

1. Go back to Knack Builder
2. Click **Data** → **Variants**
3. Click on any variant to open it
4. Look for **Image IDs JSON** field
5. Should see: `["img_001","img_002","img_003",...]`

**Success = JSON array visible in field**

---

## Troubleshooting

### Problem: "field_174 doesn't exist" error

**Solution**: You skipped Action 1. Go create the field now.

### Problem: "image_ids is empty in JSON"

**Check**: 
```bash
# Did scraper capture images?
cat ai_scraper_output/products.json | jq '.products[0].images'
```
If empty, the product page didn't load properly (try another URL).

### Problem: "JSON serialization error"

**Check**: Did you create the field as "Paragraph Text"?
- ✅ Correct: Paragraph Text
- ❌ Wrong: Short Text, Number, etc.

### Problem: Field ID is field_175, not field_174

**Solution**: Update these 2 files:
```python
# scraper/knack_integration.py line 63:
'imageIdsJson': 'field_175',  # Change from field_174
```

```typescript
// shop/lib/knack-config.ts line 147:
imageIdsJson: 'field_175',  // Change from field_174
```

---

## Summary

**Time Required**: ~10 minutes total

| Action | Time | Status |
|--------|------|--------|
| Create Knack field | 5 min | ⏳ You do this |
| Test scraper (no Knack) | 2 min | ⏳ You do this |
| Verify JSON output | 1 min | ⏳ You do this |
| Test with Knack push | 2 min | ⏳ You do this |
| Verify database | 1 min | ⏳ You do this |
| **TOTAL** | **11 min** | |

---

## When You're Done

You'll have:
- ✅ Knack field created and configured
- ✅ Scraper binding images to variants
- ✅ Database storing image bindings as JSON
- ✅ Frontend ready to read image data
- 🎉 Image filtering system operational!

---

## Next Steps (After Setup)

1. **Frontend Gallery Filtering** (Future Feature):
   - Update product detail page
   - Read `imageIdsJson` from API
   - Filter gallery by selected variant
   - User selects "Black" → Show only Black images

2. **Smart Color Detection** (Phase 2):
   - Use AI Vision to detect colors in images
   - Bind color-specific images to matching variants
   - Black jacket image → Black variants only
   - Olive jacket image → Olive variants only

3. **Image Role Tagging** (Enhancement):
   - Mark images as "hero", "detail", "size_chart"
   - Frontend can treat different image types specially
   - Hero always shown, details in expandable section

---

**Ready? Start with Action 1!** 🚀
