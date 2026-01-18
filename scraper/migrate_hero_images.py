#!/usr/bin/env python3
"""
Migrate Existing Images to New Hero Naming Convention
------------------------------------------------------
Converts existing images from old naming to new hero-01 through hero-07 format.

Old naming:
- [product-id]-main.jpg
- [product-id]-cat01.jpg
- [product-id]-Details_Long.jpg

New naming:
- [product-id]-hero-01.jpg (main)
- [product-id]-hero-02.jpg (cat01)
- [product-id]-hero-03.jpg (cat02)
- ...
- [product-id]-details.jpg (long stitched)
"""

import os
import shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SHOP_IMAGES = SCRIPT_DIR.parent / 'shop' / 'public' / 'images'


def migrate_images():
    print("🔄 MIGRATING IMAGES TO NEW HERO NAMING")
    print("=" * 60)
    
    if not SHOP_IMAGES.exists():
        print(f"❌ Images directory not found: {SHOP_IMAGES}")
        return
    
    # Group files by product ID
    product_files = {}
    
    for file in SHOP_IMAGES.iterdir():
        if not file.is_file():
            continue
        
        filename = file.name
        
        # Skip already migrated files
        if '-hero-' in filename or filename == 'placeholder.png':
            continue
        
        # Extract product ID (everything before the last dash and file type indicator)
        parts = filename.rsplit('-', 1)
        if len(parts) != 2:
            continue
        
        product_id = parts[0]
        file_type = parts[1].lower()
        
        if product_id not in product_files:
            product_files[product_id] = {
                'main': None,
                'catalogue': [],
                'details': None
            }
        
        # Categorize file
        if 'main' in file_type:
            product_files[product_id]['main'] = file
        elif 'cat' in file_type or 'catalog' in file_type:
            product_files[product_id]['catalogue'].append(file)
        elif 'detail' in file_type or 'long' in file_type:
            product_files[product_id]['details'] = file
    
    # Migrate each product's files
    migrated_count = 0
    
    for product_id, files in product_files.items():
        print(f"\n📦 {product_id}")
        
        # Migrate main image to hero-01
        if files['main']:
            old_path = files['main']
            ext = old_path.suffix
            new_path = SHOP_IMAGES / f"{product_id}-hero-01{ext}"
            
            if not new_path.exists():
                shutil.copy2(old_path, new_path)
                print(f"  ✅ {old_path.name} → hero-01{ext}")
                migrated_count += 1
            else:
                print(f"  ⏭️  hero-01{ext} already exists")
        
        # Migrate catalogue images to hero-02 through hero-07
        files['catalogue'].sort(key=lambda f: f.name)
        for idx, cat_file in enumerate(files['catalogue'][:6], start=2):  # Max 6 catalogue images
            old_path = cat_file
            ext = old_path.suffix
            new_path = SHOP_IMAGES / f"{product_id}-hero-{idx:02d}{ext}"
            
            if not new_path.exists():
                shutil.copy2(old_path, new_path)
                print(f"  ✅ {old_path.name} → hero-{idx:02d}{ext}")
                migrated_count += 1
            else:
                print(f"  ⏭️  hero-{idx:02d}{ext} already exists")
        
        # Migrate details image
        if files['details']:
            old_path = files['details']
            ext = old_path.suffix
            new_path = SHOP_IMAGES / f"{product_id}-details{ext}"
            
            if not new_path.exists():
                shutil.copy2(old_path, new_path)
                print(f"  ✅ {old_path.name} → details{ext}")
                migrated_count += 1
            else:
                print(f"  ⏭️  details{ext} already exists")
    
    print("\n" + "=" * 60)
    print(f"✅ Migrated {migrated_count} images to new naming convention")
    print("\n💡 TIP: Old images are preserved. You can delete them after verifying new images work.")
    print("   To delete old images: rm shop/public/images/*-main.* shop/public/images/*-cat*.* shop/public/images/*-Details_Long.*")


if __name__ == '__main__':
    migrate_images()
