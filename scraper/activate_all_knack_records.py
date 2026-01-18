#!/usr/bin/env python3
"""
Update all products and variants in Knack to Active status
"""
import sys
from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY

def activate_all_records():
    """Update all products and variants to Active status"""
    print("🚀 Activating all records in Knack\n")
    
    # Initialize Knack API
    try:
        api = KnackAPI()
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)
    
    # Get all products
    print("📦 Fetching all products...")
    products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    print(f"   Found {len(products)} products\n")
    
    # Update products to Active
    print("🔄 Updating products to Active...")
    for idx, product in enumerate(products, 1):
        try:
            api.update_record(
                PRODUCTS_OBJECT_KEY,
                product['id'],
                {PRODUCT_FIELDS['status']: 'Active'}
            )
            if idx % 10 == 0:
                print(f"   → {idx}/{len(products)} products activated...")
        except Exception as e:
            print(f"   ⚠️  Product {product['id']} failed: {e}")
            continue
    
    print(f"   ✅ Activated {len(products)} products\n")
    
    # Get all variants
    print("📦 Fetching all variants...")
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    print(f"   Found {len(variants)} variants\n")
    
    # Update variants to Active
    print("🔄 Updating variants to Active...")
    for idx, variant in enumerate(variants, 1):
        try:
            api.update_record(
                VARIANTS_OBJECT_KEY,
                variant['id'],
                {VARIANT_FIELDS['status']: 'Active'}
            )
            if idx % 50 == 0:
                print(f"   → {idx}/{len(variants)} variants activated...")
        except Exception as e:
            print(f"   ⚠️  Variant {variant['id']} failed: {e}")
            continue
    
    print(f"   ✅ Activated {len(variants)} variants\n")
    
    print(f"✅ Activation complete!")
    print(f"   Products: {len(products)} → Active")
    print(f"   Variants: {len(variants)} → Active")

if __name__ == '__main__':
    activate_all_records()
