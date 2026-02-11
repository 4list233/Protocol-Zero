#!/usr/bin/env python3
"""
Verify Image-to-Product Mapping

Checks that products in Knack have corresponding images in /public/images/
"""

import os
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load environment from project root
project_root = Path(__file__).parent.parent.parent
env_path = project_root / '.env'
load_dotenv(env_path)

KNACK_APP_ID = os.getenv('KNACK_APPLICATION_ID')
KNACK_API_KEY = os.getenv('KNACK_REST_API_KEY')

headers = {
    'X-Knack-Application-Id': KNACK_APP_ID,
    'X-Knack-REST-API-Key': KNACK_API_KEY,
}

# Get products from Knack
print("Fetching products from Knack...")
response = requests.get(
    'https://api.knack.com/v1/objects/object_6/records',
    headers=headers,
    params={'rows_per_page': 10}  # Test first 10 products
)

if not response.ok:
    print(f"Error fetching products: {response.status_code}")
    exit(1)

products = response.json()['records']
print(f"Found {len(products)} products\n")

# Check images
images_dir = Path(__file__).parent / '..' / 'shop' / 'public' / 'images'

print("IMAGE AVAILABILITY CHECK")
print("=" * 70)

products_with_images = 0
products_without_images = 0

for product in products:
    product_id = product.get('field_45', 'N/A')  # ID field
    title = product.get('field_47', 'N/A')[:50]  # Title field
    
    if product_id == 'N/A':
        continue
    
    # Check for primary images
    hero_01 = images_dir / f"{product_id}-hero-01.jpg"
    main = images_dir / f"{product_id}-Main.jpg"
    
    has_image = hero_01.exists() or main.exists()
    
    if has_image:
        products_with_images += 1
        status = "✅"
        
        # Count additional images
        additional_count = 0
        for i in range(2, 8):
            hero = images_dir / f"{product_id}-hero-{i:02d}.jpg"
            if hero.exists():
                additional_count += 1
        
        detail_img = ""
        if (images_dir / f"{product_id}-details.jpg").exists():
            detail_img = " + details"
        
        print(f"{status} {product_id[:20]:20} | {title[:30]:30} | Images: {additional_count + 1}{detail_img}")
    else:
        products_without_images += 1
        print(f"❌ {product_id[:20]:20} | {title[:30]:30} | No images found")

print("\n" + "=" * 70)
print(f"Summary:")
print(f"  Products with images:    {products_with_images}/{len(products)}")
print(f"  Products without images: {products_without_images}/{len(products)}")

if products_without_images > 0:
    print(f"\n⚠️  {products_without_images} products are missing images!")
    print("   Run sync_media.py to copy images to /public/images/")
else:
    print("\n✅ All products have images!")
