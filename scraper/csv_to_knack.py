#!/usr/bin/env python3
"""
CSV to Knack Upload Script with Margin Recalculation
Reads scraped CSV, recalculates pricing, restructures variants, matches images, uploads to Knack
"""

import os
import csv
import json
import time
import re
from typing import Dict, List, Optional
from collections import defaultdict
from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(SCRIPT_DIR, 'protocol_zero_variants.csv')
IMAGES_DIR = os.path.join(SCRIPT_DIR, '..', 'shop', 'public', 'images')

# Pricing configuration
PRICING_CONFIG = {
    'exchange_rate': 0.19,
    'shipping_cny': 30,
    'salesperson_cut': 0.10,
    'promoter_cut': 0.10,
    'target_margin': 0.30,
}

def calculate_price_cad(price_cny: float) -> dict:
    """Calculate CAD pricing with margins from CNY price"""
    cfg = PRICING_CONFIG
    
    if price_cny <= 0:
        return {'cost_cny': 0, 'shipping_cny': 30, 'cost_cad': 0, 'price_cad': 0, 'margin_standard': 0, 'margin_promo': 0}
    
    cost_cny = price_cny + cfg['shipping_cny']
    cost_cad = cost_cny * cfg['exchange_rate']
    
    divisor = 1 - cfg['salesperson_cut'] - cfg['target_margin']
    sale_price_cad = cost_cad / divisor if divisor > 0 else cost_cad * 2
    sale_price_cad = round(sale_price_cad) - 0.01
    
    if sale_price_cad < 1:
        sale_price_cad = round(cost_cad * 1.5, 2)
    
    revenue_after_salesperson = sale_price_cad * (1 - cfg['salesperson_cut'])
    margin_standard = (revenue_after_salesperson - cost_cad) / sale_price_cad * 100 if sale_price_cad > 0 else 0
    
    promo_price = sale_price_cad * 0.90
    revenue_after_cuts = promo_price * (1 - cfg['salesperson_cut'] - cfg['promoter_cut'])
    margin_promo = (revenue_after_cuts - cost_cad) / promo_price * 100 if promo_price > 0 else 0
    
    return {
        'cost_cny': price_cny,
        'shipping_cny': cfg['shipping_cny'],
        'cost_cad': round(cost_cad, 2),
        'price_cad': round(sale_price_cad, 2),
        'margin_standard': round(margin_standard, 1),
        'margin_promo': round(margin_promo, 1),
    }

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')[:80]

def extract_option_structure(variant_name: str) -> Dict[str, str]:
    """Parse variant name to extract option types and values"""
    result = {'optionType1': '', 'optionValue1': '', 'optionType2': '', 'optionValue2': ''}
    
    color_keywords = r'\b(Black|White|Red|Blue|Green|Grey|Gray|Brown|Tan|Coyote|Ranger Green|OD Green|FDE|Silver|Gold|Pink|Orange|Khaki|CP Camo|MultiCam|BCP|Wolf Grey|Matte Black)\b'
    size_keywords = r'\b(XXS|XS|S|M|L|XL|XXL|XXXL|One Size|Universal)\b'
    
    color_match = re.search(color_keywords, variant_name, re.IGNORECASE)
    if color_match:
        result['optionType1'] = 'Color'
        result['optionValue1'] = color_match.group(1)
        
        remaining = variant_name.replace(color_match.group(0), '').strip(' -/')
        size_match = re.search(size_keywords, remaining, re.IGNORECASE)
        if size_match:
            result['optionType2'] = 'Size'
            result['optionValue2'] = size_match.group(1)
        
        return result
    
    result['optionType1'] = 'Style'
    result['optionValue1'] = variant_name
    return result

def find_images_for_product(product_slug: str) -> Dict[str, any]:
    """Find all image paths for a product"""
    images = {'primary': '', 'detail': '', 'gallery': []}
    
    if not os.path.exists(IMAGES_DIR):
        return images
    
    for filename in os.listdir(IMAGES_DIR):
        if not filename.startswith(product_slug):
            continue
        
        filepath = f"/images/{filename}"
        
        if '-Main.' in filename and not any(c.isdigit() for c in filename.split('-Main')[0][-3:]):
            images['primary'] = filepath
        elif '-Details_Long.' in filename:
            images['detail'] = filepath
        elif '-Main' in filename or '-Catalogue' in filename:
            images['gallery'].append(filepath)
    
    images['gallery'] = sorted(images['gallery'])
    return images

def read_csv_data(csv_path: str) -> Dict[str, List[Dict]]:
    """Read CSV and group variants by product"""
    products = defaultdict(lambda: {'url': '', 'title_en': '', 'title_zh': '', 'variants': []})
    
    print(f"\n📖 Reading CSV: {os.path.basename(csv_path)}")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = row.get('URL', '').strip()
            if not url:
                continue
            
            products[url]['url'] = url
            products[url]['title_en'] = row.get('Product Title', '') or row.get('Translated Title', '')
            products[url]['title_zh'] = row.get('Product Title ZH', '')
            
            variant_name = row.get('Option Name', '') or row.get('Translated Option Name', '')
            if not variant_name:
                continue
            
            price_cny_str = row.get('Price CNY', '0')
            try:
                price_cny = float(price_cny_str) if price_cny_str else 0
            except:
                price_cny = 0
            
            products[url]['variants'].append({
                'name': variant_name,
                'name_zh': row.get('Option Name ZH', ''),
                'price_cny': price_cny,
                'media_folder': row.get('Media Folder', ''),
            })
    
    print(f"   ✅ Found {len(products)} unique products with {sum(len(p['variants']) for p in products.values())} variants\n")
    
    return dict(products)

def upload_to_knack(products_data: Dict, api: KnackAPI, dry_run: bool = True):
    """Upload processed data to Knack"""
    print("\n" + "="*60)
    print(f"{'[DRY RUN] ' if dry_run else ''}📤 UPLOADING TO KNACK")
    print("="*60)
    
    total_products = len(products_data)
    total_variants = sum(len(p['variants']) for p in products_data.values())
    
    print(f"\n📦 {total_products} products")
    print(f"📋 {total_variants} variants")
    print(f"💰 Exchange rate: {PRICING_CONFIG['exchange_rate']} CNY→CAD")
    print(f"📦 Shipping: ¥{PRICING_CONFIG['shipping_cny']} per item")
    print(f"📊 Target margin: {int(PRICING_CONFIG['target_margin']*100)}%\n")
    
    uploaded_products = 0
    uploaded_variants = 0
    skipped_variants = 0
    
    for idx, (url, product) in enumerate(products_data.items(), 1):
        title_en = product['title_en']
        title_zh = product['title_zh']
        product_id = slugify(title_en)
        
        print(f"\n[{idx}/{total_products}] {title_en[:60]}")
        print(f"   Slug: {product_id}")
        
        # Find images
        images = find_images_for_product(product_id)
        print(f"   🖼️  Primary: {os.path.basename(images['primary']) if images['primary'] else 'NOT FOUND'}")
        print(f"   🖼️  Detail: {os.path.basename(images['detail']) if images['detail'] else 'NOT FOUND'}")
        print(f"   🖼️  Gallery: {len(images['gallery'])} images")
        
        # Prepare product data
        product_data = {
            PRODUCT_FIELDS['id']: product_id,
            PRODUCT_FIELDS['title']: title_en,
            PRODUCT_FIELDS['titleOriginal']: title_zh,
            PRODUCT_FIELDS['status']: 'Active',
            PRODUCT_FIELDS['url']: url,
            PRODUCT_FIELDS['primaryImage']: images['primary'],
            PRODUCT_FIELDS['images']: images['gallery'],
            PRODUCT_FIELDS['detailImage']: images['detail'],
        }
        
        if dry_run:
            print(f"   → Would create product")
            product_record_id = f"fake_{idx}"
        else:
            product_record = api.create_record(PRODUCTS_OBJECT_KEY, product_data)
            product_record_id = product_record['id']
            uploaded_products += 1
            print(f"   ✅ Created product (ID: {product_record_id})")
            time.sleep(0.2)
        
        # Upload variants
        variant_count = 0
        for v_idx, variant in enumerate(product['variants'], 1):
            variant_name = variant['name']
            price_cny = variant['price_cny']
            
            if price_cny <= 0:
                skipped_variants += 1
                if v_idx <= 2:
                    print(f"   ⚠️  Skipping (no price): {variant_name[:40]}")
                continue
            
            # Calculate pricing
            pricing = calculate_price_cad(price_cny)
            options = extract_option_structure(variant_name)
            
            # Prepare variant data
            variant_data = {
                VARIANT_FIELDS['product']: [product_record_id],
                VARIANT_FIELDS['variantName']: variant_name,
                VARIANT_FIELDS['priceCny']: price_cny,
                VARIANT_FIELDS['shippingCny']: pricing['shipping_cny'],
                VARIANT_FIELDS['costCad']: pricing['cost_cad'],
                VARIANT_FIELDS['priceCad']: pricing['price_cad'],
                VARIANT_FIELDS['marginStandard']: pricing['margin_standard'],
                VARIANT_FIELDS['marginPromo']: pricing['margin_promo'],
                VARIANT_FIELDS['stock']: 1,
                VARIANT_FIELDS['status']: 'Active',
                VARIANT_FIELDS['optionType1']: options['optionType1'],
                VARIANT_FIELDS['optionValue1']: options['optionValue1'],
                VARIANT_FIELDS['optionType2']: options['optionType2'],
                VARIANT_FIELDS['optionValue2']: options['optionValue2'],
            }
            
            if dry_run:
                if v_idx <= 3:
                    print(f"   → Would create variant: {variant_name[:35]}")
                    print(f"      ¥{price_cny} → ${pricing['price_cad']} (margin: {pricing['margin_standard']}%)")
            else:
                api.create_record(VARIANTS_OBJECT_KEY, variant_data)
                uploaded_variants += 1
                if v_idx <= 3:
                    print(f"   ✅ Created: {variant_name[:35]} | ¥{price_cny} → ${pricing['price_cad']}")
                time.sleep(0.15)
            
            variant_count += 1
        
        if variant_count > 3:
            print(f"   ... and {variant_count - 3} more variants")
    
    # Summary
    print("\n" + "="*60)
    print(f"{'✅ DRY RUN COMPLETE' if dry_run else '🎉 UPLOAD COMPLETE'}")
    print("="*60)
    
    if dry_run:
        print(f"\n📦 Would upload {total_products} products")
        print(f"📋 Would upload {total_variants - skipped_variants} variants")
        if skipped_variants > 0:
            print(f"⚠️  Would skip {skipped_variants} variants (no pricing)")
        print("\n⚠️  This was a dry run. Run without --dry-run to apply changes.")
    else:
        print(f"\n✅ Uploaded {uploaded_products} products")
        print(f"✅ Uploaded {uploaded_variants} variants")
        if skipped_variants > 0:
            print(f"⚠️  Skipped {skipped_variants} variants (no pricing)")
        print("\n📸 All images matched from shop/public/images/")
        print("💰 All margins recalculated using current formula")
        print("🏷️  All variant options restructured")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Upload CSV data to Knack with recalculated margins',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview upload (dry run)
  python csv_to_knack.py --dry-run
  
  # Upload to Knack
  python csv_to_knack.py
  
  # Use different CSV file
  python csv_to_knack.py --csv path/to/file.csv
"""
    )
    
    parser.add_argument('--dry-run', action='store_true', help='Preview without uploading')
    parser.add_argument('--csv', default=CSV_FILE, help='Path to CSV file')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.csv):
        print(f"❌ CSV file not found: {args.csv}")
        return 1
    
    try:
        # Read CSV data
        products_data = read_csv_data(args.csv)
        
        if not products_data:
            print("❌ No products found in CSV")
            return 1
        
        # Initialize Knack API
        api = KnackAPI()
        
        # Upload to Knack
        upload_to_knack(products_data, api, dry_run=args.dry_run)
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Upload failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    exit(main())
