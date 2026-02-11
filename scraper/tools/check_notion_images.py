#!/usr/bin/env python3
"""Check what images are stored in Notion"""

import requests
import json
import os
from dotenv import load_dotenv

# Load env from project root .env
project_root = os.path.join(os.path.dirname(__file__), '..', '..')
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

NOTION_API_KEY = os.getenv('NOTION_API_KEY')
PRODUCTS_DB = os.getenv('NOTION_DATABASE_ID_PRODUCTS')

headers = {
    'Authorization': f'Bearer {NOTION_API_KEY}',
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
}

# Query first 5 products
response = requests.post(
    f'https://api.notion.com/v1/databases/{PRODUCTS_DB}/query',
    headers=headers,
    json={'page_size': 5}
)

if response.ok:
    data = response.json()
    print(f'Found {len(data["results"])} products in Notion\n')
    for page in data['results']:
        props = page.get('properties', {})
        
        # Get basic info
        product_id_texts = props.get('Product ID', {}).get('rich_text', [])
        product_id = product_id_texts[0].get('text', {}).get('content', 'N/A') if product_id_texts else 'N/A'
        
        sku_texts = props.get('Product SKU', {}).get('rich_text', [])
        sku = sku_texts[0].get('text', {}).get('content', 'N/A') if sku_texts else 'N/A'
        
        title_texts = props.get('Name', {}).get('title', [])
        title = title_texts[0].get('text', {}).get('content', 'N/A') if title_texts else 'N/A'
        
        # Check Images property (Files type)
        images_prop = props.get('Images', {})
        hero_images_prop = props.get('Hero Images', {})
        
        print(f'Product: {product_id} | SKU: {sku}')
        print(f'  Title: {title[:50]}')
        print(f'  Images property type: {images_prop.get("type", "N/A")}')
        print(f'  Hero Images property type: {hero_images_prop.get("type", "N/A")}')
        
        if images_prop.get('type') == 'files':
            files = images_prop.get('files', [])
            print(f'  Images (files): {len(files)} files')
            for i, f in enumerate(files[:2]):
                file_url = f.get('file', {}).get('url', '') or f.get('external', {}).get('url', '')
                print(f'    [{i}]: {file_url[:80]}')
        
        if hero_images_prop.get('type') == 'rich_text':
            texts = hero_images_prop.get('rich_text', [])
            if texts:
                content = texts[0].get('text', {}).get('content', '')
                if content:
                    urls = content.split('\n')
                    print(f'  Hero Images (rich_text): {len(urls)} URLs')
                    for url in urls[:2]:
                        print(f'    - {url[:80]}')
        
        print()
else:
    print(f'Error: {response.status_code}')
    print(response.text)
