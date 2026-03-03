# Quick Start Guide

## 🚀 Fast Track (3 Commands)

```bash
# 1. Scrape (no API cost)
python3 ai_scraper.py

# 2. Translate (bulk, 2-3 API calls)
python3 translate_deepseek.py

# 3. Upload to Knack
python3 upload_to_knack.py --with-images --product-id 1
```

## 📚 Full Documentation

See [WORKFLOW.md](./WORKFLOW.md) for:
- Complete workflow explanation
- Cost comparison (99% savings!)
- Flag reference
- Troubleshooting
- Variant image flow

## 💰 Cost Optimization

**Default behavior is now scrape-only** (no translation during scraping).

This saves **99% on API costs**:
- Old: ~$2-5 for 100 products
- New: ~$0.01-0.05 for 100 products

## 🎯 Key Points

1. **Scraper = Scrape-only by default** (no translation)
2. **Use translate_deepseek.py** for bulk translation after scraping
3. **Upload incrementally** with `--product-id` flag
4. **Always use `--dry-run`** first to preview

## 🔧 Common Commands

### Scrape + Translate (expensive, not recommended)
```bash
python3 ai_scraper.py --translate
```

### Scrape first 1 URL (testing)
```bash
python3 ai_scraper.py --test
```

### Upload with dry-run (preview)
```bash
python3 upload_to_knack.py --with-images --product-id 1 --dry-run
```

### Force re-translate (clear cache)
```bash
rm ai_scraper_output/translation_cache.json
python3 translate_deepseek.py
```

---

For detailed workflow and troubleshooting, see **[WORKFLOW.md](./WORKFLOW.md)**
