#!/usr/bin/env python3
"""
Upload to Knack & Sync to Notion
================================

Separate script to upload scraped products to Knack and sync media to Notion.
Run this AFTER manual review of scraped data and images.

Usage:
    python upload_to_knack.py                 # Upload all products from products.json
    python upload_to_knack.py --dry-run       # Preview without making changes
    python upload_to_knack.py --sync-media    # Also sync media to public/images
    python upload_to_knack.py --product-id 5  # Upload specific product only

Prerequisites:
    1. Run scraper first: python ai_scraper.py
    2. Review and stitch images manually
    3. Ensure Knack credentials in shop/.env.local
"""

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass

# Import from local modules
from knack_integration import (
    KnackAPI, 
    PRODUCTS_OBJECT_KEY, 
    VARIANTS_OBJECT_KEY,
    PRODUCT_FIELDS,
    VARIANT_FIELDS
)

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output')
MEDIA_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output', 'media')
JSON_OUTPUT = os.path.join(OUTPUT_DIR, 'products.json')
SYNC_MEDIA_SCRIPT = os.path.join(SCRIPT_DIR, '..', 'shared', 'scripts', 'sync-media.js')


def load_products() -> Dict:
    """Load products from products.json"""
    if not os.path.exists(JSON_OUTPUT):
        print(f"❌ No products.json found at {JSON_OUTPUT}")
        print("   Run the scraper first: python ai_scraper.py")
        sys.exit(1)
    
    with open(JSON_OUTPUT, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"📦 Loaded {data['count']} products from {JSON_OUTPUT}")
    print(f"   Generated: {data.get('timestamp', 'unknown')}")
    
    return data


def upload_product(knack: KnackAPI, product: Dict, dry_run: bool = False) -> Optional[str]:
    """Upload a single product and its variants to Knack"""
    try:
        # Check if product already exists by URL
        existing = knack.find_record(
            PRODUCTS_OBJECT_KEY,
            PRODUCT_FIELDS['url'],
            product['url']
        )
        
        if existing:
            product_record_id = existing['id']
            print(f"   → Found existing product: {product_record_id}")
        else:
            # Build product data
            product_data = {
                PRODUCT_FIELDS['id']: product.get('product_id', ''),
                PRODUCT_FIELDS['title']: product.get('title_en', ''),
                PRODUCT_FIELDS['titleOriginal']: product.get('title_zh', ''),
                PRODUCT_FIELDS['url']: product.get('url', ''),
                PRODUCT_FIELDS['status']: 'Active',
            }
            
            # Add base price if available
            base_price = product.get('base_price_cad', 0)
            if 'priceCadBase' in PRODUCT_FIELDS and base_price > 0:
                product_data[PRODUCT_FIELDS['priceCadBase']] = base_price
            
            if dry_run:
                title = product.get('title_en', '')[:40]
                print(f"   → [DRY RUN] Would create product: {title}")
                return None
            
            result = knack.create_record(PRODUCTS_OBJECT_KEY, product_data)
            product_record_id = result['id']
            print(f"   → Created product: {product_record_id}")
        
        # Upload variants
        variants = product.get('variants', [])
        in_stock_count = 0
        skipped_count = 0
        
        for v in variants:
            # Skip out-of-stock variants
            if not v.get('in_stock', True):
                continue
            
            # Skip variants without proper English names
            variant_name = v.get('variant_name_en', '').strip()
            if not variant_name or len(variant_name) < 2:
                skipped_count += 1
                continue
            
            in_stock_count += 1
            
            # Get pricing data
            price_cny = v.get('price_cny', 0)
            shipping_cny = v.get('shipping_cny', 30)
            cost_cad = v.get('cost_cad', 0)
            price_cad = v.get('price_cad', 0)
            margin_standard = v.get('margin_standard', 0)
            margin_promo = v.get('margin_promo', 0)
            
            variant_data = {
                VARIANT_FIELDS['product']: [product_record_id],
                VARIANT_FIELDS['variantName']: variant_name,
                VARIANT_FIELDS['optionType1']: v.get('option_type_1', ''),
                VARIANT_FIELDS['optionValue1']: v.get('option_value_1', ''),
                VARIANT_FIELDS['optionType2']: v.get('option_type_2', ''),
                VARIANT_FIELDS['optionValue2']: v.get('option_value_2', ''),
                VARIANT_FIELDS['priceCny']: price_cny,
                VARIANT_FIELDS['shippingCny']: shipping_cny,
                VARIANT_FIELDS['costCad']: cost_cad,
                VARIANT_FIELDS['priceCad']: price_cad,
                VARIANT_FIELDS['marginStandard']: margin_standard,
                VARIANT_FIELDS['marginPromo']: margin_promo,
                VARIANT_FIELDS['status']: 'Active',
            }
            
            if dry_run:
                print(f"      → [DRY RUN] {variant_name[:40]} | ¥{price_cny} → ${cost_cad:.2f} cost → ${price_cad} sell")
                continue
            
            # Check if variant exists (by name)
            existing_variant = knack.find_record(
                VARIANTS_OBJECT_KEY,
                VARIANT_FIELDS['variantName'],
                variant_name
            )
            
            if existing_variant:
                knack.update_record(VARIANTS_OBJECT_KEY, existing_variant['id'], variant_data)
                print(f"      → Updated: {variant_name[:35]} | ¥{price_cny} → ${price_cad}")
            else:
                knack.create_record(VARIANTS_OBJECT_KEY, variant_data)
                print(f"      → Created: {variant_name[:35]} | ¥{price_cny} → ${price_cad}")
        
        if skipped_count > 0:
            print(f"   ⚠️  Skipped {skipped_count} variants (no English name)")
        print(f"   → Uploaded {in_stock_count} in-stock variants")
        return product_record_id
        
    except Exception as e:
        print(f"   ❌ Error uploading product: {e}")
        return None


def sync_media():
    """Run the media sync script to copy images to public/images"""
    print("\n" + "="*60)
    print("🖼️  SYNCING MEDIA TO PUBLIC/IMAGES")
    print("="*60)
    
    if not os.path.exists(SYNC_MEDIA_SCRIPT):
        print(f"❌ Media sync script not found: {SYNC_MEDIA_SCRIPT}")
        return False
    
    try:
        result = subprocess.run(
            ['node', SYNC_MEDIA_SCRIPT],
            capture_output=True,
            text=True
        )
        print(result.stdout)
        if result.returncode != 0:
            print(f"⚠️  Media sync warnings: {result.stderr}")
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Media sync error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Upload scraped products to Knack and sync media to Notion',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python upload_to_knack.py                  # Upload all products
    python upload_to_knack.py --dry-run        # Preview what would be uploaded
    python upload_to_knack.py --sync-media     # Also sync images to public folder
    python upload_to_knack.py --product-id 3   # Upload only product #3
        """
    )
    parser.add_argument('--dry-run', action='store_true', 
                        help='Preview changes without uploading to Knack')
    parser.add_argument('--sync-media', action='store_true',
                        help='Also sync media files to shop/public/images')
    parser.add_argument('--product-id', type=int,
                        help='Upload only this product ID (1-based index)')
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("📤 UPLOAD TO KNACK")
    print("="*60)
    
    # Load products
    data = load_products()
    products = data.get('products', [])
    
    if not products:
        print("❌ No products to upload")
        return
    
    # Filter to specific product if requested
    if args.product_id:
        idx = args.product_id - 1
        if idx < 0 or idx >= len(products):
            print(f"❌ Invalid product ID {args.product_id}. Valid range: 1-{len(products)}")
            return
        products = [products[idx]]
        print(f"   Uploading only product #{args.product_id}")
    
    # Initialize Knack API
    try:
        knack = KnackAPI()
        print("   ✅ Knack API initialized")
    except Exception as e:
        print(f"❌ Failed to initialize Knack API: {e}")
        return
    
    if args.dry_run:
        print("\n   🧪 DRY RUN MODE - No changes will be made\n")
    
    # Upload each product
    success_count = 0
    error_count = 0
    
    for i, product in enumerate(products, 1):
        print(f"\n[{i}/{len(products)}] {product.get('title_en', 'Unknown')[:50]}")
        
        result = upload_product(knack, product, dry_run=args.dry_run)
        if result or args.dry_run:
            success_count += 1
        else:
            error_count += 1
    
    # Summary
    print("\n" + "="*60)
    print(f"📊 UPLOAD SUMMARY")
    print("="*60)
    print(f"   ✅ Successful: {success_count}")
    print(f"   ❌ Errors: {error_count}")
    
    if args.dry_run:
        print("\n   This was a DRY RUN. Run without --dry-run to upload.")
    
    # Sync media if requested
    if args.sync_media:
        sync_media()
    else:
        print("\n💡 Tip: Add --sync-media to also copy images to public folder")


if __name__ == '__main__':
    main()
