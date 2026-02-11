# Shopify vs Taobao CSV Format Comparison

This document shows the transformation from Taobao scraper output to Shopify import format.

## Input Format: protocol_zero_variants.csv

### Structure
One row per variant with Chinese and English product/variant names.

### Sample Data

```csv
URL,Product Title,Product Title ZH,Option Name,Option Name ZH,Variant URL,Price,Price CNY,Price CAD,Shipping CAD,Final CAD,Media Folder,Main Images,Detail Images,Catalogue Images
https://item.taobao.com/item.htm?id=123456,2011 Combat Master Holster,2011战术快拔枪套,Black - Medium,黑色 - 中号,https://item.taobao.com/item.htm?id=123456&sku=1,¥50.00,50,0,0,0,product_holster_001,3,5,0
https://item.taobao.com/item.htm?id=123456,2011 Combat Master Holster,2011战术快拔枪套,Black - Large,黑色 - 大号,https://item.taobao.com/item.htm?id=123456&sku=2,¥55.00,55,0,0,0,product_holster_001,3,5,0
https://item.taobao.com/item.htm?id=123456,2011 Combat Master Holster,2011战术快拔枪套,Tan - Medium,沙色 - 中号,https://item.taobao.com/item.htm?id=123456&sku=3,¥50.00,50,0,0,0,product_holster_001,3,5,0
```

### Key Columns

- **URL** - Taobao product page URL (groups variants)
- **Product Title** - English translated title
- **Product Title ZH** - Original Chinese title
- **Option Name** - Variant name (e.g., "Black - Medium")
- **Price CNY** - Base cost in Chinese Yuan
- **Media Folder** - Directory with product images

---

## Output Format: shopify_import.csv

### Structure
Shopify's multi-column format with product info on first variant row, subsequent rows have variant data only.

### Sample Data (Truncated for Readability)

```csv
Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Variant SKU,Variant Price,Cost per item,Image Src
2011-combat-master-holster-123456,2011 Combat Master Holster,"<div>Premium tactical holster...</div>",Protocol Zero,Airsoft Gear,"holster,tactical,black,tan",TRUE,Color,Black,Size,Medium,2011-COMBAT-BLA-MED,22.80,15.20,https://cdn.example.com/holster-black-m.jpg
2011-combat-master-holster-123456,,,,,,,Color,Black,Size,Large,2011-COMBAT-BLA-LAR,24.70,16.15,https://cdn.example.com/holster-black-l.jpg
2011-combat-master-holster-123456,,,,,,,Color,Tan,Size,Medium,2011-COMBAT-TAN-MED,22.80,15.20,https://cdn.example.com/holster-tan-m.jpg
```

### Key Columns

- **Handle** - URL-friendly product ID (same for all variants)
- **Title** - Product name (only on first row)
- **Body (HTML)** - Product description HTML (only on first row)
- **Option1 Name/Value** - First variant dimension (e.g., Color: Black)
- **Option2 Name/Value** - Second variant dimension (e.g., Size: Medium)
- **Variant SKU** - Unique SKU per variant
- **Variant Price** - Selling price with margin applied
- **Cost per item** - Your cost (for profit tracking)

---

## Transformation Logic

### 1. Product Grouping

**Taobao CSV:**
```
Row 1: URL=X, Product=A, Variant=Black-M
Row 2: URL=X, Product=A, Variant=Black-L
Row 3: URL=X, Product=A, Variant=Tan-M
```

**Shopify CSV:**
```
Row 1: Handle=A-X, Title=Product A, Option1=Black, Option2=M
Row 2: Handle=A-X, Title="", Option1=Black, Option2=L
Row 3: Handle=A-X, Title="", Option1=Tan, Option2=M
```

### 2. Price Calculation

```python
# Input: Price CNY = 50
cost_cny = 50
shipping_cny = 30
exchange_rate = 0.19
margin = 0.80  # 80%

# Calculate
total_cost_cny = 50 + 30 = 80
cost_cad = 80 * 0.19 = 15.20
selling_price = 15.20 * (1 + 0.80) = 27.36
final_price = round(27.36) - 0.01 = 26.99  # Psychological pricing

# Output
Variant Price = $26.99 CAD
Cost per item = $15.20 CAD
```

### 3. SKU Generation

```python
# Input
handle = "2011-combat-master-holster-123456"
option1_value = "Black"
option2_value = "Medium"

# Generate SKU
prefix = handle[:20].upper()  # "2011-COMBAT-MASTER-"
suffix1 = "Black"[:3].upper()  # "BLA"
suffix2 = "Medium"[:3].upper()  # "MED"

sku = f"{prefix}-{suffix1}-{suffix2}"
# Output: "2011-COMBAT-MASTER--BLA-MED"
```

### 4. Collection Assignment

Based on final selling price:

```python
if price <= 25:
    collection = "Budget ($0-$25)"
elif price <= 75:
    collection = "Mid-Range ($25-$75)"
else:
    collection = "Premium ($75+)"
```

### 5. Tag Extraction

```python
title = "2011 Combat Master Holster"
variants = ["Black - Medium", "Tan - Large"]

tags = []
# Extract from title
if "holster" in title.lower():
    tags.append("holster")
# Extract colors
if "Black" in variants:
    tags.append("black")
if "Tan" in variants:
    tags.append("tan")
# Add generic
tags.extend(["airsoft", "tactical gear"])

# Output: ["holster", "black", "tan", "airsoft", "tactical gear"]
```

---

## Field Mapping Reference

| Taobao CSV Column | Shopify CSV Column | Transformation |
|-------------------|-------------------|----------------|
| URL | Handle | Generate URL-friendly slug + product ID |
| Product Title | Title | Direct copy (first variant row only) |
| Product Title ZH | (not exported) | Stored in internal object |
| Option Name | Option1 Value | Split into Color/Size if multi-dimensional |
| Price CNY | Variant Price | Calculate with margin + exchange rate |
| Price CNY | Cost per item | Convert to CAD (cost only) |
| Media Folder | Image Src | Construct image URLs from folder path |
| In Stock | Status | 'active' if Yes, 'draft' if No |
| (generated) | Variant SKU | Generate from handle + option values |
| (generated) | Body (HTML) | Auto-generate product description |
| (generated) | Tags | Extract from title + variants |

---

## Pricing Examples

### Budget Tier Example (50% Margin)

```
Input:  Taobao Cost = ¥40 CNY
Calc:   Total Cost = (40 + 30) * 0.19 = $13.30 CAD
        Selling Price = 13.30 * 1.5 = $19.95 CAD
Output: Collection = Budget ($0-$25)
```

### Mid-Range Example (80% Margin)

```
Input:  Taobao Cost = ¥120 CNY
Calc:   Total Cost = (120 + 30) * 0.19 = $28.50 CAD
        Selling Price = 28.50 * 1.8 = $51.30 CAD
Output: Collection = Mid-Range ($25-$75)
```

### Premium Example (100% Margin)

```
Input:  Taobao Cost = ¥350 CNY
Calc:   Total Cost = (350 + 30) * 0.19 = $72.20 CAD
        Selling Price = 72.20 * 2.0 = $144.40 CAD
Output: Collection = Premium ($75+)
```

---

## Variant Option Splitting

Current implementation uses single dimension. For multi-dimensional variants:

### Option 1: Manual Split (Post-Import)

Upload with single dimension, then split in Shopify admin:

```
Taobao: "Black - Medium" → Shopify Option1: "Black - Medium"

Then in Shopify:
1. Edit product variants
2. Add "Color" and "Size" options
3. Re-map variants to Color=Black, Size=Medium
```

### Option 2: Pre-Process CSV

Update scraper to extract multiple dimensions:

```python
variant_name = "Black - Medium"
parts = variant_name.split(" - ")

if len(parts) >= 2:
    option1_name = "Color"
    option1_value = parts[0]  # "Black"
    option2_name = "Size"
    option2_value = parts[1]  # "Medium"
```

---

## Image URL Construction

If you have a CDN or image hosting:

```python
media_folder = "product_holster_001"
cdn_base = "https://cdn.yourstore.com/products/"

# Construct URLs
hero_image = f"{cdn_base}{media_folder}/hero.jpg"
variant_image = f"{cdn_base}{media_folder}/black-medium.jpg"
details_image = f"{cdn_base}{media_folder}/details.jpg"
```

Example output:
```
Image Src: https://cdn.yourstore.com/products/product_holster_001/hero.jpg
Image Position: 1
Image Alt Text: 2011 Combat Master Holster - Hero Image
```

---

## Complete Comparison

### Taobao Input (1 Product, 3 Variants)

```csv
URL,Product Title,Option Name,Price CNY
https://taobao.com/123,Combat Holster,Black-M,50
https://taobao.com/123,Combat Holster,Black-L,55
https://taobao.com/123,Combat Holster,Tan-M,50
```

### Shopify Output (Same Product, 3 Variants)

With 80% margin, 0.19 exchange rate:

```csv
Handle,Title,Option1 Value,Variant SKU,Variant Price,Cost per item
combat-holster-123,Combat Holster,Black-M,COMBAT-BLA-M,26.99,15.20
combat-holster-123,,Black-L,COMBAT-BLA-L,29.69,16.15
combat-holster-123,,Tan-M,COMBAT-TAN-M,26.99,15.20
```

---

## Summary

**Taobao Format:**
- One row per variant
- Chinese + English titles
- Raw CNY prices
- Simple structure

**Shopify Format:**
- Product info on first variant row
- Calculated CAD prices with margins
- Multi-dimensional variant options
- SEO and metadata fields
- Collection and tag assignments

**Transformation:**
- Groups variants by URL
- Applies pricing formulas
- Generates SKUs and handles
- Categorizes into collections
- Extracts relevant tags
