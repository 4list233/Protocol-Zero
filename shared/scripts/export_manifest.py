#!/usr/bin/env python3
"""
Export scraper data to shop-compatible JSON manifest
Add this to scraper.py after CSV export
"""

import json
import os
import re
from datetime import datetime
from collections import defaultdict

def media_slug(media_folder):
    """Normalize media folder names to match synced filenames (strip product_# prefixes)."""
    if not media_folder:
        return ''
    return re.sub(r'^product_\d+_', '', media_folder)

def slugify(text):
    """Convert text to URL-friendly slug"""
    text = text.lower()
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'[^a-z0-9\-]', '', text)
    return text[:50]

def categorize_product(title):
    """Auto-categorize product based on title keywords"""
    title_lower = title.lower()
    
    if any(word in title_lower for word in ['grenade', 'water bomb', 'm67', 'm26']):
        return 'Grenades'
    elif any(word in title_lower for word in ['holster', 'gun case', 'pistol case', 'glock', '2011', '1911']):
        return 'Holsters'
    elif any(word in title_lower for word in ['ptt', 'headset', 'adapter', 'radio', 'kenwood', 'motorola']):
        return 'Radio & PTT'
    elif any(word in title_lower for word in ['vest', 'molle', 'chest', 'pda', 'panel', 'pouch']):
        return 'Pouches'
    elif any(word in title_lower for word in ['helmet', 'battery', 'mount']):
        return 'Helmets & Accessories'
    elif any(word in title_lower for word in ['mask', 'goggle', 'eye protection']):
        return 'Eye Protection'
    else:
        return 'Tactical Gear'

def export_products_manifest(all_scraped_data, output_dir='../shared/data', script_dir=None):
    """Export shop-compatible JSON manifest from scraped data"""
    
    if script_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
    
    manifest_path = os.path.join(script_dir, output_dir, 'products_manifest.json')
    catalog_path = os.path.join(script_dir, output_dir, 'catalog_index.json')
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    
    print("\n🔄 Generating products_manifest.json for shop...")
    
    # Group variants by URL (product)
    products_by_url = defaultdict(lambda: {
        'variants': [],
        'images': set(),
        'options_values': set()
    })
    
    for row in all_scraped_data:
        url = row.get('URL', '')
        if not url:
            continue
            
        product_data = products_by_url[url]
        
        # Store first row data for product-level fields
        if not product_data.get('title'):
            translated_title = (row.get('Translated Title', '') or '').strip()
            original_title = (row.get('Product Title', '') or '').strip()
            product_data['title'] = translated_title or original_title
            product_data['title_en'] = translated_title
            product_data['original_title'] = original_title
            product_data['media_folder'] = row.get('Media Folder', '')
            product_data['url'] = url
        
        # Add variant data
        product_data['variants'].append({
            'option': row.get('Option Name', ''),
            'price_cad': row.get('Final CAD', 0.0) or 0.0,
            'price_cny': row.get('Price CNY', 0.0) or 0.0
        })
        
        # Collect unique option values
        if row.get('Option Name'):
            product_data['options_values'].add(row.get('Option Name'))
    
    # Build products list
    products = []
    for url, data in products_by_url.items():
        # Generate ID from slug
        product_id = slugify(data['title'])
        
        # Determine primary image and all images
        media_folder = data['media_folder']
        media_folder_slug = media_slug(media_folder)
        primary_image = f"/images/{media_folder_slug}-Main.jpg" if media_folder_slug else ""
        
        # Collect all images (Main + Catalogue)
        images = []
        detail_long_image = None
        if media_folder_slug:
            # Add Main image
            images.append(f"/images/{media_folder_slug}-Main.jpg")
            
            # Add Catalogue images (gallery images, assume up to 20)
            for i in range(1, 21):
                catalogue_img = f"/images/{media_folder_slug}-Catalogue_{i:02d}.jpg"
                images.append(catalogue_img)
            
            # Set detail long image path
            detail_long_image = f"/images/{media_folder_slug}-Details_Long.jpg"
        
        # Get average price across variants
        variant_prices = [v['price_cad'] for v in data['variants'] if v['price_cad'] > 0]
        avg_price = round(sum(variant_prices) / len(variant_prices), 2) if variant_prices else 0.0
        
        # Build product object
        title = data.get('title') or data.get('original_title') or 'Untitled Product'
        product = {
            'id': product_id,
            'sku': f"AUTO-{len(products) + 1:03d}",
            'title': title,
            'price_cad': avg_price,
            'primaryImage': primary_image,
            'images': images[:15],  # Limit to 15 images to avoid huge payloads
            'detailLongImage': detail_long_image,  # Stitched detail image
            'url': url,
            'category': categorize_product(title),
            'description': f"Imported from Taobao. {title}",
            'options': [
                {
                    'name': 'Variant',
                    'values': list(data['options_values'])
                }
            ] if data['options_values'] else [],
            'variants': data['variants']
        }

        if data.get('title_en'):
            product['title_en'] = data['title_en']
        if data.get('original_title'):
            product['title_original'] = data['original_title']
        
        products.append(product)
    
    # Create manifest
    manifest = {
        'last_updated': datetime.now().isoformat(),
        'total_products': len(products),
        'total_variants': len(all_scraped_data),
        'products': products
    }
    
    # Write manifest
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    print(f"   ✅ Exported {len(products)} products with {len(all_scraped_data)} variants")
    print(f"   📄 Manifest saved to: {manifest_path}")
    
    # Update catalog index for duplicate detection
    try:
        if os.path.exists(catalog_path):
            with open(catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
        else:
            catalog = {'last_updated': None, 'products': {}}
        
        # Update catalog with new products
        for product in products:
            catalog['products'][product['url']] = {
                'id': product['id'],
                'title': product['title'],
                'last_scraped': datetime.now().isoformat(),
                'status': 'active',
                'variants': len(product.get('variants', []))
            }
        
        catalog['last_updated'] = datetime.now().isoformat()
        
        with open(catalog_path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        
        print(f"   ✅ Updated catalog index: {catalog_path}")
    except Exception as e:
        print(f"   ⚠️  Warning: Could not update catalog index: {e}")
    
    return manifest_path

# Example usage (add to main() function after CSV export):
# export_products_manifest(all_scraped_data)
