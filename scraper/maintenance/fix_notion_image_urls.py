#!/usr/bin/env python3
"""
Fix Notion Image URLs - Replace localhost with production URL
"""

import os
import requests
from dotenv import load_dotenv

# Load environment from project root
project_root = os.path.join(os.path.dirname(__file__), '..', '..')
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

NOTION_API_KEY = os.getenv('NOTION_API_KEY')
PRODUCTS_DB = os.getenv('NOTION_DATABASE_ID_PRODUCTS')
PRODUCTION_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pzairsoft.ca')

headers = {
    'Authorization': f'Bearer {NOTION_API_KEY}',
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
}

print(f"🔧 FIXING NOTION IMAGE URLs")
print(f"   Replacing localhost:3000 → {PRODUCTION_URL}")
print("=" * 70)

# Query all products
response = requests.post(
    f'https://api.notion.com/v1/databases/{PRODUCTS_DB}/query',
    headers=headers,
    json={'page_size': 100}
)

if not response.ok:
    print(f"❌ Error querying Notion: {response.status_code}")
    print(response.text)
    exit(1)

data = response.json()
pages = data.get('results', [])
print(f"Found {len(pages)} pages in Notion\n")

updated_count = 0
skipped_count = 0

for page in pages:
    page_id = page['id']
    props = page.get('properties', {})
    
    # Get Images property
    images_prop = props.get('Images', {})
    if images_prop.get('type') != 'files':
        continue
    
    files = images_prop.get('files', [])
    if not files:
        skipped_count += 1
        continue
    
    # Check if any URLs contain localhost
    has_localhost = any(
        'localhost:3000' in (f.get('external', {}).get('url', '') or f.get('file', {}).get('url', ''))
        for f in files
    )
    
    if not has_localhost:
        skipped_count += 1
        continue
    
    # Fix the URLs
    fixed_files = []
    for f in files:
        url = f.get('external', {}).get('url', '') or f.get('file', {}).get('url', '')
        if url:
            fixed_url = url.replace('http://localhost:3000', PRODUCTION_URL).replace('https://localhost:3000', PRODUCTION_URL)
            fixed_files.append({'external': {'url': fixed_url}})
    
    # Update the page
    try:
        update_response = requests.patch(
            f'https://api.notion.com/v1/pages/{page_id}',
            headers=headers,
            json={
                'properties': {
                    'Images': {
                        'files': fixed_files
                    }
                }
            }
        )
        
        if update_response.ok:
            updated_count += 1
            print(f"  ✅ Updated page {page_id[:8]}... ({len(fixed_files)} images)")
        else:
            print(f"  ❌ Failed to update {page_id[:8]}...: {update_response.status_code}")
            
    except Exception as e:
        print(f"  ❌ Error updating {page_id[:8]}...: {e}")

print("\n" + "=" * 70)
print(f"Summary:")
print(f"  Updated: {updated_count} pages")
print(f"  Skipped: {skipped_count} pages (no localhost URLs)")
print(f"\n✅ Done! Image URLs have been fixed.")
