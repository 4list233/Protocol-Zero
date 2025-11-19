#!/usr/bin/env python3
"""
Stitch detail images into a single long scrollable image.
Run this AFTER manually filtering out unwanted images from Details/ folders.

Usage:
    python3 stitch-details.py                    # Process all products
    python3 stitch-details.py product_1_slug     # Process specific product
    python3 stitch-details.py --confirm          # Skip confirmation prompt
"""

import os
import sys
from pathlib import Path
from PIL import Image

# Configuration
MEDIA_DIR = Path("media")
MAX_WIDTH = 1200
SPACING = 0  # Pixels between images (0 => seamless)


def stitch_images_vertically(image_paths, output_path, max_width=1200, spacing=0):
    """Stitch multiple images into one vertical long image."""
    if not image_paths:
        print("  ⚠️  No images to stitch")
        return False
    
    try:
        images = []
        for path in image_paths:
            img = Image.open(path)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if too wide
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            images.append(img)
        
        # Calculate total height
        total_height = sum(img.height for img in images) + spacing * max(len(images) - 1, 0)
        
        # Use the widest image width
        canvas_width = max(img.width for img in images)
        # Pick canvas background that matches the first image to avoid white seams
        base_color = images[0].getpixel((0, 0)) if images else (0, 0, 0)
        
        # Create canvas
        canvas = Image.new('RGB', (canvas_width, total_height), base_color)
        
        # Paste images
        y_offset = 0
        for img in images:
            # Center horizontally if image is narrower than canvas
            x_offset = (canvas_width - img.width) // 2
            canvas.paste(img, (x_offset, y_offset))
            y_offset += img.height + spacing
        
        # Save with high quality
        canvas.save(output_path, 'JPEG', quality=95)
        
        # Close images
        for img in images:
            img.close()
        
        return True
    
    except Exception as e:
        print(f"  ❌ Stitch error: {e}")
        return False


def process_product_folder(product_folder: Path, skip_confirm=False):
    """Process one product folder and stitch its detail images."""
    details_dir = product_folder / "Details"
    
    if not details_dir.exists():
        print(f"  ⏭️  No Details/ folder found")
        return False
    
    # Find all Detail_XX.jpg files (not Details_Long.jpg)
    detail_files = sorted([
        f for f in details_dir.glob("Detail_*.jpg")
        if f.name != "Details_Long.jpg"
    ])
    
    if not detail_files:
        print(f"  ⏭️  No detail images found")
        return False
    
    print(f"  📸 Found {len(detail_files)} detail images")
    
    # Show files
    for i, f in enumerate(detail_files, 1):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"      {i}. {f.name} ({size_mb:.2f} MB)")
    
    # Confirm before stitching
    if not skip_confirm:
        response = input(f"\n  ✅ Stitch these {len(detail_files)} images? [Y/n]: ").strip().lower()
        if response and response not in ['y', 'yes']:
            print(f"  ⏭️  Skipped by user")
            return False
    
    # Stitch
    output_path = details_dir / "Details_Long.jpg"
    print(f"\n  🔄 Stitching {len(detail_files)} images...")
    
    success = stitch_images_vertically(
        detail_files,
        output_path,
        max_width=MAX_WIDTH,
        spacing=SPACING
    )
    
    if success:
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"  ✅ Created: {output_path.name} ({size_mb:.2f} MB)")
        return True
    else:
        return False


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Stitch detail images after manual filtering")
    parser.add_argument('product', nargs='?', help="Specific product folder name (optional)")
    parser.add_argument('--confirm', action='store_true', help="Skip confirmation prompts")
    
    args = parser.parse_args()
    
    print("🖼️  Protocol Zero - Detail Image Stitcher")
    print("=" * 60)
    
    if not MEDIA_DIR.exists():
        print(f"❌ Media directory not found: {MEDIA_DIR}")
        return 1
    
    # Get product folders to process
    if args.product:
        product_folders = [MEDIA_DIR / args.product]
        if not product_folders[0].exists():
            print(f"❌ Product folder not found: {args.product}")
            return 1
    else:
        product_folders = sorted([
            f for f in MEDIA_DIR.iterdir()
            if f.is_dir() and f.name.startswith("product_")
        ])
    
    if not product_folders:
        print("❌ No product folders found")
        return 1
    
    print(f"\n📦 Found {len(product_folders)} product folder(s)\n")
    
    # Process each folder
    success_count = 0
    skip_count = 0
    fail_count = 0
    
    for folder in product_folders:
        print(f"📁 {folder.name}")
        result = process_product_folder(folder, skip_confirm=args.confirm)
        
        if result:
            success_count += 1
        elif result is False:
            skip_count += 1
        else:
            fail_count += 1
        
        print()  # Blank line between products
    
    # Summary
    print("=" * 60)
    print(f"✅ Stitched: {success_count}")
    print(f"⏭️  Skipped: {skip_count}")
    print(f"❌ Failed: {fail_count}")
    print(f"📊 Total: {len(product_folders)}")


if __name__ == "__main__":
    sys.exit(main() or 0)
