#!/usr/bin/env python3
import os
from typing import Dict, List

MEDIA_DIR = 'ai_scraper_output/media'

def scan_product_images(product_index: int) -> Dict[str, List[str]]:
    """Scan media directory for a product and collect image paths."""
    images = {
        'Main': [],
        'Catalogue': [],
        'Details': []
    }
    
    # Construct media folder path using zero-padded index
    folder_name = f"product_{product_index:03d}"
    product_folder = os.path.join(MEDIA_DIR, folder_name)
    
    print(f"Scanning {folder_name}: exists={os.path.exists(product_folder)}")
    
    if not os.path.exists(product_folder):
        return images
    
    # Scan Main folder
    main_folder = os.path.join(product_folder, 'Main')
    if os.path.exists(main_folder):
        for file in sorted(os.listdir(main_folder)):
            if file.lower().endswith(('.jpg', '.jpeg', '.png')) and not file.startswith('.'):
                images['Main'].append(os.path.join(main_folder, file))
                print(f"  Main: {file}")
    
    # Scan Catalogue folder
    catalogue_folder = os.path.join(product_folder, 'Catalogue')
    if os.path.exists(catalogue_folder):
        for file in sorted(os.listdir(catalogue_folder)):
            if file.lower().endswith(('.jpg', '.jpeg', '.png')) and not file.startswith('.'):
                images['Catalogue'].append(os.path.join(catalogue_folder, file))
                print(f"  Catalogue: {file}")
    
    # Scan Details folder - ONLY collect Details_Long.jpg (the stitched image)
    details_folder = os.path.join(product_folder, 'Details')
    if os.path.exists(details_folder):
        details_long = os.path.join(details_folder, 'Details_Long.jpg')
        if os.path.exists(details_long):
            images['Details'].append(details_long)
            print(f"  Details: Details_Long.jpg ← STITCHED IMAGE")
        else:
            # Fallback: look for case-insensitive match
            for file in os.listdir(details_folder):
                if file.lower() == 'details_long.jpg':
                    images['Details'].append(os.path.join(details_folder, file))
                    print(f"  Details: {file} ← STITCHED IMAGE")
                    break
            if not images['Details']:
                print(f"  Details: ⚠️  Details_Long.jpg NOT FOUND")
    
    return images

# Test
print("="*60)
for i in [1, 2, 3, 4]:
    print(f"\nProduct {i}:")
    result = scan_product_images(i)
    print(f"Total: Main={len(result['Main'])}, Catalogue={len(result['Catalogue'])}, Details={len(result['Details'])}")
