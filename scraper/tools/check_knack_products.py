#!/usr/bin/env python3
"""Check Knack products"""

import requests, os, json
from dotenv import load_dotenv

# Load from project root .env
import os
project_root = os.path.join(os.path.dirname(__file__), '..', '..')
load_dotenv(os.path.join(project_root, '.env'))

KNACK_APP_ID = os.getenv('KNACK_APPLICATION_ID')
KNACK_API_KEY = os.getenv('KNACK_REST_API_KEY')

headers = {
    'X-Knack-Application-Id': KNACK_APP_ID,
    'X-Knack-REST-API-Key': KNACK_API_KEY,
}

# Get first 5 products
response = requests.get(
    'https://api.knack.com/v1/objects/object_6/records',
    headers=headers,
    params={'rows_per_page': 5}
)

if response.ok:
    data = response.json()
    print(f'Found {len(data["records"])} products in Knack\n')
    for record in data['records']:
        product_id = record.get('field_45', 'N/A')  # ID field
        sku = record.get('field_46', 'N/A')  # SKU field
        title = record.get('field_47', 'N/A')  # Title field
        print(f'Product ID: {product_id}')
        print(f'SKU: {sku}')
        print(f'Title: {title[:50] if isinstance(title, str) else title}')
        print()
else:
    print(f'Error: {response.status_code}')
    print(response.text[:500])
