#!/usr/bin/env python3
"""
Variant Classification Script
Processes scraped Taobao data to identify base models and option variants.

Usage:
    python3 classify_variants.py input.csv output.json

Input: CSV from Taobao scraper with all variants
Output: JSON with classified variants (base models + archived options)
"""

import csv
import json
import re
import sys
from collections import defaultdict
from typing import Dict, List, Set, Tuple

# Common size patterns
SIZE_PATTERNS = [
    r'\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b',
    r'\b\d+-\d+lb\b',  # Weight ranges like "80-110lb"
    r'\b\d+kg\b',      # Weight in kg
]

# Common color patterns (can be expanded)
COLOR_PATTERNS = [
    r'\b(Black|White|Red|Blue|Green|Grey|Gray|Brown|Tan|Coyote|Ranger Green)\b',
    r'BK\b', r'WG\b', r'RG\b', r'CB\b',  # Abbreviated colors
]


def extract_option_from_variant_name(variant_name: str) -> Tuple[str, str]:
    """
    Extract the option value from a variant name.
    Returns: (base_name, option_value)
    
    Example:
        "1x White Arm Sleeve - M" → ("1x White Arm Sleeve", "M")
        "No Label Black - 80-110lb" → ("No Label Black", "80-110lb")
    """
    # Try size patterns
    for pattern in SIZE_PATTERNS:
        match = re.search(pattern, variant_name, re.IGNORECASE)
        if match:
            option_value = match.group(1)
            # Remove the option from the name to get base name
            base_name = re.sub(r'\s*[-–—]\s*' + re.escape(option_value) + r'\s*$', '', variant_name).strip()
            return (base_name, option_value)
    
    # If no clear pattern, return original name as base
    return (variant_name, '')


def is_base_variant(variant_name: str) -> bool:
    """
    Determine if a variant is a base model (no size/option suffix).
    """
    # Check if it ends with a size pattern
    for pattern in SIZE_PATTERNS:
        if re.search(pattern + r'\s*$', variant_name, re.IGNORECASE):
            return False
    
    # Check for common separators followed by options
    if re.search(r'\s*[-–—]\s*[A-Z0-9]+\s*$', variant_name):
        return False
    
    return True


def classify_variants(csv_path: str) -> Dict:
    """
    Read scraped CSV and classify variants into base models and options.
    """
    # Group variants by product URL
    products = defaultdict(lambda: {
        'title': '',
        'url': '',
        'variants': []
    })
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = row.get('URL', '')
            product_title = row.get('Product Title', '') or row.get('Translated Title', '')
            variant_name = row.get('Option Name', '')
            
            if not url or not variant_name:
                continue
            
            products[url]['title'] = product_title
            products[url]['url'] = url
            products[url]['variants'].append({
                'name': variant_name,
                'name_zh': row.get('Option Name ZH', ''),
                'translated_name': row.get('Translated Option Name', ''),
                'price': row.get('Price', ''),  # Original price field
                'price_cny': row.get('Price CNY', ''),
                'price_cad': row.get('Price CAD', ''),
                'shipping_cad': row.get('Shipping CAD', ''),
                'final_cad': row.get('Final CAD', ''),
                'sku': row.get('SKU', ''),
                'media_folder': row.get('Media Folder', ''),
                'main_images': row.get('Main Images', ''),
                'detail_images': row.get('Detail Images', ''),
                'catalogue_images': row.get('Catalogue Images', ''),
            })
    
    # Classify each product's variants
    classified_products = []
    
    for url, product_data in products.items():
        variants = product_data['variants']
        
        # Group variants by base model
        base_variants = defaultdict(lambda: {
            'name': '',
            'options': set(),
            'data': None
        })
        
        for variant in variants:
            variant_name = variant['name']
            base_name, option_value = extract_option_from_variant_name(variant_name)
            
            if option_value:
                # This is an option variant (e.g., "1x White - M")
                base_variants[base_name]['name'] = base_name
                base_variants[base_name]['options'].add(option_value)
                
                # Store archived variant data
                if base_variants[base_name]['data'] is None:
                    base_variants[base_name]['data'] = variant
            else:
                # This is a base variant (e.g., "1x White")
                if base_name not in base_variants:
                    base_variants[base_name]['name'] = base_name
                    base_variants[base_name]['data'] = variant
        
        # Build final product structure
        active_variants = []
        archived_variants = []
        
        # Generate product ID for linking (consistent across all variants)
        product_id = f"prod_{hash(url) % 10000:04d}"
        
        for base_name, base_data in base_variants.items():
            # Generate IDs for linking
            base_variant_id = f"active_{url}_{base_name}".replace(' ', '_').replace('-', '_')
            archived_ids = []
            
            # Get base variant data for field inheritance
            base_variant_data = base_data['data'] if base_data['data'] else {}
            
            # Create archived option variants FIRST (these are the source of truth)
            options_list = sorted(list(base_data['options']))
            for option in options_list:
                archived_id = f"archived_{url}_{base_name}_{option}".replace(' ', '_').replace('-', '_')
                archived_ids.append(archived_id)
                
                # Archived variants inherit ALL fields from base variant
                archived_variant = {
                    'id': archived_id,
                    'productId': product_id,  # SAME product connection as active variant
                    'variantName': f"{base_data['name']} - {option}",
                    'variantNameZH': f"{base_variant_data.get('name_zh', '')} - {option}" if base_variant_data.get('name_zh') else '',
                    'translatedName': f"{base_variant_data.get('translated_name', '')} - {option}" if base_variant_data.get('translated_name') else '',
                    'status': 'Archived',
                    'baseVariantId': base_variant_id,  # Links to active variant
                    'optionType1': 'Model',
                    'optionValue1': base_data['name'],
                    'optionType2': 'Size',
                    'optionValue2': option,  # Individual option value (SOURCE OF TRUTH)
                    # Pricing fields (ALL duplicated from base variant)
                    'price': base_variant_data.get('price', ''),
                    'priceCNY': base_variant_data.get('price_cny', ''),
                    'priceCAD': base_variant_data.get('price_cad', ''),
                    'shippingCAD': base_variant_data.get('shipping_cad', ''),
                    'finalCAD': base_variant_data.get('final_cad', ''),
                    'priceCADOverride': '',  # Can be manually set later
                    'competitorPrice': '',  # Can be manually set later
                    'margin': '',  # Can be manually set later
                    # SKU and inventory
                    'sku': f"{base_variant_data.get('sku', '')}-{option}" if base_variant_data.get('sku') else '',
                    'stock': 0,  # Archived variants have no stock by default
                    # Media fields (duplicated from base variant)
                    'mediaFolder': base_variant_data.get('media_folder', ''),
                    'mainImages': base_variant_data.get('main_images', ''),
                    'detailImages': base_variant_data.get('detail_images', ''),
                    'catalogueImages': base_variant_data.get('catalogue_images', ''),
                }
                archived_variants.append(archived_variant)
            
            # Create active base variant (reads from archived variants)
            active_variant = {
                'id': base_variant_id,
                'productId': product_id,  # SAME product connection as archived variants
                'variantName': base_data['name'],
                'variantNameZH': base_variant_data.get('name_zh', ''),
                'translatedName': base_variant_data.get('translated_name', ''),
                'status': 'Active',
                'optionType1': 'Model',
                'optionValue1': base_data['name'],
                'optionType2': 'Available Sizes' if options_list else '',
                'optionValue2': ','.join(options_list) if options_list else '',  # Extracted from archived variants
                'linkedArchivedVariants': archived_ids,  # References to archived variants
                # Pricing fields
                'price': base_variant_data.get('price', ''),
                'priceCNY': base_variant_data.get('price_cny', ''),
                'priceCAD': base_variant_data.get('price_cad', ''),
                'shippingCAD': base_variant_data.get('shipping_cad', ''),
                'finalCAD': base_variant_data.get('final_cad', ''),
                'priceCADOverride': '',  # Can be manually set later
                'competitorPrice': '',  # Can be manually set later
                'margin': '',  # Can be manually set later
                # SKU and inventory
                'sku': base_variant_data.get('sku', ''),
                'stock': 100,  # Default stock for active variants
                # Media fields
                'mediaFolder': base_variant_data.get('media_folder', ''),
                'mainImages': base_variant_data.get('main_images', ''),
                'detailImages': base_variant_data.get('detail_images', ''),
                'catalogueImages': base_variant_data.get('catalogue_images', ''),
            }
            active_variants.append(active_variant)
        
        classified_products.append({
            'id': product_id,  # Consistent product ID used by all variants
            'title': product_data['title'],
            'url': product_data['url'],
            'active_variants': active_variants,
            'archived_variants': archived_variants,
        })
    
    return {
        'products': classified_products,
        'summary': {
            'total_products': len(classified_products),
            'total_active_variants': sum(len(p['active_variants']) for p in classified_products),
            'total_archived_variants': sum(len(p['archived_variants']) for p in classified_products),
        }
    }


def main():
    """
    Main entry point with support for JSON export or direct database import
    
    Modes:
        - JSON mode: python3 classify_variants.py input.csv output.json
        - Database mode: python3 classify_variants.py input.csv --mode database
    """
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Classify Taobao variants into active and archived variants'
    )
    parser.add_argument('input_csv', help='Input CSV file from scraper')
    parser.add_argument('output', nargs='?', help='Output JSON file (only for JSON mode)')
    parser.add_argument('--mode', choices=['json', 'database'], default='json',
                        help='Output mode: json (default) or database')
    parser.add_argument('--limit', type=int, help='Limit number of products to import (for testing)')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--dry-run', action='store_true', help='Simulate changes without updating database')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.mode == 'json' and not args.output:
        print("Error: Output JSON file required for JSON mode")
        print("Usage: python3 classify_variants.py input.csv output.json")
        sys.exit(1)
    
    print(f"Reading variants from {args.input_csv}...")
    result = classify_variants(args.input_csv)
    
    # Apply limit if specified
    if args.limit and args.limit > 0:
        result['products'] = result['products'][:args.limit]
        result['summary']['total_products'] = len(result['products'])
        result['summary']['total_active_variants'] = sum(
            len(p['active_variants']) for p in result['products']
        )
        result['summary']['total_archived_variants'] = sum(
            len(p['archived_variants']) for p in result['products']
        )
        print(f"\n⚠️  Limited to first {args.limit} product(s)")
    
    print(f"\nClassification Summary:")
    print(f"  Products: {result['summary']['total_products']}")
    print(f"  Active Variants (Base Models): {result['summary']['total_active_variants']}")
    print(f"  Archived Variants (Options): {result['summary']['total_archived_variants']}")
    
    if args.mode == 'json':
        # JSON export mode
        print(f"\nWriting classified variants to {args.output}...")
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print("✅ Classification complete!")
        print(f"\nNext steps:")
        print(f"1. Review {args.output} to verify classification")
        print(f"2. Import active variants to Knack (status: Active)")
        print(f"3. Import archived variants to Knack (status: Archived)")
        print(f"4. Test frontend with new structure")
    
    elif args.mode == 'database':
        # Database import mode
        try:
            from knack_integration import import_classified_variants
            
            if args.dry_run:
                print(f"\n🧪 DRY RUN MODE - No changes will be made to Knack database")
            else:
                print(f"\n🔄 Starting direct database import to Knack...")
            
            import_classified_variants(result, verbose=args.verbose, dry_run=args.dry_run)
            
            if args.dry_run:
                print("\n✅ Dry run complete! Review the changes above.")
                print("\nTo apply these changes, run without --dry-run flag")
            else:
                print("\n✅ Import complete!")
                print("\nNext steps:")
                print("1. Verify products and variants in Knack database")
                print("2. Set pricing and activate products in Knack")
                print("3. Test frontend with imported data")
            
        except ImportError as e:
            print(f"\n❌ Error: Could not import knack_integration module")
            print(f"   Make sure knack_integration.py is in the same directory")
            print(f"   Error: {str(e)}")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Error during database import: {str(e)}")
            sys.exit(1)


if __name__ == '__main__':
    main()
