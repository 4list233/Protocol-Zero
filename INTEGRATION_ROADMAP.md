# Protocol Zero – End-to-End Integration Roadmap (Scraper → Shop)

Date: 2025-11-17

This roadmap implements the flow you described: persistent Chrome profile, manual login window at the start, strict image rules (hero/galleries, omit videos), capture every detail image and stitch into one long image, and link prices to product options. It then integrates the output with the shop.

## 1) Browser Session & Login (Human-in-the-loop)

Goal: Always launch the same Chrome profile so your Taobao login persists. Give you time upfront to log in to avoid CAPTCHAs.

Plan
- ~~Use Selenium Manager to start Chrome with a dedicated profile at `scraper/chrome_profile_selenium/` (no manual chromedriver needed).~~ ✅
- ~~`--login-setup` mode: open Taobao home, wait for you to log in, save cookies, and exit. Normal runs reuse this profile.~~ ✅
- During normal scraping, if a login/CAPTCHA is detected on any page, pause and prompt you to solve, then continue. ⏳ (login works, CAPTCHA detection not implemented yet)

Runbook (macOS/zsh)
```bash
# 1) One-time or occasional: log in to Taobao on the scraper profile
cd ~/Documents/protocol-zero/scraper
python3 scraper.py --login-setup

# After login completes in the browser window, return to terminal and press Enter

# 2) Normal scraping runs (profile/session reused automatically)
python3 scraper.py
```

## 2) URL Sources

- ~~Primary: `scraper/taobao_links.txt` (one URL per line).~~ ✅
- Optional: Read from CSV column `URL` (e.g., previously exported lists). If both present, merge and de-dupe. ⏳ (not implemented yet)

## 3) Scrape Rules (Per Product)

Hero and Galleries
- ~~Hero: the first media item if it is an image; if it is a video, skip it and take the second image instead.~~ ✅
- ~~Capture a high-quality screenshot of the selected hero from the main display area (not the small thumbnail). Use large window size and device-scale factor for clarity. Filename: `Main/Main.jpg`.~~ ✅
- ~~Omit all videos entirely across the entire workflow.~~ ✅
- ~~Capture all other gallery images (secondary, third, fourth...) as screenshots or downloads when available. Save as `Catalogue/Catalogue_01.jpg`, `Catalogue_02.jpg`, ...~~ ✅

Details Section (Long Image)
- ~~Scroll to and fully load the product description/detail section.~~ ✅
- ~~Collect every image in that section (resolve `src`, `data-*`, and `srcset`), skip duplicates/small icons.~~ ✅
- ~~Save as individual files first: `Details/Detail_01.jpg`, ...~~ ✅ then ~~stitch vertically into one long image `Details/Details_Long.jpg` (or `.png` if better for quality/size) that represents the full description as a continuous scroll.~~ ✅

Price and Variants
- ~~Detect selectable options (variant buttons). For each:~~ ✅
  - ~~Click the option; wait for price to settle using DOM mutation observation (or script data parsing) to avoid stale values.~~ ✅
  - ~~Read price in CNY and compute final CAD using configured rule: `CAD = round(CNY * 0.202 + 15, 2)`.~~ ✅ (Now extracts 券后/优惠前 correctly)
  - ~~Record the option text (Chinese for now) and the price mapping. Images stay product-level only (no per-variant images).~~ ✅

Resilience
- ~~Ignore videos entirely (skip `<video>` and video-like URLs).~~ ✅
- ~~Handle lazy-loaded images (`data-src`, `data-original`, `srcset`).~~ ✅
- ~~Ensure minimum dimensions; if download fails, use element screenshot with margin padding for uniform framing.~~ ✅

## 4) Output Schema (for Shop Integration)

CSV (for audits)
- ~~`scraper/protocol_zero_variants.csv`: one row per product-option with: URL, Product Title (ZH), Translated Title (optional later), Option Name (ZH), Price fields (raw/CNY/CAD/final), Media Folder, counts.~~ ✅

Manifest JSON (source of truth for shop)
- `shared/data/products_manifest.json` ⏳ (not yet implemented)
```json
{
  "last_updated": "2025-11-17T18:30:00Z",
  "products": [
    {
      "id": "product-slug",
      "title": "Original Chinese Title",
      "title_en": "English (optional later)",
      "url": "https://item.taobao.com/item.htm?id=...",
      "images": [
        "/images/<folder>-Main.jpg",               // hero (from Main/Main.jpg)
        "/images/<folder>-Catalogue_01.jpg",       // others (optional list)
        "..."
      ],
      "detailLongImage": "/images/<folder>-Details_Long.jpg", // stitched detail image
      "price_cny": 88.00,            // base/default price if available
      "price_cad": 32.76,            // computed default
      "variants": [
        { "option": "选项名称 (ZH)", "price_cny": 88.00, "price_cad": 32.76 },
        { "option": "...", "price_cny": 96.00, "price_cad": 34.39 }
      ]
    }
  ]
}
```
Notes
- Images are product-level only. Variants carry pricing and labels but no images.
- The `<folder>` placeholder is the product media folder name (e.g., `product_1_molle-pda`). A sync script maps it to `/shop/public/images` filenames like `molle-pda-Main.jpg`.

## 5) Shop Rendering Changes

- Gallery: Use `images[]` for hero + gallery images. ⏳
- Detail: Render `detailLongImage` as a tall, scrollable image under the gallery area. ⏳
- Variants: Show options and per-option price. Selecting an option updates the price display. Images remain unchanged. ⏳

Minimal Frontend Additions
- Extend the `Product` type to include `detailLongImage?: string`. ⏳
- Update the product page to display the long image if present. ⏳
- No change to cart logic beyond using the variant price when selected. ⏳

## 6) File and Naming Conventions

Scraper output
```
scraper/media/product_{index}_{slug}/
  Main/Main.jpg
  Catalogue/Catalogue_01.jpg ...
  Details/Detail_01.jpg ...
  Details/Details_Long.jpg
```
Shared sync (already present)
- `shared/scripts/sync-media.js` copies and flattens images into `shop/public/images/` as `<slug>-Main.jpg`, `<slug>-Catalogue_01.jpg`, `<slug>-Details_Long.jpg`, etc. ⏳ (exists but needs testing with new structure)
- `shared/scripts/generate-products.js` reads `products_manifest.json` and writes `shop/lib/products.generated.ts` (we'll extend it to include `detailLongImage`). ⏳

## 7) Automation & CI (optional)

- Local: After scraping, optionally run `npm run sync-media && npm run generate-products` from `shared/scripts`.
- CI: A GitHub Action can run the scraper (self-hosted if GUI needed), sync media, generate products, and push changes.

## 8) Milestones (Work-Off Plan)

M1 – Stable startup & login (High)
- ~~Default to Selenium Manager + persistent profile.~~ ✅
- ~~Keep `--login-setup`~~ ✅ and add login/CAPTCHA detection during runs (pause/resume). ⏳

M2 – Hero/galleries & video omittance (High)
- ~~Implement hero selection logic (skip first if video). High-quality screenshot fallback.~~ ✅
- ~~Capture remaining gallery images; normalize lazy-load.~~ ✅

M3 – Details → stitched long image (High)
- ~~Collect all description images and stitch to `Details_Long.jpg`.~~ ✅

M4 – Price + variants reliability (High)
- ~~Use DOM mutation observers/script-data parsing to get accurate prices after option click.~~ ✅ (券后/优惠前 extraction working)

M5 – Manifest export + generator/shop update (High)
- Emit `shared/data/products_manifest.json` with `detailLongImage`. ⏳
- Update generator and shop to render long detail image. ⏳

M6 – Diagnostics & docs (Medium)
- `--debug` flag with per-URL JSONL logs and failure screenshots. ⏳
- Update `SETUP.md` and `scraper/README.md` for the new flow. ⏳

## 9) Acceptance Criteria

- ~~You can run `python3 scraper.py --login-setup`, log in, exit, and future runs reuse the session.~~ ✅
- For a test set of URLs, each product produces:
  - ~~A `Main/Main.jpg` hero (or second image if first media is video).~~ ✅
  - ~~Optional `Catalogue_*.jpg` files for other gallery images.~~ ✅
  - ~~`Details_Long.jpg` created from all description images.~~ ✅
  - A manifest entry with `images[]`, `detailLongImage`, and accurate variant prices. ⏳
- The shop page shows hero/gallery, a scrollable long detail image, and correct prices per option. ⏳

## 10) What I’ll Implement First (on approval)

- M1: Remove hardcoded `CHROME_DRIVER_PATH`, rely on Selenium Manager, tidy startup + login pause.
- M2: Hero selection + HQ screenshot fallback and skip videos.
- M3: Detail stitching: build PIL-based vertical stitcher.
- M5: Manifest writer + generator/shop fields for `detailLongImage`.

## 11) Quick Commands

```bash
# Open login window (manual login)
cd ~/Documents/protocol-zero/scraper
python3 scraper.py --login-setup

# Run scraper after login
python3 scraper.py

# Sync media and generate products (optional local step)
cd ../shared/scripts
npm install
npm run sync-media
npm run generate-products

# Start the shop
cd ../../shop
npm install
npm run dev
```
