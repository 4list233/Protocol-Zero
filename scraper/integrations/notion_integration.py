"""
Notion Database Integration for Product Image Storage
Handles API calls to Notion for storing product/variant image URLs
"""

import os
import json
import time
from typing import Dict, List, Optional
from dotenv import load_dotenv
import requests

# Load environment variables from project root .env
project_root = os.path.join(os.path.dirname(__file__), '..', '..')
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

# Notion API Configuration
NOTION_API_KEY = os.getenv('NOTION_API_KEY') or os.getenv('NOTION_TOKEN')
NOTION_API_BASE = 'https://api.notion.com/v1'
NOTION_VERSION = '2022-06-28'

# Database IDs
PRODUCTS_DATABASE_ID = os.getenv('NOTION_DATABASE_ID_PRODUCTS')
VARIANTS_DATABASE_ID = os.getenv('NOTION_DATABASE_ID_VARIANTS')


class NotionAPI:
    """Wrapper for Notion REST API calls"""
    
    def __init__(self):
        if not NOTION_API_KEY:
            raise ValueError(
                "Missing Notion API key. Please set NOTION_API_KEY or NOTION_TOKEN in /Users/5425855/Documents/protocol-zero/.env"
            )
        
        self.headers = {
            'Authorization': f'Bearer {NOTION_API_KEY}',
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
        }
    
    def create_page(self, database_id: str, properties: Dict, children: Optional[List] = None) -> Dict:
        """Create a new page in a Notion database"""
        url = f'{NOTION_API_BASE}/pages'
        
        payload = {
            'parent': {'database_id': database_id},
            'properties': properties
        }
        
        if children:
            payload['children'] = children
        
        response = requests.post(url, headers=self.headers, json=payload)
        
        if not response.ok:
            error_msg = f"Notion API error: {response.status_code} {response.text}"
            raise Exception(error_msg)
        
        return response.json()
    
    def update_page(self, page_id: str, properties: Dict) -> Dict:
        """Update an existing page in Notion"""
        url = f'{NOTION_API_BASE}/pages/{page_id}'
        
        payload = {'properties': properties}
        
        response = requests.patch(url, headers=self.headers, json=payload)
        
        if not response.ok:
            error_msg = f"Notion API error: {response.status_code} {response.text}"
            raise Exception(error_msg)
        
        return response.json()
    
    def query_database(self, database_id: str, filter_query: Optional[Dict] = None) -> List[Dict]:
        """Query a Notion database with optional filter"""
        url = f'{NOTION_API_BASE}/databases/{database_id}/query'
        
        payload = {}
        if filter_query:
            payload['filter'] = filter_query
        
        response = requests.post(url, headers=self.headers, json=payload)
        
        if not response.ok:
            return []
        
        data = response.json()
        return data.get('results', [])
    
    def find_page_by_property(self, database_id: str, property_name: str, value: str) -> Optional[Dict]:
        """Find a page by a specific property value"""
        filter_query = {
            'property': property_name,
            'rich_text': {
                'equals': value
            }
        }
        
        results = self.query_database(database_id, filter_query)
        return results[0] if results else None


def create_product_page(api: NotionAPI, product_data: Dict, image_urls: Dict[str, List[str]]) -> str:
    """
    Create or update a product page in Notion with image URLs
    
    Args:
        api: NotionAPI instance
        product_data: Product data including product_id, title, url
        image_urls: Dict with keys 'Main', 'Catalogue', 'Details' containing image URL lists
        
    Returns:
        Notion page ID
    """
    if not PRODUCTS_DATABASE_ID:
        raise ValueError("NOTION_DATABASE_ID_PRODUCTS not set in environment")
    
    # Check if page already exists
    existing = api.find_page_by_property(
        PRODUCTS_DATABASE_ID,
        'Product ID',
        product_data['product_id']
    )
    
    # Prepare properties
    properties = {
        'Name': {
            'title': [{'text': {'content': product_data['title_en']}}]
        },
        'Product ID': {
            'rich_text': [{'text': {'content': product_data['product_id']}}]
        },
        'Product SKU': {
            'rich_text': [{'text': {'content': product_data.get('product_sku', '')}}]
        },
        'Taobao URL': {
            'url': product_data['url']
        },
        'Hero Images': {
            'rich_text': [{'text': {'content': '\n'.join(image_urls.get('Main', []))}}]
        },
        'Catalogue Images': {
            'rich_text': [{'text': {'content': '\n'.join(image_urls.get('Catalogue', []))}}]
        },
        'Detail Images': {
            'rich_text': [{'text': {'content': '\n'.join(image_urls.get('Details', []))}}]
        }
    }
    
    if existing:
        # Update existing page
        page_id = existing['id']
        api.update_page(page_id, properties)
        print(f"      → Updated Notion product page: {page_id}")
        return page_id
    else:
        # Create new page
        result = api.create_page(PRODUCTS_DATABASE_ID, properties)
        page_id = result['id']
        print(f"      → Created Notion product page: {page_id}")
        return page_id


def create_variant_page(api: NotionAPI, variant_data: Dict, product_page_id: str, variant_image_url: Optional[str] = None) -> str:
    """
    Create or update a variant page in Notion with image URL
    
    Args:
        api: NotionAPI instance
        variant_data: Variant data including variant_name, sku
        product_page_id: Parent product's Notion page ID
        variant_image_url: URL to variant-specific hero image
        
    Returns:
        Notion page ID
    """
    if not VARIANTS_DATABASE_ID:
        raise ValueError("NOTION_DATABASE_ID_VARIANTS not set in environment")
    
    # Check if page already exists
    existing = api.find_page_by_property(
        VARIANTS_DATABASE_ID,
        'Variant SKU',
        variant_data['sku']
    )
    
    # Prepare properties
    properties = {
        'Name': {
            'title': [{'text': {'content': variant_data['variant_name_en']}}]
        },
        'Variant SKU': {
            'rich_text': [{'text': {'content': variant_data['sku']}}]
        },
        'Product': {
            'relation': [{'id': product_page_id}]
        }
    }
    
    # Add variant-specific image URL if provided
    if variant_image_url:
        properties['Hero Image URL'] = {
            'url': variant_image_url
        }
    
    if existing:
        # Update existing page
        page_id = existing['id']
        api.update_page(page_id, properties)
        return page_id
    else:
        # Create new page
        result = api.create_page(VARIANTS_DATABASE_ID, properties)
        return result['id']


def push_product_to_notion(product_data: Dict, dry_run: bool = False) -> Optional[str]:
    """
    Push a complete product with all variants to Notion
    
    Args:
        product_data: Complete product data from scraper including images
        dry_run: If True, simulate without creating pages
        
    Returns:
        Notion product page ID
    """
    if dry_run:
        print("      → [DRY RUN] Would push to Notion")
        return None
    
    try:
        api = NotionAPI()
        
        # Prepare image URLs (convert local paths to hosted URLs if needed)
        # TODO: Upload images to CDN/S3 and get public URLs
        image_urls = {
            'Main': product_data.get('images', {}).get('Main', []),
            'Catalogue': product_data.get('images', {}).get('Catalogue', []),
            'Details': product_data.get('images', {}).get('Details', [])
        }
        
        # Create product page
        product_page_id = create_product_page(api, product_data, image_urls)
        
        # Create variant pages
        for variant in product_data.get('variants', []):
            variant_image_url = variant.get('image_url')  # Variant-specific image
            create_variant_page(api, variant, product_page_id, variant_image_url)
            time.sleep(0.3)  # Rate limit
        
        print(f"      → Pushed {len(product_data.get('variants', []))} variants to Notion")
        return product_page_id
        
    except Exception as e:
        print(f"      ⚠️  Notion error: {e}")
        return None
