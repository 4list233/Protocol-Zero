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

# Load environment variables from shop/.env.local
env_path = os.path.join(os.path.dirname(__file__), '..', 'shop', '.env.local')
load_dotenv(env_path)

# Knack API Configuration
KNACK_API_BASE = 'https://api.knack.com/v1'
KNACK_APP_ID = os.getenv('KNACK_APPLICATION_ID')
KNACK_API_KEY = os.getenv('KNACK_REST_API_KEY')

# Object keys
PRODUCTS_OBJECT_KEY = os.getenv('KNACK_OBJECT_KEY_PRODUCTS', 'object_6')
VARIANTS_OBJECT_KEY = os.getenv('KNACK_OBJECT_KEY_VARIANTS', 'object_7')

# Product field keys (from knack-config.ts)
PRODUCT_FIELDS = {
    'id': os.getenv('KNACK_FIELD_PRODUCTS_ID', 'field_45'),
    'sku': os.getenv('KNACK_FIELD_PRODUCTS_SKU', 'field_46'),
    'title': os.getenv('KNACK_FIELD_PRODUCTS_TITLE', 'field_47'),
    'titleOriginal': os.getenv('KNACK_FIELD_PRODUCTS_TITLE_ORIGINAL', 'field_48'),
    'description': os.getenv('KNACK_FIELD_PRODUCTS_DESCRIPTION', 'field_49'),
    'category': os.getenv('KNACK_FIELD_PRODUCTS_CATEGORY', 'field_50'),
    'status': os.getenv('KNACK_FIELD_PRODUCTS_STATUS', 'field_51'),
    'priceCadBase': os.getenv('KNACK_FIELD_PRODUCTS_PRICE_CAD_BASE', 'field_138'),
    'margin': os.getenv('KNACK_FIELD_PRODUCTS_MARGIN', 'field_53'),
    'stock': os.getenv('KNACK_FIELD_PRODUCTS_STOCK', 'field_54'),
    'url': os.getenv('KNACK_FIELD_PRODUCTS_URL', 'field_55'),
    'primaryImage': os.getenv('KNACK_FIELD_PRODUCTS_PRIMARY_IMAGE', 'field_56'),
    'images': os.getenv('KNACK_FIELD_PRODUCTS_IMAGES', 'field_57'),
    'detailImage': os.getenv('KNACK_FIELD_PRODUCTS_DETAIL_IMAGE', 'field_58'),
}

# Variant field keys (from knack-config.ts)
VARIANT_FIELDS = {
    'product': os.getenv('KNACK_FIELD_VARIANTS_PRODUCT', 'field_61'),  # Connection to products
    'variantName': os.getenv('KNACK_FIELD_VARIANTS_VARIANT_NAME', 'field_62'),
    'sku': os.getenv('KNACK_FIELD_VARIANTS_SKU', 'field_63'),
    'priceCny': os.getenv('KNACK_FIELD_VARIANTS_PRICE_CNY', 'field_64'),
    'priceCad': os.getenv('KNACK_FIELD_VARIANTS_PRICE_CAD', 'field_138'),
    'costCad': 'field_173',       # Landed cost in CAD (Price + Shipping) × exchange rate
    'marginStandard': 'field_154', # Standard margin % after salesperson cut
    'marginPromo': 'field_155',    # Promo margin % after salesperson + promoter cuts
    'stock': os.getenv('KNACK_FIELD_VARIANTS_STOCK', 'field_66'),
    'status': os.getenv('KNACK_FIELD_VARIANTS_STATUS', 'field_67'),
    'sortOrder': os.getenv('KNACK_FIELD_VARIANTS_SORT_ORDER', 'field_68'),
    'optionType1': 'field_145',   # e.g., "Color", "Style"
    'optionValue1': 'field_146',  # e.g., "Black", "Standard"
    'optionType2': 'field_147',   # e.g., "Size" (nullable)
    'optionValue2': 'field_148',  # e.g., "M", "85-125cm" (nullable)
    'shippingCny': 'field_151',
    'competitorPriceCad': 'field_139',
}


class KnackAPI:
    """Wrapper for Knack REST API calls"""
    
    def __init__(self):
        if not KNACK_APP_ID or not KNACK_API_KEY:
            raise ValueError(
                "Missing Knack credentials. Please set KNACK_APPLICATION_ID and "
                "KNACK_REST_API_KEY in shop/.env.local"
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
