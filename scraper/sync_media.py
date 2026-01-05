#!/usr/bin/env python3
"""
Sync Media to Shop
------------------
Copy scraped images to shop/public/images with proper naming.
"""

import os
import shutil
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
MEDIA_DIR = SCRIPT_DIR / 'ai_scraper_output' / 'media'
PRODUCTS_JSON = SCRIPT_DIR / 'ai_scraper_output' / 'products.json'
TARGET_DIR = SCRIPT_DIR.parent / 'shop' / 'public' / 'images'


def sync_media():
    print("🖼️  SYNCING MEDIA TO SHOP")
    print("=" * 60)
    
    # Create target directory
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load products for naming
    with open(PRODUCTS_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    products = data.get('products', [])
    copied = 0
    
    for idx, product in enumerate(products, 1):
        folder_name = f"product_{idx:03d}"
        folder_path = MEDIA_DIR / folder_name
        
        if not folder_path.exists():
            print(f"  ⚠️  {folder_name}: Not found")
            continue
        
        product_id = product.get('product_id', f'p{idx}')
        title_slug = product.get('title_en', '')[:30].replace(' ', '-').replace('/', '-').lower()
        slug = f"{product_id}-{title_slug}"
        
        # Copy main image
        main_dir = folder_path / 'Main'
        if main_dir.exists():
            for img in main_dir.iterdir():
                if img.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                    target = TARGET_DIR / f"{slug}-main{img.suffix}"
                    shutil.copy2(img, target)
                    copied += 1
                    break  # Only first main image
        
        # Copy catalogue images
        cat_dir = folder_path / 'Catalogue'
        if cat_dir.exists():
            for i, img in enumerate(sorted(cat_dir.iterdir()), 1):
                if img.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                    target = TARGET_DIR / f"{slug}-cat{i:02d}{img.suffix}"
                    shutil.copy2(img, target)
                    copied += 1
        
        # Copy stitched details
        details = folder_path / 'details_stitched.jpg'
        if details.exists():
            target = TARGET_DIR / f"{slug}-details.jpg"
            shutil.copy2(details, target)
            copied += 1
        
        print(f"  ✅ {folder_name}: {product_id}")
    
    print("\n" + "=" * 60)
    print(f"✅ Copied {copied} images to {TARGET_DIR}")
    
    return copied


if __name__ == '__main__':
    sync_media()
