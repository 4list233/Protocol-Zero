#!/usr/bin/env python3
"""
Seed existing products.json to Knack database.
Validates all translations are complete before seeding.
"""
import json
import sys
import re
from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY


def has_chinese(text: str) -> bool:
    """Check if text contains Chinese characters"""
    return any('\u4e00' <= ch <= '\u9fff' for ch in (text or ''))


def validate_translations(products: list) -> dict:
    """Validate all translations are complete before seeding to Knack"""
    issues = {
        'untranslated_titles': [],
        'untranslated_variants': [],
        'missing_titles': [],
        'missing_skus': [],
    }
    
    for idx, product in enumerate(products, 1):
        title_en = product.get('title_en', '')
        
        if not title_en or title_en == product.get('title_zh', ''):
            issues['missing_titles'].append(f"Product {idx}: {product.get('product_id', '?')}")
        elif has_chinese(title_en):
            issues['untranslated_titles'].append(
                f"Product {idx}: {title_en[:60]}"
            )
        
        if not product.get('product_sku'):
            issues['missing_skus'].append(f"Product {idx}: {product.get('product_id', '?')}")
        
        for v_idx, variant in enumerate(product.get('variants', []), 1):
            variant_en = variant.get('variant_name_en', '')
            if has_chinese(variant_en):
                issues['untranslated_variants'].append(
                    f"Product {idx} Variant {v_idx}: {variant_en[:50]}"
                )
    
    return issues

def seed_json_to_knack(json_path, force=False):
    """Seed products from JSON file to Knack. Validates translations first."""
    print(f"🚀 Seeding products from {json_path} to Knack\n")
    
    # Load JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    products = data.get('products', [])
    print(f"📦 Found {len(products)} products\n")
    
    # ── VALIDATE TRANSLATIONS ──
    print("🔍 Validating translations...")
    issues = validate_translations(products)
    
    total_issues = (len(issues['untranslated_titles']) + len(issues['untranslated_variants']) +
                    len(issues['missing_titles']) + len(issues['missing_skus']))
    
    if total_issues > 0:
        print(f"\n⚠️  Translation validation found {total_issues} issues:")
        if issues['missing_titles']:
            print(f"   ❌ Missing titles: {len(issues['missing_titles'])}")
            for item in issues['missing_titles'][:5]:
                print(f"      - {item}")
        if issues['untranslated_titles']:
            print(f"   ❌ Untranslated titles (Chinese remaining): {len(issues['untranslated_titles'])}")
            for item in issues['untranslated_titles'][:5]:
                print(f"      - {item}")
        if issues['untranslated_variants']:
            print(f"   ❌ Untranslated variants (Chinese remaining): {len(issues['untranslated_variants'])}")
            for item in issues['untranslated_variants'][:10]:
                print(f"      - {item}")
        if issues['missing_skus']:
            print(f"   ⚠️  Missing SKUs: {len(issues['missing_skus'])}")
        
        if not force:
            print(f"\n❌ SEEDING BLOCKED - translations incomplete!")
            print(f"   Run the scraper first to translate all products:")
            print(f"   → python ai_scraper.py --test")
            print(f"   Or force seeding with: --force")
            sys.exit(1)
        else:
            print(f"\n⚠️  Forcing seed despite {total_issues} validation issues...")
    else:
        print(f"   ✅ All translations validated - zero Chinese text remaining\n")
    
    # Initialize Knack API
    try:
        api = KnackAPI()
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)
    
    total_variants = 0
    
    for idx, product in enumerate(products, 1):
        try:
            print(f"============================================================")
            print(f"📦 Product {idx}/{len(products)}: {product['title_en'][:50]}...")
            print(f"============================================================")
            
            # Create product in Knack
            product_data = {
                PRODUCT_FIELDS['id']: product['product_id'],
                PRODUCT_FIELDS['sku']: product['product_id'],  # Use product ID as SKU
                PRODUCT_FIELDS['title']: product['title_en'],
                PRODUCT_FIELDS['titleOriginal']: product['title_zh'],
                PRODUCT_FIELDS['url']: product['url'],
                PRODUCT_FIELDS['status']: 'Active',
            }
            
            print(f"   Creating product record...")
            product_record = api.create_record(PRODUCTS_OBJECT_KEY, product_data)
            product_knack_id = product_record['id']
            print(f"   ✅ Product created (ID: {product_knack_id})")
            
            # Create variants
            variants = product.get('variants', [])
            print(f"   Creating {len(variants)} variants...")
            
            for v_idx, variant in enumerate(variants, 1):
                try:
                    # Generate unique SKU using product ID + variant index (ALWAYS unique)
                    unique_sku = f"{product['product_id']}_v{v_idx}"
                    
                    variant_data = {
                        VARIANT_FIELDS['product']: [product_knack_id],  # Connection to product
                        VARIANT_FIELDS['variantName']: variant['variant_name_en'],
                        VARIANT_FIELDS['sku']: unique_sku,
                        VARIANT_FIELDS['priceCny']: variant['price_cny'],
                        VARIANT_FIELDS['priceCad']: variant['price_cad'],
                        VARIANT_FIELDS['shippingCny']: variant.get('shipping_cny', 30),
                        VARIANT_FIELDS['costCad']: variant['cost_cad'],
                        VARIANT_FIELDS['marginStandard']: variant['margin_standard'],
                        VARIANT_FIELDS['marginPromo']: variant['margin_promo'],
                        VARIANT_FIELDS['optionType1']: variant.get('option_type_1', ''),
                        VARIANT_FIELDS['optionValue1']: variant.get('option_value_1', ''),
                        VARIANT_FIELDS['optionType2']: variant.get('option_type_2', ''),
                        VARIANT_FIELDS['optionValue2']: variant.get('option_value_2', ''),
                        VARIANT_FIELDS['stock']: 100 if variant.get('in_stock', True) else 0,
                        VARIANT_FIELDS['status']: 'Active' if variant.get('in_stock', True) else 'Out of Stock',
                        VARIANT_FIELDS['imageIdsJson']: json.dumps(variant.get('image_ids', [])),
                    }
                    
                    api.create_record(VARIANTS_OBJECT_KEY, variant_data)
                    total_variants += 1
                    
                    if v_idx % 10 == 0:
                        print(f"      → {v_idx}/{len(variants)} variants created...")
                        
                except Exception as e:
                    print(f"      ⚠️  Variant {v_idx} failed: {e}")
                    continue
            
            print(f"   ✅ Created {len(variants)} variants")
            print()
            
        except Exception as e:
            print(f"   ❌ Product failed: {e}\n")
            continue
    
    print(f"\n✅ Seeding complete!")
    print(f"   Products: {len(products)}")
    print(f"   Variants: {total_variants}")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Seed products.json to Knack database')
    parser.add_argument('--input', default='ai_scraper_output/products.json',
                       help='Input JSON file path')
    parser.add_argument('--force', action='store_true',
                       help='Force seeding even if translations are incomplete')
    args = parser.parse_args()
    
    seed_json_to_knack(args.input, force=args.force)
