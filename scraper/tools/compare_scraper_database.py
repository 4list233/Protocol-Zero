"""
Compare Scraped Products vs Knack Database

Compares the locally scraped products.json with what's in the Knack database
to identify:
- New products (in scraper but not in database)
- Existing products (in both)
- Deleted products (in database but not in scraper)
- Variant count differences
- Price differences
- Status differences

Usage:
    python3 compare_scraper_database.py
    python3 compare_scraper_database.py --detailed    # Show all differences
    python3 compare_scraper_database.py --csv         # Export to CSV
"""

import os
import sys
import json
import csv
import re
from datetime import datetime
from typing import Dict, List, Set, Tuple
from collections import defaultdict

from knack_integration import KnackAPI, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY
from dotenv import load_dotenv

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRAPED_PRODUCTS_FILE = os.path.join(SCRIPT_DIR, 'ai_scraper_output', 'products.json')

# ============================================================================
# COMPARISON LOGIC
# ============================================================================

def load_scraped_products() -> Dict[str, Dict]:
    """Load scraped products from JSON file"""
    if not os.path.exists(SCRAPED_PRODUCTS_FILE):
        print(f"❌ Scraped products file not found: {SCRAPED_PRODUCTS_FILE}")
        print("   Run ai_scraper.py first to generate products.json")
        sys.exit(1)
    
    with open(SCRAPED_PRODUCTS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle both formats: {"products": [...]} or [...]
    if isinstance(data, dict) and 'products' in data:
        products = data['products']
    elif isinstance(data, list):
        products = data
    else:
        products = []
    
    # Index by product_id
    indexed = {}
    for product in products:
        product_id = product.get('product_id')
        if product_id:
            indexed[product_id] = product
    
    return indexed


def load_database_products(api: KnackAPI) -> Tuple[Dict[str, Dict], Dict[str, List[Dict]]]:
    """Load products and variants from Knack database"""
    print("📡 Fetching products from Knack database...")
    db_products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    
    print("📡 Fetching variants from Knack database...")
    db_variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    
    # Index products by product_id (extract from URL)
    products_indexed = {}
    for product in db_products:
        # Extract product ID from field_55 (URL field)
        url_data = product.get('field_55_raw', {})
        url = url_data.get('url', '') if isinstance(url_data, dict) else str(url_data)
        
        # Extract ID from Taobao URL
        match = re.search(r'id=(\d+)', url)
        if match:
            product_id = match.group(1)
            products_indexed[product_id] = product
    
    # Index variants by product_id  
    variants_by_product = defaultdict(list)
    for variant in db_variants:
        # field_46 is the connection to Products
        product_connection = variant.get('field_46')
        if product_connection:
            # Get the Knack record ID
            knack_id = product_connection[0].get('id') if isinstance(product_connection, list) else None
            if knack_id:
                # Find which product_id this belongs to
                for pid, prod in products_indexed.items():
                    if prod.get('id') == knack_id:
                        variants_by_product[pid].append(variant)
                        break
    
    return products_indexed, variants_by_product


def compare_products(scraped: Dict[str, Dict], db_products: Dict[str, Dict], db_variants: Dict[str, List[Dict]]) -> Dict:
    """Compare scraped vs database products"""
    
    scraped_ids = set(scraped.keys())
    db_ids = set(db_products.keys())
    
    # Classification
    new_products = scraped_ids - db_ids
    existing_products = scraped_ids & db_ids
    deleted_products = db_ids - scraped_ids
    
    # Detailed comparison for existing products
    differences = []
    
    for product_id in existing_products:
        s_product = scraped[product_id]
        d_product = db_products[product_id]
        d_variants = db_variants.get(product_id, [])
        
        s_name = s_product.get('name_en', 'N/A')
        s_variant_count = len(s_product.get('variants', []))
        d_variant_count = len(d_variants)
        
        d_status = d_product.get('field_93', 'N/A')  # Status field
        
        diff = {
            'product_id': product_id,
            'name': s_name,
            'scraped_variants': s_variant_count,
            'db_variants': d_variant_count,
            'variant_diff': s_variant_count - d_variant_count,
            'db_status': d_status,
        }
        
        # Check price differences (sample first variant)
        if s_product.get('variants') and d_variants:
            s_price = s_product['variants'][0].get('price_rmb', 0)
            d_price = float(d_variants[0].get('field_49', 0))  # Price RMB field
            diff['scraped_price'] = s_price
            diff['db_price'] = d_price
            diff['price_diff'] = s_price - d_price
        
        if diff['variant_diff'] != 0 or (diff.get('price_diff', 0) != 0):
            differences.append(diff)
    
    return {
        'new_products': sorted(list(new_products)),
        'existing_products': sorted(list(existing_products)),
        'deleted_products': sorted(list(deleted_products)),
        'differences': differences,
        'summary': {
            'total_scraped': len(scraped_ids),
            'total_database': len(db_ids),
            'new': len(new_products),
            'existing': len(existing_products),
            'deleted': len(deleted_products),
            'modified': len(differences)
        }
    }


def print_comparison_report(comparison: Dict, scraped: Dict[str, Dict], db_products: Dict[str, Dict], detailed: bool = False):
    """Print human-readable comparison report"""
    
    summary = comparison['summary']
    
    print("\n" + "="*70)
    print("📊 SCRAPER vs DATABASE COMPARISON REPORT")
    print("="*70)
    
    print(f"\n📈 SUMMARY:")
    print(f"   Scraped Products:  {summary['total_scraped']}")
    print(f"   Database Products: {summary['total_database']}")
    print(f"   ✨ New:            {summary['new']}")
    print(f"   ✅ Existing:       {summary['existing']}")
    print(f"   🔄 Modified:       {summary['modified']}")
    print(f"   🗑️  Deleted:        {summary['deleted']}")
    
    # New Products
    if comparison['new_products']:
        print(f"\n✨ NEW PRODUCTS ({len(comparison['new_products'])}):")
        print("-" * 70)
        for product_id in comparison['new_products'][:10]:  # Show first 10
            product = scraped.get(product_id, {})
            name = product.get('name_en', 'N/A')
            variants = len(product.get('variants', []))
            print(f"   {product_id}: {name}")
            print(f"      Variants: {variants}")
        
        if len(comparison['new_products']) > 10:
            print(f"   ... and {len(comparison['new_products']) - 10} more")
    
    # Modified Products
    if comparison['differences']:
        print(f"\n🔄 MODIFIED PRODUCTS ({len(comparison['differences'])}):")
        print("-" * 70)
        for diff in comparison['differences'][:10]:  # Show first 10
            print(f"   {diff['product_id']}: {diff['name']}")
            print(f"      Variants: {diff['scraped_variants']} (scraped) vs {diff['db_variants']} (database)")
            if 'price_diff' in diff and diff['price_diff'] != 0:
                print(f"      Price: ¥{diff['scraped_price']} (scraped) vs ¥{diff['db_price']} (database)")
            print(f"      Database Status: {diff['db_status']}")
        
        if len(comparison['differences']) > 10:
            print(f"   ... and {len(comparison['differences']) - 10} more")
    
    # Deleted Products
    if comparison['deleted_products']:
        print(f"\n🗑️  DELETED PRODUCTS ({len(comparison['deleted_products'])}):")
        print("-" * 70)
        print("   (In database but not in scraper)")
        for product_id in comparison['deleted_products'][:10]:  # Show first 10
            product = db_products.get(product_id, {})
            name = product.get('field_77', 'N/A')  # name_en field
            status = product.get('field_93', 'N/A')
            print(f"   {product_id}: {name} (Status: {status})")
        
        if len(comparison['deleted_products']) > 10:
            print(f"   ... and {len(comparison['deleted_products']) - 10} more")
    
    print("\n" + "="*70)
    
    if detailed and comparison['differences']:
        print("\n📋 DETAILED DIFFERENCES:")
        print("="*70)
        for diff in comparison['differences']:
            print(f"\n{diff['product_id']}: {diff['name']}")
            print(f"  Scraped Variants: {diff['scraped_variants']}")
            print(f"  Database Variants: {diff['db_variants']}")
            print(f"  Difference: {diff['variant_diff']:+d}")
            if 'price_diff' in diff:
                print(f"  Scraped Price: ¥{diff['scraped_price']}")
                print(f"  Database Price: ¥{diff['db_price']}")
                print(f"  Price Diff: ¥{diff['price_diff']:+.2f}")
            print(f"  Database Status: {diff['db_status']}")


def export_csv(comparison: Dict, scraped: Dict[str, Dict], db_products: Dict[str, Dict]):
    """Export comparison to CSV"""
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    csv_file = os.path.join(SCRIPT_DIR, f'comparison_report_{timestamp}.csv')
    
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Product ID', 'Name', 'Status', 'Scraped Variants', 'DB Variants', 'Variant Diff', 'Scraped Price', 'DB Price', 'Price Diff'])
        
        # New products
        for product_id in comparison['new_products']:
            product = scraped.get(product_id, {})
            name = product.get('name_en', 'N/A')
            variants = len(product.get('variants', []))
            price = product.get('variants', [{}])[0].get('price_rmb', 0) if product.get('variants') else 0
            writer.writerow([product_id, name, 'NEW', variants, 0, variants, price, 0, price])
        
        # Modified products
        for diff in comparison['differences']:
            writer.writerow([
                diff['product_id'],
                diff['name'],
                'MODIFIED',
                diff['scraped_variants'],
                diff['db_variants'],
                diff['variant_diff'],
                diff.get('scraped_price', 'N/A'),
                diff.get('db_price', 'N/A'),
                diff.get('price_diff', 'N/A')
            ])
        
        # Deleted products
        for product_id in comparison['deleted_products']:
            product = db_products.get(product_id, {})
            name = product.get('field_77', 'N/A')
            writer.writerow([product_id, name, 'DELETED', 0, 'Unknown', 0, 0, 0, 0])
    
    print(f"\n📄 CSV report exported to: {csv_file}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Compare scraped products with Knack database')
    parser.add_argument('--detailed', action='store_true', help='Show detailed differences')
    parser.add_argument('--csv', action='store_true', help='Export to CSV')
    args = parser.parse_args()
    
    # Load environment
    load_dotenv()
    
    # Initialize Knack API
    api = KnackAPI()
    
    # Load data
    print("📦 Loading scraped products...")
    scraped = load_scraped_products()
    print(f"   ✅ Loaded {len(scraped)} scraped products")
    
    db_products, db_variants = load_database_products(api)
    print(f"   ✅ Loaded {len(db_products)} database products")
    print(f"   ✅ Loaded {sum(len(v) for v in db_variants.values())} database variants")
    
    # Compare
    print("\n🔍 Comparing...")
    comparison = compare_products(scraped, db_products, db_variants)
    
    # Report
    print_comparison_report(comparison, scraped, db_products, detailed=args.detailed)
    
    if args.csv:
        export_csv(comparison, scraped, db_products)


if __name__ == '__main__':
    main()
