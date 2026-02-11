#!/usr/bin/env python3
"""
Verify Knack database data quality
"""
import sys
from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY

def verify_knack_data():
    """Verify data quality in Knack"""
    print("🔍 Verifying Knack Database Data Quality\n")
    
    try:
        api = KnackAPI()
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)
    
    # Get all products
    products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    print(f"📦 Products: {len(products)}")
    
    # Check product SKUs
    products_without_sku = 0
    for p in products:
        if not p.get(PRODUCT_FIELDS['sku']):
            products_without_sku += 1
    
    print(f"   ✅ With SKU: {len(products) - products_without_sku}")
    print(f"   ⚠️  Without SKU: {products_without_sku}\n")
    
    # Get all variants
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    print(f"🔧 Variants: {len(variants)}")
    
    # Check variant data quality
    linked_to_product = 0
    zero_price = 0
    active_variants = 0
    
    for v in variants:
        # Check product link
        product_connection = v.get(VARIANT_FIELDS['product'])
        if product_connection and len(product_connection) > 0:
            linked_to_product += 1
        
        # Check price
        price_cad = v.get(VARIANT_FIELDS['priceCad'])
        if price_cad and float(price_cad) == 0:
            zero_price += 1
        
        # Check status
        if v.get(VARIANT_FIELDS['status']) == 'Active':
            active_variants += 1
    
    print(f"   ✅ Linked to product: {linked_to_product}")
    print(f"   ⚠️  Not linked: {len(variants) - linked_to_product}")
    print(f"   💰 With price > $0: {len(variants) - zero_price}")
    print(f"   ⚠️  Price = $0: {zero_price}")
    print(f"   ✅ Active: {active_variants}")
    print(f"   ⚠️  Inactive: {len(variants) - active_variants}\n")
    
    # Sample a few variants
    print("📊 Sample Variants:\n")
    for i, v in enumerate(variants[:5], 1):
        product_link = v.get(VARIANT_FIELDS['product'], [])
        product_id = product_link[0] if product_link else "NONE"
        print(f"{i}. {v.get(VARIANT_FIELDS['variantName'], 'UNKNOWN')[:40]}")
        print(f"   Product: {product_id}")
        print(f"   Price: ${v.get(VARIANT_FIELDS['priceCad'], 0)}")
        print(f"   SKU: {v.get(VARIANT_FIELDS['sku'], 'MISSING')}")
        print(f"   Status: {v.get(VARIANT_FIELDS['status'], 'UNKNOWN')}\n")
    
    # Summary
    print("=" * 60)
    if products_without_sku == 0 and linked_to_product == len(variants) and zero_price == 0:
        print("✅ DATA QUALITY: EXCELLENT - All checks passed!")
    elif linked_to_product < len(variants) or zero_price > 0:
        print("⚠️  DATA QUALITY: ISSUES FOUND - See above for details")
    else:
        print("✅ DATA QUALITY: GOOD - Minor issues found")
    print("=" * 60)

if __name__ == '__main__':
    verify_knack_data()
