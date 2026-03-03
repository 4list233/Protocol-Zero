#!/usr/bin/env python3
"""
Upload to Knack & Sync to Notion
================================

Separate script to upload scraped products to Knack and sync media to Notion.
Run this AFTER scraping and translation.

Usage:
    python upload_to_knack.py                 # Upload all products from products_translated.json
    python upload_to_knack.py --dry-run       # Preview without making changes
    python upload_to_knack.py --sync-media    # Also sync media to public/images
    python upload_to_knack.py --product-id 5  # Upload specific product only

Prerequisites:
    1. Run scraper: python ai_scraper.py
    2. Run translation: python translate_deepseek.py
    3. Review images (automatic stitching)
    4. Ensure Knack credentials in .env
"""

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass

# Add integrations to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'integrations'))

# Import from local modules
from knack_integration import (
    KnackAPI,
    PRODUCTS_OBJECT_KEY,
    VARIANTS_OBJECT_KEY,
    PRODUCT_FIELDS,
    VARIANT_FIELDS,
    PRODUCT_IMAGES_OBJECT_KEY,
    PRODUCT_IMAGE_FIELDS,
    IMAGE_TYPES
)

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output')
MEDIA_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output', 'media')
JSON_OUTPUT = os.path.join(OUTPUT_DIR, 'products_translated.json')  # Use translated file by default
SYNC_MEDIA_SCRIPT = os.path.join(SCRIPT_DIR, '..', 'shared', 'scripts', 'sync-media.js')


def load_products(input_file: Optional[str] = None) -> Dict:
    """Load products from products_translated.json or specified file"""
    json_file = input_file if input_file else JSON_OUTPUT

    if not os.path.exists(json_file):
        print(f"❌ No products file found at {json_file}")
        print("   Run the scraper first: python ai_scraper.py")
        print("   Then translate: python translate_deepseek.py")
        sys.exit(1)
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"📦 Loaded {data['count']} products from {json_file}")
    print(f"   Generated: {data.get('timestamp', 'unknown')}")
    
    return data


def scan_product_images(media_folder: str) -> Dict[str, List[str]]:
    """
    Scan media directory for a product and collect image paths.

    For Details, only collects the stitched Details_Long.jpg file.
    For Main and Catalogue, collects all image files.
    For Variant, collects all variant-specific images from variant_screenshots folder.

    Args:
        media_folder: Media folder name (e.g., '817287036106' or 'product_001')

    Returns:
        Dict with keys 'Main', 'Catalogue', 'Details', 'Variant' containing absolute image paths
    """
    images = {
        'Main': [],
        'Catalogue': [],
        'Details': [],
        'Variant': []
    }

    # Use the actual media folder name from JSON
    product_folder = os.path.join(MEDIA_DIR, media_folder)

    if not os.path.exists(product_folder):
        return images

    # Scan Main folder
    main_folder = os.path.join(product_folder, 'Main')
    if os.path.exists(main_folder):
        for file in sorted(os.listdir(main_folder)):
            if file.lower().endswith(('.jpg', '.jpeg', '.png')) and not file.startswith('.'):
                images['Main'].append(os.path.join(main_folder, file))

    # Scan Catalogue folder
    catalogue_folder = os.path.join(product_folder, 'Catalogue')
    if os.path.exists(catalogue_folder):
        for file in sorted(os.listdir(catalogue_folder)):
            if file.lower().endswith(('.jpg', '.jpeg', '.png')) and not file.startswith('.'):
                images['Catalogue'].append(os.path.join(catalogue_folder, file))

    # Scan Details folder - ONLY collect Details_Long.jpg (the stitched image)
    details_folder = os.path.join(product_folder, 'Details')
    if os.path.exists(details_folder):
        details_long = os.path.join(details_folder, 'Details_Long.jpg')
        if os.path.exists(details_long):
            images['Details'].append(details_long)
        else:
            # Fallback: look for case-insensitive match
            for file in os.listdir(details_folder):
                if file.lower() == 'details_long.jpg':
                    images['Details'].append(os.path.join(details_folder, file))
                    break

    # Scan variant_screenshots folder
    variant_folder = os.path.join(product_folder, 'variant_screenshots')
    if os.path.exists(variant_folder):
        for file in sorted(os.listdir(variant_folder)):
            if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and not file.startswith('.'):
                images['Variant'].append(os.path.join(variant_folder, file))

    return images


def upload_product(knack: KnackAPI, product: Dict, product_index: int, dry_run: bool = False, with_images: bool = False) -> Optional[str]:
    """Upload a single product and its variants to Knack
    
    Args:
        knack: KnackAPI instance
        product: Product data dict
        product_index: 1-based index for mapping to media folder
        dry_run: Preview mode flag
        with_images: Whether to upload images
    """
    try:
        # Extract and normalize product title (used for both product record and image linking)
        product_title = product.get('title_en', '').strip()
        
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
                PRODUCT_FIELDS['title']: product_title,
                PRODUCT_FIELDS['titleOriginal']: product.get('title_zh', ''),
                PRODUCT_FIELDS['url']: product.get('url', ''),
                PRODUCT_FIELDS['status']: 'Active',
            }
            
            # Add base price if available
            base_price = product.get('base_price_cad', 0)
            if 'priceCadBase' in PRODUCT_FIELDS and base_price > 0:
                product_data[PRODUCT_FIELDS['priceCadBase']] = base_price
            
            if dry_run:
                print(f"   → [DRY RUN] Would create product: {product_title[:40]}")
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
                VARIANT_FIELDS['totalCostCad']: cost_cad,
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

        # Upload images if requested
        if with_images:
            # Get media folder from JSON, fallback to sequential naming
            media_folder = product.get('media_folder', f"product_{product_index:03d}")
            # Scan media directory for images using actual folder name
            images = scan_product_images(media_folder)
            # Count total images
            total_images = sum(len(paths) for paths in images.values())
            if total_images > 0:
                print(f"   🖼️  Uploading {total_images} images from {media_folder}...")
                img_count = upload_product_images(knack, product_record_id, images, product.get('variants', []), dry_run)
                print(f"   → Uploaded {img_count} images")
            else:
                print(f"   ⚠️  No images found in media folder: {media_folder}")

        return product_record_id

    except Exception as e:
        import traceback
        print(f"   ❌ Error uploading product: {e}")
        traceback.print_exc()
        return None


def upload_product_images(
    knack: KnackAPI,
    product_record_id: str,
    images: Dict,
    variants: List[Dict] = None,
    dry_run: bool = False
) -> int:
    """
    Upload images to the Product Images table (object_14) and link to product.

    Args:
        knack: KnackAPI instance
        product_record_id: The Knack record ID of the product (used for field_188 connection)
        images: Dict with keys 'Main', 'Catalogue', 'Details', 'Variant' containing image paths
                Note: Details should contain ONLY the stitched Details_Long.jpg file
        variants: List of variant dicts with 'sku' keys (needed for linking variant images)
        dry_run: If True, just preview without uploading

    Returns:
        Number of images uploaded
    """
    uploaded_count = 0

    # Map our image categories to Knack imageType values
    type_mapping = {
        'Main': IMAGE_TYPES['primary'],      # Primary images
        'Catalogue': IMAGE_TYPES['gallery'],  # Gallery images
        'Details': IMAGE_TYPES['detail'],     # Detail image (stitched Details_Long.jpg)
        'Variant': IMAGE_TYPES['variant'],   # Variant-specific images
    }

    # Ensure variants is a list
    if variants is None:
        variants = []

    for category, image_paths in images.items():
        if not image_paths:
            continue

        image_type = type_mapping.get(category, IMAGE_TYPES['gallery'])

        for idx, image_path in enumerate(image_paths):
            if not os.path.exists(image_path):
                print(f"      ⚠️  Image not found: {image_path}")
                continue

            # Determine sort order: Primary=0, then by index
            sort_order = 0 if category == 'Main' and idx == 0 else (idx + 1) * 10

            # For the very first Main image, also mark as Primary
            actual_type = IMAGE_TYPES['primary'] if category == 'Main' and idx == 0 else image_type

            if dry_run:
                dry_run_msg = f"      → [DRY RUN] Would upload: {os.path.basename(image_path)} ({actual_type})"
                # Show variant linking info in dry run
                if category == 'Variant':
                    import re
                    match = re.match(r'variant_(\d+)\.', os.path.basename(image_path))
                    if match and variants:
                        variant_index = int(match.group(1)) - 1
                        if 0 <= variant_index < len(variants):
                            variant_sku = variants[variant_index].get('sku', 'N/A')
                            dry_run_msg += f" variantId={variant_sku}"
                print(dry_run_msg)
                uploaded_count += 1
                continue

            try:
                # Step 1: Create a record in Product Images table
                # Set descriptive alt text based on category
                if category == 'Details':
                    alt_text = "Product details (stitched long image)"
                else:
                    alt_text = f"{category} image {idx + 1}"

                # Use product_record_id for connection field (same as variants use for field_61)
                image_record_data = {
                    PRODUCT_IMAGE_FIELDS['product']: [product_record_id],
                    PRODUCT_IMAGE_FIELDS['imageType']: actual_type,
                    PRODUCT_IMAGE_FIELDS['sortOrder']: sort_order,
                    PRODUCT_IMAGE_FIELDS['altText']: alt_text,
                    PRODUCT_IMAGE_FIELDS['name']: os.path.basename(image_path),
                }

                # Link variant images to their variants via variantId (SKU)
                if category == 'Variant':
                    import re
                    # Extract variant index from filename: variant_001.png → 0 (0-based)
                    match = re.match(r'variant_(\d+)\.', os.path.basename(image_path))
                    if match and variants:
                        variant_index = int(match.group(1)) - 1  # 1-based to 0-based
                        if 0 <= variant_index < len(variants):
                            variant_sku = variants[variant_index].get('sku', '')
                            if variant_sku:
                                image_record_data[PRODUCT_IMAGE_FIELDS['variantId']] = variant_sku
                                alt_text = f"Variant: {variants[variant_index].get('variant_name_en', 'Unknown')}"
                                image_record_data[PRODUCT_IMAGE_FIELDS['altText']] = alt_text

                result = knack.create_record(PRODUCT_IMAGES_OBJECT_KEY, image_record_data)
                image_record_id = result['id']

                # Step 2: Upload the actual image file to that record
                knack.upload_file(
                    PRODUCT_IMAGES_OBJECT_KEY,
                    image_record_id,
                    PRODUCT_IMAGE_FIELDS['image'],
                    image_path
                )

                uploaded_count += 1
                print(f"      ✅ {actual_type}: {os.path.basename(image_path)}")

            except Exception as e:
                print(f"      ❌ Failed to upload {os.path.basename(image_path)}: {e}")

    return uploaded_count


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
    python upload_to_knack.py                       # Upload all products (data only)
    python upload_to_knack.py --dry-run             # Preview what would be uploaded
    python upload_to_knack.py --with-images         # Upload products + images to Knack
    python upload_to_knack.py --sync-media          # Also sync images to public folder
    python upload_to_knack.py --product-id 3        # Upload only product #3    python upload_to_knack.py --input ai_scraper_output/products_translated.json  # Use translated file    python upload_to_knack.py --with-images --dry-run  # Preview including images
        """
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without uploading to Knack')
    parser.add_argument('--with-images', action='store_true',
                        help='Also upload images to Knack Product Images table')
    parser.add_argument('--sync-media', action='store_true',
                        help='Also sync media files to shop/public/images')
    parser.add_argument('--product-id', type=int,
                        help='Upload only this product ID (1-based index)')
    parser.add_argument('--input', type=str,
                        help='Input JSON file (default: ai_scraper_output/products_translated.json)')
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("📤 UPLOAD TO KNACK")
    print("="*60)
    
    # Load products
    data = load_products(args.input)
    products = data.get('products', [])
    
    if not products:
        print("❌ No products to upload")
        return
    
    # Filter to specific product if requested
    start_index = 1  # Default: start from product 1
    if args.product_id:
        idx = args.product_id - 1
        if idx < 0 or idx >= len(products):
            print(f"❌ Invalid product ID {args.product_id}. Valid range: 1-{len(products)}")
            return
        products = [products[idx]]
        start_index = args.product_id  # Preserve the original index
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
    
    for i, product in enumerate(products, start_index):
        actual_index = i if not args.product_id else args.product_id
        print(f"\n[{i if not args.product_id else i}/{len(products) if not args.product_id else len(data.get('products', []))}] {product.get('title_en', 'Unknown')[:50]}")
        
        # Pass the actual product index for mapping to media folder
        result = upload_product(knack, product, product_index=actual_index, dry_run=args.dry_run, with_images=args.with_images)
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
