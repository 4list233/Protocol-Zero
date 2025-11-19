# Taobao Scraper Output Requirements for Protocol Zero Shop

## 📋 Overview
This guide specifies the exact output format your Taobao scraper should produce for seamless integration with the Protocol Zero shop import system.

---

## ✅ Current Status
Your scraper is **already 90% correct**! The following improvements are needed:
1. **Populate price fields** with actual scraped values (currently showing 0.0)
2. **Translate variant names** (Option Name) to English using LLM
3. **Scrape variant-specific prices** if they differ by colour/option

---

## 📁 Folder Structure (PERFECT - No Changes Needed)

```
media/
  product_1_mollepda/
    Main/
      Main.jpg          ← Primary product image (used in shop grid)
    Details/
      Detail_01.jpg     ← Additional images (horizontal gallery on detail page)
      Detail_02.jpg
      Detail_03.jpg
      ... (as many as available)
  product_2_m67/
    Main/
      Main.jpg
    Details/
      Detail_01.jpg
      Detail_02.jpg
      ...
```

### ✅ Folder Naming Rules (Already Correct)
- Pattern: `product_N_shortname`
- `N` = Unique number for each product
- `shortname` = Abbreviated descriptive name (helps matching)
- Examples: `product_1_mollepda`, `product_2_m67`, `product_3_tacticalvest`

**Why this works:**
- The import script extracts product ID from URLs (e.g., `713575933395`)
- Falls back to title slug matching using your descriptive suffix
- Your current naming is optimal - **keep it exactly as-is**

---

## 📊 CSV Structure

### Required Columns (All Present - Good!)

| Column Name | Purpose | Example | Status |
|-------------|---------|---------|--------|
| `URL` | Product page link with ID | `https://item.taobao.com/item.htm?id=713575933395` | ✅ Correct |
| `Product Title` | Original Chinese title | `战术背心通用型MOLLE系统...` | ✅ Keep for reference |
| `Translated Title` | **English product name (LLM-translated)** | `Tactical Vest Universal MOLLE System Phone Navigation Panel Bag` | ⚠️ **Use ChatGPT/DeepSeek/LLM** |
| `Option Name` | **English variant/colour name (LLM-translated)** | `MC Camouflage` (NOT `【考度拉】MC迷彩 CP迷彩`) | ⚠️ **Use ChatGPT/DeepSeek/LLM** |
| `Price CAD` | Product price in CAD | `68.50` | ⚠️ **FIX: Scrape from page** |
| `Final CAD` | Total with shipping | `83.50` | ⚠️ **FIX: Calculate or scrape** |
| `Shipping CAD` | Shipping cost | `15.0` | ✅ Correct |
| `Price CNY` | Original Taobao price | `339.00` | ⚠️ **FIX: Scrape from page** |
| `Media Folder` | Links to folder name | `product_1_mollepda` | ✅ Correct |
| `Main Images` | Count of main images | `1` | ✅ Correct |
| `Detail Images` | Count of detail images | `24` | ✅ Correct |

### ⚠️ CRITICAL FIXES NEEDED

#### 1. Translation - Use LLM (ChatGPT/DeepSeek), NOT Google Translate

**Why LLM over Google Translate/APIs:**
- Better context understanding for tactical/military gear terminology
- More natural English phrasing
- Handles Chinese brand names and slang better
- Can clean up formatting (remove brackets, decorative symbols)

**What to Translate:**

**A) Product Titles (`Translated Title` column):**
```
❌ BAD (Machine translation):
"战术背心通用型MOLLE系统手机导航面板包胸口PDA包户外多功能胸包"
→ "Tactical vest universal type MOLLE system mobile phone navigation panel bag chest mouth PDA bag outdoor multi-function chest bag"

✅ GOOD (LLM translation):
"战术背心通用型MOLLE系统手机导航面板包胸口PDA包户外多功能胸包"
→ "Tactical Vest Universal MOLLE System Phone Navigation Panel Chest Bag"
```

**B) Variant Names (`Option Name` column):**
```
❌ BAD (Untranslated):
"【考度拉】MC迷彩 CP迷彩"       → Keep Chinese characters
"【考度拉】黑色 BK"             → Keep Chinese characters

✅ GOOD (LLM translated):
"【考度拉】MC迷彩 CP迷彩"       → "MC Camouflage / CP Camouflage"
"【考度拉】黑色 BK"             → "Black"
"【考度拉】狼灰色WG"            → "Wolf Grey"
"【考度拉】游骑兵绿色RG"        → "Ranger Green"
"【考度拉】狼棕色CB"            → "Coyote Brown"
"【考度拉】暗夜迷彩 BCP"        → "Black Camouflage Pattern"
```

**LLM Translation Prompt Template:**
```
Translate the following Taobao product information to English:

Product Title: [Chinese title]
Variant Options: [Chinese option 1], [Chinese option 2], [Chinese option 3]

Requirements:
- Use proper tactical/military gear terminology
- Remove decorative brackets and symbols
- Keep colour codes (MC, BK, RG, CB, etc.) in the translation
- Make it concise and natural English
- For variants, just give the colour/option name (e.g., "Black" not "【Brand】Black")
```

**Recommended LLM Services:**
1. **ChatGPT API** (GPT-4 or GPT-3.5-turbo)
2. **DeepSeek API** (Good for Chinese → English)
3. **Claude API** (Anthropic)
4. **Local LLM** (Llama 3, Mistral) if you want offline processing

**Implementation:**
- Batch translate all titles and variants in one API call to save costs
- Cache translations to avoid re-translating same products
- Use temperature=0.3 for more consistent translations


#### 2. Price Scraping - Get Real Values from Taobao

**Current Problem:**
```csv
Price,Price CNY,Price CAD,Shipping CAD,Final CAD
¥0.00,0.0,0.0,15.0,15.0   ← All prices are zero!
```

**Required Fix:**
```csv
Price,Price CNY,Price CAD,Shipping CAD,Final CAD
¥339.00,339.0,68.50,15.0,83.50   ← Scrape actual prices
```

**Scraping Rules:**

**A) Base Product Price:**
- Scrape the price displayed on the product page
- This might be the starting price or default variant price
- Store in `Price CNY` (Chinese Yuan)
- Convert to CAD using exchange rate (typically ~0.19-0.20 CNY to CAD)
- Store converted price in `Price CAD`

**B) Variant-Specific Prices:**
Many Taobao products have **different prices for different variants** (colours, sizes, etc.):

```
Example: Tactical Vest
- Black variant: ¥339.00
- MC Camo variant: ¥359.00  ← Different price!
- Premium version: ¥419.00  ← Different price!
```

**How to handle variant prices:**

1. **If all variants have the SAME price:**
   ```csv
   URL,Option Name,Price CNY,Price CAD,Shipping CAD,Final CAD
   https://item.taobao.com/item.htm?id=123,Black,339.0,68.50,15.0,83.50
   https://item.taobao.com/item.htm?id=123,MC Camo,339.0,68.50,15.0,83.50
   https://item.taobao.com/item.htm?id=123,Wolf Grey,339.0,68.50,15.0,83.50
   ```

2. **If variants have DIFFERENT prices:**
   ```csv
   URL,Option Name,Price CNY,Price CAD,Shipping CAD,Final CAD
   https://item.taobao.com/item.htm?id=123,Black,339.0,68.50,15.0,83.50
   https://item.taobao.com/item.htm?id=123,MC Camo,359.0,72.52,15.0,87.52
   https://item.taobao.com/item.htm?id=123,Premium Black,419.0,84.64,15.0,99.64
   ```
   
   **Calculation for MC Camo variant:**
   - Scraped: ¥359.00
   - Converted: 359 × 0.202 = $72.52 CAD
   - Shipping: $15.00 (flat rate)
   - Final: $72.52 + $15.00 = $87.52 CAD

**Where to find variant prices on Taobao:**
- Look for the "SKU" or option selector dropdown
- When you click different colour/size options, the price updates
- Some products show a price range (e.g., "¥339.00 - ¥419.00")
- Scrape the **specific price for each selected variant**

**Price Scraping Implementation Tips:**
```javascript
// Pseudocode for variant price scraping:
const EXCHANGE_RATE = 0.202; // CNY to CAD (includes fees)
const FLAT_SHIPPING_CAD = 15.0;

for each variant in product.variants:
  - Select the variant option (click/select dropdown)
  - Wait for price element to update
  - Scrape the updated price in CNY (e.g., ¥339.00)
  - Store: variant_name → price_cny
  - Convert: price_cad = price_cny * EXCHANGE_RATE
  - Calculate: final_cad = price_cad + FLAT_SHIPPING_CAD
  - Round to 2 decimals
```

**C) Shipping Cost:**
- **Always use flat rate: `Shipping CAD = 15.0`** for every item
- This covers shipping from China to Canada
- Apply to all products uniformly

**D) Final Total:**
- **Formula: `Final CAD = Price CAD + 15.0`**
- This is what the customer will actually pay
- Example: Product at $68.50 → Final price $83.50


#### 3. Exchange Rate & Price Calculation

**Complete Price Calculation Process:**

**Step 1: Scrape CNY Price from Taobao**
```
Example: ¥339.00 (Chinese Yuan)
```

**Step 2: Convert CNY → CAD**
```
Exchange Rate: 0.202 (includes small markup for fees)
Price CAD = 339 × 0.202 = $68.50 CAD
```

**Step 3: Add Flat Shipping**
```
Shipping CAD = $15.00 (flat rate for all items)
Final CAD = $68.50 + $15.00 = $83.50 CAD
```

**CNY to CAD Exchange Rate Guidelines:**
- Base rate: ~0.19-0.20 (as of 2025)
- **Recommended rate: 0.202** (includes small markup for payment processing fees)
- Update quarterly or when exchange rate fluctuates significantly
- Keep consistent across all products for simplicity

**Complete Example:**
```
Taobao shows: ¥339.00
↓
Price CNY: 339.0
Price CAD: 339 × 0.202 = $68.50
Shipping CAD: $15.00 (flat rate)
Final CAD: $68.50 + $15.00 = $83.50
```

**Rules:**
1. **Price CNY** = Scraped from Taobao product page (original price)
2. **Price CAD** = Price CNY × 0.202 (converted to Canadian dollars)
3. **Shipping CAD** = Always $15.00 (flat rate for all products)
4. **Final CAD** = Price CAD + $15.00 (total customer pays)
5. For products with multiple variants:
   - **If prices differ:** Each variant row gets its own Price CNY, Price CAD, and Final CAD
   - **If prices are same:** All variant rows get the same price
5. If exact CAD conversion is unknown, use an approximate exchange rate (~0.19 CNY to CAD)

**Example** (MOLLE PDA bag with 6 colour variants - **WITH VARIANT PRICES**):
```csv
URL,Translated Title,Option Name,Price CNY,Price CAD,Shipping CAD,Final CAD,Media Folder
https://item.taobao.com/item.htm?id=713575933395,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,MC Camouflage,339.0,68.50,15.0,83.50,product_1_mollepda
https://item.taobao.com/item.htm?id=713575933395,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,Black,339.0,68.50,15.0,83.50,product_1_mollepda
https://item.taobao.com/item.htm?id=713575933395,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,Wolf Grey,349.0,70.50,15.0,85.50,product_1_mollepda
https://item.taobao.com/item.htm?id=713575933395,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,Ranger Green,339.0,68.50,15.0,83.50,product_1_mollepda
https://item.taobao.com/item.htm?id=713575933395,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,Coyote Brown,339.0,68.50,15.0,83.50,product_1_mollepda
https://item.taobao.com/item.htm?id=713575933395,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,Black Camouflage Pattern,359.0,72.50,15.0,87.50,product_1_mollepda
```

**Note:** 
- ✅ All option names translated to English (MC Camouflage, not MC迷彩)
- ✅ Variant prices can differ (Wolf Grey = 349 CNY, Black Camo = 359 CNY)
- ✅ Title cleaned up and concise (LLM-translated)

---

## 🎨 Variant Handling (PERFECT - No Changes Needed)

### Current Approach ✅
- **One CSV row per variant** (e.g., one row per colour option)
- Multiple rows share the same URL (grouped into single product)
- `Option Name` column contains the variant identifier

### What the Import Script Does Automatically:
1. Groups all rows with the same URL into one product
2. Extracts unique values from `Option Name` column
3. Creates `options: [{name: "Colour", values: ["MC Camo", "Black", ...]}]`
4. Displays colour selector on product detail page
5. Shows "Multiple colour options available" badge on shop cards

**Keep your current approach** - it's working perfectly!

---

## 🔗 URL Format (PERFECT - No Changes Needed)

### Required Format ✅
```
https://item.taobao.com/item.htm?id=713575933395
```
or
```
https://detail.tmall.com/item.htm?id=823946437927&...
```

**Key requirement:** URL must contain `id=XXXXXXXXXXXXX` parameter

**The import script will:**
- Extract the numeric ID (`713575933395`)
- Use it for product identification
- Generate SEO-friendly slugs (`tactical-vest-universal-molle-system-mob`)
- Match to your media folders

**Your current URLs are perfect - no changes needed!**

---

## 🖼️ Image Requirements

### File Naming ✅ (Already Correct)
- **Main image:** `Main.jpg` (exactly this name)
- **Detail images:** `Detail_01.jpg`, `Detail_02.jpg`, `Detail_03.jpg`, etc.

### File Locations ✅ (Already Correct)
- Main image must be in `Main/` subfolder
- Detail images must be in `Details/` subfolder

### Image Quality Recommendations
- **Format:** JPG or PNG (JPG preferred for file size)
- **Main image resolution:** 800x800px minimum (for shop grid)
- **Detail image resolution:** 1200x1200px or higher (for detail gallery)
- **File size:** Keep under 500KB per image when possible

### How Images Are Used:
- `Main/Main.jpg` → **Primary product card** (shop grid thumbnail)
- `Details/Detail_XX.jpg` → **Horizontal scrolling gallery** (product detail page)

**Your current image structure is perfect - no changes needed!**

---

## 📝 Complete Example

### CSV Rows (for one product with 3 colour variants **WITH LLM TRANSLATIONS & VARIANT PRICES**):
```csv
URL,Product Title,Translated Title,Option Name,Price,Price CNY,Price CAD,Shipping CAD,Final CAD,Media Folder,Main Images,Detail Images,Catalogue Images
https://item.taobao.com/item.htm?id=713575933395,战术背心通用型MOLLE系统手机导航面板包胸口PDA包户外多功能胸包,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,MC Camouflage,¥339.00,339.0,68.50,15.0,83.50,product_1_mollepda,1,24,0
https://item.taobao.com/item.htm?id=713575933395,战术背心通用型MOLLE系统手机导航面板包胸口PDA包户外多功能胸包,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,Black,¥339.00,339.0,68.50,15.0,83.50,product_1_mollepda,1,24,0
https://item.taobao.com/item.htm?id=713575933395,战术背心通用型MOLLE系统手机导航面板包胸口PDA包户外多功能胸包,Tactical Vest Universal MOLLE System Phone Navigation Panel Bag,Wolf Grey,¥349.00,349.0,70.50,15.0,85.50,product_1_mollepda,1,24,0
```

**Key Changes from Current Output:**
- ✅ `Translated Title`: LLM-translated, cleaned up (not machine translation)
- ✅ `Option Name`: English only - "MC Camouflage", "Black", "Wolf Grey" (not `【考度拉】MC迷彩 CP迷彩`)
- ✅ `Price CNY`: Scraped actual price (339.00, 349.00) - not 0.0
- ✅ `Price CAD`: Converted to CAD (68.50, 70.50) - not 0.0
- ✅ Wolf Grey variant has different price (¥349 vs ¥339)

### Corresponding Folder Structure:
```
media/
  product_1_mollepda/
    Main/
      Main.jpg
    Details/
      Detail_01.jpg
      Detail_02.jpg
      ... (24 total detail images)
```

### Import Result:
```typescript
{
  id: "tactical-vest-universal-molle-system-mob",
  sku: "PZ-713575933395",
  title: "Tactical Vest Universal MOLLE System Phone Navigation Panel Bag",  // ← LLM-translated
  price_cad: 68.50,  // ← Base price (lowest variant)
  primaryImage: "/images/tactical-vest-universal-molle-system-mob-Main.jpg",
  images: [
    "/images/tactical-vest-universal-molle-system-mob-Detail_01.jpg",
    "/images/tactical-vest-universal-molle-system-mob-Detail_02.jpg",
    // ... all 24 detail images
  ],
  url: "https://item.taobao.com/item.htm?id=713575933395",
  category: "Tactical Gear",
  description: "",
  options: [
    {
      name: "Colour",
      values: ["MC Camouflage", "Black", "Wolf Grey"]  // ← LLM-translated variant names
    }
  ]
}
```

**Note:** If variants have different prices, the shop currently shows the **base/lowest price**. Future enhancement could show price range (e.g., "$68.50 - $70.50").

---

## 🚀 Testing Your Scraper Output

### Step 1: Verify Folder Structure
```bash
ls -R "/path/to/media" | head -50
```

**Check for:**
- ✅ Each product has its own `product_N_name/` folder
- ✅ Each product folder contains `Main/` and `Details/` subfolders
- ✅ `Main/` contains `Main.jpg`
- ✅ `Details/` contains `Detail_01.jpg`, `Detail_02.jpg`, etc.

### Step 2: Verify CSV Content
```bash
head -n 5 protocol_zero_variants.csv
```

**Check for:**
- ✅ Header row with all required columns
- ✅ URLs contain `id=XXXXX` parameter
- ✅ `Translated Title` is in English
- ✅ `Price CAD` has actual prices (not 0.0)
- ✅ `Media Folder` matches actual folder names
- ✅ Multiple rows for products with colour variants

### Step 3: Run Import Script
```bash
cd /Users/5425855/Documents/protocol-zero-shop
npx tsx scripts/import-products-from-csv.ts \
  "/Users/5425855/Documents/Protocol Z Scraper/protocol_zero_variants.csv" \
  "/Users/5425855/Documents/Protocol Z Scraper/media"
```

**Expected output:**
```
✅ Wrote 9 products to lib/products.generated.ts
```

### Step 4: Verify Generated Products
```bash
cat lib/products.generated.ts | head -100
```

**Check for:**
- ✅ All products have `price_cad` > 0 (not 0.0)
- ✅ `primaryImage` points to `/images/[product-id]-Main.jpg`
- ✅ `images` array contains all detail images
- ✅ Products with variants have `options` array with **English** colour values
- ✅ Titles are clean, LLM-translated English (not machine translation)

---

## 🎯 Quick Checklist

Before running your scraper, ensure it will:

- [ ] Create `product_N_name/` folders with unique numbers
- [ ] Put main product image in `Main/Main.jpg`
- [ ] Put additional images in `Details/Detail_01.jpg`, `Detail_02.jpg`, etc.
- [ ] **Use LLM (ChatGPT/DeepSeek) for translations** - NOT Google Translate
- [ ] **Translate product titles** to clean, concise English
- [ ] **Translate variant names** (Option Name) to English - remove Chinese characters and brackets
- [ ] **Scrape actual prices from Taobao** (not 0.0)
- [ ] **Scrape variant-specific prices** if they differ by colour/option
- [ ] **Convert CNY to CAD** using current exchange rate (~0.19-0.20)
- [ ] Calculate `Final CAD = Price CAD + Shipping CAD`
- [ ] Use same URL for all colour variants of a product
- [ ] Ensure URLs contain `id=XXXXX` parameter
- [ ] Match `Media Folder` value to actual folder name

---

## 🆘 Troubleshooting

### Problem: Products not importing
**Solution:** Check that URLs contain `id=` parameter with numeric product ID

### Problem: Images not appearing
**Solution:** Verify folder names in CSV match actual media folder names exactly

### Problem: Price showing as $0.00 in shop
**Solution:** Scrape actual prices from Taobao page and populate `Price CNY` + `Price CAD` columns (not 0.0)

### Problem: Variant prices all the same but shouldn't be
**Solution:** Scrape each variant's price individually by selecting each option and capturing the updated price

### Problem: Colour options showing Chinese characters
**Solution:** Use LLM (ChatGPT/DeepSeek) to translate `Option Name` to English - remove brackets and decorative symbols

### Problem: Product titles too long or awkward English
**Solution:** Use LLM translation with prompt asking for "concise tactical gear terminology" instead of literal word-for-word translation

### Problem: Colour options not showing
**Solution:** Ensure multiple CSV rows with same URL but different `Option Name` values

### Problem: Wrong image as primary
**Solution:** Ensure main product image is named exactly `Main.jpg` in `Main/` subfolder

---

## 📞 Support

If you encounter issues after implementing these requirements:
1. Share the first 10 lines of your CSV
2. Share the folder structure output from `ls -R media/ | head -50`
3. Share any error messages from the import script
4. Check that LLM translations are being applied (not Chinese characters in output)
5. Verify prices are non-zero in the CSV

The import script has extensive auto-detection and should handle minor variations, but following these requirements ensures optimal results.

---

## 📋 Summary: Three Critical Improvements Needed

1. **🤖 LLM Translation (ChatGPT/DeepSeek preferred)**
   - Translate product titles to clean, concise English
   - Translate variant names (Option Name) to English - remove Chinese characters and brackets
   - Use LLM over Google Translate for better tactical gear terminology

2. **💰 Price Scraping**
   - Scrape actual prices from Taobao (populate `Price CNY` and `Price CAD` - not 0.0)
   - Scrape variant-specific prices if they differ by colour/option
   - Convert CNY to CAD using current exchange rate (~0.19-0.20)

3. **🎨 Variant Price Handling**
   - If variants have different prices, scrape each one individually
   - Store the specific price for each variant row in the CSV

**Everything else (folder structure, naming, image organization) is already perfect!** 🎉
