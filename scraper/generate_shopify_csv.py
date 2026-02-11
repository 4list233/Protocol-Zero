#!/usr/bin/env python3
import json
import csv

# Load translated JSON
with open('ai_scraper_output/products.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Shopify CSV header
header = [
    'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
    'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
    'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty',
    'Variant Inventory Policy', 'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
    'Variant Requires Shipping', 'Variant Taxable', 'Variant Barcode', 'Image Src', 'Image Position',
    'Image Alt Text', 'Gift Card', 'SEO Title', 'SEO Description', 'Google Shopping / Google Product Category',
    'Google Shopping / Gender', 'Google Shopping / Age Group', 'Google Shopping / MPN',
    'Google Shopping / Condition', 'Google Shopping / Custom Product', 'Variant Image',
    'Variant Weight Unit', 'Variant Tax Code', 'Cost per item', 'Included / United States',
    'Price / United States', 'Compare At Price / United States', 'Included / International',
    'Price / International', 'Compare At Price / International', 'Status'
]

rows = [header]

for product in data['products']:
    # Use English title
    title = product.get('title_en', product.get('title_zh', ''))
    
    # Create handle
    handle = title.lower()
    handle = ''.join(c if c.isalnum() or c in [' ', '-'] else '' for c in handle)
    handle = '-'.join(handle.split())[:100]
    
    # Get images
    images = product.get('images', {})
    all_images = images.get('Main', []) + images.get('Catalogue', [])
    detail_images = images.get('Details', [])
    
    # Create HTML body
    body_html = f'<p>{title}</p>'
    if detail_images:
        body_html += '<div class="product-details">'
        for detail_img in detail_images[:5]:
            img_rel = detail_img.replace('/Users/5425855/Documents/protocol-zero/scraper/ai_scraper_output/', '')
            body_html += f'<img src="{img_rel}" alt="Product detail" />'
        body_html += '</div>'
    
    variants = product.get('variants', [])
    
    # Get option names
    option1_name = variants[0].get('option_type_1', '') if variants else ''
    option2_name = variants[0].get('option_type_2', '') if variants else ''
    
    # Add variant rows
    for idx, variant in enumerate(variants):
        is_first = idx == 0
        
        row = [
            handle,
            title if is_first else '',
            body_html if is_first else '',
            'Protocol Zero' if is_first else '',
            'Sporting Goods > Outdoor Recreation > Tactical & Gear' if is_first else '',
            'Tactical Gear' if is_first else '',
            'Tactical, Imported' if is_first else '',
            'TRUE' if is_first else '',
            option1_name if is_first else '',
            variant.get('option_value_1', ''),
            option2_name if is_first else '',
            variant.get('option_value_2', ''),
            '', '',  # Option 3
            variant.get('sku', ''),
            '',  # Grams
            'shopify',
            '100' if variant.get('in_stock', True) else '0',
            'deny', 'manual',
            str(variant.get('price_cad', '')),
            '',  # Compare price
            'TRUE', 'TRUE', '',  # Shipping, Taxable, Barcode
            '', '', '',  # Image Src, Position, Alt
            'FALSE',
            title if is_first else '',
            title if is_first else '',
            '',  # Google category
            'unisex' if is_first else '',
            'adult' if is_first else '',
            product.get('product_id', '') if is_first else '',
            'new' if is_first else '',
            'TRUE' if is_first else '',
            '', 'g', '',  # Variant Image, Weight Unit, Tax Code
            str(variant.get('cost_cad', '')),
            'TRUE' if is_first else '', '', '',  # US pricing
            'TRUE' if is_first else '', '', '',  # Intl pricing
            'active' if is_first else ''
        ]
        rows.append(row)
    
    # Add image rows
    for img_idx, img_path in enumerate(all_images[:10], start=len(variants) + 1):
        img_rel = img_path.replace('/Users/5425855/Documents/protocol-zero/scraper/ai_scraper_output/', '')
        img_row = [''] * len(header)
        img_row[0] = handle
        img_row[25] = img_rel
        img_row[26] = str(img_idx)
        img_row[27] = f'{title} - Image {img_idx}'
        rows.append(img_row)

# Write CSV
with open('ai_scraper_output/products_shopify.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print(f"✅ Generated Shopify CSV with {len(rows)-1} rows")
print(f"✅ {len(data['products'])} products with English translations")
print(f"📁 Saved to: ai_scraper_output/products_shopify.csv")
