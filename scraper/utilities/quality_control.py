#!/usr/bin/env python3
"""
Scraper Quality Control
=======================

Analyzes scraped data, identifies problems, and separates products into:
- GOOD: Complete with reasonable pricing
- OUTLIERS: Has extreme price variations (likely wrong prices)
- INCOMPLETE: Missing title, no variants, or untranslated
- FAILED: Products that errored during scraping

Usage:
    python quality_control.py                  # Analyze and report
    python quality_control.py --clean          # Remove bad data
    python quality_control.py --separate-links # Create separate link files
    python quality_control.py --full           # Do everything
"""

import os
import sys
import json
import shutil
import argparse
from datetime import datetime
from typing import Dict, List, Tuple

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output')
MEDIA_DIR = os.path.join(SCRIPT_DIR, 'media')
LINKS_FILE = os.path.join(SCRIPT_DIR, 'taobao_links.txt')
JSON_OUTPUT = os.path.join(OUTPUT_DIR, 'products.json')
CSV_OUTPUT = os.path.join(OUTPUT_DIR, 'products.csv')

# Quality thresholds
OUTLIER_MULTIPLIER = 3.0  # Price > 3x average = outlier
MIN_VARIANTS = 1          # Minimum variants required


def load_products() -> Dict:
    """Load products from products.json"""
    if not os.path.exists(JSON_OUTPUT):
        print(f"❌ No products.json found at {JSON_OUTPUT}")
        sys.exit(1)
    
    with open(JSON_OUTPUT, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_links() -> List[str]:
    """Load original URLs from taobao_links.txt"""
    if not os.path.exists(LINKS_FILE):
        return []
    
    with open(LINKS_FILE, 'r') as f:
        return [l.strip() for l in f if l.strip() and not l.startswith('#')]


def extract_product_id(url: str) -> str:
    """Extract Taobao product ID from URL"""
    import re
    match = re.search(r'[?&]id=(\d+)', url)
    return match.group(1) if match else ''


def analyze_product(product: Dict) -> Tuple[str, List[str]]:
    """
    Analyze a product and return (status, issues)
    Status: 'good', 'outliers', 'incomplete', 'failed'
    """
    issues = []
    
    # Check title
    title_en = product.get('title_en', '')
    title_zh = product.get('title_zh', '')
    
    if not title_en and not title_zh:
        issues.append("Missing title")
    elif not title_en or title_en == title_zh:
        issues.append("Title not translated")
    
    # Check variants
    variants = product.get('variants', [])
    in_stock = [v for v in variants if v.get('in_stock', True)]
    
    if not variants:
        issues.append("No variants")
        return 'incomplete', issues
    
    if not in_stock:
        issues.append("All variants out of stock")
    
    # Check for untranslated variants
    untranslated = 0
    for v in in_stock:
        name_en = v.get('variant_name_en', '')
        name_zh = v.get('variant_name_zh', '')
        if name_en == name_zh or has_chinese(name_en):
            untranslated += 1
    
    if untranslated > len(in_stock) * 0.5:
        issues.append(f"{untranslated}/{len(in_stock)} variants untranslated")
    
    # Check for price outliers
    prices = [v.get('price_cny', 0) for v in in_stock if v.get('price_cny', 0) > 0]
    
    if not prices:
        issues.append("No prices extracted")
        return 'incomplete', issues
    
    avg_price = sum(prices) / len(prices)
    min_price = min(prices)
    max_price = max(prices)
    
    # Detect outliers
    outliers = []
    for v in in_stock:
        price = v.get('price_cny', 0)
        if price > 0:
            if price > avg_price * OUTLIER_MULTIPLIER:
                outliers.append(f"¥{price} (>{OUTLIER_MULTIPLIER}x avg ¥{avg_price:.0f})")
            elif avg_price > 50 and price < avg_price / OUTLIER_MULTIPLIER:
                outliers.append(f"¥{price} (<{1/OUTLIER_MULTIPLIER:.1f}x avg ¥{avg_price:.0f})")
    
    if outliers:
        issues.append(f"Price outliers: {len(outliers)} variants")
        return 'outliers', issues
    
    # Check for extreme prices (likely errors)
    if max_price > 500 and max_price > min_price * 10:
        issues.append(f"Extreme price range: ¥{min_price}-¥{max_price}")
        return 'outliers', issues
    
    if issues:
        return 'incomplete', issues
    
    return 'good', []


def has_chinese(text: str) -> bool:
    """Check if text contains Chinese characters"""
    return any('\u4e00' <= ch <= '\u9fff' for ch in text)


def analyze_all(data: Dict) -> Dict[str, List[Dict]]:
    """Analyze all products and categorize them"""
    results = {
        'good': [],
        'outliers': [],
        'incomplete': [],
        'failed': []
    }
    
    products = data.get('products', [])
    
    for i, product in enumerate(products, 1):
        status, issues = analyze_product(product)
        
        product_info = {
            'index': i,
            'url': product.get('url', ''),
            'product_id': product.get('product_id', ''),
            'title_zh': product.get('title_zh', '')[:50],
            'title_en': product.get('title_en', '')[:50],
            'variant_count': len(product.get('variants', [])),
            'issues': issues,
            'product': product
        }
        
        results[status].append(product_info)
    
    return results


def find_failed_urls(all_urls: List[str], scraped_products: List[Dict]) -> List[str]:
    """Find URLs that failed to scrape (not in products.json)"""
    scraped_ids = set()
    for p in scraped_products:
        url = p.get('url', '')
        pid = extract_product_id(url)
        if pid:
            scraped_ids.add(pid)
    
    failed = []
    for url in all_urls:
        pid = extract_product_id(url)
        if pid and pid not in scraped_ids:
            failed.append(url)
    
    return failed


def print_summary(results: Dict, failed_urls: List[str]):
    """Print analysis summary"""
    print("\n" + "="*70)
    print("📊 SCRAPING QUALITY REPORT")
    print("="*70)
    
    print(f"\n✅ GOOD: {len(results['good'])} products")
    for p in results['good'][:5]:
        print(f"   {p['index']:2}. {p['title_en'] or p['title_zh']}")
    if len(results['good']) > 5:
        print(f"   ... and {len(results['good']) - 5} more")
    
    print(f"\n⚠️  OUTLIERS (bad pricing): {len(results['outliers'])} products")
    for p in results['outliers']:
        print(f"   {p['index']:2}. {p['title_en'] or p['title_zh']}")
        for issue in p['issues']:
            print(f"       → {issue}")
    
    print(f"\n📝 INCOMPLETE: {len(results['incomplete'])} products")
    for p in results['incomplete']:
        print(f"   {p['index']:2}. {p['title_en'] or p['title_zh']}")
        for issue in p['issues']:
            print(f"       → {issue}")
    
    print(f"\n❌ FAILED (timeout/error): {len(failed_urls)} products")
    for url in failed_urls:
        pid = extract_product_id(url)
        print(f"   • {pid}: {url[:60]}...")
    
    print("\n" + "="*70)
    total = len(results['good']) + len(results['outliers']) + len(results['incomplete']) + len(failed_urls)
    print(f"TOTAL: {total} products")
    print(f"  ✅ Good:       {len(results['good']):3} ({100*len(results['good'])/total:.0f}%)")
    print(f"  ⚠️  Outliers:   {len(results['outliers']):3} ({100*len(results['outliers'])/total:.0f}%)")
    print(f"  📝 Incomplete: {len(results['incomplete']):3} ({100*len(results['incomplete'])/total:.0f}%)")
    print(f"  ❌ Failed:     {len(failed_urls):3} ({100*len(failed_urls)/total:.0f}%)")
    print("="*70)


def separate_links(results: Dict, failed_urls: List[str]):
    """Create separate link files for each category"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Good links - archive
    good_file = os.path.join(SCRIPT_DIR, f'links_good_{timestamp}.txt')
    with open(good_file, 'w') as f:
        f.write(f"# Good products - scraped {timestamp}\n")
        for p in results['good']:
            f.write(f"{p['url']}\n")
    print(f"✅ Good links: {good_file}")
    
    # Redo links (outliers + incomplete + failed)
    redo_file = os.path.join(SCRIPT_DIR, f'links_redo_{timestamp}.txt')
    with open(redo_file, 'w') as f:
        f.write(f"# Products to redo - {timestamp}\n")
        f.write(f"# Outliers ({len(results['outliers'])})\n")
        for p in results['outliers']:
            f.write(f"{p['url']}\n")
        f.write(f"\n# Incomplete ({len(results['incomplete'])})\n")
        for p in results['incomplete']:
            f.write(f"{p['url']}\n")
        f.write(f"\n# Failed ({len(failed_urls)})\n")
        for url in failed_urls:
            f.write(f"{url}\n")
    print(f"🔄 Redo links: {redo_file}")
    
    # Also create a simple redo file for immediate use
    simple_redo = os.path.join(SCRIPT_DIR, 'taobao_links_redo.txt')
    with open(simple_redo, 'w') as f:
        for p in results['outliers']:
            f.write(f"{p['url']}\n")
        for p in results['incomplete']:
            f.write(f"{p['url']}\n")
        for url in failed_urls:
            f.write(f"{url}\n")
    print(f"🔄 Simple redo file: {simple_redo}")
    
    return good_file, redo_file


def clean_bad_data(results: Dict):
    """Remove bad products from JSON, CSV, and delete their media folders"""
    # Get list of good product indices
    good_indices = set(p['index'] for p in results['good'])
    
    # Load full data
    data = load_products()
    original_count = len(data['products'])
    
    # Keep only good products
    good_products = []
    removed_folders = []
    
    for i, product in enumerate(data['products'], 1):
        if i in good_indices:
            good_products.append(product)
        else:
            # Find and mark media folder for deletion
            pid = product.get('product_id', '')
            title_slug = product.get('title_en', product.get('title_zh', ''))[:30]
            # Look for matching folder in media
            for folder in os.listdir(MEDIA_DIR) if os.path.exists(MEDIA_DIR) else []:
                if folder.startswith(f'product_{i}_') or pid in folder:
                    removed_folders.append(os.path.join(MEDIA_DIR, folder))
    
    # Update JSON
    data['products'] = good_products
    data['count'] = len(good_products)
    data['cleaned'] = datetime.now().isoformat()
    data['removed'] = original_count - len(good_products)
    
    # Backup original
    backup_json = JSON_OUTPUT.replace('.json', '_backup.json')
    shutil.copy(JSON_OUTPUT, backup_json)
    print(f"📦 Backed up original: {backup_json}")
    
    # Write cleaned JSON
    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ Cleaned JSON: {len(good_products)}/{original_count} products kept")
    
    # Regenerate CSV with only good products
    regenerate_csv(good_products)
    
    # Delete bad media folders
    for folder in removed_folders:
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"🗑️  Removed: {os.path.basename(folder)}")
    
    print(f"\n✅ Cleaned {original_count - len(good_products)} bad products")


def regenerate_csv(products: List[Dict]):
    """Regenerate CSV with only good products"""
    import csv
    
    # Pricing config (from ai_scraper.py)
    PRICING_CONFIG = {
        'shipping_cny': 30,
        'exchange_rate': 0.19,
        'salesperson_cut': 0.10,
        'promoter_cut': 0.10,
        'target_margin': 0.30,
    }
    
    def calculate_price_cad(price_cny: float) -> Dict:
        cost_cad = (price_cny + PRICING_CONFIG['shipping_cny']) * PRICING_CONFIG['exchange_rate']
        price_cad = cost_cad / (1 - PRICING_CONFIG['target_margin'])
        price_cad = round(price_cad * 2) / 2  # Round to nearest 0.50
        if price_cad < 10:
            price_cad = round(price_cad) - 0.01
        else:
            price_cad = round(price_cad) - 0.01
        
        actual_margin = (price_cad - cost_cad) / price_cad if price_cad > 0 else 0
        margin_after_sales = actual_margin - PRICING_CONFIG['salesperson_cut']
        margin_after_promo = margin_after_sales - PRICING_CONFIG['promoter_cut']
        
        return {
            'cost_cad': round(cost_cad, 2),
            'price_cad': price_cad,
            'margin_standard': round(margin_after_sales * 100, 1),
            'margin_promo': round(margin_after_promo * 100, 1),
            'shipping_cny': PRICING_CONFIG['shipping_cny'],
        }
    
    rows = []
    for p in products:
        for v in p.get('variants', []):
            if not v.get('in_stock', True):
                continue
            
            price_cny = v.get('price_cny', 0)
            pricing = calculate_price_cad(price_cny) if price_cny > 0 else {
                'cost_cad': 0, 'price_cad': 0, 'margin_standard': 0, 'margin_promo': 0, 'shipping_cny': 30
            }
            
            rows.append({
                'Product ID': p.get('product_id', ''),
                'Product Title (ZH)': p.get('title_zh', ''),
                'Product Title (EN)': p.get('title_en', ''),
                'URL': p.get('url', ''),
                'Variant Name (ZH)': v.get('variant_name_zh', ''),
                'Variant Name (EN)': v.get('variant_name_en', ''),
                'Option Type 1': v.get('option_type_1', ''),
                'Option Value 1': v.get('option_value_1', ''),
                'Option Type 2': v.get('option_type_2', ''),
                'Option Value 2': v.get('option_value_2', ''),
                'Price CNY': price_cny,
                'Shipping CNY': pricing['shipping_cny'],
                'Cost CAD': pricing['cost_cad'],
                'Price CAD': pricing['price_cad'],
                'Margin %': pricing['margin_standard'],
                'Margin Promo %': pricing['margin_promo'],
                'SKU Key': v.get('sku_key', ''),
                'In Stock': 'Yes' if v.get('in_stock', True) else 'No',
            })
    
    # Write CSV
    if rows:
        with open(CSV_OUTPUT, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        print(f"✅ Regenerated CSV: {len(rows)} variants")


def clean_outlier_variants(data: Dict) -> int:
    """Remove only the outlier variants from products, keeping the products intact"""
    cleaned_count = 0
    
    for product in data.get('products', []):
        variants = product.get('variants', [])
        in_stock = [v for v in variants if v.get('in_stock', True)]
        
        if not in_stock:
            continue
        
        prices = [v.get('price_cny', 0) for v in in_stock if v.get('price_cny', 0) > 0]
        
        if not prices:
            continue
        
        avg_price = sum(prices) / len(prices)
        
        # Mark outliers as out of stock (effectively removing them from export)
        cleaned = []
        for v in variants:
            price = v.get('price_cny', 0)
            is_outlier = False
            
            if price > 0 and v.get('in_stock', True):
                if price > avg_price * OUTLIER_MULTIPLIER:
                    is_outlier = True
                elif avg_price > 50 and price < avg_price / OUTLIER_MULTIPLIER:
                    is_outlier = True
            
            if is_outlier:
                v['in_stock'] = False
                v['removed_reason'] = f'price_outlier: ¥{price} vs avg ¥{avg_price:.0f}'
                cleaned_count += 1
            
            cleaned.append(v)
        
        product['variants'] = cleaned
    
    return cleaned_count


def main():
    parser = argparse.ArgumentParser(description='Scraper Quality Control')
    parser.add_argument('--clean', action='store_true', help='Remove bad products from JSON/CSV/media')
    parser.add_argument('--clean-variants', action='store_true', help='Remove only outlier variants (keeps products)')
    parser.add_argument('--separate-links', action='store_true', help='Create separate link files')
    parser.add_argument('--full', action='store_true', help='Do everything (analyze, separate, clean)')
    args = parser.parse_args()
    
    # Load data
    data = load_products()
    all_urls = load_links()
    
    # Analyze
    results = analyze_all(data)
    failed_urls = find_failed_urls(all_urls, data.get('products', []))
    
    # Print summary
    print_summary(results, failed_urls)
    
    # Separate links
    if args.separate_links or args.full:
        print("\n📁 SEPARATING LINKS...")
        separate_links(results, failed_urls)
    
    # Clean bad data
    if args.clean or args.full:
        print("\n🧹 CLEANING BAD DATA...")
        clean_bad_data(results)
    
    # Clean only outlier variants
    if args.clean_variants:
        print("\n🧹 CLEANING OUTLIER VARIANTS...")
        # Reload data since we modified results
        data = load_products()
        
        # Backup
        backup_json = JSON_OUTPUT.replace('.json', '_backup.json')
        shutil.copy(JSON_OUTPUT, backup_json)
        print(f"📦 Backed up original: {backup_json}")
        
        cleaned = clean_outlier_variants(data)
        
        # Save
        data['cleaned_variants'] = cleaned
        data['cleaned_at'] = datetime.now().isoformat()
        with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ Marked {cleaned} outlier variants as out-of-stock")
        
        # Regenerate CSV
        regenerate_csv(data['products'])
        print(f"✅ Regenerated CSV")
    
    # Suggest next steps
    print("\n" + "="*70)
    print("📋 NEXT STEPS")
    print("="*70)
    
    if not args.full:
        if not args.separate_links:
            print("1. Run with --separate-links to create categorized link files")
        if not args.clean:
            print("2. Run with --clean to remove bad data from outputs")
    
    redo_count = len(results['outliers']) + len(results['incomplete']) + len(failed_urls)
    if redo_count > 0:
        print(f"\n3. Re-scrape {redo_count} products:")
        print(f"   cp taobao_links_redo.txt taobao_links.txt")
        print(f"   python ai_scraper.py --batch-translate")
    
    if results['good']:
        print(f"\n4. Upload {len(results['good'])} good products to Knack:")
        print(f"   python upload_to_knack.py --dry-run")
        print(f"   python upload_to_knack.py --sync-media")


if __name__ == '__main__':
    main()
