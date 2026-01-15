#!/usr/bin/env python3
"""
Upload Products from Folders to Knack
--------------------------------------
Reads product data from individual folders instead of CSV.

Usage:
    python folders_to_knack.py                    # Upload all products
    python folders_to_knack.py --dry-run          # Preview without uploading
    python folders_to_knack.py --product 5        # Upload product_005 only
    python folders_to_knack.py --sync-media       # Also sync images
"""

import os
import sys
import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional
from knack_integration import (
    KnackAPI, 
    PRODUCTS_OBJECT_KEY, 
    VARIANTS_OBJECT_KEY,
    PRODUCT_FIELDS,
    VARIANT_FIELDS
)

SCRIPT_DIR = Path(__file__).parent
PRODUCTS_DIR = SCRIPT_DIR / 'ai_scraper_output' / 'products'
MEDIA_DIR = SCRIPT_DIR / 'ai_scraper_output' / 'media'


def parse_product_file(product_folder: Path) -> Optional[Dict]:
    """Parse product.txt file"""
    product_file = product_folder / 'product.txt'
    if not product_file.exists():
        return None
    
    product = {}
    current_section = None
    description_lines = []
    
    with open(product_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            # Section headers
            if line.startswith('# Description'):
                current_section = 'description'
                continue
            elif line.startswith('#'):
                current_section = None
                continue
            
            # Description section
            if current_section == 'description':
                if line:
                    description_lines.append(line)
                continue
            
            # Key-value pairs
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower().replace(' ', '_').replace('(en)', '').replace('(zh)', '')
                value = value.strip()
                
                if key == 'id':
                    product['product_id'] = value
                elif key == 'title':
                    product['title_en'] = value
                elif key == 'title_zh':
                    product['title_zh'] = value
                elif key == 'url':
                    product['url'] = value
                elif key == 'category':
                    product['category'] = value
                elif key == 'status':
                    product['status'] = value
    
    if description_lines:
        product['description'] = '\n'.join(description_lines)
    
    return product


def parse_variants_file(product_folder: Path) -> List[Dict]:
    """Parse variants.txt file"""
    variants_file = product_folder / 'variants.txt'
    if not variants_file.exists():
        return []
    
    variants = []
    
    with open(variants_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            # Parse variant line: Name | Price CNY | Price CAD | Margin | Status
            parts = [p.strip() for p in line.split('|')]
            if len(parts) < 3:
                continue
            
            variant = {
                'variant_name': parts[0],
                'price_cny': float(parts[1]) if parts[1] else 0,
                'price_cad': float(parts[2]) if parts[2] else 0,
            }
            
            # Optional fields
            if len(parts) > 3:
                margin_str = parts[3].replace('%', '').strip()
                if margin_str:
                    variant['margin'] = float(margin_str)
            
            if len(parts) > 4:
                variant['status'] = parts[4]
            else:
                variant['status'] = 'Active'
            
            variants.append(variant)
    
    return variants


def load_product_from_folder(product_folder: Path) -> Optional[Dict]:
    """Load complete product data from folder"""
    product = parse_product_file(product_folder)
    if not product:
        return None
    
    variants = parse_variants_file(product_folder)
    product['variants'] = variants
    
    return product


def upload_product(knack: KnackAPI, product: Dict, dry_run: bool = False) -> Optional[str]:
    """Upload a single product and its variants to Knack"""
    product_id = product.get('product_id', '')
    title = product.get('title_en', '')
    
    print(f"\n📦 {title[:50]}")
    print(f"   ID: {product_id}")
    print(f"   Variants: {len(product.get('variants', []))}")
    
    if dry_run:
        print(f"   [DRY RUN] Would upload to Knack")
        return None
    
    try:
        # Check if product exists
        existing = knack.find_record(
            PRODUCTS_OBJECT_KEY,
            PRODUCT_FIELDS['id'],
            product_id
        )
        
        if existing:
            product_record_id = existing['id']
            print(f"   ✅ Found existing: {product_record_id}")
            
            # Update product
            product_data = {
                PRODUCT_FIELDS['title']: title,
                PRODUCT_FIELDS['status']: product.get('status', 'Active'),
            }
            
            if 'url' in product:
                product_data[PRODUCT_FIELDS['url']] = product['url']
            if 'category' in product:
                product_data[PRODUCT_FIELDS['category']] = product['category']
            if 'description' in product:
                product_data[PRODUCT_FIELDS['description']] = product['description']
            
            knack.update_record(PRODUCTS_OBJECT_KEY, product_record_id, product_data)
            print(f"   ✅ Updated product")
            
        else:
            # Create product
            product_data = {
                PRODUCT_FIELDS['id']: product_id,
                PRODUCT_FIELDS['title']: title,
                PRODUCT_FIELDS['status']: product.get('status', 'Active'),
            }
            
            if 'title_zh' in product:
                product_data[PRODUCT_FIELDS['titleOriginal']] = product['title_zh']
            if 'url' in product:
                product_data[PRODUCT_FIELDS['url']] = product['url']
            if 'category' in product:
                product_data[PRODUCT_FIELDS['category']] = product['category']
            if 'description' in product:
                product_data[PRODUCT_FIELDS['description']] = product['description']
            
            result = knack.create_record(PRODUCTS_OBJECT_KEY, product_data)
            product_record_id = result['id']
            print(f"   ✅ Created: {product_record_id}")
        
        # Upload variants
        uploaded_count = 0
        for variant in product.get('variants', []):
            variant_name = variant.get('variant_name', '')
            price_cad = variant.get('price_cad', 0)
            
            # Skip variants without pricing
            if price_cad <= 0:
                continue
            
            # Check if variant exists
            existing_variant = knack.find_record(
                VARIANTS_OBJECT_KEY,
                VARIANT_FIELDS['variantName'],
                variant_name
            )
            
            variant_data = {
                VARIANT_FIELDS['product']: product_record_id,
                VARIANT_FIELDS['variantName']: variant_name,
                VARIANT_FIELDS['priceCny']: variant.get('price_cny', 0),
                VARIANT_FIELDS['priceCad']: price_cad,
                VARIANT_FIELDS['status']: variant.get('status', 'Active'),
            }
            
            if 'margin' in variant:
                variant_data[VARIANT_FIELDS['marginStandard']] = variant['margin']
            
            if existing_variant:
                knack.update_record(VARIANTS_OBJECT_KEY, existing_variant['id'], variant_data)
            else:
                knack.create_record(VARIANTS_OBJECT_KEY, variant_data)
            
            uploaded_count += 1
        
        print(f"   ✅ Uploaded {uploaded_count} variants")
        return product_record_id
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description='Upload products from folders to Knack')
    parser.add_argument('--dry-run', action='store_true', help='Preview without uploading')
    parser.add_argument('--product', type=int, help='Upload specific product number (e.g., 5 for product_005)')
    parser.add_argument('--sync-media', action='store_true', help='Also sync media files')
    args = parser.parse_args()
    
    print("📤 UPLOAD PRODUCTS FROM FOLDERS TO KNACK")
    print("=" * 60)
    
    if not PRODUCTS_DIR.exists():
        print(f"❌ Products directory not found: {PRODUCTS_DIR}")
        print("   Run: python csv_to_folders.py")
        sys.exit(1)
    
    # Get list of product folders
    product_folders = sorted([f for f in PRODUCTS_DIR.iterdir() if f.is_dir() and f.name.startswith('product_')])
    
    if not product_folders:
        print(f"❌ No product folders found in {PRODUCTS_DIR}")
        sys.exit(1)
    
    print(f"📁 Found {len(product_folders)} product folders")
    
    # Filter to specific product if requested
    if args.product:
        folder_name = f"product_{args.product:03d}"
        product_folders = [f for f in product_folders if f.name == folder_name]
        if not product_folders:
            print(f"❌ Product folder not found: {folder_name}")
            sys.exit(1)
        print(f"📌 Uploading only: {folder_name}")
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made\n")
    
    # Initialize Knack API
    knack = KnackAPI()
    
    # Upload products
    success_count = 0
    error_count = 0
    
    for product_folder in product_folders:
        product = load_product_from_folder(product_folder)
        if not product:
            print(f"⚠️  {product_folder.name}: No product.txt found")
            continue
        
        result = upload_product(knack, product, args.dry_run)
        if result:
            success_count += 1
        else:
            if not args.dry_run:
                error_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    if args.dry_run:
        print(f"✅ Dry run complete: {len(product_folders)} products reviewed")
    else:
        print(f"✅ Upload complete!")
        print(f"   Success: {success_count}")
        if error_count > 0:
            print(f"   Errors: {error_count}")
    
    # Sync media if requested
    if args.sync_media and not args.dry_run:
        print("\n📸 Syncing media files...")
        import subprocess
        try:
            subprocess.run(['python3', str(SCRIPT_DIR / 'sync_media.py')], check=True)
            print("✅ Media sync complete")
        except Exception as e:
            print(f"⚠️  Media sync failed: {e}")


if __name__ == '__main__':
    main()
