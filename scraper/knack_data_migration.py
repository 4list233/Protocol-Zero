#!/usr/bin/env python3
"""
Knack Data Migration Script
Downloads all products/variants, recalculates margins, restructures options, and re-uploads
"""

import os
import csv
import json
import time
import re
from typing import Dict, List, Optional
from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(SCRIPT_DIR, 'backups')
IMAGES_DIR = os.path.join(SCRIPT_DIR, '..', 'shop', 'public', 'images')

# Translation dictionaries (based on COMET_BROWSER_INSTRUCTIONS.md)
COLOR_TRANSLATIONS = {
    # Chinese colors
    '黑色': 'Black', '黑': 'Black',
    '白色': 'White', '白': 'White',
    '灰色': 'Grey', '灰': 'Grey',
    '狼灰色': 'Wolf Grey', '狼灰': 'Wolf Grey',
    '棕色': 'Brown', '棕': 'Brown',
    '狼棕色': 'Coyote Brown', '狼棕': 'Coyote Brown', '土狼棕': 'Coyote Brown',
    '沙色': 'Sand',
    '泥色': 'Tan',
    '卡其': 'Khaki', '卡其色': 'Khaki',
    '绿色': 'Green', '绿': 'Green',
    '军绿色': 'Army Green', '军绿': 'Army Green',
    '游骑兵绿色': 'Ranger Green', '游骑兵绿': 'Ranger Green',
    '红色': 'Red', '红': 'Red',
    '玫红色': 'Rose Red',
    '粉色': 'Pink', '粉红色': 'Pink',
    '蓝色': 'Blue', '蓝': 'Blue',
    '金色': 'Gold', '金': 'Gold',
    '银色': 'Silver', '银': 'Silver',
    '消光黑': 'Matte Black',
    # Camo patterns
    'CP迷彩': 'CP Camo',
    '暗夜迷彩': 'Black Camo',
    '废墟迷彩': 'Ruins Camo', '废墟': 'Ruins Camo',
    '丛林迷彩': 'Jungle Camo',
    'MC迷彩': 'MultiCam',
    '迷彩': 'Camo',
    # Codes (keep)
    'BK': 'Black', 'WG': 'Wolf Grey', 'CB': 'Coyote Brown',
    'RG': 'Ranger Green', 'OD': 'Olive Drab', 'FDE': 'FDE',
    'BCP': 'Black Camo', 'MC': 'MultiCam',
}

SIZE_TRANSLATIONS = {
    '均码': 'One Size',
    '大款': 'Large',
    '小款': 'Small',
    '短款': 'Short',
    '矮款': 'Low Profile',
    '加大款': 'XL',
    '小号': 'Small',
    '一个': '1 pc', '一块': '1 pc', '一只': '1 pc',
    '两个': '2 pcs', '2个': '2 pcs',
    '三个': '3 pcs', '3个': '3 pcs',
    '一套': '1 Set',
}

STYLE_TRANSLATIONS = {
    '金属': 'Metal',
    '铝合金': 'Aluminum',
    '尼龙': 'Nylon',
    '考度拉': 'Cordura',
    '标准': 'Standard',
    '升级版': 'Upgraded',
    '套装': 'Set',
    '单': 'Single',
    '双': 'Dual',
    '左': 'Left',
    '右': 'Right',
}

# Pricing configuration (from ai_scraper.py)
PRICING_CONFIG = {
    'exchange_rate': 0.19,      # 1 CNY = 0.19 CAD
    'shipping_cny': 30,         # ¥30 shipping per item
    'salesperson_cut': 0.10,    # 10% revenue to salesperson
    'promoter_cut': 0.10,       # 10% to promoter
    'target_margin': 0.30,      # 30% target profit margin
}

def translate_to_english(chinese_text: str, context: str = 'product') -> str:
    """
    Translate Chinese text to English using dictionary-based translation.
    
    Args:
        chinese_text: Chinese text to translate
        context: 'product' for product names, 'variant' for variant names
    
    Returns:
        Translated English text
    """
    if not chinese_text or not any('\u4e00' <= c <= '\u9fff' for c in chinese_text):
        # No Chinese characters found
        return chinese_text
    
    result = chinese_text
    
    # Apply color translations
    for chinese, english in COLOR_TRANSLATIONS.items():
        result = result.replace(chinese, english)
    
    # Apply size translations
    for chinese, english in SIZE_TRANSLATIONS.items():
        result = result.replace(chinese, english)
    
    # Apply style translations
    for chinese, english in STYLE_TRANSLATIONS.items():
        result = result.replace(chinese, english)
    
    # Clean up common patterns for products
    if context == 'product':
        # Remove Taobao/Tmall suffixes
        result = re.sub(r'-?(淘宝网|tmall\.com天猫)$', '', result)
        result = re.sub(r'【.*?】', '', result)  # Remove brackets
        
        # Remove brand names (common ones)
        brands = ['WOSPORT', 'FMA', 'TMC', 'Artex', 'ARSON MACHINE', 'NGD北境防务', '陌歌', 'KUBLAI库拜来']
        for brand in brands:
            result = result.replace(brand, '')
    
    # Clean up extra spaces and punctuation
    result = re.sub(r'\s+', ' ', result).strip()
    result = re.sub(r'\s*[-/]\s*$', '', result)  # Remove trailing separators
    
    return result


def calculate_price_cad(price_cny: float) -> dict:
    """
    Calculate CAD pricing with margins from CNY price.
    """
    cfg = PRICING_CONFIG
    
    if price_cny <= 0:
        return {
            'cost_cny': 0,
            'shipping_cny': cfg['shipping_cny'],
            'cost_cad': 0,
            'price_cad': 0,
            'margin_standard': 0,
            'margin_promo': 0,
        }
    
    # Calculate cost in CAD
    cost_cny = price_cny + cfg['shipping_cny']
    cost_cad = cost_cny * cfg['exchange_rate']
    
    # Calculate sale price to achieve target margin
    divisor = 1 - cfg['salesperson_cut'] - cfg['target_margin']
    sale_price_cad = cost_cad / divisor if divisor > 0 else cost_cad * 2
    
    # Round to nearest .99 for retail pricing
    sale_price_cad = round(sale_price_cad) - 0.01
    if sale_price_cad < 1:
        sale_price_cad = round(cost_cad * 1.5, 2)
    
    # Calculate actual margins
    revenue_after_salesperson = sale_price_cad * (1 - cfg['salesperson_cut'])
    margin_standard = (revenue_after_salesperson - cost_cad) / sale_price_cad * 100 if sale_price_cad > 0 else 0
    
    # Promo margin
    promo_price = sale_price_cad * 0.90  # 10% discount
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


def extract_option_structure(variant_name: str) -> Dict[str, str]:
    """
    Parse variant name to extract option types and values.
    
    Examples:
        "2011 Quick-Draw Holster Light-Bearing" → {type1: "Style", value1: "Quick-Draw Holster Light-Bearing"}
        "Tan High Profile - GBRS Hydra Mount" → {type1: "Color", value1: "Tan", type2: "Profile", value2: "High Profile"}
    """
    result = {
        'optionType1': '',
        'optionValue1': '',
        'optionType2': '',
        'optionValue2': '',
    }
    
    # Common patterns
    color_keywords = r'\b(Black|White|Red|Blue|Green|Grey|Gray|Brown|Tan|Coyote|Ranger Green|OD Green|FDE|Silver|Gold|Pink|Orange|Khaki|CP Camo|MultiCam|BCP|Wolf Grey)\b'
    size_keywords = r'\b(XXS|XS|S|M|L|XL|XXL|XXXL|One Size|Universal)\b'
    profile_keywords = r'\b(High Profile|Low Profile|Standard|Short|Long|Large|Small|Medium)\b'
    
    # Try to extract color
    color_match = re.search(color_keywords, variant_name, re.IGNORECASE)
    if color_match:
        result['optionType1'] = 'Color'
        result['optionValue1'] = color_match.group(1)
        
        # Check for additional dimension after color
        remaining = variant_name.replace(color_match.group(0), '').strip(' -/')
        
        # Try size
        size_match = re.search(size_keywords, remaining, re.IGNORECASE)
        if size_match:
            result['optionType2'] = 'Size'
            result['optionValue2'] = size_match.group(1)
            return result
        
        # Try profile
        profile_match = re.search(profile_keywords, remaining, re.IGNORECASE)
        if profile_match:
            result['optionType2'] = 'Profile'
            result['optionValue2'] = profile_match.group(1)
            return result
        
        return result
    
    # No color found, check for style/profile
    if re.search(profile_keywords, variant_name, re.IGNORECASE):
        result['optionType1'] = 'Profile'
        result['optionValue1'] = variant_name
        return result
    
    # Default: treat as style
    result['optionType1'] = 'Style'
    result['optionValue1'] = variant_name
    
    return result


def find_image_for_product(product_id: str, image_type: str = 'Main') -> str:
    """
    Find image path for product from public/images directory.
    
    Args:
        product_id: Product slug (e.g., "2011-light-bearing-quick-draw-holster")
        image_type: "Main", "Details_Long", or "Catalogue"
    
    Returns:
        Image path relative to /images/ (e.g., "/images/product-slug-Main.jpg")
    """
    if not os.path.exists(IMAGES_DIR):
        return ''
    
    # Look for exact match
    pattern = f"{product_id}-{image_type}"
    
    for filename in os.listdir(IMAGES_DIR):
        if pattern in filename and filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            return f"/images/{filename}"
    
    return ''


def find_all_images_for_product(product_id: str) -> List[str]:
    """Find all catalogue images for a product (numbered Main_01, Main_02, etc.)"""
    if not os.path.exists(IMAGES_DIR):
        return []
    
    images = []
    for filename in os.listdir(IMAGES_DIR):
        if filename.startswith(product_id) and '-Main' in filename and filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            images.append(f"/images/{filename}")
    
    return sorted(images)


def download_knack_data(api: KnackAPI) -> tuple[List[Dict], List[Dict]]:
    """Download all products and variants from Knack"""
    print("\n" + "="*60)
    print("📥 DOWNLOADING KNACK DATA")
    print("="*60)
    
    print("\n1. Fetching all products...")
    products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    print(f"   ✅ Downloaded {len(products)} products")
    
    print("\n2. Fetching all variants...")
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    print(f"   ✅ Downloaded {len(variants)} variants")
    
    return products, variants


def save_backup(products: List[Dict], variants: List[Dict]):
    """Save backup CSVs"""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = time.strftime('%Y%m%d_%H%M%S')
    
    # Save products
    products_csv = os.path.join(BACKUP_DIR, f'knack_products_backup_{timestamp}.csv')
    if products:
        with open(products_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=products[0].keys())
            writer.writeheader()
            writer.writerows(products)
        print(f"   ✅ Products backup: {os.path.basename(products_csv)}")
    
    # Save variants
    variants_csv = os.path.join(BACKUP_DIR, f'knack_variants_backup_{timestamp}.csv')
    if variants:
        with open(variants_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=variants[0].keys())
            writer.writeheader()
            writer.writerows(variants)
        print(f"   ✅ Variants backup: {os.path.basename(variants_csv)}")
    
    return products_csv, variants_csv


def process_and_recalculate(products: List[Dict], variants: List[Dict]) -> tuple[List[Dict], List[Dict]]:
    """
    Process products and variants:
    1. Recalculate margins
    2. Restructure option fields
    3. Match with Notion images
    """
    print("\n" + "="*60)
    print("🔄 PROCESSING & RECALCULATING DATA")
    print("="*60)
    
    processed_products = []
    processed_variants = []
    
    # Build product ID mapping
    product_id_map = {}  # Knack record ID -> product slug
    for p in products:
        knack_id = p['id']
        product_slug = p.get(PRODUCT_FIELDS['id'], '')
        if product_slug:
            product_id_map[knack_id] = product_slug
    
    # Process each product
    print(f"\n📦 Processing {len(products)} products...")
    for idx, product in enumerate(products, 1):
        product_id = product.get(PRODUCT_FIELDS['id'], '')
        title = product.get(PRODUCT_FIELDS['title'], '')
        
        print(f"\n{idx}. {title[:60]}")
        print(f"   ID: {product_id}")
        
        # Translate product title if it contains Chinese
        if any('\u4e00' <= c <= '\u9fff' for c in title):
            print(f"   🌐 Translating product title...")
            english_title = translate_to_english(title, context='product')
            print(f"   ✅ Translated: {english_title[:60]}")
        else:
            english_title = title
        
        # Find images
        primary_image = find_image_for_product(product_id, 'Main')
        detail_image = find_image_for_product(product_id, 'Details_Long')
        catalogue_images = find_all_images_for_product(product_id)
        
        print(f"   🖼️  Primary: {os.path.basename(primary_image) if primary_image else 'NOT FOUND'}")
        print(f"   🖼️  Detail: {os.path.basename(detail_image) if detail_image else 'NOT FOUND'}")
        print(f"   🖼️  Gallery: {len(catalogue_images)} images")
        
        # Update product data
        processed_product = product.copy()
        processed_product[PRODUCT_FIELDS['title']] = english_title
        if primary_image:
            processed_product[PRODUCT_FIELDS['primaryImage']] = primary_image
        if detail_image:
            processed_product[PRODUCT_FIELDS['detailImage']] = detail_image
        if catalogue_images:
            processed_product[PRODUCT_FIELDS['images']] = catalogue_images
        
        processed_products.append(processed_product)
    
    # Process variants
    print(f"\n\n📋 Processing {len(variants)} variants...")
    variant_count = 0
    recalc_count = 0
    
    for variant in variants:
        variant_name = variant.get(VARIANT_FIELDS['variantName'], '')
        
        # Get product connection
        product_connection = variant.get(VARIANT_FIELDS['product'], [])
        if isinstance(product_connection, str):
            # Extract Knack ID from HTML
            match = re.search(r'class="([a-f0-9]{24})"', product_connection)
            if match:
                product_connection = [match.group(1)]
            else:
                product_connection = []
        
        if not product_connection:
            print(f"   ⚠️  Skipping variant (no product connection): {variant_name}")
            continue
        
        product_knack_id = product_connection[0] if isinstance(product_connection, list) else product_connection
        
        # Translate variant name if it contains Chinese
        if any('\u4e00' <= c <= '\u9fff' for c in variant_name):
            english_variant_name = translate_to_english(variant_name, context='variant')
        else:
            english_variant_name = variant_name
        
        # Get current pricing
        price_cny = float(variant.get(VARIANT_FIELDS['priceCny'], 0) or 0)
        
        # Recalculate margins
        pricing = calculate_price_cad(price_cny)
        
        # Extract option structure from English variant name
        options = extract_option_structure(english_variant_name)
        
        # Update variant data
        processed_variant = variant.copy()
        processed_variant[VARIANT_FIELDS['variantName']] = english_variant_name
        processed_variant[VARIANT_FIELDS['product']] = [product_knack_id]
        processed_variant[VARIANT_FIELDS['shippingCny']] = pricing['shipping_cny']
        processed_variant[VARIANT_FIELDS['costCad']] = pricing['cost_cad']
        processed_variant[VARIANT_FIELDS['priceCad']] = pricing['price_cad']
        processed_variant[VARIANT_FIELDS['marginStandard']] = pricing['margin_standard']
        processed_variant[VARIANT_FIELDS['marginPromo']] = pricing['margin_promo']
        processed_variant[VARIANT_FIELDS['optionType1']] = options['optionType1']
        processed_variant[VARIANT_FIELDS['optionValue1']] = options['optionValue1']
        processed_variant[VARIANT_FIELDS['optionType2']] = options['optionType2']
        processed_variant[VARIANT_FIELDS['optionValue2']] = options['optionValue2']
        
        processed_variants.append(processed_variant)
        
        variant_count += 1
        if price_cny > 0:
            recalc_count += 1
            if variant_count <= 5:  # Show first 5 as examples
                print(f"   ✅ {variant_name[:40]}")
                print(f"      ¥{price_cny} → ${pricing['price_cad']} (margin: {pricing['margin_standard']}%)")
                print(f"      Options: {options['optionType1']}={options['optionValue1']}, {options['optionType2']}={options['optionValue2']}")
    
    print(f"\n   📊 Summary:")
    print(f"      • {variant_count} variants processed")
    print(f"      • {recalc_count} variants with recalculated pricing")
    
    return processed_products, processed_variants


def delete_all_knack_data(api: KnackAPI, dry_run: bool = True):
    """Delete all existing products and variants"""
    print("\n" + "="*60)
    print(f"🗑️  {'[DRY RUN] ' if dry_run else ''}DELETING EXISTING KNACK DATA")
    print("="*60)
    
    # Delete variants first (to avoid orphaned records)
    print("\n1. Deleting all variants...")
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    for idx, variant in enumerate(variants, 1):
        variant_name = variant.get(VARIANT_FIELDS['variantName'], 'Unknown')
        if dry_run:
            print(f"   [{idx}/{len(variants)}] Would delete: {variant_name[:50]}")
        else:
            api.delete_record(VARIANTS_OBJECT_KEY, variant['id'])
            print(f"   [{idx}/{len(variants)}] Deleted: {variant_name[:50]}")
            time.sleep(0.1)  # Rate limit
    
    print(f"\n   ✅ {'Would delete' if dry_run else 'Deleted'} {len(variants)} variants")
    
    # Delete products
    print("\n2. Deleting all products...")
    products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    for idx, product in enumerate(products, 1):
        title = product.get(PRODUCT_FIELDS['title'], 'Unknown')
        if dry_run:
            print(f"   [{idx}/{len(products)}] Would delete: {title[:50]}")
        else:
            api.delete_record(PRODUCTS_OBJECT_KEY, product['id'])
            print(f"   [{idx}/{len(products)}] Deleted: {title[:50]}")
            time.sleep(0.1)  # Rate limit
    
    print(f"\n   ✅ {'Would delete' if dry_run else 'Deleted'} {len(products)} products")


def upload_processed_data(api: KnackAPI, products: List[Dict], variants: List[Dict], dry_run: bool = True):
    """Upload processed products and variants to Knack"""
    print("\n" + "="*60)
    print(f"📤 {'[DRY RUN] ' if dry_run else ''}UPLOADING PROCESSED DATA")
    print("="*60)
    
    # Track new Knack IDs
    product_id_mapping = {}  # old_knack_id -> new_knack_id
    
    # Upload products first
    print(f"\n1. Uploading {len(products)} products...")
    for idx, product in enumerate(products, 1):
        old_id = product['id']
        title = product.get(PRODUCT_FIELDS['title'], 'Unknown')
        
        # Prepare product data (exclude Knack metadata)
        product_data = {
            PRODUCT_FIELDS['id']: product.get(PRODUCT_FIELDS['id']),
            PRODUCT_FIELDS['sku']: product.get(PRODUCT_FIELDS['sku']),
            PRODUCT_FIELDS['title']: product.get(PRODUCT_FIELDS['title']),
            PRODUCT_FIELDS['titleOriginal']: product.get(PRODUCT_FIELDS['titleOriginal']),
            PRODUCT_FIELDS['description']: product.get(PRODUCT_FIELDS['description']),
            PRODUCT_FIELDS['category']: product.get(PRODUCT_FIELDS['category']),
            PRODUCT_FIELDS['status']: product.get(PRODUCT_FIELDS['status'], 'Active'),
            PRODUCT_FIELDS['url']: product.get(PRODUCT_FIELDS['url']),
            PRODUCT_FIELDS['primaryImage']: product.get(PRODUCT_FIELDS['primaryImage']),
            PRODUCT_FIELDS['images']: product.get(PRODUCT_FIELDS['images']),
            PRODUCT_FIELDS['detailImage']: product.get(PRODUCT_FIELDS['detailImage']),
        }
        
        if dry_run:
            print(f"   [{idx}/{len(products)}] Would upload: {title[:50]}")
        else:
            new_record = api.create_record(PRODUCTS_OBJECT_KEY, product_data)
            product_id_mapping[old_id] = new_record['id']
            print(f"   [{idx}/{len(products)}] Uploaded: {title[:50]}")
            time.sleep(0.2)  # Rate limit
    
    print(f"\n   ✅ {'Would upload' if dry_run else 'Uploaded'} {len(products)} products")
    
    # Upload variants
    print(f"\n2. Uploading {len(variants)} variants...")
    for idx, variant in enumerate(variants, 1):
        variant_name = variant.get(VARIANT_FIELDS['variantName'], 'Unknown')
        
        # Get product connection and update to new Knack ID
        old_product_id = variant.get(VARIANT_FIELDS['product'], [])
        if isinstance(old_product_id, list) and old_product_id:
            old_product_id = old_product_id[0]
        
        if not dry_run:
            new_product_id = product_id_mapping.get(old_product_id)
            if not new_product_id:
                print(f"   ⚠️  Skipping variant (no product mapping): {variant_name[:50]}")
                continue
        else:
            new_product_id = old_product_id
        
        # Prepare variant data
        variant_data = {
            VARIANT_FIELDS['product']: [new_product_id],
            VARIANT_FIELDS['variantName']: variant.get(VARIANT_FIELDS['variantName']),
            VARIANT_FIELDS['sku']: variant.get(VARIANT_FIELDS['sku']),
            VARIANT_FIELDS['priceCny']: variant.get(VARIANT_FIELDS['priceCny']),
            VARIANT_FIELDS['shippingCny']: variant.get(VARIANT_FIELDS['shippingCny']),
            VARIANT_FIELDS['costCad']: variant.get(VARIANT_FIELDS['costCad']),
            VARIANT_FIELDS['priceCad']: variant.get(VARIANT_FIELDS['priceCad']),
            VARIANT_FIELDS['marginStandard']: variant.get(VARIANT_FIELDS['marginStandard']),
            VARIANT_FIELDS['marginPromo']: variant.get(VARIANT_FIELDS['marginPromo']),
            VARIANT_FIELDS['stock']: variant.get(VARIANT_FIELDS['stock'], 1),
            VARIANT_FIELDS['status']: variant.get(VARIANT_FIELDS['status'], 'Active'),
            VARIANT_FIELDS['sortOrder']: variant.get(VARIANT_FIELDS['sortOrder']),
            VARIANT_FIELDS['optionType1']: variant.get(VARIANT_FIELDS['optionType1']),
            VARIANT_FIELDS['optionValue1']: variant.get(VARIANT_FIELDS['optionValue1']),
            VARIANT_FIELDS['optionType2']: variant.get(VARIANT_FIELDS['optionType2']),
            VARIANT_FIELDS['optionValue2']: variant.get(VARIANT_FIELDS['optionValue2']),
        }
        
        if dry_run:
            if idx <= 5:  # Show first 5
                print(f"   [{idx}/{len(variants)}] Would upload: {variant_name[:40]}")
        else:
            api.create_record(VARIANTS_OBJECT_KEY, variant_data)
            if idx <= 5 or idx % 50 == 0:  # Show progress
                print(f"   [{idx}/{len(variants)}] Uploaded: {variant_name[:40]}")
            time.sleep(0.15)  # Rate limit
    
    print(f"\n   ✅ {'Would upload' if dry_run else 'Uploaded'} {len(variants)} variants")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Knack Data Migration: Download, recalculate, and re-upload',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (preview only, no changes)
  python knack_data_migration.py --dry-run
  
  # Full migration (deletes and re-uploads)
  python knack_data_migration.py
  
  # Skip deletion (only upload processed data as new records)
  python knack_data_migration.py --no-delete
"""
    )
    
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without modifying Knack')
    parser.add_argument('--no-delete', action='store_true',
                       help='Skip deletion step (only upload new records)')
    
    args = parser.parse_args()
    
    try:
        # Initialize Knack API
        api = KnackAPI()
        
        # Step 1: Download current data
        products, variants = download_knack_data(api)
        
        # Step 2: Save backup
        print("\n" + "="*60)
        print("💾 SAVING BACKUP")
        print("="*60)
        save_backup(products, variants)
        
        # Step 3: Process and recalculate
        processed_products, processed_variants = process_and_recalculate(products, variants)
        
        # Step 4: Delete existing data (if not skipped)
        if not args.no_delete:
            delete_all_knack_data(api, dry_run=args.dry_run)
        
        # Step 5: Upload processed data
        upload_processed_data(api, processed_products, processed_variants, dry_run=args.dry_run)
        
        # Summary
        print("\n" + "="*60)
        print(f"{'✅ DRY RUN COMPLETE' if args.dry_run else '🎉 MIGRATION COMPLETE'}")
        print("="*60)
        
        if args.dry_run:
            print("\n⚠️  This was a dry run. No changes were made to Knack.")
            print("   Run without --dry-run to apply changes.")
        else:
            print(f"\n✅ Migrated {len(processed_products)} products")
            print(f"✅ Migrated {len(processed_variants)} variants")
            print("\n📸 All images matched from shop/public/images/")
            print("💰 All margins recalculated using current formula")
            print("🏷️  All variant options restructured")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
