#!/usr/bin/env python3
"""Diagnostic: Check what images would be generated for products"""

import os
from pathlib import Path

# Check what images actually exist
images_dir = Path(__file__).parent / '..' / 'shop' / 'public' / 'images'

# Test products from Knack
test_product_ids = [
    '586117181099',
    '643256207245',
    '646929225114',
    '654310678238',
    '678253192936'
]

print("CHECKING IMAGE AVAILABILITY FOR PRODUCTS")
print("=" * 70)

for product_id in test_product_ids:
    print(f"\nProduct ID: {product_id}")
    print("-" * 50)
    
    # Check for hero images (hero-01 through hero-07)
    hero_images = []
    for i in range(1, 8):
        num = f"{i:02d}"
        hero_path = images_dir / f"{product_id}-hero-{num}.jpg"
        if hero_path.exists():
            hero_images.append(f"/images/{product_id}-hero-{num}.jpg")
            print(f"  ✅ hero-{num}.jpg exists")
    
    # Check for legacy Main image
    main_path = images_dir / f"{product_id}-Main.jpg"
    if main_path.exists():
        print(f"  ✅ Main.jpg exists")
        hero_images.append(f"/images/{product_id}-Main.jpg")
    
    # Check for details image
    details_path = images_dir / f"{product_id}-details.jpg"
    legacy_details_path = images_dir / f"{product_id}-Details_Long.jpg"
    
    if details_path.exists():
        print(f"  ✅ details.jpg exists")
    elif legacy_details_path.exists():
        print(f"  ✅ Details_Long.jpg exists (legacy)")
    else:
        print(f"  ❌ No details image")
    
    if not hero_images:
        print(f"  ⚠️  WARNING: No hero images found!")
        # Check for any images with this product ID
        matching = list(images_dir.glob(f"{product_id}*"))
        if matching:
            print(f"  Found {len(matching)} files with this ID:")
            for f in matching[:3]:
                print(f"    - {f.name}")
    else:
        print(f"  Total hero images: {len(hero_images)}")

print("\n" + "=" * 70)
