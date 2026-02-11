#!/usr/bin/env python3
"""
Quick Product Editor
--------------------
Interactive tool to edit products from folders.

Usage:
    python3 edit_product.py                  # List all products
    python3 edit_product.py 5                # Edit product_005
    python3 edit_product.py --search belt    # Search for products
"""

import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict

SCRIPT_DIR = Path(__file__).parent
PRODUCTS_DIR = SCRIPT_DIR / 'ai_scraper_output' / 'products'


def list_products(search_term: str = None):
    """List all products with optional search"""
    if not PRODUCTS_DIR.exists():
        print(f"❌ Products directory not found: {PRODUCTS_DIR}")
        print("   Run: python3 csv_to_folders.py")
        return
    
    product_folders = sorted([f for f in PRODUCTS_DIR.iterdir() if f.is_dir() and f.name.startswith('product_')])
    
    if not product_folders:
        print(f"❌ No product folders found")
        return
    
    print(f"\n📦 PRODUCTS ({len(product_folders)} total)")
    print("=" * 80)
    
    for folder in product_folders:
        product_file = folder / 'product.txt'
        if not product_file.exists():
            continue
        
        # Read product info
        product_id = ''
        title = ''
        with open(product_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('ID:'):
                    product_id = line.split(':', 1)[1].strip()
                elif line.startswith('Title (EN):'):
                    title = line.split(':', 1)[1].strip()
        
        # Filter by search term
        if search_term:
            search_lower = search_term.lower()
            if search_lower not in title.lower() and search_lower not in product_id.lower():
                continue
        
        # Count variants
        variants_file = folder / 'variants.txt'
        variant_count = 0
        if variants_file.exists():
            with open(variants_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        variant_count += 1
        
        folder_num = folder.name.replace('product_', '')
        print(f"{folder_num:>3}. {title[:55]}")
        print(f"     ID: {product_id}  |  Variants: {variant_count}")
        print()


def edit_product(product_num: int):
    """Open product files for editing"""
    folder_name = f"product_{product_num:03d}"
    product_folder = PRODUCTS_DIR / folder_name
    
    if not product_folder.exists():
        print(f"❌ Product folder not found: {folder_name}")
        return
    
    product_file = product_folder / 'product.txt'
    variants_file = product_folder / 'variants.txt'
    notes_file = product_folder / 'notes.txt'
    
    if not product_file.exists():
        print(f"❌ product.txt not found in {folder_name}")
        return
    
    # Read product title
    title = ''
    with open(product_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('Title (EN):'):
                title = line.split(':', 1)[1].strip()
                break
    
    print(f"\n📝 EDITING: {title}")
    print("=" * 80)
    print(f"Folder: {product_folder}")
    print()
    print(f"Files:")
    print(f"  • product.txt  - Product info")
    print(f"  • variants.txt - Variant list")
    print(f"  • notes.txt    - Your notes")
    print()
    
    # Try to open in VSCode or default editor
    try:
        import subprocess
        
        # Try VSCode first
        result = subprocess.run(['code', str(product_folder)], capture_output=True)
        if result.returncode == 0:
            print("✅ Opened in VSCode")
            print()
            print("💡 After editing:")
            print(f"   python3 folders_to_knack.py --product {product_num}")
            return
        
        # Fall back to default editor
        if sys.platform == 'darwin':  # macOS
            subprocess.run(['open', str(product_folder)])
            print("✅ Opened in default app")
        elif sys.platform == 'win32':  # Windows
            os.startfile(str(product_folder))
            print("✅ Opened in default app")
        else:  # Linux
            subprocess.run(['xdg-open', str(product_folder)])
            print("✅ Opened in default app")
        
        print()
        print("💡 After editing:")
        print(f"   python3 folders_to_knack.py --product {product_num}")
        
    except Exception as e:
        print(f"⚠️  Could not open automatically: {e}")
        print()
        print("📂 Open manually:")
        print(f"   {product_folder}")
        print()
        print("💡 After editing:")
        print(f"   python3 folders_to_knack.py --product {product_num}")


def main():
    parser = argparse.ArgumentParser(description='Quick product editor')
    parser.add_argument('product', type=int, nargs='?', help='Product number to edit')
    parser.add_argument('--search', '-s', help='Search products by title or ID')
    parser.add_argument('--list', '-l', action='store_true', help='List all products')
    args = parser.parse_args()
    
    if args.product:
        edit_product(args.product)
    elif args.search:
        list_products(args.search)
    else:
        list_products()


if __name__ == '__main__':
    main()
