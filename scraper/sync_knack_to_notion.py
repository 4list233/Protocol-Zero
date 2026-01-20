#!/usr/bin/env python3
"""
Sync Knack Products to Notion with Product IDs and Images

This script:
1. Fetches all products from Knack
2. For each product, creates/updates Notion page with:
   - Product ID (for linking)
   - Product SKU
   - Title
   - Status
   - Image URLs (using production URLs, not localhost)
"""

import os
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load environment
env_path = Path(__file__).parent / '..' / 'shop' / '.env.local'
load_dotenv(env_path)

# Knack configuration
KNACK_APP_ID = os.getenv('KNACK_APPLICATION_ID')
KNACK_API_KEY = os.getenv('KNACK_REST_API_KEY')
KNACK_PRODUCTS_OBJECT = 'object_6'

# Notion configuration
NOTION_API_KEY = os.getenv('NOTION_API_KEY')
PRODUCTS_DB = os.getenv('NOTION_DATABASE_ID_PRODUCTS')
PRODUCTION_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pzairsoft.ca')

knack_headers = {
    'X-Knack-Application-Id': KNACK_APP_ID,
    'X-Knack-REST-API-Key': KNACK_API_KEY,
}

notion_headers = {
    'Authorization': f'Bearer {NOTION_API_KEY}',
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
}

def get_local_images_for_product(product_id):
    """Get list of images that exist locally for a product"""
    images_dir = Path(__file__).parent / '..' / 'shop' / 'public' / 'images'
    
    image_urls = []
    
    # Check for hero images (hero-01 through hero-07)
    for i in range(1, 8):
        hero_path = images_dir / f"{product_id}-hero-{i:02d}.jpg"
        if hero_path.exists():
            image_urls.append(f"{PRODUCTION_URL}/images/{product_id}-hero-{i:02d}.jpg")
    
    # Check for legacy Main image
    main_path = images_dir / f"{product_id}-Main.jpg"
    if main_path.exists():
        image_urls.append(f"{PRODUCTION_URL}/images/{product_id}-Main.jpg")
    
    return image_urls

def get_detail_image_for_product(product_id):
    """Get detail/long image for a product"""
    images_dir = Path(__file__).parent / '..' / 'shop' / 'public' / 'images'
    
    # Check for details.jpg
    details_path = images_dir / f"{product_id}-details.jpg"
    if details_path.exists():
        return f"{PRODUCTION_URL}/images/{product_id}-details.jpg"
    
    # Check for legacy Details_Long.jpg
    legacy_path = images_dir / f"{product_id}-Details_Long.jpg"
    if legacy_path.exists():
        return f"{PRODUCTION_URL}/images/{product_id}-Details_Long.jpg"
    
    return None

def find_notion_page_by_product_id(product_id):
    """Find existing Notion page by Product ID"""
    try:
        response = requests.post(
            f'https://api.notion.com/v1/databases/{PRODUCTS_DB}/query',
            headers=notion_headers,
            json={
                'filter': {
                    'property': 'ID',
                    'rich_text': {
                        'equals': product_id
                    }
                }
            }
        )
        
        if response.ok:
            results = response.json().get('results', [])
            return results[0]['id'] if results else None
    except:
        pass
    
    return None

def create_or_update_notion_page(product_id, sku, title, status, image_urls, detail_image_url):
    """Create or update a Notion page with product info and images"""
    
    # Check if page exists
    existing_page_id = find_notion_page_by_product_id(product_id)
    
    # Prepare properties (matching Notion database schema)
    properties = {
        'ID': {
            'rich_text': [{'text': {'content': product_id}}]
        },
        'SKU': {
            'rich_text': [{'text': {'content': sku}}]
        },
        'Title': {
            'title': [{'text': {'content': title[:100]}}]  # Notion title limit
        },
        'Status': {
            'select': {'name': status or 'Active'}
        }
    }
    
    # Add images as external files (Notion requires name field for external files)
    if image_urls:
        properties['Images'] = {
            'files': [{'type': 'external', 'name': f'Image {i+1}', 'external': {'url': url}} for i, url in enumerate(image_urls[:20])]
        }
    
    # Add detail image
    if detail_image_url:
        properties['Detail Image'] = {
            'files': [{'type': 'external', 'name': 'Detail Image', 'external': {'url': detail_image_url}}]
        }
    
    try:
        if existing_page_id:
            # Update existing page
            response = requests.patch(
                f'https://api.notion.com/v1/pages/{existing_page_id}',
                headers=notion_headers,
                json={'properties': properties}
            )
        else:
            # Create new page
            response = requests.post(
                'https://api.notion.com/v1/pages',
                headers=notion_headers,
                json={
                    'parent': {'database_id': PRODUCTS_DB},
                    'properties': properties
                }
            )
        
        if response.ok:
            return True, existing_page_id is not None
        else:
            print(f"      ❌ Notion API error: {response.status_code}")
            print(f"         {response.text[:200]}")
            return False, False
            
    except Exception as e:
        print(f"      ❌ Error: {e}")
        return False, False

print("🔄 SYNCING KNACK PRODUCTS TO NOTION")
print(f"   Production URL: {PRODUCTION_URL}")
print("=" * 70)

# Fetch all active products from Knack
response = requests.get(
    f'https://api.knack.com/v1/objects/{KNACK_PRODUCTS_OBJECT}/records',
    headers=knack_headers,
    params={'rows_per_page': 1000}
)

if not response.ok:
    print(f"❌ Error fetching from Knack: {response.status_code}")
    exit(1)

products = response.json()['records']
print(f"Found {len(products)} products in Knack\n")

created_count = 0
updated_count = 0
skipped_count = 0

for product in products:
    product_id = product.get('field_45')  # ID field
    sku = product.get('field_46', '')     # SKU field
    title = product.get('field_47', '')   # Title field
    status = product.get('field_51', 'Active')  # Status field
    
    if not product_id:
        skipped_count += 1
        continue
    
    print(f"  Processing: {product_id} - {title[:40]}...")
    
    # Get images from local file system
    image_urls = get_local_images_for_product(product_id)
    detail_image_url = get_detail_image_for_product(product_id)
    
    if not image_urls:
        print(f"    ⚠️  No images found locally for {product_id}")
    else:
        print(f"    ✓ Found {len(image_urls)} images")
    
    # Create or update in Notion
    success, was_update = create_or_update_notion_page(
        product_id, sku, title, status, image_urls, detail_image_url
    )
    
    if success:
        if was_update:
            updated_count += 1
            print(f"    ✅ Updated in Notion")
        else:
            created_count += 1
            print(f"    ✅ Created in Notion")
    else:
        skipped_count += 1

print("\n" + "=" * 70)
print(f"Summary:")
print(f"  Created: {created_count} pages")
print(f"  Updated: {updated_count} pages")
print(f"  Skipped: {skipped_count} pages")
print(f"\n✅ Done! Knack products synced to Notion with Product IDs.")
