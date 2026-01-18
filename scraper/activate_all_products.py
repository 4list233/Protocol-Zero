#!/usr/bin/env python3
"""
Activate All Products and Variants
===================================
Updates all products and variants in Knack to status = 'Active'
so they display on the shop.

Usage:
    python3 activate_all_products.py [--dry-run]
    
Environment variables required:
    KNACK_APPLICATION_ID - Your Knack application ID
    KNACK_REST_API_KEY - Your Knack REST API key
"""

import os
import sys
import argparse

# Try to load dotenv if available
try:
    from dotenv import load_dotenv
    # Load from multiple possible locations
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    
    # Try various .env file locations
    env_files = [
        os.path.join(repo_root, '.env'),
        os.path.join(repo_root, '.env.local'),
        os.path.join(repo_root, 'shop', '.env.local'),
        os.path.join(repo_root, 'shop', '.env'),
        os.path.join(script_dir, '.env'),
    ]
    
    for env_file in env_files:
        if os.path.exists(env_file):
            load_dotenv(env_file)
            print(f"   Loaded env from: {env_file}")
except ImportError:
    pass  # dotenv not installed, rely on system env vars

from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY

def main():
    parser = argparse.ArgumentParser(description='Activate all products and variants')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without updating')
    args = parser.parse_args()
    
    print("=" * 60)
    print("ACTIVATE ALL PRODUCTS AND VARIANTS")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE UPDATE'}")
    print()
    
    # Initialize Knack API
    try:
        knack = KnackAPI()
    except Exception as e:
        print(f"❌ Failed to initialize Knack API: {e}")
        print("   Make sure KNACK_APPLICATION_ID and KNACK_REST_API_KEY are set")
        sys.exit(1)
    
    # Fetch all products
    print("📦 Fetching products...")
    products = knack.get_all_records(PRODUCTS_OBJECT_KEY)
    print(f"   Found {len(products)} products")
    
    # Count statuses
    product_statuses = {}
    for p in products:
        status = p.get(PRODUCT_FIELDS['status'], 'Unknown')
        product_statuses[status] = product_statuses.get(status, 0) + 1
    
    print(f"   Current statuses: {product_statuses}")
    
    # Fetch all variants
    print("\n📋 Fetching variants...")
    variants = knack.get_all_records(VARIANTS_OBJECT_KEY)
    print(f"   Found {len(variants)} variants")
    
    # Count variant statuses
    variant_statuses = {}
    for v in variants:
        status = v.get(VARIANT_FIELDS['status'], 'Unknown')
        variant_statuses[status] = variant_statuses.get(status, 0) + 1
    
    print(f"   Current statuses: {variant_statuses}")
    
    # Update products to Active
    print("\n" + "-" * 60)
    print("UPDATING PRODUCTS TO ACTIVE")
    print("-" * 60)
    
    products_updated = 0
    products_already_active = 0
    products_failed = 0
    
    for p in products:
        record_id = p.get('id')
        current_status = p.get(PRODUCT_FIELDS['status'], '')
        title = p.get(PRODUCT_FIELDS['title'], 'Unknown')[:40]
        
        if current_status == 'Active':
            products_already_active += 1
            continue
        
        if args.dry_run:
            print(f"   [DRY RUN] Would activate: {title} (was: {current_status})")
            products_updated += 1
        else:
            try:
                knack.update_record(PRODUCTS_OBJECT_KEY, record_id, {
                    PRODUCT_FIELDS['status']: 'Active'
                })
                print(f"   ✓ Activated: {title}")
                products_updated += 1
            except Exception as e:
                print(f"   ❌ Failed: {title} - {e}")
                products_failed += 1
    
    print(f"\n   Products: {products_updated} activated, {products_already_active} already active, {products_failed} failed")
    
    # Update variants to Active
    print("\n" + "-" * 60)
    print("UPDATING VARIANTS TO ACTIVE")
    print("-" * 60)
    
    variants_updated = 0
    variants_already_active = 0
    variants_failed = 0
    
    for v in variants:
        record_id = v.get('id')
        current_status = v.get(VARIANT_FIELDS['status'], '')
        name = v.get(VARIANT_FIELDS['variantName'], 'Unknown')[:40]
        
        if current_status == 'Active':
            variants_already_active += 1
            continue
        
        # Skip "Out of Stock" variants - they should stay that way
        if current_status == 'Out of Stock':
            continue
        
        if args.dry_run:
            print(f"   [DRY RUN] Would activate: {name} (was: {current_status})")
            variants_updated += 1
        else:
            try:
                knack.update_record(VARIANTS_OBJECT_KEY, record_id, {
                    VARIANT_FIELDS['status']: 'Active'
                })
                print(f"   ✓ Activated: {name}")
                variants_updated += 1
            except Exception as e:
                print(f"   ❌ Failed: {name} - {e}")
                variants_failed += 1
    
    print(f"\n   Variants: {variants_updated} activated, {variants_already_active} already active, {variants_failed} failed")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Products:  {products_updated} updated to Active")
    print(f"Variants:  {variants_updated} updated to Active")
    
    if args.dry_run:
        print("\n⚠️  DRY RUN - No changes were made")
        print("   Run without --dry-run to apply changes")
    else:
        print("\n✅ All updates complete!")
        print("   Products should now appear on the shop")

if __name__ == '__main__':
    main()
