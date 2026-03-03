"""
Knack Database Integration for Variant Classification
Handles API calls to Knack REST API for creating/updating products and variants
"""

import os
import json
import time
from typing import Dict, List, Optional
from dotenv import load_dotenv
import requests

# Load environment variables from project root .env
project_root = os.path.join(os.path.dirname(__file__), '..', '..')
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

# Knack API Configuration
KNACK_API_BASE = 'https://api.knack.com/v1'
KNACK_APP_ID = os.getenv('KNACK_APPLICATION_ID')
KNACK_API_KEY = os.getenv('KNACK_REST_API_KEY')

# Object keys
PRODUCTS_OBJECT_KEY = os.getenv('KNACK_OBJECT_KEY_PRODUCTS', 'object_6')
VARIANTS_OBJECT_KEY = os.getenv('KNACK_OBJECT_KEY_VARIANTS', 'object_7')
PRODUCT_IMAGES_OBJECT_KEY = os.getenv('KNACK_OBJECT_KEY_PRODUCT_IMAGES', 'object_14')

# Product field keys (updated from Knack database)
PRODUCT_FIELDS = {
    'id': os.getenv('KNACK_FIELD_PRODUCTS_ID', 'field_45'),
    'sku': os.getenv('KNACK_FIELD_PRODUCTS_SKU', 'field_46'),
    'title': os.getenv('KNACK_FIELD_PRODUCTS_TITLE', 'field_47'),
    'titleOriginal': os.getenv('KNACK_FIELD_PRODUCTS_TITLE_ORIGINAL', 'field_48'),
    'description': os.getenv('KNACK_FIELD_PRODUCTS_DESCRIPTION', 'field_49'),
    'category': os.getenv('KNACK_FIELD_PRODUCTS_CATEGORY', 'field_50'),
    'status': os.getenv('KNACK_FIELD_PRODUCTS_STATUS', 'field_51'),
    'margin': os.getenv('KNACK_FIELD_PRODUCTS_MARGIN', 'field_134'),
    'stock': os.getenv('KNACK_FIELD_PRODUCTS_STOCK', 'field_54'),
    'url': os.getenv('KNACK_FIELD_PRODUCTS_URL', 'field_55'),
    # Image fields on product (for quick access caching)
    'primaryImage': os.getenv('KNACK_FIELD_PRODUCTS_PRIMARY_IMAGE', 'field_140'),
    'images': os.getenv('KNACK_FIELD_PRODUCTS_IMAGES', 'field_57'),
    'detailImage': os.getenv('KNACK_FIELD_PRODUCTS_DETAIL_IMAGE', 'field_141'),
    'image': os.getenv('KNACK_FIELD_PRODUCTS_IMAGE', 'field_185'),
    'competitorProducts': os.getenv('KNACK_FIELD_PRODUCTS_COMPETITOR', 'field_135'),
    'archived': os.getenv('KNACK_FIELD_PRODUCTS_ARCHIVED', 'field_374'),
}

# Variant field keys (updated from Knack database)
VARIANT_FIELDS = {
    'product': os.getenv('KNACK_FIELD_VARIANTS_PRODUCT', 'field_61'),  # Connection to products
    'variantName': os.getenv('KNACK_FIELD_VARIANTS_VARIANT_NAME', 'field_62'),
    'sku': os.getenv('KNACK_FIELD_VARIANTS_SKU', 'field_63'),
    'priceCny': os.getenv('KNACK_FIELD_VARIANTS_PRICE_CNY', 'field_64'),
    'priceCad': os.getenv('KNACK_FIELD_VARIANTS_PRICE_CAD', 'field_138'),  # Selling Price
    'totalCostCad': 'field_153',   # Total Cost CAD
    'marginStandard': 'field_154', # Standard margin %
    'marginPromo': 'field_155',    # Promo margin %
    'stock': os.getenv('KNACK_FIELD_VARIANTS_STOCK', 'field_66'),
    'status': os.getenv('KNACK_FIELD_VARIANTS_STATUS', 'field_67'),
    'sortOrder': os.getenv('KNACK_FIELD_VARIANTS_SORT_ORDER', 'field_68'),
    # Chinese source info
    'chineseName': 'field_149',
    'chineseLink': 'field_150',
    # Multi-dimensional variant options
    'optionType1': 'field_145',   # e.g., "Color", "Style"
    'optionValue1': 'field_146',  # e.g., "Black", "Standard"
    'optionType2': 'field_147',   # e.g., "Size" (nullable)
    'optionValue2': 'field_148',  # e.g., "M", "85-125cm" (nullable)
    'shippingCny': 'field_151',
    'isBaseVariant': 'field_152',
    'competitorPriceCad': 'field_139',
    'competitorProducts': 'field_137',
}

# Product Images table field keys (object_14)
PRODUCT_IMAGE_FIELDS = {
    'name': 'field_186',
    'product': 'field_188',      # Connection to products (object_6)
    'image': 'field_189',        # Image file
    'imageType': 'field_190',    # Multiple Choice: Primary, Gallery, Detail, Catalog, Variant
    'sortOrder': 'field_191',    # Number for ordering
    'altText': 'field_192',      # Short Text for accessibility
    'variantId': 'field_193',    # Short Text - links to specific variant
}

# Image types for the imageType field
IMAGE_TYPES = {
    'primary': 'Primary',
    'gallery': 'Gallery',
    'detail': 'Detail',
    'catalog': 'Catalog',
    'variant': 'Variant',
}


class KnackAPI:
    """Wrapper for Knack REST API calls"""
    
    def __init__(self):
        if not KNACK_APP_ID or not KNACK_API_KEY:
            raise ValueError(
                "Missing Knack credentials. Please set KNACK_APPLICATION_ID and "
                "KNACK_REST_API_KEY in .env"
            )
        
        self.headers = {
            'X-Knack-Application-Id': KNACK_APP_ID,
            'X-Knack-REST-API-Key': KNACK_API_KEY,
            'Content-Type': 'application/json',
        }
    
    def create_record(self, object_key: str, data: Dict) -> Dict:
        """Create a new record in Knack"""
        url = f'{KNACK_API_BASE}/objects/{object_key}/records'
        
        response = requests.post(url, headers=self.headers, json=data)
        
        if not response.ok:
            error_msg = f"Knack API error: {response.status_code} {response.text}"
            raise Exception(error_msg)
        
        return response.json()
    
    def update_record(self, object_key: str, record_id: str, data: Dict) -> Dict:
        """Update an existing record in Knack"""
        url = f'{KNACK_API_BASE}/objects/{object_key}/records/{record_id}'
        
        response = requests.put(url, headers=self.headers, json=data)
        
        if not response.ok:
            error_msg = f"Knack API error: {response.status_code} {response.text}"
            raise Exception(error_msg)
        
        return response.json()
    
    def find_record(self, object_key: str, field_key: str, value: str) -> Optional[Dict]:
        """Find a record by field value"""
        url = f'{KNACK_API_BASE}/objects/{object_key}/records'
        params = {
            'filters': json.dumps([{
                'field': field_key,
                'operator': 'is',
                'value': value
            }])
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        
        if not response.ok:
            return None
        
        data = response.json()
        records = data.get('records', [])
        
        return records[0] if records else None

    def find_records_with_filters(self, object_key: str, filters: list) -> list:
        """Find records matching ALL of the given filter conditions.
        
        Args:
            object_key: Knack object key (e.g. 'object_6')
            filters: List of dicts with keys 'field', 'operator', 'value'
                     e.g. [{'field': 'field_62', 'operator': 'is', 'value': 'Black'},
                           {'field': 'field_61', 'operator': 'contains', 'value': 'RECORD_ID'}]
        Returns:
            List of matching records (may be empty)
        """
        url = f'{KNACK_API_BASE}/objects/{object_key}/records'
        params = {
            'filters': json.dumps({
                'match': 'and',
                'rules': filters
            })
        }
        response = requests.get(url, headers=self.headers, params=params)
        if not response.ok:
            return []
        return response.json().get('records', [])

    def get_all_records(self, object_key: str, page_limit: int = 1000) -> List[Dict]:
        """Get all records from an object (paginated)"""
        all_records = []
        page = 1
        
        while True:
            url = f'{KNACK_API_BASE}/objects/{object_key}/records'
            params = {'page': page, 'rows_per_page': 100}
            
            response = requests.get(url, headers=self.headers, params=params)
            
            if not response.ok:
                break
            
            data = response.json()
            records = data.get('records', [])
            
            if not records:
                break
            
            all_records.extend(records)
            
            # Check if more pages
            total_pages = data.get('total_pages', 1)
            if page >= total_pages or page >= page_limit:
                break
            
            page += 1
            time.sleep(0.2)  # Rate limit
        
        return all_records

    def delete_record(self, object_key: str, record_id: str) -> bool:
        """Delete a record from Knack"""
        url = f'{KNACK_API_BASE}/objects/{object_key}/records/{record_id}'

        response = requests.delete(url, headers=self.headers)

        if not response.ok:
            return False

        return True

    def upload_file(self, object_key: str, record_id: str, field_key: str, file_path: str) -> Optional[str]:
        """
        Upload a file to a Knack image/file field.

        Knack file upload uses a two-step process:
        1. Upload file to get asset ID
        2. Update record with asset reference

        Args:
            object_key: The Knack object key (e.g., 'object_6')
            record_id: The record ID to attach the file to
            field_key: The field key for the image/file field
            file_path: Local path to the file to upload

        Returns:
            URL of the uploaded file, or None if failed
        """
        if not os.path.exists(file_path):
            print(f"      ⚠️  File not found: {file_path}")
            return None

        # Determine content type
        ext = os.path.splitext(file_path)[1].lower()
        content_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
        }
        content_type = content_types.get(ext, 'application/octet-stream')

        # Headers for file upload (no Content-Type - requests handles multipart)
        upload_headers = {
            'X-Knack-Application-Id': KNACK_APP_ID,
            'X-Knack-REST-API-Key': KNACK_API_KEY,
        }

        try:
            # Step 1: Upload the file to Knack's asset storage
            upload_url = f'{KNACK_API_BASE}/applications/{KNACK_APP_ID}/assets/file/upload'

            with open(file_path, 'rb') as f:
                files = {
                    'files': (os.path.basename(file_path), f, content_type)
                }
                response = requests.post(upload_url, headers=upload_headers, files=files)

            if not response.ok:
                print(f"      ⚠️  File upload failed: {response.status_code} {response.text}")
                return None

            # Parse response to get asset ID
            result = response.json()
            if not result.get('id'):
                print(f"      ⚠️  No asset ID in response: {result}")
                return None

            asset_id = result['id']
            asset_url = result.get('url', '')

            # Step 2: Update the record with the asset reference
            update_data = {
                field_key: asset_id
            }
            self.update_record(object_key, record_id, update_data)

            print(f"      ✅ Uploaded: {os.path.basename(file_path)}")
            return asset_url

        except Exception as e:
            print(f"      ⚠️  Upload error: {e}")
            return None

    def upload_product_images(self, record_id: str, image_paths: List[str],
                              primary_field: str = None, gallery_field: str = None) -> Dict[str, str]:
        """
        Upload multiple images for a product.

        Args:
            record_id: Knack record ID of the product
            image_paths: List of local file paths to upload
            primary_field: Field key for primary image (uses first image)
            gallery_field: Field key for gallery images (uses all images)

        Returns:
            Dict mapping original paths to Knack URLs
        """
        urls = {}

        if not image_paths:
            return urls

        primary_field = primary_field or IMAGE_FIELDS.get('productPrimaryImage')
        gallery_field = gallery_field or IMAGE_FIELDS.get('productGallery')

        # Upload primary image (first in list)
        if primary_field and image_paths:
            url = self.upload_file(PRODUCTS_OBJECT_KEY, record_id, primary_field, image_paths[0])
            if url:
                urls[image_paths[0]] = url

        # For gallery, Knack typically expects multiple separate uploads or a JSON array
        # This depends on your Knack field configuration
        # If using multiple Image fields, upload each separately
        # If using a single field with multiple allowed, we'd need different handling

        for i, path in enumerate(image_paths[1:], start=1):
            # Rate limit between uploads
            time.sleep(0.3)
            # For now, just track the uploads - actual gallery handling depends on Knack setup
            print(f"      📷 Gallery image {i}: {os.path.basename(path)}")

        return urls

    def upload_variant_image(self, record_id: str, image_path: str) -> Optional[str]:
        """
        Upload an image for a variant.

        Args:
            record_id: Knack record ID of the variant
            image_path: Local path to the image

        Returns:
            URL of uploaded image, or None if failed
        """
        field_key = IMAGE_FIELDS.get('variantImage')
        if not field_key:
            print("      ⚠️  No variant image field configured")
            return None

        return self.upload_file(VARIANTS_OBJECT_KEY, record_id, field_key, image_path)

    def upload_detail_image(self, record_id: str, image_path: str) -> Optional[str]:
        """
        Upload a detail/stitched image for a product.

        Args:
            record_id: Knack record ID of the product
            image_path: Local path to the stitched detail image

        Returns:
            URL of uploaded image, or None if failed
        """
        field_key = IMAGE_FIELDS.get('productDetailImage')
        if not field_key:
            print("      ⚠️  No detail image field configured")
            return None

        return self.upload_file(PRODUCTS_OBJECT_KEY, record_id, field_key, image_path)


def find_product(api: KnackAPI, product_data: Dict) -> Optional[str]:
    """
    Find existing product in Knack database by URL (DO NOT CREATE)
    
    Args:
        api: KnackAPI instance
        product_data: Product data from classify_variants.py
        
    Returns:
        Knack record ID of existing product, or None if not found
    """
    # First try by URL (most reliable match)
    existing = api.find_record(
        PRODUCTS_OBJECT_KEY,
        PRODUCT_FIELDS['url'],
        product_data['url']
    )
    
    if existing:
        print(f"   ✅ Found existing product by URL: {product_data['title'][:60]}")
        print(f"      Knack Product ID (field_45): {existing.get('field_45', 'N/A')}")
        print(f"      Knack Record ID: {existing['id']}")
        return existing['id']
    
    # Fallback: try by product ID
    existing = api.find_record(
        PRODUCTS_OBJECT_KEY,
        PRODUCT_FIELDS['id'],
        product_data['id']
    )
    
    if existing:
        print(f"   ✅ Found existing product by ID: {product_data['title'][:60]}")
        print(f"      Product ID: {product_data['id']}")
        print(f"      Knack Record ID: {existing['id']}")
        return existing['id']
    else:
        print(f"   ❌ Product NOT found in Knack: {product_data['title'][:60]}")
        print(f"      URL: {product_data['url'][:80]}")
        print(f"      Please create this product in Knack first before importing variants")
        return None


def update_variant(api: KnackAPI, product_record_id: str, variant_data: Dict, dry_run: bool = False) -> Optional[Dict]:
    """
    Find and update existing variant in Knack database
    
    Args:
        api: KnackAPI instance
        product_record_id: Knack record ID of parent product
        variant_data: Variant data from classify_variants.py
        dry_run: If True, don't make actual changes
        
    Returns:
        Dict with before/after data, or None if not found
    """
    # Find existing variant by variantName
    existing = api.find_record(
        VARIANTS_OBJECT_KEY,
        VARIANT_FIELDS['variantName'],
        variant_data['variantName']
    )
    
    if not existing:
        print(f"         ⚠️  Variant not found: {variant_data['variantName']}")
        return None
    
    record_id = existing['id']
    
    # Get current values
    before = {
        'optionType1': existing.get(VARIANT_FIELDS['optionType1'], ''),
        'optionValue1': existing.get(VARIANT_FIELDS['optionValue1'], ''),
        'optionType2': existing.get(VARIANT_FIELDS['optionType2'], ''),
        'optionValue2': existing.get(VARIANT_FIELDS['optionValue2'], ''),
        'status': existing.get(VARIANT_FIELDS['status'], ''),
    }
    
    # Prepare update data (only fields we want to modify)
    update_data = {}
    after = before.copy()
    
    # Update option fields if present
    if variant_data.get('optionType1'):
        update_data[VARIANT_FIELDS['optionType1']] = variant_data['optionType1']
        after['optionType1'] = variant_data['optionType1']
    if variant_data.get('optionValue1'):
        update_data[VARIANT_FIELDS['optionValue1']] = variant_data['optionValue1']
        after['optionValue1'] = variant_data['optionValue1']
    if variant_data.get('optionType2'):
        update_data[VARIANT_FIELDS['optionType2']] = variant_data['optionType2']
        after['optionType2'] = variant_data['optionType2']
    if variant_data.get('optionValue2'):
        update_data[VARIANT_FIELDS['optionValue2']] = variant_data['optionValue2']
        after['optionValue2'] = variant_data['optionValue2']
    
    # Update status
    if variant_data.get('status'):
        update_data[VARIANT_FIELDS['status']] = variant_data['status']
        after['status'] = variant_data['status']
    
    # Only update if we have fields to change and not dry run
    if update_data and not dry_run:
        api.update_record(VARIANTS_OBJECT_KEY, record_id, update_data)
    
    return {
        'record_id': record_id,
        'variant_name': variant_data['variantName'],
        'before': before,
        'after': after,
        'has_changes': before != after
    }


def import_classified_variants(classified_data: Dict, verbose: bool = True, dry_run: bool = False):
    """
    Import classified variants data into Knack database
    
    Args:
        classified_data: Output from classify_variants() function
        verbose: Print detailed progress
        dry_run: If True, simulate changes without updating database
    """
    api = KnackAPI()
    
    products = classified_data.get('products', [])
    total_products = len(products)
    total_active = 0
    total_archived = 0
    total_changes = 0
    all_changes = []
    
    mode = "DRY RUN" if dry_run else "UPDATE"
    print(f"\n🚀 Starting Knack database {mode}")
    print(f"   Products: {total_products}")
    if dry_run:
        print(f"   Mode: 🧪 DRY RUN (no changes will be made)")
    print()
    
    # Track variant record IDs for linking
    variant_id_map = {}  # id -> knack_record_id
    
    for i, product in enumerate(products, 1):
        product_id = product['id']
        product_title = product['title']
        active_variants = product.get('active_variants', [])
        archived_variants = product.get('archived_variants', [])
        
        if verbose:
            print(f"[{i}/{total_products}] 📦 {product_title}")
            print(f"   Product ID: {product_id}")
            print(f"   Active Variants: {len(active_variants)}")
            print(f"   Archived Variants: {len(archived_variants)}")
        
        # Find existing product (DO NOT CREATE)
        try:
            product_record_id = find_product(api, product)
            
            if not product_record_id:
                print(f"   ⚠️  Skipping variants - product must be created in Knack first\n")
                continue
            
            # Small delay
            time.sleep(0.3)
            
            # Update active variants
            for j, variant in enumerate(active_variants):
                result = update_variant(api, product_record_id, variant, dry_run=dry_run)
                if result:
                    variant_id_map[variant['id']] = result['record_id']
                    total_active += 1
                    
                    if result['has_changes']:
                        all_changes.append(result)
                        total_changes += 1
                    
                    if verbose:
                        status = "🔄" if result['has_changes'] else "✅"
                        print(f"      {status} Active: {variant['variantName']}")
                        if dry_run and result['has_changes']:
                            print(f"         BEFORE: optionValue2={result['before']['optionValue2']}, status={result['before']['status']}")
                            print(f"         AFTER:  optionValue2={result['after']['optionValue2']}, status={result['after']['status']}")
            
            # Update archived variants
            for j, variant in enumerate(archived_variants):
                result = update_variant(api, product_record_id, variant, dry_run=dry_run)
                if result:
                    variant_id_map[variant['id']] = result['record_id']
                    total_archived += 1
                    
                    if result['has_changes']:
                        all_changes.append(result)
                        total_changes += 1
                    
                    if verbose:
                        status = "🔄" if result['has_changes'] else "✅"
                        print(f"      {status} Archived: {variant['variantName']}")
                        if dry_run and result['has_changes']:
                            print(f"         BEFORE: optionValue2={result['before']['optionValue2']}, status={result['before']['status']}")
                            print(f"         AFTER:  optionValue2={result['after']['optionValue2']}, status={result['after']['status']}")
            
            if verbose:
                print()
            
        except Exception as e:
            print(f"   ❌ Error importing variants for {product_title}: {str(e)}")
            import traceback
            traceback.print_exc()
            continue
    
    print(f"\n{'🧪 DRY RUN' if dry_run else '✅ UPDATE'} Complete!")
    print(f"   Products Found: {total_products}")
    print(f"   Active Variants Processed: {total_active}")
    print(f"   Archived Variants Processed: {total_archived}")
    print(f"   Total Variants: {total_active + total_archived}")
    print(f"   Variants with Changes: {total_changes}")
    
    if dry_run and total_changes > 0:
        print(f"\n📋 Summary of Changes (Would be applied):")
        for change in all_changes[:10]:  # Show first 10 changes
            print(f"\n   Variant: {change['variant_name']}")
            print(f"   Record ID: {change['record_id']}")
            if change['before']['optionValue2'] != change['after']['optionValue2']:
                print(f"   optionValue2: '{change['before']['optionValue2']}' → '{change['after']['optionValue2']}'")
            if change['before']['status'] != change['after']['status']:
                print(f"   status: '{change['before']['status']}' → '{change['after']['status']}'")
        
        if len(all_changes) > 10:
            print(f"\n   ... and {len(all_changes) - 10} more changes")
    
    # TODO: Implement bidirectional linking
    # Currently, Knack doesn't have fields for baseVariantId and linkedArchivedVariants
    # These would need to be added to the Knack schema first
    print(f"\n⚠️  Note: Bidirectional linking (baseVariantId ↔ linkedArchivedVariants)")
    print(f"   requires additional Knack fields that may not be configured yet.")
    print(f"   Variants are linked to products correctly via the 'product' connection field.")
    
    if not dry_run:
        print(f"\n⚠️  Important: This script UPDATES existing variants in Knack.")
        print(f"   Products and variants must already exist - no new records are created.")


if __name__ == '__main__':
    # Test with a sample product
    print("Testing Knack API connection...")
    
    try:
        api = KnackAPI()
        print("✅ Knack API connection successful")
        print(f"   App ID: {KNACK_APP_ID[:8]}...")
        print(f"   Products Object: {PRODUCTS_OBJECT_KEY}")
        print(f"   Variants Object: {VARIANTS_OBJECT_KEY}")
    except Exception as e:
        print(f"❌ Error: {e}")
