# Variant Hero Image Fix

## Problem
Variant hero images were not being captured and saved, even though the scraper was taking screenshots for price extraction. This meant:
- All Shopify variants showed the same hero image
- No variant-specific image switching when selecting different colors/sizes in the shop

## Root Cause
The scraper was taking screenshots during variant detection (to extract prices via Vision API), but these screenshots were:
1. Saved to a temporary `price_screenshots/` folder for transient processing
2. Never moved to the final `variant_screenshots/` folder
3. Discarded after price extraction

## Solution
Modified `ai_scraper.py` to:

### 1. Create Both Folders
```python
# Create screenshots folders (for price extraction and variant hero images)
screenshots_folder = os.path.join(product_folder, 'price_screenshots')
os.makedirs(screenshots_folder, exist_ok=True)

variant_images_folder = os.path.join(product_folder, 'variant_screenshots')
os.makedirs(variant_images_folder, exist_ok=True)
```

### 2. Save Variant Screenshots as Hero Images
For **single-dimension variants** (colors only):
- When DOM price extraction succeeds: Save screenshot to `variant_screenshots/variant_001.png`
- When DOM price extraction fails: Use Vision API screenshot (already saved in `price_screenshots/`) then ALSO save to `variant_screenshots/`

For **multi-dimensional variants** (color × size):
- Same logic: Always save variant screenshot to `variant_screenshots/variant_001.png`, `variant_002.png`, etc.

### 3. Updated Function Signatures
```python
def _extract_single_dimension_variants(self, product: ScrapedProduct, dimension: Dict, 
                                       screenshots_folder: str, variant_images_folder: str):

def _extract_multi_dimension_variants(self, product: ScrapedProduct, dimensions: List[Dict], 
                                      screenshots_folder: str, variant_images_folder: str):
```

## Media Structure
```
ai_scraper_output/media/product_001/
├── Main/                           # Hero photos (product main image)
│   └── main_01.jpg
├── Catalogue/                      # Gallery images
│   ├── catalogue_01.jpg
│   └── catalogue_02.jpg
├── Details/                        # Stitched detail photos
│   └── details_01.jpg
├── price_screenshots/              # Temporary screenshots for Vision API
│   ├── variant_001.png
│   └── variant_002.png
└── variant_screenshots/            # ✅ NEW: Variant hero images (ONE PER VARIANT)
    ├── variant_001.png            # Shows when "Color: Red" is selected
    ├── variant_002.png            # Shows when "Color: Blue" is selected
    └── variant_003.png            # Shows when "Color: Green" is selected
```

## Shopify Integration
The `shopify_export.py` already knows to look for variant images in the correct location:
```python
# Looks for: media/{product}/variant_screenshots/variant_001.png
for ext in ['png', 'jpg', 'jpeg', 'webp']:
    candidates.append(media_folder / 'variant_screenshots' / f"variant_{variant_index:03d}.{ext}")
```

When a variant image is found, it's used as the `variant_image_url` in the Shopify CSV export.

## Result
✅ Each variant now has its own hero image  
✅ Images change when variant is selected in Shopify  
✅ No API cost increase (using already-captured screenshots)  
✅ Fallback to product hero image if variant image missing  

## Next Steps
Run the scraper as normal:
```bash
python3 ai_scraper.py
```

Then export to Shopify:
```bash
python3 shopify_export.py
```

The `products.csv` will now include proper `variant_image_url` values pointing to each variant's screenshot.
