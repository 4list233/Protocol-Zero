# Quick Start Guide: Variant Restructuring Workflow

This guide shows you how to use the complete variant workflow from scraping to live products.

---

## Step 1: Scrape Taobao Products

**Run the scraper to capture ALL variants:**

```bash
cd scraper
python3 scraper.py
```

**What happens:**
- Scraper visits each Taobao URL
- Clicks ALL available options (colors, sizes, quantities)
- Captures every combination as a separate variant
- Exports to CSV: `protocol_zero_variants.csv`

**Output example:**
```csv
URL,Product Title,Option Name,Price CNY,Price CAD
https://...,Arm Sleeve,1x White,100,20.20
https://...,Arm Sleeve,1x White - XXS,100,20.20
https://...,Arm Sleeve,1x White - XS,100,20.20
https://...,Arm Sleeve,1x White - S,100,20.20
```

---

## Step 2: Classify Variants

**Run the classification script:**

```bash
python3 classify_variants.py protocol_zero_variants.csv classified_variants.json
```

**What happens:**
- Script reads all scraped variants
- Identifies base models (e.g., "1x White")
- Identifies option variants (e.g., "1x White - XXS")
- Creates archived variants with links to base variants
- Extracts option values from archived variants
- Populates active variants with comma-separated option lists (derived from archived variants)
- Outputs structured JSON for database import

**Output preview:**
```
Classification Summary:
  Products: 12
  Active Variants (Base Models): 24
  Archived Variants (Options): 96

✅ Classification complete!
```

---

## Step 3: Import to Knack

**Manual import (for now):**

1. Open `classified_variants.json`
2. **First:** Import `archived_variants` data
   - Import to Knack Variants table with `status` = "Archived"
   - Note the variant IDs created
3. **Second:** Import `active_variants` data
   - Set `status` = "Active"
   - Link to archived variants via `linkedArchivedVariants` field
   - Ensure `optionValue2` is populated (extracted from archived variants)
4. **Verify:** Each archived variant has `baseVariantId` pointing to its active variant

**What to verify:**
- Base model variants have `optionValue2` with comma-separated options
- `optionType2` says "Available Sizes" or similar
- All active variants have correct pricing

---

## Step 4: Verify Frontend

**Test product display:**

```bash
cd shop
npm run dev
```

**Navigate to:** `http://localhost:3000/shop/[product-id]`

**What to check:**
- ✅ Base model variants show as buttons (e.g., "1x White", "2x White")
- ✅ After selecting a base model, dropdown appears
- ✅ Dropdown contains all sizes from `optionValue2`
- ✅ Selecting a size updates the display
- ✅ "Add to Cart" includes both variant and size

---

## Step 5: Test Complete Flow

**End-to-end testing:**

1. **Product Page**
   - Select base variant: "1x White"
   - Select size from dropdown: "M"
   - Click "Add to Cart"

2. **Cart Page** (`/cart`)
   - Verify item shows:
     - Product: "Arm Sleeve"
     - Variant: "1x White"
     - Size/Option: "M" ← Should be visible
   - Verify price is correct

3. **Checkout** (`/checkout`)
   - Proceed to checkout
   - Verify order summary shows:
     - Product, Variant, Size
   - Complete checkout

4. **Verify Order in Knack**
   - Check order record
   - Verify it includes:
     - Product ID
     - Variant ID (base model)
     - Selected option: "Size: M"

---

## Troubleshooting

### Issue: Dropdown not appearing

**Check:**
- `optionType2` contains "Available" keyword
- `optionValue2` has comma-separated values
- Variant `status` is "Active"

**Fix:**
```json
{
  "optionType2": "Available Sizes",
  "optionValue2": "XXS,XS,S,M,L"
}
```

### Issue: Size not showing in cart

**Check:**
- `selectedOption` is being passed to `addItem()`
- Cart context includes `selectedOption` in CartItem
- Cart display includes conditional render for `selectedOption`

**Fix:** Verify in `/app/shop/[id]/page.tsx`:
```tsx
addItem({
  ...,
  selectedOption: selectedOption2 || undefined
})
```

### Issue: Wrong options in dropdown

**Check:**
- Classification script extracted correct options
- `optionValue2` in database matches expected values
- No typos or extra spaces in CSV list

**Fix:** Re-run classification script with updated patterns

---

## Advanced Usage

### Custom Size Patterns

Edit `classify_variants.py` to add your own size patterns:

```python
SIZE_PATTERNS = [
    r'\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b',
    r'\b\d+-\d+lb\b',
    r'\b\d+kg\b',
    r'\b(Small|Medium|Large)\b',  # Add custom patterns
]
```

### Manual Classification

For products that don't match patterns, manually edit the JSON:

```json
{
  "variantName": "Custom Model",
  "status": "Active",
  "optionType2": "Available Colors",
  "optionValue2": "Black,White,Red"
}
```

---

## Next Steps

1. **Automate Import:** Create script to push JSON directly to Knack API
2. **Admin Panel:** Add UI to edit `optionValue2` for base variants
3. **Validation:** Add checks to ensure option values match archived variants
4. **Bulk Operations:** Process multiple products at once with batch scripts

---

## Support

For issues or questions, refer to:
- **COMPLETE_VARIANT_WORKFLOW.md** - Full technical documentation
- **VARIANT_RESTRUCTURING_COMPLETE.md** - Implementation status
- **classify_variants.py** - Classification script source code
