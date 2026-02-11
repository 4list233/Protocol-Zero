"""
Variant Engine for Taobao Product Scraper
Extracts structured variant/SKU data from Taobao/Tmall product pages.

Tiered extraction approach:
- Tier 1 (Best): Extract SKU map from embedded JSON in page source
- Tier 2: Network/XHR sniffing for SKU data
- Tier 3 (Fallback): Selenium click-based combination enumeration
"""

import re
import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict

# Chinese to English dimension name mapping
DIMENSION_TRANSLATIONS = {
    # Colors
    '颜色': 'Color',
    '颜色分类': 'Color',
    '颜色分': 'Color',
    '颜色/尺码': 'Color',
    
    # Sizes
    '尺码': 'Size',
    '尺寸': 'Size',
    '规格': 'Size',
    '大小': 'Size',
    '码数': 'Size',
    '型号': 'Model',
    
    # Styles
    '款式': 'Style',
    '样式': 'Style',
    '类型': 'Type',
    '版本': 'Version',
    
    # Bundles/Sets
    '套装': 'Bundle',
    '套餐': 'Bundle',
    '组合': 'Combo',
    
    # Quantity
    '数量': 'Quantity',
    '件数': 'Quantity',
    
    # Direction
    '左右': 'Side',
    '方向': 'Side',
    
    # Materials
    '材质': 'Material',
    '面料': 'Material',
}

# Color value translations
COLOR_TRANSLATIONS = {
    '黑色': 'Black',
    '黑': 'Black',
    '白色': 'White',
    '白': 'White',
    '红色': 'Red',
    '蓝色': 'Blue',
    '绿色': 'Green',
    '军绿': 'OD Green',
    '军绿色': 'OD Green',
    '游骑兵绿': 'Ranger Green',
    '棕色': 'Brown',
    '沙色': 'Tan',
    '泥色': 'Coyote Brown',
    '灰色': 'Grey',
    '黄色': 'Yellow',
    '粉色': 'Pink',
    '粉红色': 'Pink',
    '玫红色': 'Hot Pink',
    '紫色': 'Purple',
    '橙色': 'Orange',
    '金色': 'Gold',
    '银色': 'Silver',
    '迷彩': 'Camo',
    '多地形迷彩': 'Multicam',
    'MC迷彩': 'Multicam',
}


@dataclass
class OptionValue:
    """Single option value (e.g., "Black" for Color dimension)"""
    value: str
    value_zh: str
    image_url: Optional[str] = None
    prop_id: Optional[str] = None  # Taobao property ID


@dataclass
class OptionDimension:
    """Single option dimension (e.g., "Color" with values ["Black", "Tan"])"""
    name: str
    name_zh: str
    values: List[OptionValue] = field(default_factory=list)


@dataclass
class SKUVariant:
    """Single SKU combination"""
    sku_id: str
    prop_path: str  # e.g., "1627207:28341;20509:28314"
    option_values: Dict[str, str]  # e.g., {"Color": "Black", "Size": "M"}
    option_values_zh: Dict[str, str]  # Original Chinese values
    price_cny: float = 0.0
    stock: int = 0
    image_url: Optional[str] = None
    available: bool = True


@dataclass
class VariantExtractionResult:
    """Result of variant extraction"""
    options: List[OptionDimension] = field(default_factory=list)
    variants: List[SKUVariant] = field(default_factory=list)
    confidence: float = 0.0
    method: str = "none"
    needs_review: bool = False
    error: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            'options': [asdict(o) for o in self.options],
            'variants': [asdict(v) for v in self.variants],
            'confidence': self.confidence,
            'method': self.method,
            'needs_review': self.needs_review,
            'error': self.error
        }


def translate_dimension_name(name_zh: str) -> str:
    """Translate Chinese dimension name to English"""
    name_zh = name_zh.strip()
    
    # Direct lookup
    if name_zh in DIMENSION_TRANSLATIONS:
        return DIMENSION_TRANSLATIONS[name_zh]
    
    # Partial match
    for zh, en in DIMENSION_TRANSLATIONS.items():
        if zh in name_zh or name_zh in zh:
            return en
    
    # Default to original
    return name_zh


def translate_color_value(value_zh: str) -> str:
    """Translate Chinese color value to English"""
    value_zh = value_zh.strip()
    
    # Direct lookup
    if value_zh in COLOR_TRANSLATIONS:
        return COLOR_TRANSLATIONS[value_zh]
    
    # Partial match for compound colors
    for zh, en in COLOR_TRANSLATIONS.items():
        if zh in value_zh:
            return en
    
    return value_zh


def extract_json_from_html(html_source: str) -> List[dict]:
    """
    Extract embedded JSON objects from Taobao/Tmall page source.
    Returns list of potential SKU data objects found.
    """
    found_objects = []
    
    # Patterns for embedded JSON data
    patterns = [
        # Taobao init data
        r'window\.g_config\.idata\s*=\s*(\{.+?\});',
        r'var\s+g_config\s*=\s*(\{.+?\});',
        r'TShop\.Setup\((\{.+?\})\)',
        
        # SKU map patterns
        r'"skuMap"\s*:\s*(\{.+?\})',
        r'"sku2info"\s*:\s*(\{.+?\})',
        r'"skuCore"\s*:\s*(\{.+?\})',
        r'"propertyMemoMap"\s*:\s*(\{.+?\})',
        r'"skuBase"\s*:\s*(\{.+?\})',
        
        # Property definitions
        r'"props"\s*:\s*(\[.+?\])',
        r'"prop"\s*:\s*(\[.+?\])',
        
        # Price data
        r'"priceInfo"\s*:\s*(\{.+?\})',
        r'"price"\s*:\s*(\{.+?\})',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, html_source, re.DOTALL)
        for match in matches:
            try:
                # Clean up the match
                json_str = match.strip()
                # Handle trailing commas
                json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
                obj = json.loads(json_str)
                found_objects.append(obj)
            except json.JSONDecodeError:
                continue
    
    # Also try to find script tags with JSON
    script_pattern = r'<script[^>]*>(.*?)</script>'
    scripts = re.findall(script_pattern, html_source, re.DOTALL)
    
    for script in scripts:
        # Look for JSON object assignments
        json_patterns = [
            r'=\s*(\{[^;]+?"sku[^;]+?\})',
            r'=\s*(\{[^;]+?"prop[^;]+?\})',
        ]
        for jp in json_patterns:
            matches = re.findall(jp, script, re.DOTALL)
            for match in matches:
                try:
                    obj = json.loads(match)
                    found_objects.append(obj)
                except:
                    continue
    
    return found_objects


def parse_sku_map(data: dict) -> Optional[VariantExtractionResult]:
    """
    Parse Taobao SKU map structure into normalized options + variants.
    
    Common structures:
    - skuMap: {"propPath": {"price": "xx", "stock": yy}}
    - sku2info: {"skuId": {"price": "xx", "quantity": yy}}
    - props: [{"name": "颜色", "values": [{"name": "黑色", "image": "..."}]}]
    """
    result = VariantExtractionResult(method="json_extraction")
    
    # Try different SKU map keys
    sku_data = None
    prop_data = None
    
    # Find SKU mapping
    for key in ['skuMap', 'sku2info', 'skuCore', 'skuBase']:
        if key in data:
            sku_data = data[key]
            break
    
    # Find property/dimension definitions
    for key in ['props', 'prop', 'properties', 'skuProps']:
        if key in data:
            prop_data = data[key]
            break
    
    if not prop_data and not sku_data:
        # Try nested structures
        if 'data' in data:
            return parse_sku_map(data['data'])
        if 'skuInfo' in data:
            return parse_sku_map(data['skuInfo'])
        return None
    
    # Build prop_id to value mapping for resolving SKU prop_paths
    # Key: prop_id (e.g., "28341"), Value: (dimension_name, value_en, value_zh)
    prop_id_to_value = {}
    
    # Parse dimension definitions
    if prop_data and isinstance(prop_data, list):
        for dim in prop_data:
            if not isinstance(dim, dict):
                continue
            
            name_zh = dim.get('name', '') or dim.get('label', '') or dim.get('text', '')
            if not name_zh:
                continue
            
            name_en = translate_dimension_name(name_zh)
            
            option_dim = OptionDimension(
                name=name_en,
                name_zh=name_zh,
                values=[]
            )
            
            # Parse values
            values = dim.get('values', []) or dim.get('value', []) or dim.get('options', [])
            if isinstance(values, list):
                for val in values:
                    if isinstance(val, dict):
                        val_zh = val.get('name', '') or val.get('text', '') or val.get('label', '')
                        val_en = translate_color_value(val_zh) if name_en == 'Color' else val_zh
                        image = val.get('image', '') or val.get('img', '') or val.get('pic', '')
                        prop_id = str(val.get('id', '') or val.get('propId', ''))
                        
                        # Store mapping for SKU resolution
                        if prop_id:
                            prop_id_to_value[prop_id] = (name_en, val_en, val_zh)
                        
                        option_dim.values.append(OptionValue(
                            value=val_en,
                            value_zh=val_zh,
                            image_url=image if image else None,
                            prop_id=prop_id if prop_id else None
                        ))
                    elif isinstance(val, str):
                        val_en = translate_color_value(val) if name_en == 'Color' else val
                        option_dim.values.append(OptionValue(
                            value=val_en,
                            value_zh=val,
                        ))
            
            if option_dim.values:
                result.options.append(option_dim)
    
    # Parse SKU combinations
    if sku_data and isinstance(sku_data, dict):
        for prop_path, sku_info in sku_data.items():
            if not isinstance(sku_info, dict):
                continue
            
            # Extract price and stock
            price = 0.0
            stock = 0
            
            # Price can be in various fields
            for price_key in ['price', 'priceText', 'originPrice', 'promotionPrice']:
                if price_key in sku_info:
                    try:
                        price_val = sku_info[price_key]
                        if isinstance(price_val, str):
                            price_val = re.sub(r'[^\d.]', '', price_val)
                        price = float(price_val)
                        break
                    except:
                        continue
            
            # Stock
            for stock_key in ['stock', 'quantity', 'canBookCount']:
                if stock_key in sku_info:
                    try:
                        stock = int(sku_info[stock_key])
                        break
                    except:
                        continue
            
            # SKU ID
            sku_id = str(sku_info.get('skuId', '') or sku_info.get('id', '') or prop_path)
            
            # Parse prop_path to get option values
            # Format: "28341;28314" or "1627207:28341;20509:28314"
            option_values = {}
            option_values_zh = {}
            
            # Split prop_path into segments
            segments = prop_path.split(';')
            for segment in segments:
                # Handle both "28341" and "1627207:28341" formats
                if ':' in segment:
                    parts = segment.split(':')
                    value_id = parts[-1]  # Last part is the value ID
                else:
                    value_id = segment
                
                # Look up the value in our mapping
                if value_id in prop_id_to_value:
                    dim_name, val_en, val_zh = prop_id_to_value[value_id]
                    option_values[dim_name] = val_en
                    option_values_zh[dim_name] = val_zh
            
            variant = SKUVariant(
                sku_id=sku_id,
                prop_path=prop_path,
                option_values=option_values,
                option_values_zh=option_values_zh,
                price_cny=price,
                stock=stock,
                available=stock > 0
            )
            
            result.variants.append(variant)
    
    # Calculate confidence
    if result.options and result.variants:
        result.confidence = 0.9
    elif result.options or result.variants:
        result.confidence = 0.6
    else:
        result.confidence = 0.0
    
    return result


def extract_from_page_source(html_source: str) -> VariantExtractionResult:
    """
    Tier 1: Extract SKU data from embedded JSON in page source.
    This is the most reliable method when available.
    """
    result = VariantExtractionResult(method="json_extraction")
    
    # Find all JSON objects in the page
    json_objects = extract_json_from_html(html_source)
    
    if not json_objects:
        result.confidence = 0.0
        result.error = "No embedded JSON found in page source"
        return result
    
    # Try to parse each object as SKU data
    best_result = None
    best_confidence = 0.0
    
    for obj in json_objects:
        parsed = parse_sku_map(obj)
        if parsed and parsed.confidence > best_confidence:
            best_result = parsed
            best_confidence = parsed.confidence
    
    if best_result:
        return best_result
    
    result.error = f"Found {len(json_objects)} JSON objects but none contained valid SKU data"
    result.needs_review = True
    return result


def detect_dimension_groups_from_dom(driver) -> List[Tuple[str, List[str]]]:
    """
    Tier 3 helper: Detect option groups and their values from DOM.
    Returns list of (dimension_name, [values]) tuples.
    """
    from selenium.webdriver.common.by import By
    
    dimensions = []
    
    # Common container patterns for option groups
    group_selectors = [
        'div[class*="sku-item"]',
        'div[class*="tm-sale-prop"]',
        'div[class*="prop"]',
        'dl[class*="sku"]',
        'div[class*="valueItem"]',
    ]
    
    # Try to find labeled option groups
    for selector in group_selectors:
        try:
            groups = driver.find_elements(By.CSS_SELECTOR, selector)
            for group in groups:
                # Try to find the label/title for this group
                label = ""
                try:
                    label_el = group.find_element(By.CSS_SELECTOR, 'dt, label, span[class*="title"]')
                    label = label_el.text.strip()
                except:
                    pass
                
                # Find option buttons/values within this group
                values = []
                try:
                    buttons = group.find_elements(By.CSS_SELECTOR, 'li, span[class*="value"], div[class*="value"]')
                    for btn in buttons:
                        val = btn.text.strip()
                        if val and len(val) < 50:  # Reasonable value length
                            values.append(val)
                except:
                    pass
                
                if label and values:
                    dimensions.append((label, values))
        except:
            continue
    
    return dimensions


def enumerate_click_combinations(driver, max_combinations: int = 60) -> VariantExtractionResult:
    """
    Tier 3: Fallback method - enumerate combinations by clicking options.
    Used when JSON extraction fails.
    """
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    import time
    
    result = VariantExtractionResult(method="click_enumeration")
    
    try:
        # Detect dimension groups
        dimension_groups = detect_dimension_groups_from_dom(driver)
        
        if not dimension_groups:
            # Fall back to flat option list
            buttons = driver.find_elements(By.CSS_SELECTOR, 'div.valueItem--smR4pNt4')
            if buttons:
                dim = OptionDimension(name="Model", name_zh="型号", values=[])
                for btn in buttons:
                    val = btn.text.strip()
                    if val:
                        dim.values.append(OptionValue(value=val, value_zh=val))
                result.options.append(dim)
                result.confidence = 0.5
            return result
        
        # Build options from detected groups
        for dim_name, values in dimension_groups:
            dim_en = translate_dimension_name(dim_name)
            dim = OptionDimension(name=dim_en, name_zh=dim_name, values=[])
            for val in values:
                val_en = translate_color_value(val) if dim_en == 'Color' else val
                dim.values.append(OptionValue(value=val_en, value_zh=val))
            result.options.append(dim)
        
        # TODO: Enumerate combinations by clicking
        # For each combination:
        # 1. Click values in each dimension
        # 2. Check if combination is valid (not disabled)
        # 3. Extract price for this selection
        # 4. Record as variant
        
        # For now, generate cartesian product
        if len(result.options) == 1:
            # Single dimension - each value is a variant
            for val in result.options[0].values:
                variant = SKUVariant(
                    sku_id=f"gen_{val.value}",
                    prop_path="",
                    option_values={result.options[0].name: val.value},
                    option_values_zh={result.options[0].name_zh: val.value_zh},
                )
                result.variants.append(variant)
        elif len(result.options) == 2:
            # Two dimensions - cartesian product
            dim1, dim2 = result.options[0], result.options[1]
            count = 0
            for val1 in dim1.values:
                for val2 in dim2.values:
                    if count >= max_combinations:
                        result.needs_review = True
                        break
                    variant = SKUVariant(
                        sku_id=f"gen_{val1.value}_{val2.value}",
                        prop_path="",
                        option_values={dim1.name: val1.value, dim2.name: val2.value},
                        option_values_zh={dim1.name_zh: val1.value_zh, dim2.name_zh: val2.value_zh},
                    )
                    result.variants.append(variant)
                    count += 1
                if count >= max_combinations:
                    break
        
        result.confidence = 0.6 if result.variants else 0.3
        
    except Exception as e:
        result.error = str(e)
        result.confidence = 0.0
        result.needs_review = True
    
    return result


def extract_variants(driver=None, html_source: str = None) -> VariantExtractionResult:
    """
    Main entry point for variant extraction.
    Tries multiple tiers in order of reliability.
    
    Args:
        driver: Selenium WebDriver instance (optional, for Tier 3)
        html_source: HTML page source (optional, will get from driver if not provided)
    
    Returns:
        VariantExtractionResult with options, variants, confidence, and metadata
    """
    
    # Get HTML source if not provided
    if not html_source and driver:
        html_source = driver.page_source
    
    if not html_source:
        return VariantExtractionResult(
            error="No HTML source provided",
            needs_review=True
        )
    
    # Tier 1: Try JSON extraction from page source
    result = extract_from_page_source(html_source)
    
    if result.confidence >= 0.8:
        print(f"      -> Tier 1 (JSON): Extracted {len(result.options)} dimensions, {len(result.variants)} variants")
        return result
    
    # Tier 3: Fall back to click enumeration (Tier 2 XHR would go here)
    if driver:
        print(f"      -> Tier 1 failed (confidence {result.confidence}), trying click enumeration...")
        result = enumerate_click_combinations(driver)
        if result.confidence > 0:
            print(f"      -> Tier 3 (Click): Extracted {len(result.options)} dimensions, {len(result.variants)} variants")
            return result
    
    # If nothing worked
    return VariantExtractionResult(
        method="failed",
        error="All extraction methods failed",
        needs_review=True
    )


# Testing
if __name__ == '__main__':
    # Test with sample HTML containing embedded JSON
    sample_html = '''
    <script>
    var g_config = {
        "skuInfo": {
            "props": [
                {"name": "颜色分类", "values": [{"name": "黑色", "id": "28341"}, {"name": "沙色", "id": "28342"}]},
                {"name": "尺码", "values": [{"name": "M", "id": "28314"}, {"name": "L", "id": "28315"}]}
            ],
            "skuMap": {
                "28341;28314": {"price": "159", "stock": 50, "skuId": "5001"},
                "28341;28315": {"price": "169", "stock": 30, "skuId": "5002"},
                "28342;28314": {"price": "159", "stock": 45, "skuId": "5003"},
                "28342;28315": {"price": "169", "stock": 25, "skuId": "5004"}
            }
        }
    };
    </script>
    '''
    
    result = extract_variants(html_source=sample_html)
    print("\nExtraction Result:")
    print(f"  Confidence: {result.confidence}")
    print(f"  Method: {result.method}")
    print(f"  Options: {len(result.options)}")
    for opt in result.options:
        print(f"    - {opt.name} ({opt.name_zh}): {[v.value for v in opt.values]}")
    print(f"  Variants: {len(result.variants)}")
    for var in result.variants[:5]:
        print(f"    - SKU {var.sku_id}: {var.option_values}, ¥{var.price_cny}")
