# Quick Start Guide – Protocol Zero Scraper (M1–M5 Implemented)

Last Updated: 2025-11-17

## Prerequisites

- Python 3.8+
- Node.js 16+
- Chrome browser installed
- macOS/Linux (tested on macOS)

## First-Time Setup

### 1. Install Python Dependencies

```bash
cd ~/Documents/protocol-zero/scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Dependencies installed:**
- `selenium>=4.15.0` (with automatic driver management)
- `requests>=2.31.0` (for image downloads)
- `Pillow>=10.1.0` (for image stitching)

### 2. Install Node.js Dependencies (for sync scripts)

```bash
cd ~/Documents/protocol-zero/shared/scripts
npm install
```

### 3. Login to Taobao (One-Time)

```bash
cd ~/Documents/protocol-zero/scraper
source .venv/bin/activate
python3 scraper.py --login-setup
```

**What happens:**
1. Chrome opens with a dedicated profile
2. Navigates to taobao.com
3. **YOU:** Log in manually (QR code or password)
4. **YOU:** Press Enter in the terminal when done
5. Session is saved in `chrome_profile_selenium/`

**Important:** This login persists! You won't need to login again unless you clear the profile.

## Running the Scraper

### Step 1: Add Product URLs

Edit `scraper/taobao_links.txt` and add Taobao product URLs (one per line):

```
https://item.taobao.com/item.htm?id=713575933395
https://item.taobao.com/item.htm?id=646929225114
```

### Step 2: Run the Scraper

```bash
cd ~/Documents/protocol-zero/scraper
source .venv/bin/activate
python3 scraper.py
```

**What it does:**
- Opens Chrome with your logged-in session
- For each URL:
  - ✓ Captures **hero image** (first non-video image, high-quality)
  - ✓ Captures **gallery images** (all other images, videos omitted)
  - ✓ Scrolls to detail section
  - ✓ Captures **all detail images**
  - ✓ **Stitches details** into one long scrollable image
  - ✓ Clicks through **variant options** and records prices
- Saves:
  - `protocol_zero_variants.csv` (audit trail)
  - `../shared/data/products_manifest.json` (shop data)
  - `media/product_N_slug/` (all images)

### Step 3: Sync to Shop (Optional)

```bash
cd ~/Documents/protocol-zero/shared/scripts
npm run sync-media
npm run generate-products
```

**What it does:**
- Copies images from `shared/media/` → `shop/public/images/`
- Generates `shop/lib/products.generated.ts` from manifest

### Step 4: View in Shop

```bash
cd ~/Documents/protocol-zero/shop
npm install  # first time only
npm run dev
```

Open: http://localhost:3000/shop

## Output Structure

```
scraper/
  media/
    product_1_molle-pda/
      Main/
        Main.jpg                    ← Hero (HQ, first non-video)
      Catalogue/
        Catalogue_01.jpg            ← Other gallery images
        Catalogue_02.jpg
        ...
      Details/
        Detail_01.jpg               ← Individual detail images
        Detail_02.jpg
        ...
        Details_Long.jpg            ← Stitched long image ⭐
  protocol_zero_variants.csv        ← Variant data (CSV)

shared/
  data/
    products_manifest.json          ← Shop integration data ⭐
  media/                            ← (symlink or will be copied)

shop/
  public/images/
    molle-pda-Main.jpg              ← Synced images
    molle-pda-Catalogue_01.jpg
    molle-pda-Details_Long.jpg
  lib/
    products.generated.ts           ← Generated TypeScript
```

## Key Features Implemented

### ✅ M1: Stable Startup & Login
- Selenium Manager handles drivers automatically
- Persistent Chrome profile for session reuse
- No manual chromedriver setup needed

### ✅ M2: Hero/Gallery Capture
- Hero = first non-video gallery image (HQ screenshot)
- Videos completely omitted throughout
- Gallery images captured with fallback to screenshots

### ✅ M3: Detail Stitching
- All detail images collected from description section
- Stitched vertically into one long `Details_Long.jpg`
- Ready for scrollable display in shop

### ✅ M5: Manifest Export
- Exports `shared/data/products_manifest.json`
- Shop-compatible schema with images, prices, variants
- Includes `detailLongImage` field for long image

## Troubleshooting

### "No module named selenium"
```bash
cd ~/Documents/protocol-zero/scraper
source .venv/bin/activate
pip install -r requirements.txt
```

### "Login/CAPTCHA page timeout"
- Run `python3 scraper.py --login-setup` to refresh session
- Solve any CAPTCHAs manually
- Session will persist after login

### "No images captured"
- Check if URLs in `taobao_links.txt` are valid
- Verify you're logged in (run `--login-setup` again)
- Check `scraper/media/` for output folders

### "Details_Long.jpg not created"
- Verify Pillow is installed: `pip install Pillow`
- Check if detail images exist in `Details/` folder
- Look for stitching errors in console output

### "npm run sync-media fails"
```bash
cd ~/Documents/protocol-zero/shared/scripts
npm install
npm run sync-media
```

## Next: Price Reliability (M4)

Current limitation: Prices may not update correctly after clicking variants.

**Coming soon:** DOM mutation observers for accurate price detection.

## Support

See:
- `INTEGRATION_ROADMAP.md` - Full integration plan
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `KNOWN_ISSUES.md` - Known bugs and fixes

## Quick Commands Reference

```bash
# One-time login
python3 scraper.py --login-setup

# Run scraper
python3 scraper.py

# Sync to shop
cd ../shared/scripts && npm run sync-all

# Start shop
cd ../../shop && npm run dev
```
