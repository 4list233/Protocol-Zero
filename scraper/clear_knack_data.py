#!/usr/bin/env python3
"""
Clear all products, variants, and images from Knack database.
Use this to start fresh before re-seeding from scraper.

WARNING: This will permanently delete all product, variant, and image data!
"""

import os
import sys
import time

# Add integrations to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'integrations'))

from knack_integration import (
    KnackAPI,
    PRODUCTS_OBJECT_KEY,
    VARIANTS_OBJECT_KEY,
    PRODUCT_IMAGES_OBJECT_KEY,
)


def clear_all_data(dry_run: bool = True):
    """
    Delete all products and variants from Knack.

    Args:
        dry_run: If True, only count records without deleting
    """
    api = KnackAPI()

    print("=" * 60)
    print("KNACK DATA CLEARING UTILITY")
    print("=" * 60)

    if dry_run:
        print("\n🧪 DRY RUN MODE - No data will be deleted\n")
    else:
        print("\n⚠️  LIVE MODE - Data will be permanently deleted!\n")

    # Step 1: Count and optionally delete product images
    print("📊 Fetching product images...")
    images = api.get_all_records(PRODUCT_IMAGES_OBJECT_KEY)
    print(f"   Found {len(images)} product images")

    if not dry_run and images:
        print("\n🗑️  Deleting product images...")
        deleted = 0
        for i, img in enumerate(images, 1):
            record_id = img.get('id')
            if record_id:
                success = api.delete_record(PRODUCT_IMAGES_OBJECT_KEY, record_id)
                if success:
                    deleted += 1
                    if deleted % 10 == 0:
                        print(f"   Deleted {deleted}/{len(images)} images...")
                time.sleep(0.2)  # Rate limit
        print(f"   ✅ Deleted {deleted} product images")

    # Step 2: Count and optionally delete variants
    print("\n📊 Fetching variants...")
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    print(f"   Found {len(variants)} variants")

    if not dry_run and variants:
        print("\n🗑️  Deleting variants...")
        deleted = 0
        for i, variant in enumerate(variants, 1):
            record_id = variant.get('id')
            if record_id:
                success = api.delete_record(VARIANTS_OBJECT_KEY, record_id)
                if success:
                    deleted += 1
                    if deleted % 10 == 0:
                        print(f"   Deleted {deleted}/{len(variants)} variants...")
                time.sleep(0.2)  # Rate limit
        print(f"   ✅ Deleted {deleted} variants")

    # Step 3: Count and optionally delete products
    print("\n📊 Fetching products...")
    products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    print(f"   Found {len(products)} products")

    if not dry_run and products:
        print("\n🗑️  Deleting products...")
        deleted = 0
        for i, product in enumerate(products, 1):
            record_id = product.get('id')
            if record_id:
                success = api.delete_record(PRODUCTS_OBJECT_KEY, record_id)
                if success:
                    deleted += 1
                    if deleted % 5 == 0:
                        print(f"   Deleted {deleted}/{len(products)} products...")
                time.sleep(0.2)  # Rate limit
        print(f"   ✅ Deleted {deleted} products")

    # Summary
    print("\n" + "=" * 60)
    if dry_run:
        print("DRY RUN SUMMARY:")
        print(f"   Would delete {len(images)} product images")
        print(f"   Would delete {len(variants)} variants")
        print(f"   Would delete {len(products)} products")
        print("\nTo actually delete, run with --confirm flag:")
        print("   python clear_knack_data.py --confirm")
    else:
        print("DELETION COMPLETE:")
        print(f"   Deleted {len(images)} product images")
        print(f"   Deleted {len(variants)} variants")
        print(f"   Deleted {len(products)} products")
        print("\nKnack database is now empty. Ready for fresh seed.")
    print("=" * 60)


if __name__ == '__main__':
    # Check for --confirm flag
    if '--confirm' in sys.argv:
        # Double-check with user
        print("\n⚠️  WARNING: This will permanently delete ALL products and variants!")
        confirm = input("Type 'DELETE ALL' to confirm: ")
        if confirm == 'DELETE ALL':
            clear_all_data(dry_run=False)
        else:
            print("Aborted.")
    else:
        # Dry run by default
        clear_all_data(dry_run=True)
