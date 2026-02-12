# Batch Translation & Seeding Fix - Implementation Plan

## Problem Analysis

### Current Issues
1. **Inefficient Translation in Scraper**
   - `ai_scraper.py` has batch mode but still makes MANY API calls
   - Each product/variant is translated individually during scraping
   - `translate_deepseek.py` has the efficient approach but is a separate script

2. **Translation Workflow is Fragmented**
   - Scrape → Export → Run separate translation script → Seed
   - Extra steps, prone to errors
   - Users forget to translate before seeding

3. **Seeding Validation Missing**
   - `seed_json_to_knack.py` doesn't validate translations are complete
   - Chinese text can leak into Knack database
   - No checks for untranslated variants

### Root Cause
The scraper has two translation approaches:
- `translator.batch_translate_all()` - Makes N API calls (one per small batch)
- `translate_deepseek.py` - Makes 2 API calls total (one for all products, one for all variants)

The efficient approach isn't integrated into the main scraper.

## Solution Architecture

### Single Unified Workflow
```
Scrape (collect Chinese) → Batch Translate (2 API calls) → Validate → Export → Seed
```

### Key Changes

#### 1. Refactor Translator Class (`ai_scraper.py`)
```python
class Translator:
    def bulk_translate_products(self, titles: List[str]) -> List[str]:
        """ONE API call for ALL product titles with numbered list"""
        # Build: "1. 标题1\n2. 标题2\n3. 标题3..."
        # Send to DeepSeek with detailed milsim prompt
        # Parse numbered response
        # Return translations in same order
        
    def bulk_translate_variants(self, names: List[str]) -> List[str]:
        """ONE API call for ALL variant names with numbered list"""
        # Build: "1. 黑色\n2. 狼灰 - M\n3. 沙色 CNC..."
        # Send to DeepSeek with variant-specific prompt
        # Parse numbered response
        # Return translations in same order
```

#### 2. Always Use Batch Mode in Scraper
```python
def scrape_product(self, url, index):
    # During scraping: ONLY collect Chinese text
    product.title_en = product.title_zh  # Placeholder
    variant.variant_name_en = variant.variant_name_zh  # Placeholder
    
def _batch_translate_all_products(self):
    # Collect ALL titles
    titles_zh = [p.title_zh for p in self.products if has_chinese(p.title_zh)]
    
    # ONE call for all titles
    titles_en = self.translator.bulk_translate_products(titles_zh)
    
    # Collect ALL variant names
    variants_zh = []
    for p in self.products:
        for v in p.variants:
            if has_chinese(v.variant_name_zh):
                variants_zh.append(v.variant_name_zh)
    
    # ONE call for all variants  
    variants_en = self.translator.bulk_translate_variants(variants_zh)
    
    # Apply translations back
    ...
```

#### 3. Add Translation Validation
```python
def validate_translations(products: List[ScrapedProduct]) -> Dict:
    """Check all translations are complete"""
    issues = {
        'untranslated_titles': [],
        'untranslated_variants': [],
        'chinese_in_english': []
    }
    
    for p in products:
        if has_chinese(p.title_en):
            issues['untranslated_titles'].append(p.product_id)
        
        for v in p.variants:
            if has_chinese(v.variant_name_en):
                issues['untranslated_variants'].append(v.sku)
    
    return issues
```

#### 4. Update Seeding Script
```python
def seed_json_to_knack(json_path):
    # Load data
    with open(json_path) as f:
        data = json.load(f)
    
    # VALIDATE translations first
    validation = validate_translations(data['products'])
    if validation['untranslated_titles'] or validation['untranslated_variants']:
        print("❌ Translation incomplete!")
        print(f"   Untranslated titles: {len(validation['untranslated_titles'])}")
        print(f"   Untranslated variants: {len(validation['untranslated_variants'])}")
        print("\n⚠️  Run translation first: python scraper/ai_scraper.py --batch-translate")
        sys.exit(1)
    
    # Proceed with seeding...
```

## Implementation Steps

### Phase 1: Refactor Translator (High Priority)
- [ ] Add `bulk_translate_products()` method to Translator class
- [ ] Add `bulk_translate_variants()` method to Translator class  
- [ ] Use numbered list format for bulk requests
- [ ] Parse numbered responses correctly
- [ ] Add translation cache support
- [ ] Test with small dataset (3-5 products)

### Phase 2: Integrate into Scraper
- [ ] Remove individual `translate()` calls during scraping
- [ ] Make `--batch-translate` the default behavior
- [ ] Update `_batch_translate_all_products()` to use new bulk methods
- [ ] Ensure all Chinese text is collected first
- [ ] Apply translations after bulk API calls complete

### Phase 3: Add Validation
- [ ] Create `validation.py` utility module
- [ ] Add `validate_translations()` function
- [ ] Add `has_chinese()` helper function
- [ ] Call validation after translation in scraper
- [ ] Call validation before seeding in seed script

### Phase 4: Update Workflow
- [ ] Update `shopify_workflow.sh` to use integrated batch translation
- [ ] Remove separate `translate_deepseek.py` execution step
- [ ] Update documentation
- [ ] Test full pipeline end-to-end

### Phase 5: Optimization
- [ ] Add retry logic for failed API calls
- [ ] Implement chunking for very large datasets (>500 items)
- [ ] Add progress indicators for batch translation
- [ ] Optimize prompt to reduce token usage further

## Expected Improvements

### Token Savings
**Before:** 
- 100 products × 1 API call = 100 calls
- 500 variants × 1 API call = 500 calls
- **Total: 600 API calls**

**After:**
- 1 API call for all products
- 1 API call for all variants
- **Total: 2 API calls**

**Savings: 99.7% reduction in API calls** 🚀

### Time Savings
- Before: ~5-10 minutes (rate limits, delays)
- After: ~10-20 seconds (2 calls)
- **Savings: ~95% faster**

### Cost Savings
- DeepSeek pricing: $0.14 per 1M input tokens
- Bulk request: ~50K tokens (all products + variants)
- **Cost per scrape: ~$0.007** (less than 1 cent!)

## Testing Checklist

- [ ] Test with 1 product, 1 variant
- [ ] Test with 10 products, 50 variants
- [ ] Test with 100 products, 500 variants
- [ ] Test with Chinese-only text
- [ ] Test with mixed Chinese/English
- [ ] Test with special characters (/, -, numbers)
- [ ] Test validation catches untranslated text
- [ ] Test seeding rejects incomplete translations
- [ ] Test cache works correctly
- [ ] Test error handling for API failures

## Rollback Plan

If issues occur:
1. Keep `translate_deepseek.py` as backup
2. Can run separately: `python scraper/translate_deepseek.py --force`
3. Original individual translation code preserved in git history
4. Flag to disable batch mode: `--no-batch-translate` (if needed)

## Success Criteria

✅ Scraper completes 100 products with 2 API calls
✅ All translations validated before export
✅ Seeding script rejects incomplete data  
✅ Total cost < $0.01 per full scrape
✅ Translation time < 30 seconds
✅ Zero Chinese text in final Knack database

## Notes

- Use DeepSeek's most efficient model: `deepseek-chat`
- Keep prompts detailed for quality translations
- Numbered list format ensures correct mapping
- Cache prevents re-translation on re-runs
- Validation is critical - catches issues early
