#!/usr/bin/env python3
"""
Stitch Detail Images
--------------------
Combines all detail images from each product into a single vertical image.
"""

import os
import sys
from PIL import Image
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
MEDIA_DIR = SCRIPT_DIR / 'ai_scraper_output' / 'media'


def get_detail_images(product_folder: Path) -> list:
    """Get all detail images from a product folder, sorted by number."""
    details_folder = product_folder / 'Details'
    if not details_folder.exists():
        return []
    
    images = []
    for f in sorted(details_folder.iterdir()):
        if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
            images.append(f)
    
    return images


def stitch_images_vertical(images: list, output_path: Path, target_width: int = 800) -> bool:
    """Stitch images vertically into a single image."""
    if not images:
        return False
    
    # Load and resize all images to same width
    loaded_images = []
    for img_path in images:
        try:
            img = Image.open(img_path)
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # Resize to target width, maintaining aspect ratio
            if img.width != target_width:
                ratio = target_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
            
            loaded_images.append(img)
        except Exception as e:
            print(f"  ⚠️ Failed to load {img_path.name}: {e}")
            continue
    
    if not loaded_images:
        return False
    
    # Calculate total height
    total_height = sum(img.height for img in loaded_images)
    
    # Create combined image
    combined = Image.new('RGB', (target_width, total_height), (255, 255, 255))
    
    # Paste images
    y_offset = 0
    for img in loaded_images:
        combined.paste(img, (0, y_offset))
        y_offset += img.height
    
    # Save
    combined.save(output_path, 'JPEG', quality=85, optimize=True)
    
    # Close images to free memory
    for img in loaded_images:
        img.close()
    
    return True


def main():
    print("🖼️  STITCHING DETAIL IMAGES")
    print("=" * 60)
    
    if not MEDIA_DIR.exists():
        print(f"❌ Media folder not found: {MEDIA_DIR}")
        sys.exit(1)
    
    # Get all product folders
    product_folders = sorted([f for f in MEDIA_DIR.iterdir() if f.is_dir() and f.name.startswith('product_')])
    
    print(f"Found {len(product_folders)} product folders\n")
    
    success_count = 0
    skip_count = 0
    
    for folder in product_folders:
        product_num = folder.name.replace('product_', '')
        detail_images = get_detail_images(folder)
        
        if not detail_images:
            print(f"  {folder.name}: No detail images found")
            skip_count += 1
            continue
        
        # Output path
        output_path = folder / 'details_stitched.jpg'
        
        # Check if already exists
        if output_path.exists():
            print(f"  {folder.name}: Already stitched ({len(detail_images)} images)")
            success_count += 1
            continue
        
        print(f"  {folder.name}: Stitching {len(detail_images)} images...", end=' ')
        
        if stitch_images_vertical(detail_images, output_path):
            file_size = output_path.stat().st_size / 1024  # KB
            print(f"✅ ({file_size:.0f} KB)")
            success_count += 1
        else:
            print("❌ Failed")
    
    print("\n" + "=" * 60)
    print(f"✅ Stitched: {success_count}")
    print(f"⏭️  Skipped: {skip_count}")
    print(f"📁 Output: {MEDIA_DIR}")


if __name__ == '__main__':
    main()
