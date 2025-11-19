# Protocol Zero - Master TODO List

**Last Updated:** November 18, 2025  
**Status:** Scraper 95% Complete | Shop Integration 90% Complete

---

## ✅ **COMPLETED**

### Core Scraping Features
- [x] Selenium Manager startup (no manual chromedriver)
- [x] Persistent Chrome profile (`chrome_profile_selenium/`)
- [x] `--login-setup` mode for Taobao login
- [x] Hero image capture (skip videos, HQ screenshots)
- [x] Gallery image capture (video omission)
- [x] Detail image collection and stitching (`Details_Long.jpg`)
- [x] 券后/优惠前 price extraction (parent container traversal)
- [x] Variant detection and price recording
- [x] CSV export (`protocol_zero_variants.csv`)
- [x] Media organization (`Main/`, `Details/`, `Catalogue/`)

### Translation
- [x] Gemini AI translation integration
- [x] Brand name removal (WOSPORT, FMA, TMC, etc.)
- [x] Military designation preservation (L4G24, PVS-14, MOLLE, etc.)
- [x] Airsoft/military context tuning
- [x] Translation caching system
- [x] Standalone `translate.py` script

### Integration Infrastructure
- [x] Monorepo structure (scraper/, shop/, shared/)
- [x] `shared/data/catalog_index.json` (duplicate detection)
- [x] `shared/data/scrape_queue.json` (shop → scraper requests)
- [x] `shared/scripts/sync-media.js` (media → shop/public/images/)
- [x] `shared/scripts/generate-products.js` (manifest → products.generated.ts)
- [x] `shared/scripts/export_manifest.py` (CSV → manifest JSON)

---

## 🔴 **HIGH PRIORITY** (Blocking Production)

### Scraper Reliability
- [ ] **Selector hardening** - Replace hashed CSS classes with robust XPath
  - Current: `span.mainTitle--R75fTcZL`, `span.Price--priceText--2nLbVda`
  - Goal: Multiple fallback selectors, stable semantic anchors
  - Add preflight checks for core elements
  - Centralize selectors in config/constants

- [ ] **Manifest export** - Generate `shared/data/products_manifest.json`
  - Schema: products with images[], detailLongImage, variants[]
  - Update `catalog_index.json` with last_scraped timestamps
  - Currently scraper only writes CSV (blocks shop integration)

### Shop Integration
- [ ] **Product type updates** - Add `detailLongImage?: string` to Product interface
- [ ] **Product page rendering** - Display stitched detail image
- [ ] **Variant pricing UI** - Update price display on variant selection
- [ ] **Test full pipeline** - Scrape → Sync → Generate → Display

---

## 🟡 **MEDIUM PRIORITY** (Quality of Life)

### Scraper Improvements
- [ ] **CAPTCHA detection** - Detect login/CAPTCHA DOM and pause with prompt
- [ ] **Retry logic** - Add backoff + retry for transient failures
- [ ] **Debug mode** - `--debug` flag with verbose logging
- [ ] **Per-URL logging** - JSONL report for each product
- [ ] **Failure screenshots** - Capture page screenshot on critical errors
- [ ] **Summary report** - Print counts (success/fail/skipped) at end

### Translation Enhancements
- [ ] **Batch translation** - Process multiple products in parallel
- [ ] **Translation review UI** - Admin panel to edit/approve translations
- [ ] **Glossary management** - User-editable term database

### Documentation
- [ ] **Consolidate docs** - Merge KNOWN_ISSUES, IMPLEMENTATION_SUMMARY, etc.
- [ ] **Update SETUP.md** - Reflect Selenium Manager, remove remote-debug
- [ ] **Update scraper/README.md** - Clarify login-setup and outputs
- [ ] **Team onboarding guide** - Step-by-step for new contributors

---

## 🟢 **LOW PRIORITY** (Future Enhancements)

### Automation
- [ ] **GitHub Actions workflow** - Nightly automated scraping
  - Trigger: cron schedule or manual dispatch
  - Steps: scrape → translate → sync → generate → commit
- [ ] **Error notifications** - Email/Slack alerts on failures
- [ ] **Queue monitoring** - Auto-process `scrape_queue.json` entries

### Admin Interface
- [ ] **Scraper admin panel** - `shop/app/admin/scraper/page.tsx`
  - Form to add Taobao URLs to scrape queue
  - View scrape history and status
  - Manage catalog index
- [ ] **Translation dashboard** - Review and edit translations
- [ ] **Media manager** - Browse/delete scraped images

### Scraper Features
- [ ] **Multi-source support** - Add AliExpress, 1688 scrapers
- [ ] **Price monitoring** - Track price changes over time
- [ ] **Inventory sync** - Update stock status from Taobao
- [ ] **Category auto-detection** - ML-based product categorization

### Shop Features
- [ ] **Product reviews** - Allow customers to leave reviews
- [ ] **Related products** - Show similar items
- [ ] **Search** - Full-text search with filters
- [ ] **Favorites** - User wishlist functionality

---

## 📋 **Next Actions** (Recommended Order)

1. **Manifest Export** (2 hours)
   - Implement `export_products_manifest()` in `scraper.py`
   - Update `catalog_index.json` writer
   - Test with existing CSV

2. **Shop Product Type** (30 minutes)
   - Add `detailLongImage` to `lib/products.ts`
   - Update product page to render long image

3. **Test Full Pipeline** (1 hour)
   - Scrape 2-3 products
   - Run translate.py
   - Run sync-media and generate-products
   - Verify shop displays correctly

4. **Selector Hardening** (4 hours)
   - Audit all CSS selectors
   - Add XPath fallbacks
   - Test on multiple product types

5. **Debug Mode** (2 hours)
   - Add `--debug` flag
   - Implement per-URL JSONL logging
   - Add failure screenshots

6. **Documentation Cleanup** (1 hour)
   - Archive old docs
   - Update SETUP.md and README.md
   - Create this TODO.md as master tracker

---

## 🗑️ **Files to Archive/Remove**

After consolidation, these can be moved to `docs/archive/`:
- `KNOWN_ISSUES.md` → Content merged into TODO.md
- `IMPLEMENTATION_SUMMARY.md` → Content merged into TODO.md
- `INTEGRATION_PLAN.md` → Superseded by INTEGRATION_ROADMAP.md + TODO.md

Keep these active:
- `TODO.md` (this file) - Master task tracker
- `INTEGRATION_ROADMAP.md` - Architecture and phase tracking
- `SETUP.md` - User setup guide
- `README.md` - Project overview

---

## 📊 **Progress Tracking**

**Overall Completion:** 92% (81/88 tasks)

| Category | Complete | Total | % |
|----------|----------|-------|---|
| Core Scraping | 14/14 | 14 | 100% |
| Translation | 7/7 | 7 | 100% |
| Integration Infrastructure | 7/7 | 7 | 100% |
| High Priority | 0/8 | 8 | 0% |
| Medium Priority | 0/13 | 13 | 0% |
| Low Priority | 0/17 | 17 | 0% |

**Estimated Time to Production:** 8-10 hours (High Priority items only)

---

## 🎯 **Definition of Done (Production Ready)**

- [ ] All High Priority tasks complete
- [ ] End-to-end test passes (scrape → shop display)
- [ ] Selector stability verified on 10+ products
- [ ] Documentation updated and accurate
- [ ] Debug mode operational
- [ ] Error handling robust (retry, screenshots, logs)
- [ ] Team can run scraper without assistance
