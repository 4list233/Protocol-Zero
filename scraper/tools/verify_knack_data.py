#!/usr/bin/env python3
"""
Verify Knack database data quality and linkage integrity.

Checks:
  1. Products have id (field_45) and SKU (field_46) populated
  2. Every product has at least 1 linked variant
  3. Variants have SKU (field_63) populated
  4. Variants are linked to a valid product (no orphans)
  5. Product Image records are linked to a valid product (no orphans)
  6. No duplicate variant SKUs

Usage:
    python tools/verify_knack_data.py
    python tools/verify_knack_data.py --verbose    # Show all problem records
"""
import sys
import os
import argparse

# Add integrations to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'integrations'))

from knack_integration import (
    KnackAPI,
    PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCT_IMAGE_FIELDS,
    PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY, PRODUCT_IMAGES_OBJECT_KEY
)


def extract_connection_id(connection_value) -> str:
    """Extract record ID from Knack connection field value (handles multiple formats)."""
    if not connection_value:
        return ''
    if isinstance(connection_value, list):
        if not connection_value:
            return ''
        item = connection_value[0]
        if isinstance(item, dict):
            return item.get('id', '')
        return str(item)
    if isinstance(connection_value, dict):
        return connection_value.get('id', '')
    return str(connection_value)


def verify_knack_data(verbose: bool = False):
    """Run all data quality checks against the Knack database."""
    print("🔍 Knack Database Integrity Check")
    print("=" * 60)

    try:
        api = KnackAPI()
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)

    issues = []

    # ─── PRODUCTS ───────────────────────────────────────────────
    print("\n📦 Fetching products...")
    products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    product_record_ids = {p['id'] for p in products}
    print(f"   Total: {len(products)}")

    products_missing_id = []
    products_missing_sku = []
    products_missing_title = []

    for p in products:
        rec_id = p['id']
        slug = p.get(PRODUCT_FIELDS['id'], '').strip()
        sku = p.get(PRODUCT_FIELDS['sku'], '').strip()
        title = p.get(PRODUCT_FIELDS['title'], '').strip()

        if not slug:
            products_missing_id.append(rec_id)
        if not sku:
            products_missing_sku.append(rec_id)
        if not title:
            products_missing_title.append(rec_id)

    print(f"   ✅ With slug (field_45): {len(products) - len(products_missing_id)}")
    print(f"   ✅ With SKU (field_46):  {len(products) - len(products_missing_sku)}")
    print(f"   ✅ With title:           {len(products) - len(products_missing_title)}")

    if products_missing_id:
        issues.append(f"⚠️  {len(products_missing_id)} products missing slug (field_45)")
        if verbose:
            for rid in products_missing_id[:10]:
                print(f"      Missing slug: record {rid}")
    if products_missing_sku:
        issues.append(f"⚠️  {len(products_missing_sku)} products missing SKU (field_46)")
        if verbose:
            for rid in products_missing_sku[:10]:
                print(f"      Missing SKU: record {rid}")

    # ─── VARIANTS ───────────────────────────────────────────────
    print("\n🔧 Fetching variants...")
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    print(f"   Total: {len(variants)}")

    variants_missing_sku = []
    variants_orphaned = []        # No product connection
    variants_broken_link = []     # Product ID not found in products
    variants_zero_price = []
    variant_skus = []
    duplicate_skus = []

    # Build product variants map (product_record_id → [variant names])
    product_variant_map: dict = {p['id']: [] for p in products}

    for v in variants:
        rec_id = v['id']
        sku = v.get(VARIANT_FIELDS['sku'], '').strip()
        name = v.get(VARIANT_FIELDS['variantName'], '').strip()
        price_cad = v.get(VARIANT_FIELDS['priceCad'], 0) or 0
        product_conn = v.get(VARIANT_FIELDS['product'])

        # SKU check
        if not sku:
            variants_missing_sku.append((rec_id, name))
        else:
            variant_skus.append(sku)

        # Product link check
        product_id = extract_connection_id(product_conn)
        if not product_id:
            variants_orphaned.append((rec_id, name))
        elif product_id not in product_record_ids:
            variants_broken_link.append((rec_id, name, product_id))
        else:
            product_variant_map[product_id].append(name)

        # Price check
        try:
            if float(price_cad) == 0:
                variants_zero_price.append((rec_id, name))
        except (TypeError, ValueError):
            variants_zero_price.append((rec_id, name))

    # Duplicate SKU check
    seen_skus = set()
    for sku in variant_skus:
        if sku in seen_skus:
            duplicate_skus.append(sku)
        seen_skus.add(sku)

    linked_count = len(variants) - len(variants_orphaned) - len(variants_broken_link)
    print(f"   ✅ Linked to valid product: {linked_count}")
    print(f"   ✅ With SKU:               {len(variants) - len(variants_missing_sku)}")
    print(f"   ✅ With price > $0:        {len(variants) - len(variants_zero_price)}")

    if variants_orphaned:
        issues.append(f"❌ {len(variants_orphaned)} ORPHANED variants (no product connection)")
        if verbose:
            for rid, name in variants_orphaned[:10]:
                print(f"      Orphan: [{rid}] {name[:50]}")
    if variants_broken_link:
        issues.append(f"❌ {len(variants_broken_link)} variants linked to NON-EXISTENT products")
        if verbose:
            for rid, name, pid in variants_broken_link[:10]:
                print(f"      Broken link: [{rid}] {name[:40]} → product {pid}")
    if variants_missing_sku:
        issues.append(f"⚠️  {len(variants_missing_sku)} variants missing SKU (field_63)")
        if verbose:
            for rid, name in variants_missing_sku[:10]:
                print(f"      Missing SKU: [{rid}] {name[:50]}")
    if duplicate_skus:
        issues.append(f"❌ {len(duplicate_skus)} DUPLICATE variant SKUs")
        if verbose:
            for sku in duplicate_skus[:10]:
                print(f"      Duplicate SKU: {sku}")
    if variants_zero_price:
        issues.append(f"⚠️  {len(variants_zero_price)} variants with $0 price")

    # Products with no variants
    products_no_variants = [pid for pid, vlist in product_variant_map.items() if not vlist]
    if products_no_variants:
        issues.append(f"⚠️  {len(products_no_variants)} products have NO linked variants")
        if verbose:
            for pid in products_no_variants[:10]:
                p = next((x for x in products if x['id'] == pid), {})
                title = p.get(PRODUCT_FIELDS['title'], '?')
                print(f"      No variants: [{pid}] {title[:50]}")

    print(f"\n   Products with ≥1 variant: {len(products) - len(products_no_variants)}/{len(products)}")

    # ─── PRODUCT IMAGES ─────────────────────────────────────────
    print("\n🖼️  Fetching product images...")
    images = api.get_all_records(PRODUCT_IMAGES_OBJECT_KEY)
    print(f"   Total: {len(images)}")

    images_orphaned = []
    images_broken_link = []
    image_type_counts: dict = {}

    for img in images:
        rec_id = img['id']
        product_conn = img.get(PRODUCT_IMAGE_FIELDS['product'])
        img_type = img.get(PRODUCT_IMAGE_FIELDS['imageType'], 'Unknown')

        image_type_counts[img_type] = image_type_counts.get(img_type, 0) + 1

        product_id = extract_connection_id(product_conn)
        if not product_id:
            images_orphaned.append(rec_id)
        elif product_id not in product_record_ids:
            images_broken_link.append((rec_id, product_id))

    linked_images = len(images) - len(images_orphaned) - len(images_broken_link)
    print(f"   ✅ Linked to valid product: {linked_images}")
    for img_type, count in sorted(image_type_counts.items()):
        print(f"      {img_type}: {count}")

    if images_orphaned:
        issues.append(f"❌ {len(images_orphaned)} ORPHANED image records (no product connection)")
    if images_broken_link:
        issues.append(f"❌ {len(images_broken_link)} image records linked to NON-EXISTENT products")

    # ─── SUMMARY ────────────────────────────────────────────────
    print("\n" + "=" * 60)
    if not issues:
        print("✅ ALL CHECKS PASSED — data integrity looks clean")
    else:
        print(f"Found {len(issues)} issue(s):\n")
        for issue in issues:
            print(f"  {issue}")
        print()
        print("Run with --verbose to see individual problem records.")
        print("To fix corrupted data: python clear_knack_data.py → re-seed")
    print("=" * 60)

    return len([i for i in issues if i.startswith("❌")]) == 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Verify Knack database integrity')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show individual problem records')
    args = parser.parse_args()

    ok = verify_knack_data(verbose=args.verbose)
    sys.exit(0 if ok else 1)
