#!/usr/bin/env python3
"""
Convert CSV to Folder-Based Structure
--------------------------------------
Converts existing CSV product data into individual product folders with text files.

Structure:
  scraper/ai_scraper_output/products/
  ├── product_001/
  │   ├── product.txt       # Product metadata
  │   ├── variants.txt      # All variants
  │   └── notes.txt         # Optional notes/edits
  └── product_002/
      └── ...

This makes it easy to:
- Edit individual products without CSV
- Review/modify specific variants
- Track changes per product
- Reseed individual products
"""

import os
import csv
import json
from pathlib import Path
from typing import Dict, List

SCRIPT_DIR = Path(__file__).parent
CSV_FILE = SCRIPT_DIR / 'protocol_zero_variants.csv'
JSON_FILE = SCRIPT_DIR / 'ai_scraper_output' / 'products.json'
PRODUCTS_DIR = SCRIPT_DIR / 'ai_scraper_output' / 'products'


def csv_to_folders():
    """Convert CSV to folder structure"""
    print("📁 CONVERTING CSV TO FOLDER STRUCTURE")
    print("=" * 60)
    
    # Create products directory
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Try loading from JSON first (has better structure)
    if JSON_FILE.exists():
        print(f"📦 Loading from {JSON_FILE.name}")
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        products = data.get('products', [])
        convert_from_json(products)
        
    elif CSV_FILE.exists():
        print(f"📦 Loading from {CSV_FILE.name}")
        convert_from_csv()
        
    else:
        print("❌ No data file found (products.json or protocol_zero_variants.csv)")
        return
    
    print(f"\n✅ Conversion complete! Products saved to:")
    print(f"   {PRODUCTS_DIR}")


def convert_from_json(products: List[Dict]):
    """Convert from products.json format"""
    for idx, product in enumerate(products, 1):
        folder_name = f"product_{idx:03d}"
        product_folder = PRODUCTS_DIR / folder_name
        product_folder.mkdir(exist_ok=True)
        
        # Write product info
        product_file = product_folder / 'product.txt'
        with open(product_file, 'w', encoding='utf-8') as f:
            f.write(f"# Product Information\n\n")
            f.write(f"ID: {product.get('product_id', '')}\n")
            f.write(f"Title (EN): {product.get('title_en', '')}\n")
            f.write(f"Title (ZH): {product.get('title_zh', '')}\n")
            f.write(f"URL: {product.get('url', '')}\n")
            f.write(f"Category: {product.get('category', '')}\n")
            f.write(f"Status: Active\n")
            f.write(f"\n# Description\n")
            f.write(f"{product.get('description', '')}\n")
        
        # Write variants
        variants = product.get('variants', [])
        if variants:
            variants_file = product_folder / 'variants.txt'
            with open(variants_file, 'w', encoding='utf-8') as f:
                f.write(f"# Variants for {product.get('title_en', '')}\n")
                f.write(f"# Format: Name | Price CNY | Price CAD | Margin | Status\n")
                f.write(f"# Edit this file to modify variants, then run: python folders_to_knack.py\n\n")
                
                for variant in variants:
                    name = variant.get('variant_name_en') or variant.get('variant_name') or variant.get('name', '')
                    price_cny = variant.get('price_cny', 0)
                    price_cad = variant.get('price_cad', 0)
                    margin = variant.get('margin_standard') or variant.get('margin', 0)
                    status = variant.get('status', 'Active')
                    
                    f.write(f"{name} | {price_cny} | {price_cad} | {margin}% | {status}\n")
        
        # Create empty notes file
        notes_file = product_folder / 'notes.txt'
        if not notes_file.exists():
            with open(notes_file, 'w', encoding='utf-8') as f:
                f.write(f"# Notes for {product.get('title_en', '')}\n\n")
                f.write(f"# Add any special notes, pricing changes, or edits here\n")
        
        print(f"✅ {folder_name}: {product.get('title_en', '')[:40]}")


def convert_from_csv():
    """Convert from CSV format"""
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    # Group by product
    products = {}
    for row in rows:
        product_id = row.get('product_id', '')
        if not product_id:
            continue
        
        if product_id not in products:
            products[product_id] = {
                'product': row,
                'variants': []
            }
        
        products[product_id]['variants'].append(row)
    
    # Create folders
    for idx, (product_id, data) in enumerate(sorted(products.items()), 1):
        folder_name = f"product_{idx:03d}"
        product_folder = PRODUCTS_DIR / folder_name
        product_folder.mkdir(exist_ok=True)
        
        product = data['product']
        
        # Write product info
        product_file = product_folder / 'product.txt'
        with open(product_file, 'w', encoding='utf-8') as f:
            f.write(f"# Product Information\n\n")
            f.write(f"ID: {product.get('product_id', '')}\n")
            f.write(f"Title: {product.get('title', '')}\n")
            f.write(f"URL: {product.get('url', '')}\n")
            f.write(f"Status: Active\n")
        
        # Write variants
        variants_file = product_folder / 'variants.txt'
        with open(variants_file, 'w', encoding='utf-8') as f:
            f.write(f"# Variants\n")
            f.write(f"# Format: Name | Price CNY | Price CAD | Status\n\n")
            
            for variant in data['variants']:
                name = variant.get('variant_name', '')
                price_cny = variant.get('price_cny', 0)
                price_cad = variant.get('price_cad', 0)
                status = variant.get('status', 'Active')
                
                f.write(f"{name} | {price_cny} | {price_cad} | {status}\n")
        
        # Create notes file
        notes_file = product_folder / 'notes.txt'
        with open(notes_file, 'w', encoding='utf-8') as f:
            f.write(f"# Notes\n\n")
        
        print(f"✅ {folder_name}: {product.get('title', '')[:40]}")


if __name__ == '__main__':
    csv_to_folders()
