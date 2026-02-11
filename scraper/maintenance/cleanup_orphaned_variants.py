#!/usr/bin/env python3
"""
Delete orphaned variants (not linked to any product)
"""
import sys
from knack_integration import KnackAPI, VARIANT_FIELDS, VARIANTS_OBJECT_KEY

def cleanup_orphaned_variants():
    """Delete variants that aren't linked to any product"""
    print("🗑️  Cleaning up orphaned variants\n")
    
    try:
        api = KnackAPI()
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)
    
    # Get all variants
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    print(f"📦 Found {len(variants)} total variants")
    
    # Find orphaned variants
    orphaned = []
    for v in variants:
        product_connection = v.get(VARIANT_FIELDS['product'])
        if not product_connection or len(product_connection) == 0:
            orphaned.append(v)
    
    print(f"🗑️  Found {len(orphaned)} orphaned variants (not linked to any product)\n")
    
    if len(orphaned) == 0:
        print("✅ No orphaned variants found!")
        return
    
    # Delete orphaned variants
    print("🗑️  Deleting orphaned variants...")
    deleted = 0
    for v in orphaned:
        try:
            api.delete_record(VARIANTS_OBJECT_KEY, v['id'])
            deleted += 1
            if deleted % 10 == 0:
                print(f"   → Deleted {deleted}/{len(orphaned)}...")
        except Exception as e:
            print(f"   ⚠️  Failed to delete {v['id']}: {e}")
    
    print(f"\n✅ Cleanup complete! Deleted {deleted} orphaned variants")

if __name__ == '__main__':
    cleanup_orphaned_variants()
