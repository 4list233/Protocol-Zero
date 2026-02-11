#!/usr/bin/env python3
"""
Shopify Export Module for Protocol Zero
Transforms scraped Taobao data to Shopify CSV import format.

This module converts protocol_zero_variants.csv (Taobao scraper output) into
Shopify-compatible CSV format with proper variant handling, pricing, and images.

Usage:
    python3 shopify_export.py                           # Export all products with default 50% margin
    python3 shopify_export.py --margin 100              # Export with 100% markup (2x price)
    python3 shopify_export.py --input custom.csv        # Export from custom CSV file
    python3 shopify_export.py --output shopify.csv      # Export to specific file
    python3 shopify_export.py --collections budget.json # Use custom collection mapping
"""

import os
import csv
import json
import re
from typing import Dict, List, Optional, Set
from pathlib import Path
from dataclasses import dataclass, field
from collections import defaultdict
import argparse
from datetime import datetime

# Default file paths
SCRIPT_DIR = Path(__file__).parent
DEFAULT_INPUT_CSV = SCRIPT_DIR / 'protocol_zero_variants.csv'
DEFAULT_OUTPUT_CSV = SCRIPT_DIR / 'shopify_import.csv'
DEFAULT_MEDIA_ROOT = SCRIPT_DIR / 'ai_scraper_output' / 'media'
COLLECTIONS_CONFIG = SCRIPT_DIR / 'shopify_collections.json'


@dataclass
class ShopifyVariant:
    """Represents a single Shopify product variant"""
    sku: str
    option1_name: str = ''
    option1_value: str = ''
    option2_name: str = ''
    option2_value: str = ''
    option3_name: str = ''
    option3_value: str = ''
    cost_cny: float = 0.0
    price_cad: float = 0.0
    compare_at_price: float = 0.0
    weight_grams: int = 200
    inventory_qty: int = 0
    variant_image_url: str = ''
    in_stock: bool = True


@dataclass
class ShopifyProduct:
    """Represents a Shopify product with multiple variants"""
    handle: str
    title: str
    title_zh: str = ''
    description_html: str = ''
    vendor: str = 'Protocol Zero'
    product_type: str = 'Airsoft Gear'
    collection: str = 'All Products'
    tags: List[str] = field(default_factory=list)
    published: bool = True
    
    # Images
    hero_image_url: str = ''
    details_image_url: str = ''
    additional_images: List[str] = field(default_factory=list)
    
    # Variants
    variants: List[ShopifyVariant] = field(default_factory=list)
    
    # Metadata
    taobao_url: str = ''
    media_folder: str = ''


class ShopifyExporter:
    """Handles conversion from Taobao scraper CSV to Shopify import CSV"""
    
    # Shopify CSV column headers (exact order matters for import)
    SHOPIFY_HEADERS = [
        'Handle',
        'Title',
        'Body (HTML)',
        'Vendor',
        'Product Category',
        'Type',
        'Tags',
        'Published',
        'Option1 Name',
        'Option1 Value',
        'Option2 Name',
        'Option2 Value',
        'Option3 Name',
        'Option3 Value',
        'Variant SKU',
        'Variant Grams',
        'Variant Inventory Tracker',
        'Variant Inventory Qty',
        'Variant Inventory Policy',
        'Variant Fulfillment Service',
        'Variant Price',
        'Variant Compare At Price',
        'Variant Requires Shipping',
        'Variant Taxable',
        'Variant Barcode',
        'Image Src',
        'Image Position',
        'Image Alt Text',
        'Gift Card',
        'SEO Title',
        'SEO Description',
        'Google Shopping / Google Product Category',
        'Google Shopping / Gender',
        'Google Shopping / Age Group',
        'Google Shopping / MPN',
        'Google Shopping / AdWords Grouping',
        'Google Shopping / AdWords Labels',
        'Google Shopping / Condition',
        'Google Shopping / Custom Product',
        'Google Shopping / Custom Label 0',
        'Google Shopping / Custom Label 1',
        'Google Shopping / Custom Label 2',
        'Google Shopping / Custom Label 3',
        'Google Shopping / Custom Label 4',
        'Variant Image',
        'Variant Weight Unit',
        'Variant Tax Code',
        'Cost per item',
        'Price / International',
        'Compare At Price / International',
        'Status',
    ]
    
    def __init__(self, margin_percent: float = 50.0, exchange_rate: float = 0.19, shipping_cny: float = 30.0,
                 salesperson_cut: float = 0.10, promoter_cut: float = 0.10, base_url: str = '', media_root: Path | None = None):
        """
        Initialize Shopify exporter.
        
        Args:
            margin_percent: Target margin percentage after all cuts (e.g., 30 = 30% net margin)
            exchange_rate: CNY to CAD exchange rate
            shipping_cny: Default shipping cost in CNY
            salesperson_cut: Percentage cut for salesperson (e.g., 0.10 = 10%)
            promoter_cut: Percentage cut for promoter (e.g., 0.10 = 10%)
            base_url: Base URL for product images (e.g., 'https://cdn.yourstore.com/products/')
        """
        self.margin_percent = margin_percent
        self.exchange_rate = exchange_rate
        self.shipping_cny = shipping_cny
        self.salesperson_cut = salesperson_cut
        self.promoter_cut = promoter_cut
        self.base_url = base_url
        self.media_root = Path(media_root) if media_root else DEFAULT_MEDIA_ROOT
        self.collections_map = self._load_collections_config()
        
    def _load_collections_config(self) -> Dict[str, str]:
        """Load collection mapping configuration from JSON file"""
        if COLLECTIONS_CONFIG.exists():
            try:
                with open(COLLECTIONS_CONFIG, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️  Warning: Could not load collections config: {e}")
        
        # Default collection mapping based on price ranges
        return {
            'budget': 'Budget ($0-$25)',
            'mid_range': 'Mid-Range ($25-$75)',
            'premium': 'Premium ($75+)',
            'default': 'All Products'
        }

    # ------------------------------------------------------------------
    # Media helpers
    # ------------------------------------------------------------------
    def _convert_media_path(self, path_str: str) -> str:
        """Convert local media path to URL (if base_url set) or relative path."""
        if not path_str:
            return ''
        try:
            p = Path(path_str)
            if self.base_url and p.is_absolute():
                rel = p.relative_to(self.media_root)
                return f"{self.base_url.rstrip('/')}/{rel.as_posix()}"
            if self.base_url and not p.is_absolute():
                return f"{self.base_url.rstrip('/')}/{p.as_posix()}"
            return p.as_posix()
        except Exception:
            # Fall back to raw string
            return path_str

    def _find_variant_image_path(self, media_folder: Path, variant_index: int) -> Optional[Path]:
        """Best-effort lookup for variant-specific screenshot."""
        if not media_folder:
            return None
        candidates = []
        # Standard V2 naming: media/{product}/variant_screenshots/variant_001.{ext}
        for ext in ['png', 'jpg', 'jpeg', 'webp']:
            candidates.append(media_folder / 'variant_screenshots' / f"variant_{variant_index:03d}.{ext}")
        for candidate in candidates:
            if candidate.exists():
                return candidate
        return None

    def _pick_detail_image(self, media_folder: Path, details_list: List[str]) -> str:
        """Prefer stitched Details_Long, otherwise first detail image."""
        if media_folder:
            stitched = media_folder / 'Details' / 'Details_Long.jpg'
            if stitched.exists():
                return stitched.as_posix()
        if details_list:
            return details_list[0]
        return ''
    
    def calculate_selling_price(self, cost_cny: float) -> dict:
        """
        Calculate CAD selling price from CNY cost using csv_to_knack.py pricing logic.
        Accounts for shipping, salesperson cut, promoter cut, and target margin.
        
        Args:
            cost_cny: Base cost in Chinese Yuan (CNY)
            
        Returns:
            Dictionary with:
                - cost_cad: Total cost in CAD
                - selling_price_cad: Final selling price
                - margin_standard: Margin % without promoter
                - margin_promo: Margin % with promoter cut
                - true_profit_cad: Actual profit after all cuts
        """
        if cost_cny <= 0:
            return {
                'cost_cad': 0.0,
                'selling_price_cad': 0.0,
                'margin_standard': 0.0,
                'margin_promo': 0.0,
                'true_profit_cad': 0.0
            }
        
        # Calculate total cost in CAD (product + shipping)
        total_cost_cny = cost_cny + self.shipping_cny
        cost_cad = total_cost_cny * self.exchange_rate
        
        # Calculate selling price to achieve target margin after cuts
        # Formula: Price = Cost / (1 - salesperson_cut - target_margin)
        divisor = 1 - self.salesperson_cut - (self.margin_percent / 100)
        
        if divisor > 0:
            selling_price_cad = cost_cad / divisor
        else:
            # Fallback: double the cost
            selling_price_cad = cost_cad * 2
        
        # Round to nearest .99 for psychological pricing
        selling_price_cad = round(selling_price_cad) - 0.01
        
        # Ensure minimum price
        if selling_price_cad < 1.0:
            selling_price_cad = round(cost_cad * 1.5, 2)
        
        # Calculate true margins
        revenue_after_salesperson = selling_price_cad * (1 - self.salesperson_cut)
        margin_standard = ((revenue_after_salesperson - cost_cad) / selling_price_cad * 100) if selling_price_cad > 0 else 0
        
        # With promoter cut
        promo_price = selling_price_cad * 0.90  # Assume 10% discount for promo
        revenue_after_cuts = promo_price * (1 - self.salesperson_cut - self.promoter_cut)
        margin_promo = ((revenue_after_cuts - cost_cad) / promo_price * 100) if promo_price > 0 else 0
        
        # True profit after salesperson cut (standard scenario)
        true_profit_cad = revenue_after_salesperson - cost_cad
        
        return {
            'cost_cad': round(cost_cad, 2),
            'selling_price_cad': round(selling_price_cad, 2),
            'margin_standard': round(margin_standard, 2),
            'margin_promo': round(margin_promo, 2),
            'true_profit_cad': round(true_profit_cad, 2)
        }
    
    def determine_collection(self, price_cad: float) -> str:
        """Determine product collection based on price tier"""
        if price_cad <= 25:
            return self.collections_map.get('budget', 'Budget ($0-$25)')
        elif price_cad <= 75:
            return self.collections_map.get('mid_range', 'Mid-Range ($25-$75)')
        else:
            return self.collections_map.get('premium', 'Premium ($75+)')
    
    def generate_handle(self, title_en: str, taobao_url: str) -> str:
        """
        Generate Shopify handle (URL-friendly product identifier).
        
        Args:
            title_en: English product title
            taobao_url: Original Taobao URL for uniqueness
            
        Returns:
            Lowercase URL-friendly handle
        """
        # Extract product ID from URL if possible
        product_id = ''
        id_match = re.search(r'id=(\d+)', taobao_url)
        if id_match:
            product_id = id_match.group(1)
        
        # Clean title: lowercase, replace spaces with hyphens, remove special chars
        handle = re.sub(r'[^a-z0-9\s-]', '', title_en.lower())
        handle = re.sub(r'\s+', '-', handle.strip())
        handle = re.sub(r'-+', '-', handle)
        
        # Truncate to 60 chars and append product ID for uniqueness
        handle = handle[:60].strip('-')
        if product_id:
            handle = f"{handle}-{product_id}"
        
        return handle
    
    def construct_image_url(self, media_folder: str, image_type: str = 'hero', variant_name: str = '') -> str:
        """
        Construct image URL from media folder path.
        
        Args:
            media_folder: Media folder name (e.g., 'product_1_combat-holster')
            image_type: Type of image ('hero', 'variant', 'detail')
            variant_name: Variant name for variant-specific images
            
        Returns:
            Complete image URL or empty string if no base_url configured
        """
        if not self.base_url or not media_folder:
            return ''
        
        # Remove 'product_' prefix and index if present
        folder_name = media_folder
        
        if image_type == 'hero':
            # Main product image: {folder}/{slug}_main_01.jpg
            slug = folder_name.replace('product_', '').split('_', 1)[-1] if '_' in folder_name else folder_name
            return f"{self.base_url.rstrip('/')}/{folder_name}/{slug}_main_01.jpg"
        elif image_type == 'variant' and variant_name:
            # Variant image: {folder}/{slug}_{variant}_variant.jpg
            slug = folder_name.replace('product_', '').split('_', 1)[-1] if '_' in folder_name else folder_name
            variant_slug = re.sub(r'[^a-z0-9]+', '-', variant_name.lower()).strip('-')
            return f"{self.base_url.rstrip('/')}/{folder_name}/{slug}_{variant_slug}_variant.jpg"
        elif image_type == 'detail':
            # Detail image: {folder}/{slug}_detail_01.jpg
            slug = folder_name.replace('product_', '').split('_', 1)[-1] if '_' in folder_name else folder_name
            return f"{self.base_url.rstrip('/')}/{folder_name}/{slug}_detail_01.jpg"
        
        return ''
    
    def generate_sku(self, handle: str, variant_index: int, option_values: Dict[str, str]) -> str:
        """
        Generate unique SKU for variant.
        
        Args:
            handle: Product handle
            variant_index: Index of variant within product
            option_values: Dict of option names to values
            
        Returns:
            Unique SKU string
        """
        # Create SKU suffix from variant options
        suffix_parts = []
        for value in option_values.values():
            if value:
                # Take first 3 letters of each option value
                clean = re.sub(r'[^a-zA-Z0-9]', '', value)
                suffix_parts.append(clean[:3].upper())
        
        suffix = '-'.join(suffix_parts) if suffix_parts else f"V{variant_index:03d}"
        
        # Combine: HANDLE-SUFFIX
        # Truncate handle to 20 chars to keep SKU reasonable length
        sku = f"{handle[:20].upper()}-{suffix}"
        
        return sku
    
    def extract_tags(self, title: str, variant_names: List[str]) -> List[str]:
        """Extract relevant tags from product title and variants"""
        tags = set()
        
        # Common airsoft/tactical keywords
        keywords = [
            'holster', 'vest', 'plate carrier', 'helmet', 'molle', 'tactical',
            'pouch', 'magazine', 'rail', 'sight', 'scope', 'optic', 'laser',
            'flashlight', 'mount', 'stock', 'grip', 'sling', 'belt', 'gloves',
            'mask', 'goggles', 'nvg', 'night vision', 'radio', 'antenna',
            'magazine pouch', 'dump pouch', 'admin pouch', 'medical', 'ifak',
            'hydration', 'backpack', 'chest rig', 'battle belt', 'holster',
            'kydex', 'nylon', 'cordura'
        ]
        
        title_lower = title.lower()
        for keyword in keywords:
            if keyword in title_lower:
                tags.add(keyword)
        
        # Extract colors from variants
        colors = ['black', 'tan', 'green', 'brown', 'grey', 'gray', 'coyote', 'od', 'multicam']
        for variant_name in variant_names:
            variant_lower = variant_name.lower()
            for color in colors:
                if color in variant_lower:
                    tags.add(color)
        
        # Add generic tags
        tags.add('airsoft')
        tags.add('tactical gear')
        
        return sorted(list(tags))
    
    def parse_taobao_csv(self, csv_path: Path) -> Dict[str, ShopifyProduct]:
        """
        Parse Taobao scraper CSV and group by product.
        
        Args:
            csv_path: Path to protocol_zero_variants.csv
            
        Returns:
            Dictionary mapping product URLs to ShopifyProduct objects
        """
        products: Dict[str, ShopifyProduct] = {}
        skipped_products = 0
        
        print(f"📖 Reading CSV: {csv_path}")
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                url = row.get('URL', '').strip()
                if not url:
                    continue
                
                # Initialize product if first variant
                if url not in products:
                    # Try to get translated title first, fallback to regular title
                    title_en = (row.get('Translated Title', '') or row.get('Product Title', '')).strip()
                    title_zh = row.get('Product Title ZH', '').strip()
                    
                    # Skip if no title at all
                    if not title_en and not title_zh:
                        skipped_products += 1
                        continue
                    
                    # Use Chinese title as fallback if no English title
                    # (User should run translate.py first for best results)
                    if not title_en:
                        title_en = title_zh
                        print(f"⚠️  Warning: Using Chinese title for product (run translate.py for English): {title_zh[:50]}")
                    
                    handle = self.generate_handle(title_en, url)
                    
                    products[url] = ShopifyProduct(
                        handle=handle,
                        title=title_en,
                        title_zh=title_zh,
                        taobao_url=url,
                        media_folder=row.get('Media Folder', ''),
                    )
                
                product = products[url]
                
                # Parse variant data - prefer translated option name
                option_name = (row.get('Translated Option Name', '') or row.get('Option Name', '')).strip()
                price_cny = float(row.get('Price CNY', 0) or 0)
                
                # Calculate pricing with proper margins
                pricing = self.calculate_selling_price(price_cny)
                
                # Construct variant image URL if base_url is configured
                variant_image_url = self.construct_image_url(
                    product.media_folder,
                    'variant',
                    option_name
                ) if product.media_folder else ''
                
                # Create variant
                variant = ShopifyVariant(
                    sku='',  # Will be generated later
                    option1_name='Variant',
                    option1_value=option_name if option_name else 'Default',
                    cost_cny=price_cny,
                    price_cad=pricing['selling_price_cad'],
                    in_stock=row.get('In Stock', 'Yes') == 'Yes',
                    variant_image_url=variant_image_url,
                )
                
                product.variants.append(variant)
        
        print(f"✅ Parsed {len(products)} products")
        if skipped_products > 0:
            print(f"⚠️  Skipped {skipped_products} products with no titles")
        
        return products

    def parse_ai_products_json(self, json_path: Path) -> Dict[str, ShopifyProduct]:
        """Parse ai_scraper_output/products.json into ShopifyProduct objects."""
        print(f"📖 Reading AI scraper JSON: {json_path}")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        products_data = data.get('products', [])
        products: Dict[str, ShopifyProduct] = {}

        for idx, item in enumerate(products_data, 1):
            url = item.get('url', '').strip()
            title_en = (item.get('title_en') or item.get('title_zh') or '').strip()
            if not title_en:
                title_en = f"Product {idx:03d}"
            handle = self.generate_handle(title_en, url)

            # Media folder inference from Main or Details path
            media_dict = item.get('images', {}) or {}
            main_list: List[str] = media_dict.get('Main', []) or []
            details_list: List[str] = media_dict.get('Details', []) or []
            media_folder_path: Optional[Path] = None

            if main_list:
                try:
                    media_folder_path = Path(main_list[0]).parent.parent
                except Exception:
                    pass
            if not media_folder_path and details_list:
                try:
                    media_folder_path = Path(details_list[0]).parent.parent
                except Exception:
                    pass
            if not media_folder_path:
                media_folder_path = self.media_root / f"product_{idx:03d}"

            hero_path = main_list[0] if main_list else ''
            detail_path = self._pick_detail_image(media_folder_path, details_list)

            product = ShopifyProduct(
                handle=handle,
                title=title_en,
                title_zh=item.get('title_zh', ''),
                taobao_url=url,
                media_folder=media_folder_path.name if media_folder_path else ''
            )

            product.hero_image_url = self._convert_media_path(hero_path)
            if detail_path:
                product.additional_images.append(self._convert_media_path(detail_path))

            variants = item.get('variants', []) or []
            for v_idx, variant in enumerate(variants, 1):
                option1_value = variant.get('option_value_1', '') or variant.get('variant_name_en', '') or variant.get('variant_name_zh', '')
                option1_name = variant.get('option_type_1', '') or ('Color' if option1_value else '')
                option2_value = variant.get('option_value_2', '')
                option2_name = variant.get('option_type_2', '') or ('Size' if option2_value else '')

                price_cny = float(variant.get('price_cny') or item.get('base_price_cny') or 0)
                pricing = self.calculate_selling_price(price_cny)

                variant_image_url = ''
                variant_path = self._find_variant_image_path(media_folder_path, v_idx)
                if variant_path:
                    variant_image_url = self._convert_media_path(variant_path.as_posix())

                shopify_variant = ShopifyVariant(
                    sku='',
                    option1_name=option1_name,
                    option1_value=option1_value if option1_value else 'Default',
                    option2_name=option2_name,
                    option2_value=option2_value,
                    cost_cny=price_cny,
                    price_cad=pricing['selling_price_cad'],
                    in_stock=variant.get('in_stock', True),
                    variant_image_url=variant_image_url,
                )

                product.variants.append(shopify_variant)

            products[url or f"product_{idx}"] = product

        print(f"✅ Parsed {len(products)} products from AI scraper JSON")
        return products
    
    def build_product_description(self, product: ShopifyProduct) -> str:
        """Generate HTML description for product"""
        # Basic description template
        description = f"""<div class="product-description">
<h2>{product.title}</h2>
<p>Premium airsoft tactical gear sourced from trusted manufacturers.</p>

<h3>Key Features:</h3>
<ul>
<li>High-quality construction</li>
<li>Multiple color options available</li>
<li>Designed for airsoft and tactical training</li>
<li>Durable materials for long-lasting use</li>
</ul>

<h3>Available Variants:</h3>
<p>{len(product.variants)} color/style options to choose from.</p>

<p><strong>Note:</strong> This is a private label product. All branding has been removed for customization.</p>
</div>"""
        
        return description
    
    def export_to_shopify_csv(self, products: Dict[str, ShopifyProduct], output_path: Path):
        """
        Export products to Shopify CSV format.
        
        Args:
            products: Dictionary of ShopifyProduct objects
            output_path: Path to output CSV file
        """
        print(f"\n📝 Exporting to Shopify CSV: {output_path}")
        
        rows = []
        
        for url, product in products.items():
            if not product.variants:
                continue
            
            # Generate SKUs for all variants
            for idx, variant in enumerate(product.variants, 1):
                option_values = {
                    variant.option1_name: variant.option1_value,
                    variant.option2_name: variant.option2_value,
                    variant.option3_name: variant.option3_value,
                }
                variant.sku = self.generate_sku(
                    product.handle, 
                    idx, 
                    {k: v for k, v in option_values.items() if v}
                )
            
            # Determine collection based on average price
            avg_price = sum(v.price_cad for v in product.variants) / len(product.variants)
            product.collection = self.determine_collection(avg_price)
            
            # Generate tags
            variant_names = [v.option1_value for v in product.variants]
            product.tags = self.extract_tags(product.title, variant_names)
            
            # Build description
            product.description_html = self.build_product_description(product)
            
            # Construct image URLs
            if product.media_folder and not product.hero_image_url:
                product.hero_image_url = self.construct_image_url(product.media_folder, 'hero')
            if product.media_folder and not product.details_image_url:
                product.details_image_url = self.construct_image_url(product.media_folder, 'detail')

            # Ensure detail image is queued for upload if available
            if product.details_image_url and product.details_image_url not in product.additional_images:
                product.additional_images.insert(0, product.details_image_url)
            
            # Create rows for each variant
            for idx, variant in enumerate(product.variants, 1):
                # First variant includes product-level data
                is_first_variant = (idx == 1)
                
                # Use hero image for first variant, variant images for others
                image_url = variant.variant_image_url or product.hero_image_url
                
                row = {
                    'Handle': product.handle,
                    'Title': product.title if is_first_variant else '',
                    'Body (HTML)': product.description_html if is_first_variant else '',
                    'Vendor': product.vendor if is_first_variant else '',
                    'Product Category': '',  # Shopify will auto-categorize
                    'Type': product.product_type if is_first_variant else '',
                    'Tags': ','.join(product.tags) if is_first_variant else '',
                    'Published': 'TRUE' if product.published else 'FALSE',
                    'Option1 Name': variant.option1_name,
                    'Option1 Value': variant.option1_value,
                    'Option2 Name': variant.option2_name,
                    'Option2 Value': variant.option2_value,
                    'Option3 Name': variant.option3_name,
                    'Option3 Value': variant.option3_value,
                    'Variant SKU': variant.sku,
                    'Variant Grams': variant.weight_grams,
                    'Variant Inventory Tracker': 'shopify',
                    'Variant Inventory Qty': variant.inventory_qty,
                    'Variant Inventory Policy': 'deny',  # Don't allow overselling
                    'Variant Fulfillment Service': 'manual',
                    'Variant Price': f"{variant.price_cad:.2f}",
                    'Variant Compare At Price': f"{variant.compare_at_price:.2f}" if variant.compare_at_price > 0 else '',
                    'Variant Requires Shipping': 'TRUE',
                    'Variant Taxable': 'TRUE',
                    'Variant Barcode': '',
                    'Image Src': image_url if image_url else '',
                    'Image Position': idx,
                    'Image Alt Text': f"{product.title} - {variant.option1_value}",
                    'Gift Card': 'FALSE',
                    'SEO Title': product.title[:70] if is_first_variant else '',  # 70 char limit
                    'SEO Description': f"{product.title} - Airsoft tactical gear. {product.collection}." if is_first_variant else '',
                    'Google Shopping / Google Product Category': 'Sporting Goods > Outdoor Recreation > Paintball & Airsoft',
                    'Google Shopping / Gender': '',
                    'Google Shopping / Age Group': 'adult',
                    'Google Shopping / MPN': variant.sku,
                    'Google Shopping / AdWords Grouping': product.product_type,
                    'Google Shopping / AdWords Labels': '',
                    'Google Shopping / Condition': 'new',
                    'Google Shopping / Custom Product': 'FALSE',
                    'Google Shopping / Custom Label 0': product.collection,
                    'Google Shopping / Custom Label 1': '',
                    'Google Shopping / Custom Label 2': '',
                    'Google Shopping / Custom Label 3': '',
                    'Google Shopping / Custom Label 4': '',
                    'Variant Image': variant.variant_image_url if variant.variant_image_url else '',
                    'Variant Weight Unit': 'g',
                    'Variant Tax Code': '',
                    'Cost per item': f"{variant.cost_cny * self.exchange_rate:.2f}",  # Show cost in CAD
                    'Price / International': '',
                    'Compare At Price / International': '',
                    'Status': 'active' if variant.in_stock else 'draft',
                }
                
                rows.append(row)

            # Append additional images (e.g., stitched Details_Long) as image-only rows
            if product.additional_images:
                start_pos = len(product.variants) + 1
                for offset, img in enumerate(product.additional_images, 0):
                    rows.append({
                        'Handle': product.handle,
                        'Title': '',
                        'Body (HTML)': '',
                        'Vendor': '',
                        'Product Category': '',
                        'Type': '',
                        'Tags': '',
                        'Published': '',
                        'Option1 Name': '',
                        'Option1 Value': '',
                        'Option2 Name': '',
                        'Option2 Value': '',
                        'Option3 Name': '',
                        'Option3 Value': '',
                        'Variant SKU': '',
                        'Variant Grams': '',
                        'Variant Inventory Tracker': '',
                        'Variant Inventory Qty': '',
                        'Variant Inventory Policy': '',
                        'Variant Fulfillment Service': '',
                        'Variant Price': '',
                        'Variant Compare At Price': '',
                        'Variant Requires Shipping': '',
                        'Variant Taxable': '',
                        'Variant Barcode': '',
                        'Image Src': img,
                        'Image Position': start_pos + offset,
                        'Image Alt Text': f"{product.title} - Details",
                        'Gift Card': '',
                        'SEO Title': '',
                        'SEO Description': '',
                        'Google Shopping / Google Product Category': '',
                        'Google Shopping / Gender': '',
                        'Google Shopping / Age Group': '',
                        'Google Shopping / MPN': '',
                        'Google Shopping / AdWords Grouping': '',
                        'Google Shopping / AdWords Labels': '',
                        'Google Shopping / Condition': '',
                        'Google Shopping / Custom Product': '',
                        'Google Shopping / Custom Label 0': '',
                        'Google Shopping / Custom Label 1': '',
                        'Google Shopping / Custom Label 2': '',
                        'Google Shopping / Custom Label 3': '',
                        'Google Shopping / Custom Label 4': '',
                        'Variant Image': '',
                        'Variant Weight Unit': '',
                        'Variant Tax Code': '',
                        'Cost per item': '',
                        'Price / International': '',
                        'Compare At Price / International': '',
                        'Status': '',
                    })
        
        # Write CSV
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=self.SHOPIFY_HEADERS)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"✅ Exported {len(rows)} variants from {len(products)} products")
        print(f"\n📊 Summary:")
        print(f"   - Products: {len(products)}")
        print(f"   - Total Variants: {len(rows)}")
        print(f"   - Margin: {self.margin_percent}%")
        print(f"   - Exchange Rate: {self.exchange_rate} CNY/CAD")
        print(f"\n💡 Next Steps:")
        print(f"   1. Review the CSV file: {output_path}")
        print(f"   2. Upload to Shopify: Products > Import")
        print(f"   3. Map any custom fields during import")
        print(f"   4. Review product listings in Shopify admin")


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description='Export Taobao scraper data to Shopify CSV format',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 shopify_export.py                          # Export with 50% margin
  python3 shopify_export.py --margin 100             # Export with 100% markup
  python3 shopify_export.py --input custom.csv       # Export custom CSV
  python3 shopify_export.py --output shopify.csv     # Custom output file
  python3 shopify_export.py --exchange-rate 0.20     # Custom exchange rate
        """
    )
    
    parser.add_argument(
        '--input',
        type=Path,
        default=DEFAULT_INPUT_CSV,
        help=f'Input CSV file (default: {DEFAULT_INPUT_CSV.name})'
    )
    
    parser.add_argument(
        '--output',
        type=Path,
        default=DEFAULT_OUTPUT_CSV,
        help=f'Output Shopify CSV file (default: {DEFAULT_OUTPUT_CSV.name})'
    )
    
    parser.add_argument(
        '--margin',
        type=float,
        default=50.0,
        help='Profit margin percentage (default: 50 = 50%% markup)'
    )
    
    parser.add_argument(
        '--exchange-rate',
        type=float,
        default=0.19,
        help='CNY to CAD exchange rate (default: 0.19)'
    )
    
    parser.add_argument(
        '--shipping',
        type=float,
        default=30.0,
        help='Default shipping cost in CNY (default: 30)'
    )
    
    parser.add_argument(
        '--salesperson-cut',
        type=float,
        default=0.10,
        help='Salesperson commission percentage (default: 0.10 = 10%%)'
    )
    
    parser.add_argument(
        '--promoter-cut',
        type=float,
        default=0.10,
        help='Promoter commission percentage (default: 0.10 = 10%%)'
    )
    
    parser.add_argument(
        '--base-url',
        type=str,
        default='',
        help='Base URL for product images (e.g., https://cdn.yourstore.com/products/)'
    )

    parser.add_argument(
        '--media-root',
        type=Path,
        default=DEFAULT_MEDIA_ROOT,
        help=f'Media root for ai_scraper_output (default: {DEFAULT_MEDIA_ROOT})'
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not args.input.exists():
        print(f"❌ Error: Input file not found: {args.input}")
        return 1
    
    print("=" * 60)
    print("🛒 SHOPIFY EXPORT TOOL")
    print("=" * 60)
    print(f"\n⚙️  Configuration:")
    print(f"   - Input CSV: {args.input}")
    print(f"   - Output CSV: {args.output}")
    print(f"   - Margin: {args.margin}%")
    print(f"   - Exchange Rate: {args.exchange_rate} CNY/CAD")
    print(f"   - Shipping: ¥{args.shipping} CNY")
    print()
    
    # Create exporter
    exporter = ShopifyExporter(
        margin_percent=args.margin,
        exchange_rate=args.exchange_rate,
        shipping_cny=args.shipping,
        salesperson_cut=args.salesperson_cut,
        promoter_cut=args.promoter_cut,
        base_url=args.base_url,
        media_root=args.media_root
    )
    
    # Parse input CSV
    if args.input.suffix.lower() == '.json':
        products = exporter.parse_ai_products_json(args.input)
    else:
        products = exporter.parse_taobao_csv(args.input)
    
    if not products:
        print("❌ No products found in CSV")
        return 1
    
    # Export to Shopify CSV
    exporter.export_to_shopify_csv(products, args.output)
    
    print(f"\n✅ Export complete!")
    print(f"\n📁 Output file: {args.output.absolute()}")
    
    return 0


if __name__ == '__main__':
    exit(main())
