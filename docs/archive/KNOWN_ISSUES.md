# Known Issues and Scraper Plan

Date: 2025-11-17

This document tracks current problems and the plan to bring the scraper from ~60% to reliable production use. It focuses on the Python Taobao scraper first, then outlines integration next steps.

## Scraper: Current State

- Startup: Attempts to attach to Chrome at `127.0.0.1:9222`; falls back to a bundled driver path; finally uses Selenium Manager. Login profile persists in `scraper/chrome_profile_selenium/`.
- Output: Writes CSV (`scraper/protocol_zero_variants.csv`) and media under `scraper/media/product_*/{Main,Details,Catalogue}`. Does not yet write `shared/data/products_manifest.json` required by the shop generator.
- Selectors: Hard-coded hashed classes (e.g., `span.mainTitle--R75fTcZL`, `span.Price--priceText--2nLbVda`) — fragile to Taobao UI changes.

## Scraper: Known Issues

1) Fragile UI selectors (break on minor Taobao changes)
- Symptoms: "key selector not found" or timeouts waiting for title/price; many URLs return empty data.
- Evidence: `TITLE_SELECTOR`, `PRICE_SELECTOR`, `THUMBNAIL_CONTAINER_SELECTOR` use hashed class names.
- Impact: High — blocks basic scraping.
- Proposed fix: Replace with resilient CSS/XPath anchored to stable semantics; centralize selectors in config; add multiple fallbacks per field; verify presence with preflight checks.

2) Chrome/Driver startup inconsistency
- Symptoms: Attach to remote-debug Chrome fails; bundled driver path invalid; users unsure whether to start Chrome with `--remote-debugging-port`.
- Evidence: Code expects `scraper/chromedriver` but repo has `chromedriver.broken`; README requires remote debugging while SETUP implies Selenium Manager.
- Impact: High — scraper may fail to start.
- Proposed fix: Remove hardcoded `CHROME_DRIVER_PATH`; rely on Selenium Manager; simplify docs to not require remote debugging; keep `--login-setup` flow.

3) Anti-bot/CAPTCHA stalls
- Symptoms: Timeout on login or blocked page; error: "Timed out. The page is likely stuck on a login/CAPTCHA page."
- Evidence: `TimeoutException` handling in `scrape_product_variants`.
- Impact: Medium/High — intermittent failures.
- Proposed fix: Detect login/captcha DOM and pause with prompt; persist session via Selenium profile; add backoff + retry; optional human-in-the-loop.

4) Price detection is flaky after variant clicks
- Symptoms: `Price CNY` becomes `None`; many variants printed with "No price found"; `Final CAD` empty.
- Evidence: Heuristic scanning in `get_price_cny()`; polling in `get_price_cny_with_wait()` may miss price updates.
- Impact: High — unusable pricing.
- Proposed fix: After click, wait for price node mutation (MutationObserver via `execute_script`) or explicit wait on attribute/text change; add script-data parsing from JSON blobs and `window.__INIT_DATA__` style variables.

5) Main image capture lacks screenshot fallback
- Symptoms: "Warning: Could not capture main photo" when downloads fail or `src` is lazy.
- Evidence: Main gallery uses only `img.get_attribute('src')`; no screenshot fallback like detail images.
- Impact: Medium — missing hero image.
- Proposed fix: If download fails, scroll center and `element.screenshot()` (like `capture_full_image_screenshot`), then add margin.

6) Lazy-loading not fully handled for gallery images
- Symptoms: Some images not saved; duplicates; very small thumbs saved.
- Evidence: Only detail images handle `data-src`/`data-original`; gallery uses plain `src` and loose y<500 filter.
- Impact: Medium.
- Proposed fix: Normalize lazy attributes for all images; click each thumb to load main; use `srcset` best candidate; size thresholding.

7) Video detection unreliable
- Symptoms: Videos missed or saved as stills; overlay video not captured.
- Evidence: Relies on URL substrings and `<video>` tags in main area; may miss shadow DOM/lightbox.
- Impact: Low/Medium.
- Proposed fix: Trigger gallery lightbox and query shadow roots; prefer downloading `<source>`; else high-res area screenshot.

8) Output mismatch with shop pipeline
- Symptoms: `shared/scripts/generate-products.js` warns `products_manifest.json` not found.
- Evidence: Scraper writes CSV only; shared `data/` lacks manifest.
- Impact: High — blocks shop from loading scraped products.
- Proposed fix: Add manifest export (`shared/data/products_manifest.json`) and update `catalog_index.json`/`scrape_queue.json` as part of run.

9) Logging and error reporting
- Symptoms: Hard to triage failures; prints only.
- Impact: Medium.
- Proposed fix: Structured per-URL report (JSONL); summary at end with counts; optional `--debug` flag and screenshot on failure.

10) Documentation inconsistency
- Symptoms: Conflicting instructions about remote debugging vs Selenium Manager; CSV locations differ across docs.
- Impact: Medium — setup confusion.
- Proposed fix: Unify SETUP and scraper README after driver change; standardize outputs paths.

## Desired Scraper Flow (Spec)

1. Startup
- Launch Chrome via Selenium Manager with persistent profile at `scraper/chrome_profile_selenium/`.
- If `--login-setup`, open Taobao, prompt user to login, save cookies, exit.

2. Input
- Read URLs from `scraper/taobao_links.txt` and optional `shared/data/scrape_queue.json` (deduped, prioritize queue).

3. For each URL
- Navigate; preflight: detect login/captcha; if present, wait and retry; abort after N minutes.
- Wait for product root to render; extract title and slug.
- Create `scraper/media/product_{i}_{slug}/`.
- Gallery/Main
  - Click through thumbs until the first valid non-video main image; try download; if failed, element screenshot; add uniform margins; save `Main/Main.jpg`.
  - If first item is a video: try `<video>/<source>` download; else screenshot fallback.
- Details
  - Scroll progressively; locate description/detail container; resolve `src|data-*|srcset`; download or screenshot; save `Details/Detail_XX.jpg` (limit ~30).
- Catalogue (fallback)
  - If no details found, collect gallery images as `Catalogue/Catalogue_XX.jpg`.
- Variants and Price
  - Detect variant buttons; for each, click; wait for variant selection state change AND price mutation; parse price from DOM or script data; compute `CAD = round(CNY * 0.202 + 15, 2)`.
  - Record rows with URL, titles (ZH/EN), variant, price fields, media counts and folder.

4. Output
- Write CSV: `scraper/protocol_zero_variants.csv`.
- Write manifest JSON: `shared/data/products_manifest.json` (grouped by product with images and variants).
- Update `shared/data/catalog_index.json` (id, url, last_scraped, variants).

5. Post-process (optional)
- Trigger `shared/scripts/sync-media.js` and `generate-products.js`.
- Print summary report.

## Remediation Plan (Work-Off)

Milestone 1: Stable startup + unified docs (High)
- Remove `CHROME_DRIVER_PATH` usage; default to Selenium Manager.
- Make remote-debug attach optional; do not require in README.
- Verify `--login-setup` on macOS. Accept: clean startup and persistent session.

Milestone 2: Selector hardening (High)
- Replace hashed classes with robust selectors/XPath; add multiple fallbacks in a central list.
- Add preflight: fail-fast with clear message if core nodes not found.

Milestone 3: Reliable price extraction (High)
- Wait for mutation after variant click; add JS hook to observe price element or app state.
- Parse script/JSON blobs for price; keep DOM fallback; extend timeout to 8–10s.

Milestone 4: Media capture reliability (Medium)
- Add screenshot fallback for main image; normalize lazy-load attributes for gallery; support `srcset` selection; ensure min size.
- Improve video detection (shadow DOM/lightbox) with overlay handling.

Milestone 5: Manifest export + integration (High)
- Implement `products_manifest.json` writer to `shared/data/`.
- Append/update `catalog_index.json`.
- Wire optional post-run to call sync/generate scripts.

Milestone 6: Diagnostics & resilience (Medium)
- Add `--debug` flag; per-URL JSONL log; capture page screenshot on critical failure.
- Retry policy with backoff; respect robots/limits; configurable sleeps.

Documentation sweep (Medium)
- Update `scraper/README.md` and root `SETUP.md` to reflect the simplified startup and outputs.

## Near-Term Task Breakdown

- [ ] M1: Remove hardcoded driver path; rely on Selenium Manager; update docs
- [ ] M2: Centralize selectors; replace hashed classes; add fallbacks
- [ ] M3: Add MutationObserver-based price wait + script-data parsing
- [ ] M4: Main image screenshot fallback + gallery lazy-load handling
- [ ] M5: Implement `shared/data/products_manifest.json` export
- [ ] M6: Append/update `shared/data/catalog_index.json`
- [ ] M6: Add structured logs and `--debug` flag
- [ ] Docs: Align README/SETUP; clarify login-setup and outputs

Notes:
- Anti-bot/CAPTCHA is expected; we keep a human-in-the-loop login mode with persistent profiles.
- We’ll validate fixes against a small canary set from `taobao_links.txt` before scaling.
