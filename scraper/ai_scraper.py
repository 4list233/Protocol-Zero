"""
AI Scraper V3 - Complete Taobao → Knack Pipeline

End-to-end automation:
1. SCRAPE   - Load Taobao URL, capture images (download by URL, not screenshot)
2. TRANSLATE - Use Gemini to translate Chinese → English (title, variant names)
3. PARSE    - Apply COMET rules to normalize Color/Size/Style options
4. SEED     - Push to Knack database via REST API

Usage:
    python3 ai_scraper.py --login              # One-time login setup
    python3 ai_scraper.py --test               # Test on first URL only
    python3 ai_scraper.py                      # Full run from taobao_links.txt
    python3 ai_scraper.py --dry-run            # Simulate Knack updates
    python3 ai_scraper.py --skip-knack         # Scrape only, no Knack push
"""

import os
import sys
import re
import json
import time
import csv
import base64
import argparse
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict

import requests
from dotenv import load_dotenv

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Local modules
from variant_engine import extract_variants, VariantExtractionResult
from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LINK_FILE = os.path.join(SCRIPT_DIR, 'taobao_links.txt')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output')
MEDIA_DIR = os.path.join(OUTPUT_DIR, 'media')
CSV_OUTPUT = os.path.join(OUTPUT_DIR, 'products.csv')
JSON_OUTPUT = os.path.join(OUTPUT_DIR, 'products.json')
CHROME_PROFILE = os.path.join(SCRIPT_DIR, 'chrome_profile_selenium')

# Load environment
env_path = os.path.join(SCRIPT_DIR, '..', 'shop', '.env.local')
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_AI_API_KEY')

# Timing
PAGE_LOAD_WAIT = 15
CLICK_DELAY = 0.6

# ============================================================================
# PRICING CONFIGURATION
# ============================================================================

PRICING_CONFIG = {
    'exchange_rate': 0.19,        # 1 CNY = 0.19 CAD
    'shipping_cny': 30,           # Fixed shipping cost per item (CNY)
    'salesperson_cut': 0.10,      # 10% of revenue to salesperson
    'promoter_cut': 0.10,         # 10% to promoter (if promo code used)
    'target_margin': 0.30,        # 30% target margin on sale price
}

def calculate_price_cad(price_cny: float) -> dict:
    """
    Calculate CAD pricing with margins from CNY price.
    
    Formula:
    - Cost CAD = (Price CNY + Shipping CNY) × Exchange Rate
    - Sale Price = Cost / (1 - salesperson_cut - target_margin)
    
    Returns dict with all pricing fields.
    """
    cfg = PRICING_CONFIG
    
    # Calculate cost in CAD
    cost_cny = price_cny + cfg['shipping_cny']
    cost_cad = cost_cny * cfg['exchange_rate']
    
    # Calculate sale price to achieve target margin after salesperson cut
    # Price = Cost / (1 - salesperson% - margin%)
    divisor = 1 - cfg['salesperson_cut'] - cfg['target_margin']
    sale_price_cad = cost_cad / divisor if divisor > 0 else cost_cad * 2
    
    # Round to nearest .99 for retail pricing
    sale_price_cad = round(sale_price_cad) - 0.01
    if sale_price_cad < 1:
        sale_price_cad = round(cost_cad * 1.5, 2)
    
    # Calculate actual margins
    revenue_after_salesperson = sale_price_cad * (1 - cfg['salesperson_cut'])
    margin_standard = (revenue_after_salesperson - cost_cad) / sale_price_cad if sale_price_cad > 0 else 0
    
    # Promo margin (after discount + salesperson + promoter)
    promo_price = sale_price_cad * 0.90  # 10% customer discount
    revenue_after_cuts = promo_price * (1 - cfg['salesperson_cut'] - cfg['promoter_cut'])
    margin_promo = (revenue_after_cuts - cost_cad) / promo_price if promo_price > 0 else 0
    
    return {
        'cost_cny': price_cny,
        'shipping_cny': cfg['shipping_cny'],
        'cost_cad': round(cost_cad, 2),
        'price_cad': round(sale_price_cad, 2),
        'margin_standard': round(margin_standard * 100, 1),  # As percentage
        'margin_promo': round(margin_promo * 100, 1),        # As percentage
    }

# ============================================================================
# TRANSLATION DICTIONARIES (from COMET_VARIANT_PROMPT)
# ============================================================================

COLOR_MAP = {
    # Chinese → English
    '黑色': 'Black', '黑': 'Black', '消光黑': 'Matte Black',
    '白色': 'White', '白': 'White',
    '灰色': 'Grey', '灰': 'Grey', '狼灰色': 'Wolf Grey', '狼灰': 'Wolf Grey',
    '棕色': 'Brown', '棕': 'Brown', '狼棕色': 'Coyote Brown', '狼棕': 'Coyote Brown', '土狼棕': 'Coyote Brown',
    '沙色': 'Sand', '泥色': 'Tan', '卡其': 'Khaki',
    '绿色': 'Green', '绿': 'Green', '军绿色': 'Army Green', '军绿': 'Army Green',
    '游骑兵绿色': 'Ranger Green', '游骑兵绿': 'Ranger Green',
    '红色': 'Red', '红': 'Red', '玫红色': 'Rose Red',
    '粉色': 'Pink', '粉红色': 'Pink',
    '蓝色': 'Blue', '蓝': 'Blue',
    '金色': 'Gold', '金': 'Gold',
    '银色': 'Silver', '银': 'Silver',
    # Camo
    '迷彩': 'Camouflage', 'CP迷彩': 'CP Camo', 'MC迷彩': 'MultiCam',
    '暗夜迷彩': 'Black Camo', '丛林迷彩': 'Jungle Camo',
    '废墟迷彩': 'Ruins Camo', '废墟': 'Ruins Camo',
    '多地形迷彩': 'MultiCam',
    # Codes
    'BK': 'Black', 'WG': 'Wolf Grey', 'CB': 'Coyote Brown',
    'RG': 'Ranger Green', 'OD': 'Olive Drab', 'MC': 'MultiCam', 'CP': 'CP Camo',
}

SIZE_MAP = {
    '均码': 'One Size', '通用': 'Universal',
    '大款': 'Large', '小款': 'Small', '短款': 'Short', '矮款': 'Low Profile',
    '加大款': 'XL', '小号': 'Small',
    '一个': '1 pc', '一块': '1 pc', '一只': '1 pc',
    '两个': '2 pcs', '2个': '2 pcs',
    '三个': '3 pcs', '3个': '3 pcs',
    '一套': '1 Set',
}

STYLE_MAP = {
    '金属': 'Metal', '铝合金': 'Aluminum', '尼龙': 'Nylon', '考度拉': 'Cordura',
    '标准': 'Standard', '升级版': 'Upgraded', '套装': 'Set',
    '单': 'Single', '双': 'Dual', '左': 'Left', '右': 'Right',
    'CNC': 'CNC',
}

DIMENSION_LABELS = {
    '颜色': 'Color', '颜色分类': 'Color',
    '尺码': 'Size', '尺寸': 'Size', '规格': 'Size',
    '款式': 'Style', '类型': 'Style',
}


# ============================================================================
# TRANSLATION & PARSING
# ============================================================================

# Model priority based on actual rate limits from Google AI Studio:
# Priority order: gemini-2.5-flash → gemini-2.5-flash-lite → gemini-3-flash → others
# Each run tries models in order until one works, then falls back to DOM if all fail
GEMINI_MODELS = [
    'gemini-2.5-flash',           # Primary: 5 RPM, 20 RPD
    'gemini-2.5-flash-lite',      # Fallback 1: 10 RPM, 20 RPD  
    'gemini-3-flash',             # Fallback 2: 5 RPM, 20 RPD
    'gemma-3-27b',                # Fallback 3: 30 RPM, 14.4 RPD
    'gemma-3-12b',                # Fallback 4: 30 RPM, 14.4 RPD
    'gemma-3-4b',                 # Fallback 5: 30 RPM, 14.4 RPD
]

# Delay between API calls - 15 seconds to stay safely under limits (5 RPM = 12s minimum)
TRANSLATION_DELAY = 15.0

# Shorter delay for non-critical calls (within same product)
INTERNAL_DELAY = 0.5


class GeminiTranslator:
    """Translate Chinese text using Gemini API with model fallback + Vision support"""
    
    def __init__(self, no_api: bool = False):
        self.api_key = GEMINI_API_KEY if not no_api else None
        self.no_api = no_api
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        self.current_model_index = 0
        self.failed_models = set()  # Reset each run - tracks models that fail during this session
        self.last_call_time = 0
        
        if no_api:
            print("⏭️  No API mode - using rule-based translation only")
        else:
            print(f"🤖 AI Models (priority order): {' → '.join(GEMINI_MODELS)}")
        
    def reset_failed_models(self):
        """Reset failed models list - call at start of each product"""
        self.failed_models = set()
        self.current_model_index = 0
        
    def _get_endpoint(self, model: str) -> str:
        return f"{self.base_url}/{model}:generateContent?key={self.api_key}"
    
    def _rate_limit_wait(self, delay: float = TRANSLATION_DELAY):
        """Ensure we don't exceed rate limits"""
        elapsed = time.time() - self.last_call_time
        if elapsed < delay:
            wait_time = delay - elapsed
            print(f"      ⏳ Rate limit: waiting {wait_time:.1f}s...")
            time.sleep(wait_time)
        self.last_call_time = time.time()
    
    def _try_model(self, model: str, payload: dict) -> tuple[bool, str]:
        """Try a specific model. Returns (success, result_or_error)"""
        try:
            endpoint = self._get_endpoint(model)
            response = requests.post(endpoint, json=payload, timeout=30)
            
            if response.ok:
                result = response.json()
                translated = result['candidates'][0]['content']['parts'][0]['text'].strip()
                translated = translated.replace('"', '').replace("'", '').strip()
                return True, translated
            elif response.status_code == 429:  # Rate limit / token exhausted
                print(f"      ⚠️  {model}: Rate limited, switching to backup...")
                self.failed_models.add(model)
                return False, "rate_limited"
            elif response.status_code == 404:
                print(f"      ⚠️  {model}: Not available, trying backup...")
                self.failed_models.add(model)
                return False, "not_found"
            else:
                return False, f"error_{response.status_code}"
        except Exception as e:
            return False, str(e)
    
    def extract_price_from_screenshot(self, screenshot_path: str) -> float:
        """
        Use Gemini Vision to extract the highlighted price from a screenshot.
        Looks for red-colored price text, typically in format "¥XX" before "已售".
        """
        if not self.api_key:
            print("      ⚠️  No GEMINI_API_KEY - cannot use Vision for price")
            return 0.0
        
        if not os.path.exists(screenshot_path):
            return 0.0
        
        # Wait for rate limit
        self._rate_limit_wait()
        
        try:
            # Read and encode image
            with open(screenshot_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            prompt = """You are reading a Taobao product page screenshot to find the MAIN PRODUCT PRICE.

CRITICAL INSTRUCTIONS:
1. Find the LARGE ORANGE-RED price number in the product info area (right side, upper portion)
2. The price format is: ¥XX.X or ¥XXX (the ¥ symbol is small, the NUMBER is large)
3. Read the COMPLETE number - if you see "56.9", return "56.9" NOT "5" or "6.9"
4. The price is typically between ¥20 and ¥500 for tactical/airsoft gear
5. Look for "已售" (already sold) text - the price is to its LEFT

EXAMPLE: If the price display shows "¥56.9 已售 1000+", you should return: 56.9

DO NOT return:
- Partial numbers (like "5" from "56.9")
- Shipping costs
- Small numbers in badges or buttons

Return ONLY the complete price number. Example: 56.9 or 128 or 89"""

            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": image_data
                            }
                        }
                    ]
                }],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 50}
            }
            
            # Try models
            for model in GEMINI_MODELS:
                if model in self.failed_models:
                    continue
                
                success, result = self._try_model(model, payload)
                if success:
                    # Parse the number
                    clean = re.sub(r'[^\d.]', '', result)
                    if clean:
                        try:
                            price = float(clean)
                            # Validate: Price should be realistic for tactical gear (¥10-¥2000)
                            if price < 10:
                                print(f"      ⚠️  Vision returned ¥{price} - likely partial read, retrying...")
                                continue  # Try next model
                            if price > 2000:
                                print(f"      ⚠️  Vision returned ¥{price} - unusually high, but accepting")
                            print(f"      💰 Vision detected price: ¥{price}")
                            return price
                        except:
                            pass
            
            return 0.0
            
        except Exception as e:
            print(f"      ⚠️  Vision price error: {e}")
            return 0.0
        
    def translate(self, text: str, context: str = "airsoft/tactical gear", use_short_delay: bool = False) -> str:
        """Translate Chinese to English with context, with model fallback"""
        if not self.api_key:
            print("      ⚠️  No GEMINI_API_KEY - using rule-based translation only")
            return self._rule_based_translate(text)
        
        if not self._has_chinese(text):
            return text
        
        # Rate limit - use shorter delay for batch variant translations
        delay = INTERNAL_DELAY if use_short_delay else TRANSLATION_DELAY
        self._rate_limit_wait(delay)
        
        prompt = f"""You are a product title + variant localization assistant for an airsoft/tactical gear e-commerce store.

Context: {context}

CORE RULES:
1. KEEP true identifiers (DO NOT remove):
   - Real model numbers/codes (L4G24, HL-ACC-73-T, PEQ-15, MK18, 6094)
   - Platform names (M4, AK, Glock, 1911, AR-15)
   - Camo pattern names (MultiCam, M81, AOR1, Flecktarn)
   - Interface standards (Picatinny, M-LOK, KeyMod, QD)
   - Rail specs, mount types, NV/IR terms
   - Material standards (Cordura, 500D Nylon, 6061 Aluminum)

2. REMOVE generic seller branding + marketing fluff:
   - Store names, "factory direct", "OEM/ODM", "hot sale", "premium", "high quality"
   - "tactical" when used as empty marketing, "military grade", "same as", "1:1", "replica"
   - Chinese: 爆款, 正品, 外贸, 高品质, 热销, 同款
   - Random brand words (悟空, WOSPORT, 骏马, 战狼) unless clearly real identifier

3. Apply milsim naming conventions:
   - Colors: 黑色→Black, 沙色/卡其/土黄→Tan/Coyote Brown, 泥色→FDE, 军绿→OD Green, 狼灰→Wolf Grey, 游骑兵绿→Ranger Green
   - Terms: 快拆→QD, 导轨→Picatinny, 织带→MOLLE, 背心→Plate Carrier, 夜视仪→NVG
   - Format: [Identifier] + [Item Type] + [Key Specs]

Text: {text}

English translation only (no quotes, no explanation):"""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200}
        }
        
        # Try each model in priority order
        for model in GEMINI_MODELS:
            if model in self.failed_models:
                continue
            
            success, result = self._try_model(model, payload)
            if success:
                return result
        
        # All models failed, use rule-based
        print("      ⚠️  All Gemini models failed - using rule-based translation")
        return self._rule_based_translate(text)
    
    def _has_chinese(self, text: str) -> bool:
        return any('\u4e00' <= ch <= '\u9fff' for ch in text)
    
    def _rule_based_translate(self, text: str) -> str:
        """Fallback rule-based translation using dictionaries"""
        result = text
        
        # Apply all maps
        for zh, en in {**COLOR_MAP, **SIZE_MAP, **STYLE_MAP}.items():
            result = result.replace(zh, en)
        
        return result

    def batch_translate_all(self, texts: List[str]) -> List[str]:
        """
        Batch translate a large list of Chinese texts in a single API call.
        Used for efficient translation of all variants at end of scraping.
        
        Args:
            texts: List of Chinese texts to translate
            
        Returns:
            List of English translations (same order as input)
        """
        if not self.api_key:
            print("   ⚠️  No API key - using rule-based translation")
            return [self._rule_based_translate(t) for t in texts]
        
        if not texts:
            return []
        
        # Filter out non-Chinese texts and track their indices
        chinese_texts = []
        chinese_indices = []
        for i, text in enumerate(texts):
            if self._has_chinese(text):
                chinese_texts.append(text)
                chinese_indices.append(i)
        
        if not chinese_texts:
            return texts  # Nothing to translate
        
        print(f"\n   📝 Batch translating {len(chinese_texts)} texts...")
        self._rate_limit_wait()
        
        # Build numbered list for prompt
        text_list = "\n".join([f"{i+1}. {t}" for i, t in enumerate(chinese_texts)])
        
        prompt = f"""You are a product localization assistant for airsoft/tactical gear e-commerce.

## TEXTS TO TRANSLATE:
{text_list}

## TRANSLATION RULES:

KEEP true identifiers (DO NOT remove):
- Real model numbers/codes (L4G24, HL-ACC-73-T, PEQ-15, MK18, 6094)
- Platform names (M4, AK, Glock, AR-15)
- Camo patterns (MultiCam, M81, AOR1, Flecktarn)
- Interface standards (Picatinny, M-LOK, KeyMod, QD)
- Material standards (Cordura, 500D Nylon, 6061 Aluminum)

REMOVE generic seller branding + marketing:
- Store names, "factory direct", "OEM", "hot sale", "premium", "high quality"
- "tactical" as empty marketing, "military grade", "1:1", "replica"
- Chinese: 爆款, 正品, 外贸, 高品质, 热销, 同款
- Random brands: 悟空, WOSPORT, 骏马, 战狼 (unless real identifier)

APPLY milsim naming conventions:
- Colors: 黑色→Black, 沙色/卡其→Tan/Coyote Brown, 泥色→FDE, 军绿→OD Green, 狼灰→Wolf Grey, 游骑兵绿→Ranger Green
- Materials: 金属→Metal, 铝合金→Aluminum, 尼龙→Nylon, 考度拉→Cordura
- Terms: 快拆→QD, 导轨→Picatinny, 织带→MOLLE, 背心→Plate Carrier, 夜视仪→NVG
- Format: [Identifier] + [Item Type] + [Key Specs]

## RESPONSE FORMAT (numbered list only):
1. [Translation 1]
2. [Translation 2]
...

Provide ONLY the numbered translations, nothing else."""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4000}
        }
        
        # Try each model
        for model in GEMINI_MODELS:
            if model in self.failed_models:
                continue
            
            success, result = self._try_model(model, payload)
            if success:
                # Parse numbered response
                translations = self._parse_batch_translations(result, len(chinese_texts))
                
                # Rebuild full list with translations inserted
                output = list(texts)  # Copy original
                for orig_idx, trans in zip(chinese_indices, translations):
                    output[orig_idx] = trans
                
                print(f"   ✅ Batch translated {len(translations)} texts")
                return output
        
        # All models failed
        print("   ⚠️  Batch translation failed - using rule-based")
        return [self._rule_based_translate(t) for t in texts]
    
    def _parse_batch_translations(self, response: str, expected_count: int) -> List[str]:
        """Parse numbered list response into list of translations"""
        lines = response.strip().split('\n')
        translations = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Remove numbering (1. 2. etc)
            match = re.match(r'^\d+[\.\)]\s*(.+)$', line)
            if match:
                translations.append(match.group(1).strip())
            elif line and not line[0].isdigit():
                translations.append(line)
        
        # Pad if needed
        while len(translations) < expected_count:
            translations.append("")
        
        return translations[:expected_count]

    def batch_process_product(self, screenshot_path: str, title_zh: str, variant_names_zh: List[str]) -> Dict:
        """
        OPTIMIZED: Process entire product in ONE API call.
        Extracts price from screenshot AND translates title + all variants together.
        
        Returns: {
            'price': float,
            'title_en': str,
            'variants_en': [str, str, ...]  # Same order as input
        }
        """
        if not self.api_key:
            print("      ⚠️  No GEMINI_API_KEY - using rule-based translation only")
            return {
                'price': 0.0,
                'title_en': self._rule_based_translate(title_zh),
                'variants_en': [self._rule_based_translate(v) for v in variant_names_zh]
            }
        
        if not os.path.exists(screenshot_path):
            print("      ⚠️  No screenshot for batch processing")
            return {
                'price': 0.0,
                'title_en': self._rule_based_translate(title_zh),
                'variants_en': [self._rule_based_translate(v) for v in variant_names_zh]
            }
        
        # Wait for rate limit
        self._rate_limit_wait()
        
        try:
            # Read and encode image
            with open(screenshot_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Build variant list for prompt
            variant_list = "\n".join([f"{i+1}. {v}" for i, v in enumerate(variant_names_zh)])
            
            prompt = f"""You are processing a Taobao tactical/airsoft product page. Do ALL of the following in ONE response:

## TASK 1: EXTRACT PRICE
Look at the screenshot and find the main product price (large orange-red number, format CNY XX.X).
The price is typically CNY 20-500 for tactical gear. Read the COMPLETE number.

## TASK 2: TRANSLATE TITLE
Translate this Chinese product title to English:
"{title_zh}"

## TASK 3: TRANSLATE VARIANTS
Translate each variant name to English (colors, patterns, sizes, materials):
{variant_list}

## RESPONSE FORMAT (use exactly this format):
PRICE: [number only, e.g. 56.9]
TITLE: [English title]
VARIANTS:
1. [English translation]
2. [English translation]
...

## CRITICAL TRANSLATION RULES:
1. KEEP all model numbers and codes exactly as-is (e.g., HL-ACC-73-T, L4G24, NVG, MK18, 6094)
2. KEEP all alphanumeric identifiers - these are important product references
3. REMOVE only Chinese brand names (WUKONG, WOSPORT, JUNMA)
4. KEEP English brand names if present
5. Translate materials: Metal, Aluminum, Polymer, Nylon
6. Translate colors: Black, Tan, OD Green, Grey, Brown
7. Translate patterns: Multicam/Camo, CP Camo, Python Pattern
8. Use tactical terminology: Plate Carrier, MOLLE, Pouch, Holster, Rail Mount

EXAMPLE: "HL-ACC-73-T Metal Tan" (NOT just "Tan")
EXAMPLE: "L4G24 Mount" (remove brand, keep model)"""

            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": image_data
                            }
                        }
                    ]
                }],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1000}
            }
            
            # Try models
            for model in GEMINI_MODELS:
                if model in self.failed_models:
                    continue
                
                success, result = self._try_model(model, payload)
                if success:
                    return self._parse_batch_response(result, title_zh, variant_names_zh)
            
            # All models failed
            print("      ⚠️  All Gemini models failed - using rule-based translation")
            return {
                'price': 0.0,
                'title_en': self._rule_based_translate(title_zh),
                'variants_en': [self._rule_based_translate(v) for v in variant_names_zh]
            }
            
        except Exception as e:
            print(f"      ⚠️  Batch processing error: {e}")
            return {
                'price': 0.0,
                'title_en': self._rule_based_translate(title_zh),
                'variants_en': [self._rule_based_translate(v) for v in variant_names_zh]
            }
    
    def _parse_batch_response(self, response: str, title_zh: str, variant_names_zh: List[str]) -> Dict:
        """Parse the structured response from batch processing"""
        result = {
            'price': 0.0,
            'title_en': title_zh,
            'variants_en': list(variant_names_zh)
        }
        
        lines = response.strip().split('\n')
        
        # Parse PRICE
        for line in lines:
            if line.startswith('PRICE:'):
                price_str = line.replace('PRICE:', '').strip()
                clean = re.sub(r'[^\d.]', '', price_str)
                if clean:
                    try:
                        result['price'] = float(clean)
                    except:
                        pass
                break
        
        # Parse TITLE
        for line in lines:
            if line.startswith('TITLE:'):
                result['title_en'] = line.replace('TITLE:', '').strip()
                break
        
        # Parse VARIANTS
        variants_section = False
        variant_translations = []
        for line in lines:
            if line.startswith('VARIANTS:'):
                variants_section = True
                continue
            if variants_section and line.strip():
                # Remove numbering like "1. " or "2. "
                variant_text = re.sub(r'^\d+\.\s*', '', line.strip())
                if variant_text:
                    variant_translations.append(variant_text)
        
        # Match translations to original variants
        if variant_translations:
            result['variants_en'] = variant_translations[:len(variant_names_zh)]
            # Pad with rule-based if not enough translations
            while len(result['variants_en']) < len(variant_names_zh):
                idx = len(result['variants_en'])
                result['variants_en'].append(self._rule_based_translate(variant_names_zh[idx]))
        
        return result

    def batch_extract_all_variant_data(self, variant_states: List[Dict], title_zh: str) -> Dict:
        """
        Send ALL variant screenshots to Gemini Vision in ONE API call.
        Extract prices, variant names, and validate for all variants.
        
        This is the CORE innovation: Instead of N separate API calls,
        we batch process everything in one comprehensive Vision request.
        
        Args:
            variant_states: List of variant state dicts with screenshot paths
            title_zh: Product title in Chinese
            
        Returns:
            {
                'title_en': 'Translated title',
                'variants': [
                    {
                        'index': 1,
                        'price_cny': 202.5,
                        'variant_name_zh': '黑色 / S',
                        'variant_name_en': 'Black / S',
                        'confidence': 'high'
                    },
                    ...
                ]
            }
        """
        if not self.api_key:
            print("      ⚠️  No API key - using fallback")
            return self._fallback_extract_variant_data(variant_states, title_zh)
        
        if not variant_states:
            return {'title_en': title_zh, 'variants': []}
        
        print(f"      → 🚀 Batch processing {len(variant_states)} variants with Gemini Vision...")
        
        # Rate limit
        self._rate_limit_wait()
        
        try:
            # Encode ALL screenshots
            image_parts = []
            for i, state in enumerate(variant_states):
                if not os.path.exists(state['screenshot_path']):
                    continue
                
                with open(state['screenshot_path'], 'rb') as f:
                    image_data = base64.b64encode(f.read()).decode('utf-8')
                    image_parts.append({
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": image_data
                        }
                    })
            
            if not image_parts:
                print("      ⚠️  No valid screenshots to process")
                return {'title_en': title_zh, 'variants': []}
            
            # Build comprehensive prompt with milsim/tactical translation guidelines
            prompt = f"""You are a product data extraction + localization assistant for a tactical/airsoft e-commerce store.

PRODUCT TITLE (Chinese): {title_zh}

TASK: Analyze {len(image_parts)} Taobao product screenshots and extract price + variant data.

Each screenshot shows ONE variant with:
1. Main product image (the item in selected color/style)
2. Price in CNY (large orange-red number near ¥ symbol, typically ¥20-500)
3. Selected variant options (highlighted buttons)

=== EXTRACTION RULES ===

**PRICE EXTRACTION:**
- Find the large orange/red price number (near "已售" or "¥")
- Read the COMPLETE number (56.9 = 56.9, NOT 5 or 6.9)
- Return as number (202.5, not "202.5")

**VARIANT NAME EXTRACTION:**
- Extract Chinese text from HIGHLIGHTED/SELECTED option buttons
- Format: "Option1 / Option2" if multiple dimensions

=== TRANSLATION RULES (Milsim/Tactical Style) ===

**KEEP true identifiers (DO NOT remove):**
- Real model numbers/codes (L4G24, HL-ACC-73-T, PEQ-15, DBAL-A3, MK18, 6094)
- Platform names (M4, AK, Glock, 1911, AR-15)
- Camo pattern names (MultiCam, M81 Woodland, AOR1, Flecktarn, CP Camo)
- Interface standards (Picatinny (1913), M-LOK, KeyMod, QD)
- Rail specs, mount types (Wilcox, Ops-Core, ARC, Unity, Reptilia)
- NV/IR terms (NVG, Night Vision, IR, Laser, PEQ)
- Material standards (Cordura, 500D Nylon, 6061 Aluminum)

**REMOVE generic seller branding + marketing fluff:**
- Store names, "factory direct", "OEM/ODM", "hot sale", "premium", "high quality"
- "tactical" when used as empty marketing, "military grade", "same as", "1:1", "replica"
- "top", "best", marketing superlatives
- Chinese: 爆款, 正品, 外贸, 高品质, 热销, 同款
- Random brand words: 悟空, WOSPORT, 骏马, 战狼 (unless clearly real identifier)
- Never invent a brand. If uncertain, omit it.

**MILSIM NAMING CONVENTIONS:**

Colors (normalize):
- 黑色/黑 → "Black", 消光黑 → "Matte Black"
- 沙色/土黄/黄褐 → "Tan" or "Coyote Brown" (pick best match)
- 卡其 → "Khaki", 泥色 → "FDE"
- 狼棕 → "Coyote Brown" (if brown) or "Wolf Grey" (if grey)
- 军绿/橄榄绿 → "OD Green", 游骑兵绿 → "Ranger Green"
- 灰色/狼灰 → "Wolf Grey"
- 迷彩 → specify camo name if present; otherwise "Camo"
- CP迷彩 → "CP Camo", 暗夜迷彩 → "Black Camo", 丛林迷彩 → "Jungle Camo"
- multicam/MC → "MultiCam"

Sizes (normalize):
- Standard: XXS, XS, S, M, L, XL, XXL, XXXL, 2XL, 3XL, 4XL
- 均码 → "One Size", 通用 → "Universal"
- 大款 → "Large", 小款 → "Small", 短款 → "Short", 矮款 → "Low Profile"
- Keep numeric sizes exactly: 80-110, 85-125cm, 20cm, 30mm
- Quantity: 一个/一块 → "1 pc", 两个 → "2 pcs", 一套 → "1 Set"

Materials/Style (normalize):
- 金属 → "Metal", 铝合金 → "Aluminum", 尼龙 → "Nylon", 考度拉 → "Cordura"
- CNC → "CNC", 标准 → "Standard", 升级版 → "Upgraded", 套装 → "Set"
- 单 → "Single", 双 → "Dual", 左 → "Left", 右 → "Right"

Terms (translate):
- 快拆 → "QD"
- 导轨/皮轨/20mm/21mm/1913 → "Picatinny (1913)" when applicable
- 织带/MOLLE/PALS → "MOLLE (PALS)"
- 背心 → "Plate Carrier" (if tactical) or "Vest"
- 挂载/支架 → "Mount"
- 夜视仪 → "NVG" or "Night Vision"
- Drop "战术" as generic adjective unless it distinguishes category

**TITLE FORMAT:**
[True Identifier/Model if real] + [Item Type] + [Key Specs] + [Compatibility] + [Color/Pattern if important]
- Keep concise; remove filler
- Use Title Case
Example: "L4G24 NVG Mount - Aluminum - Wilcox Compatible"

=== OUTPUT FORMAT ===

Return ONLY valid JSON with double-quoted keys and string values:

{{
  "title_en": "Clean English Title in Title Case",
  "variants": [
    {{
      "index": 1,
      "price_cny": 215.0,
      "variant_name_zh": "HL-ACC-73-T 金属泥色",
      "variant_name_en": "HL-ACC-73-T / Tan",
      "confidence": "high"
    }},
    {{
      "index": 2,
      "price_cny": 215.0,
      "variant_name_zh": "HL-ACC-73-BK 金属黑色",
      "variant_name_en": "HL-ACC-73-BK / Black",
      "confidence": "high"
    }}
  ]
}}

CRITICAL REQUIREMENTS:
- Process ALL {len(image_parts)} screenshots
- Return data for EACH screenshot in order (index 1, 2, 3...)
- Use exact price numbers (no rounding)
- ALL keys and string values MUST be in double quotes
- confidence: "high", "medium", or "low"
- Do NOT add comments or extra text outside the JSON"""

            # Build payload
            payload_parts = [{"text": prompt}] + image_parts
            
            payload = {
                "contents": [{
                    "parts": payload_parts
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 4000
                }
            }
            
            # Try models
            for model in GEMINI_MODELS:
                if model in self.failed_models:
                    continue
                
                success, result = self._try_model(model, payload)
                if success:
                    # Parse JSON with robust cleaning
                    parsed = self._parse_gemini_json(result, model)
                    if parsed and 'variants' in parsed and len(parsed['variants']) > 0:
                        print(f"      ✅ Extracted {len(parsed['variants'])} variants via Vision")
                        return parsed
                    else:
                        print(f"      ⚠️  Invalid response format from {model}")
                        continue
            
            # All models failed
            print("      ⚠️  All models failed - using fallback")
            return self._fallback_extract_variant_data(variant_states, title_zh)
            
        except Exception as e:
            print(f"      ⚠️  Batch Vision error: {e}")
            import traceback
            traceback.print_exc()
            return self._fallback_extract_variant_data(variant_states, title_zh)

    def _parse_gemini_json(self, result: str, model: str) -> Optional[Dict]:
        """
        Robustly parse JSON from Gemini API responses.
        
        Handles common Gemini quirks:
        - Markdown code blocks (```json ... ```)
        - JavaScript object literals (unquoted keys)
        - JavaScript comments (// and /* */)
        - Trailing commas
        - Single quotes instead of double quotes
        - Extra text before/after JSON
        """
        if not result:
            return None
        
        import re
        
        try:
            text = result.strip()
            
            # Step 1: Remove markdown code blocks
            if '```' in text:
                code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
                matches = re.findall(code_block_pattern, text)
                if matches:
                    text = matches[0]
                else:
                    lines = text.split('\n')
                    if lines[0].strip().startswith('```'):
                        lines = lines[1:]
                    if lines and lines[-1].strip() == '```':
                        lines = lines[:-1]
                    text = '\n'.join(lines)
            
            # Step 2: Find JSON object boundaries
            start_idx = -1
            end_idx = -1
            
            for i, char in enumerate(text):
                if char == '{':
                    start_idx = i
                    break
            
            if start_idx >= 0:
                brace_count = 0
                for i in range(start_idx, len(text)):
                    if text[i] == '{':
                        brace_count += 1
                    elif text[i] == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = i + 1
                            break
            
            if start_idx >= 0 and end_idx > start_idx:
                text = text[start_idx:end_idx]
            
            # Step 3: Remove JavaScript-style comments
            text = re.sub(r'(?<!["\'])//[^\n]*', '', text)
            text = re.sub(r'/\*[\s\S]*?\*/', '', text)
            
            # Step 4: Fix trailing commas
            text = re.sub(r',\s*}', '}', text)
            text = re.sub(r',\s*]', ']', text)
            
            # Step 5: Try to parse as-is first
            try:
                parsed = json.loads(text)
                return parsed
            except json.JSONDecodeError:
                pass
            
            # Step 6: FIX UNQUOTED KEYS (JavaScript object literal style)
            # This is the main Gemini quirk: { key: value } instead of { "key": value }
            # Pattern: word characters followed by colon (not inside strings)
            text_fixed = text
            
            # Add quotes around unquoted keys
            # Match: beginning of object or comma, optional whitespace, unquoted key, colon
            text_fixed = re.sub(
                r'([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:',
                r'\1"\2":',
                text_fixed
            )
            
            # Step 7: Fix unquoted string values (except numbers, booleans, null)
            # Match: colon, whitespace, unquoted value that's not a number/bool/null/object/array
            # This is tricky because values can have spaces and special chars
            # We'll handle common cases
            
            # Fix values that look like strings but aren't quoted
            # Pattern: ": value," or ": value}" where value doesn't start with ", {, [, digit, true, false, null
            def fix_unquoted_value(match):
                prefix = match.group(1)  # : and whitespace
                value = match.group(2)   # the unquoted value
                suffix = match.group(3)  # , or } or ]
                
                # Check if it's already a valid JSON value
                value_stripped = value.strip()
                if value_stripped.startswith('"') or value_stripped.startswith('{') or value_stripped.startswith('['):
                    return match.group(0)
                if value_stripped in ('true', 'false', 'null'):
                    return match.group(0)
                try:
                    float(value_stripped)
                    return match.group(0)  # It's a number
                except ValueError:
                    pass
                
                # It's an unquoted string - add quotes
                # Escape any existing quotes in the value
                value_escaped = value_stripped.replace('\\', '\\\\').replace('"', '\\"')
                return f'{prefix}"{value_escaped}"{suffix}'
            
            # Apply the fix - match ": value," or ": value}" patterns
            text_fixed = re.sub(
                r'(:\s*)([^,}\]"{\[]+?)(\s*[,}\]])',
                fix_unquoted_value,
                text_fixed
            )
            
            try:
                parsed = json.loads(text_fixed)
                return parsed
            except json.JSONDecodeError as e:
                pass
            
            # Step 8: More aggressive fixing - line by line
            lines = text.split('\n')
            fixed_lines = []
            for line in lines:
                # Fix unquoted keys
                line = re.sub(r'^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', line)
                # Fix unquoted string values that aren't numbers
                match = re.match(r'^(\s*"[^"]+"\s*:\s*)([^",\[\]{}\d][^,\[\]{}]*?)(\s*,?\s*)$', line)
                if match:
                    prefix, value, suffix = match.groups()
                    value = value.strip()
                    if value and value not in ('true', 'false', 'null') and not value.startswith('"'):
                        value_escaped = value.replace('"', '\\"')
                        line = f'{prefix}"{value_escaped}"{suffix}'
                fixed_lines.append(line)
            text_fixed = '\n'.join(fixed_lines)
            
            # Clean up again
            text_fixed = re.sub(r',\s*}', '}', text_fixed)
            text_fixed = re.sub(r',\s*]', ']', text_fixed)
            
            try:
                parsed = json.loads(text_fixed)
                return parsed
            except json.JSONDecodeError:
                pass
            
            # Step 9: Last resort - regex extraction
            parsed = self._extract_variant_data_regex(result)
            if parsed:
                return parsed
            
            print(f"      ⚠️  JSON parse failed for {model}, raw response (first 200 chars):")
            print(f"         {result[:200]}...")
            return None
            
        except Exception as e:
            print(f"      ⚠️  JSON parse error from {model}: {e}")
            return None

    def _extract_variant_data_regex(self, text: str) -> Optional[Dict]:
        """
        Last-resort extraction using regex patterns.
        Extracts price_cny and variant names even from malformed JSON.
        Handles both quoted AND unquoted keys/values (Gemini's JavaScript style).
        """
        import re
        
        try:
            variants = []
            
            # Pattern 1: Handle both quoted and unquoted keys
            # Matches: index: 1, price_cny: 215.0, variant_name_zh: "text" or variant_name_zh: text,
            variant_blocks = re.split(r'\{\s*(?:")?index(?:")?\s*:', text)
            
            for i, block in enumerate(variant_blocks[1:], 1):  # Skip first (before any index)
                try:
                    # Extract index
                    idx_match = re.match(r'\s*(\d+)', block)
                    idx = int(idx_match.group(1)) if idx_match else i
                    
                    # Extract price_cny (handles both quoted and unquoted)
                    price_match = re.search(r'(?:")?price_cny(?:")?\s*:\s*([\d.]+)', block)
                    price = float(price_match.group(1)) if price_match else 0.0
                    
                    # Extract variant_name_zh (handles both quoted and unquoted values)
                    name_zh_match = re.search(r'(?:")?variant_name_zh(?:")?\s*:\s*(?:")?([^",}\n]+?)(?:")?(?:\s*[,}\n])', block)
                    name_zh = name_zh_match.group(1).strip() if name_zh_match else f"Variant {idx}"
                    
                    # Extract variant_name_en
                    name_en_match = re.search(r'(?:")?variant_name_en(?:")?\s*:\s*(?:")?([^",}\n]+?)(?:")?(?:\s*[,}\n])', block)
                    name_en = name_en_match.group(1).strip() if name_en_match else name_zh
                    
                    # Extract confidence
                    conf_match = re.search(r'(?:")?confidence(?:")?\s*:\s*(?:")?(\w+)(?:")?', block)
                    confidence = conf_match.group(1) if conf_match else 'medium'
                    
                    if price > 0:  # Only add if we got a price
                        variants.append({
                            'index': idx,
                            'price_cny': price,
                            'variant_name_zh': name_zh,
                            'variant_name_en': name_en,
                            'confidence': confidence
                        })
                except Exception:
                    continue
            
            # Pattern 2: Fallback - just extract all prices and names
            if not variants:
                # Find all price_cny values
                prices = re.findall(r'(?:")?price_cny(?:")?\s*:\s*([\d.]+)', text)
                names_zh = re.findall(r'(?:")?variant_name_zh(?:")?\s*:\s*(?:")?([^",}\n]+?)(?:")?(?:\s*[,}\n])', text)
                names_en = re.findall(r'(?:")?variant_name_en(?:")?\s*:\s*(?:")?([^",}\n]+?)(?:")?(?:\s*[,}\n])', text)
                
                if prices:
                    for i, price in enumerate(prices):
                        name_zh = names_zh[i].strip() if i < len(names_zh) else f"Variant {i+1}"
                        name_en = names_en[i].strip() if i < len(names_en) else name_zh
                        variants.append({
                            'index': i + 1,
                            'price_cny': float(price),
                            'variant_name_zh': name_zh,
                            'variant_name_en': name_en,
                            'confidence': 'low'
                        })
            
            if variants:
                # Extract title_en (handles both quoted and unquoted)
                title_match = re.search(r'(?:")?title_en(?:")?\s*:\s*(?:")?([^",}\n]+?)(?:")?(?:\s*[,}\n])', text)
                title_en = title_match.group(1).strip() if title_match else ""
                
                print(f"      📝 Extracted {len(variants)} variants via regex fallback")
                return {
                    'title_en': title_en,
                    'variants': variants
                }
            
            return None
            
        except Exception as e:
            print(f"      ⚠️  Regex extraction error: {e}")
            return None

    def _fallback_extract_variant_data(self, variant_states: List[Dict], title_zh: str) -> Dict:
        """
        Fallback when Vision API fails.
        Uses rule-based translation.
        """
        variants = []
        
        for state in variant_states:
            # Rule-based translation
            name_en = self._rule_based_translate(state['name_zh'])
            
            # Return 0 price to indicate missing data
            variants.append({
                'index': state['index'],
                'price_cny': 0.0,
                'variant_name_zh': state['name_zh'],
                'variant_name_en': name_en,
                'confidence': 'low'
            })
        
        return {
            'title_en': self._rule_based_translate(title_zh),
            'variants': variants
        }


class VariantParser:
    """Parse variant text into structured Option Type/Value pairs"""
    
    def parse(self, variant_text: str) -> Dict:
        """
        Parse variant text and return structured options.
        Returns: {
            'optionType1': 'Color'|'Size'|'Style'|'',
            'optionValue1': str,
            'optionType2': 'Size'|'Style'|'',
            'optionValue2': str,
            'normalized': str  # Full normalized name
        }
        """
        result = {
            'optionType1': '', 'optionValue1': '',
            'optionType2': '', 'optionValue2': '',
            'normalized': variant_text
        }
        
        # Normalize text
        text = variant_text.strip()
        
        # Check for color
        color = self._find_color(text)
        if color:
            result['optionType1'] = 'Color'
            result['optionValue1'] = color
            
            # Look for size after color
            size = self._find_size(text)
            if size:
                result['optionType2'] = 'Size'
                result['optionValue2'] = size
            else:
                # Look for style after color
                style = self._find_style(text)
                if style:
                    result['optionType2'] = 'Style'
                    result['optionValue2'] = style
        else:
            # No color - check for size first
            size = self._find_size(text)
            if size:
                result['optionType1'] = 'Size'
                result['optionValue1'] = size
            else:
                # No size - check for style
                style = self._find_style(text)
                if style:
                    result['optionType1'] = 'Style'
                    result['optionValue1'] = style
        
        # Build normalized name
        parts = []
        if result['optionValue1']:
            parts.append(result['optionValue1'])
        if result['optionValue2']:
            parts.append(result['optionValue2'])
        result['normalized'] = ' / '.join(parts) if parts else text
        
        return result
    
    def _find_color(self, text: str) -> Optional[str]:
        """Find and normalize color in text"""
        text_lower = text.lower()
        
        # Check Chinese colors
        for zh, en in COLOR_MAP.items():
            if zh in text:
                return en
        
        # Check English colors
        colors = ['black', 'white', 'grey', 'gray', 'brown', 'tan', 'sand', 
                  'green', 'blue', 'red', 'pink', 'gold', 'silver', 'camo', 'multicam']
        for c in colors:
            if c in text_lower:
                return c.title()
        
        return None
    
    def _find_size(self, text: str) -> Optional[str]:
        """Find and normalize size in text"""
        # Check size map
        for zh, en in SIZE_MAP.items():
            if zh in text:
                return en
        
        # Standard sizes
        sizes = ['XXXL', 'XXL', 'XL', 'L', 'M', 'S', 'XS', 'XXS', '2XL', '3XL', '4XL']
        text_upper = text.upper()
        for s in sizes:
            # Match as standalone word
            if re.search(rf'\b{s}\b', text_upper):
                return s
        
        # Numeric ranges (measurements)
        match = re.search(r'(\d+[-–]\d+(?:cm)?)', text)
        if match:
            return match.group(1)
        
        return None
    
    def _find_style(self, text: str) -> Optional[str]:
        """Find and normalize style in text"""
        # Check style map
        for zh, en in STYLE_MAP.items():
            if zh in text:
                return en
            if zh.lower() in text.lower():
                return en
        
        return None


# ============================================================================
# IMAGE DOWNLOADER
# ============================================================================

class ImageDownloader:
    """Download images from URLs (not screenshots)"""
    
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        self.downloaded_hashes = set()  # Dedupe by content hash
        
    def download(self, url: str, filename: str, subfolder: str = 'Main') -> Optional[str]:
        """Download image from URL"""
        if not url:
            return None
            
        # Fix protocol-relative URLs
        if url.startswith('//'):
            url = 'https:' + url
        
        # Clean URL (remove size params to get full resolution)
        url = self._get_full_res_url(url)
        
        try:
            response = requests.get(url, timeout=15, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://www.taobao.com/'
            })
            response.raise_for_status()
            
            # Check content
            if len(response.content) < 1000:
                return None
            
            # Dedupe by hash
            content_hash = hashlib.md5(response.content).hexdigest()
            if content_hash in self.downloaded_hashes:
                return None
            self.downloaded_hashes.add(content_hash)
            
            # Save
            folder = os.path.join(self.output_dir, subfolder)
            os.makedirs(folder, exist_ok=True)
            
            ext = '.jpg'
            if 'png' in url.lower() or response.headers.get('content-type', '').endswith('png'):
                ext = '.png'
            
            filepath = os.path.join(folder, f"{filename}{ext}")
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            return filepath
            
        except Exception as e:
            print(f"      ⚠️  Download failed: {url[:50]}... - {e}")
            return None
    
    def _get_full_res_url(self, url: str) -> str:
        """Remove size restrictions from Taobao CDN URLs"""
        # Remove common size suffixes
        url = re.sub(r'_\d+x\d+\.[a-z]+$', '', url)
        url = re.sub(r'\?.*$', '', url)
        
        # Ensure we get the full image
        if 'alicdn.com' in url and not url.endswith(('.jpg', '.png', '.webp')):
            url = url + '.jpg'
        
        return url


# ============================================================================
# MAIN SCRAPER
# ============================================================================

@dataclass
class ScrapedVariant:
    variant_name_zh: str
    variant_name_en: str
    option_type_1: str
    option_value_1: str
    option_type_2: str
    option_value_2: str
    price_cny: float
    sku_key: str
    in_stock: bool = True
    # Calculated pricing fields
    shipping_cny: float = 0.0
    cost_cad: float = 0.0
    price_cad: float = 0.0
    margin_standard: float = 0.0
    margin_promo: float = 0.0
    # Image binding (links to product.images via IDs)
    image_ids: List[str] = field(default_factory=list)


@dataclass 
class ScrapedProduct:
    url: str
    product_id: str
    title_zh: str
    title_en: str
    variants: List[ScrapedVariant] = field(default_factory=list)
    images: Dict[str, List[str]] = field(default_factory=dict)
    base_price_cny: float = 0.0
    base_price_cad: float = 0.0
    timestamp: str = ""


class AIScraper:
    """Main scraper with full pipeline"""
    
    def __init__(self, headless: bool = False, dry_run: bool = False, skip_knack: bool = False, no_api: bool = False, batch_translate: bool = False):
        self.driver = None
        self.headless = headless
        self.dry_run = dry_run
        self.skip_knack = skip_knack
        self.no_api = no_api
        self.batch_translate = batch_translate
        
        self.translator = GeminiTranslator(no_api=no_api)
        self.parser = VariantParser()
        self.knack_api = None
        
        self.products: List[ScrapedProduct] = []
        self.pending_translations: List[dict] = []  # For batch translation mode
        
    def setup_driver(self):
        """Initialize Chrome and load cookies"""
        options = webdriver.ChromeOptions()
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--window-size=1920,1080')
        
        if self.headless:
            options.add_argument('--headless=new')
        
        print("🚀 Starting Chrome...")
        self.driver = webdriver.Chrome(options=options)
        self.driver.set_page_load_timeout(30)
        
        # Load saved cookies if available
        cookies_file = os.path.join(SCRIPT_DIR, 'taobao_cookies.json')
        if os.path.exists(cookies_file):
            print("🍪 Loading saved Taobao cookies...")
            self.driver.get('https://www.taobao.com/')
            time.sleep(2)
            with open(cookies_file, 'r') as f:
                cookies = json.load(f)
                for cookie in cookies:
                    try:
                        self.driver.add_cookie(cookie)
                    except:
                        pass
            print("✅ Cookies loaded")
        
    def setup_knack(self):
        """Initialize Knack API"""
        if self.skip_knack:
            print("⏭️  Skipping Knack (--skip-knack mode)")
            return
            
        try:
            self.knack_api = KnackAPI()
            print("✅ Knack API connected")
        except Exception as e:
            print(f"⚠️  Knack API not available: {e}")
            self.knack_api = None
    
    def login_setup(self):
        """Interactive login flow"""
        self.setup_driver()
        self.driver.get('https://www.taobao.com/')
        
        print("\n👆 Please log in to Taobao in the browser window.")
        print("⏳ Press Enter when done...")
        input()
        
        # Save cookies
        cookies = self.driver.get_cookies()
        with open(os.path.join(SCRIPT_DIR, 'taobao_cookies.json'), 'w') as f:
            json.dump(cookies, f)
        
        print("✅ Login saved!")
        self.driver.quit()
    
    def scrape_product(self, url: str, index: int) -> Optional[ScrapedProduct]:
        """
        Scrape a single product with IMPROVED V2 variant-image-price binding.
        
        V2 Workflow:
        1. Capture generic images (hero + details)
        2. Detect variants
        3. Click EACH variant → Screenshot (captures image + price)
        4. ONE batch Vision call to extract all prices + translate names
        5. Download variant-specific images
        6. Bind correct images to correct variants
        7. Push to Knack
        """
        print(f"\n{'='*60}")
        print(f"📦 Product {index}: {url[:70]}...")
        print(f"{'='*60}")
        
        # Reset failed models for each new product
        self.translator.reset_failed_models()
        
        # Create folders
        product_folder = os.path.join(MEDIA_DIR, f"product_{index:03d}")
        os.makedirs(product_folder, exist_ok=True)
        
        try:
            # Load page
            self.driver.get(url)
            time.sleep(3)
            
            # Wait for title
            try:
                WebDriverWait(self.driver, PAGE_LOAD_WAIT).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'h1, span[class*="title"]'))
                )
            except TimeoutException:
                print("   ⚠️  Page timeout - may need login")
                return None
            
            # Extract basics
            product_id = self._extract_product_id(url)
            title_zh = self._extract_title()
            print(f"   📝 Title (ZH): {title_zh[:50]}...")
            
            # Create product
            product = ScrapedProduct(
                url=url,
                product_id=product_id,
                title_zh=title_zh,
                title_en=title_zh,  # Will be updated by Vision
                images={'Main': [], 'Details': []},
                timestamp=datetime.now().isoformat()
            )
            
            # === PHASE 1: CAPTURE GENERIC IMAGES ===
            print("   📸 Capturing generic images...")
            downloader = ImageDownloader(product_folder)
            
            # Hero image (before clicking variants)
            main_urls = self._get_main_image_urls()
            for i, img_url in enumerate(main_urls[:1]):
                path = downloader.download(img_url, f"hero_{i+1:02d}", 'Main')
                if path:
                    product.images['Main'].append(path)
            print(f"      → Hero: {len(product.images['Main'])} captured")
            
            # Detail images (scroll down)
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            detail_urls = self._get_detail_image_urls()
            for i, img_url in enumerate(detail_urls[:20]):
                path = downloader.download(img_url, f"detail_{i+1:02d}", 'Details')
                if path:
                    product.images['Details'].append(path)
            print(f"      → Details: {len(product.images['Details'])} captured")
            
            # Scroll back to top
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
            # === PHASE 2: DETECT VARIANTS ===
            print("   🔍 Detecting variants...")
            dimensions = self._find_variant_dimensions()
            
            if not dimensions:
                print("      → No variants found, using base product")
                product.base_price_cny = self._extract_base_price()
                # Still push to Knack if enabled
                if self.knack_api and not self.skip_knack:
                    print("   📤 Pushing to Knack...")
                    self._push_to_knack(product)
                return product
            
            print(f"      → Found {len(dimensions)} dimension(s)")
            
            # === PHASE 3: CAPTURE ALL VARIANT STATES ===
            print(f"   📸 Capturing variant states...")
            variant_states = self._capture_all_variant_states(product, dimensions, product_folder)
            
            if not variant_states:
                print("      → No variant states captured, using fallback")
                # Fallback to old method
                self._extract_variants_by_click(product, product_folder)
                if product.variants:
                    product.base_price_cny = product.variants[0].price_cny
                if self.knack_api and not self.skip_knack:
                    self._push_to_knack(product)
                return product
            
            # === PHASE 4: BATCH VISION PROCESSING (1 API CALL!) ===
            print(f"   🤖 Batch processing {len(variant_states)} variants with Vision...")
            batch_result = self.translator.batch_extract_all_variant_data(
                variant_states=variant_states,
                title_zh=title_zh
            )
            
            # Update title
            if batch_result.get('title_en'):
                product.title_en = batch_result['title_en']
                print(f"      → 📝 Title (EN): {product.title_en[:50]}...")
            
            # === PHASE 5: DOWNLOAD VARIANT-SPECIFIC IMAGES ===
            print("   🖼️  Downloading variant-specific images...")
            variant_images = self._download_variant_images(variant_states, product_folder)
            
            # === PHASE 6: CREATE VARIANT RECORDS ===
            print("   📦 Creating variant records...")
            for variant_data in batch_result.get('variants', []):
                idx = variant_data['index']
                
                # Find corresponding state
                state = next((s for s in variant_states if s['index'] == idx), None)
                if not state:
                    continue
                
                # Skip out-of-stock variants
                if not state.get('in_stock', True):
                    print(f"      ❌ Skipping out-of-stock: {variant_data['variant_name_en'][:30]}")
                    continue
                
                # Parse options from English name
                parsed = self.parser.parse(variant_data['variant_name_en'])
                
                # Create variant
                variant = ScrapedVariant(
                    variant_name_zh=variant_data['variant_name_zh'],
                    variant_name_en=parsed['normalized'] or variant_data['variant_name_en'],
                    option_type_1=parsed['optionType1'] or 'Color',
                    option_value_1=parsed['optionValue1'] or variant_data['variant_name_en'],
                    option_type_2=parsed['optionType2'],
                    option_value_2=parsed['optionValue2'],
                    price_cny=variant_data['price_cny'],
                    sku_key=f"variant_{idx}",
                    in_stock=state.get('in_stock', True)
                )
                
                product.variants.append(variant)
                
                # Show with confidence indicator
                conf = variant_data.get('confidence', 'unknown')
                conf_icon = "✓" if conf == "high" else "⚠" if conf == "medium" else "?"
                print(f"      {conf_icon} {variant_data['variant_name_en'][:35]} @ ¥{variant_data['price_cny']}")
            
            # Set base price from first variant
            if product.variants:
                product.base_price_cny = product.variants[0].price_cny
            else:
                product.base_price_cny = self._extract_base_price()
            
            print(f"   💰 Base price: ¥{product.base_price_cny}")
            
            # === PHASE 7: BIND IMAGES TO VARIANTS ===
            print("   🔗 Binding images to variants...")
            self._bind_variant_specific_images(product, variant_images)
            
            # === PHASE 8: PUSH TO KNACK ===
            if self.knack_api and not self.skip_knack:
                print("   📤 Pushing to Knack...")
                self._push_to_knack(product)
            
            print(f"   ✅ Product complete: {len(product.variants)} variants")
            return product
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _extract_product_id(self, url: str) -> str:
        """Extract Taobao product ID from URL"""
        match = re.search(r'[?&]id=(\d+)', url)
        return match.group(1) if match else hashlib.md5(url.encode()).hexdigest()[:12]
    
    def _extract_title(self) -> str:
        """Extract product title from page"""
        selectors = [
            'h1',
            'span.mainTitle--R75fTcZL',
            'div[class*="title"] h1',
            'div[class*="title"] span',
        ]
        
        for sel in selectors:
            try:
                el = self.driver.find_element(By.CSS_SELECTOR, sel)
                text = el.text.strip()
                if text and len(text) > 5:
                    return text
            except:
                continue
        
        return self.driver.title.split('-')[0].strip()
    
    def _get_main_image_urls(self) -> List[str]:
        """Get main product image URLs"""
        urls = []
        selectors = [
            'img.mainPic--vMTLgVPN',
            'div[class*="mainPic"] img',
            'div[class*="PicGallery"] img',
        ]
        
        for sel in selectors:
            try:
                imgs = self.driver.find_elements(By.CSS_SELECTOR, sel)
                for img in imgs:
                    src = img.get_attribute('src') or img.get_attribute('data-src')
                    if src and 'alicdn' in src:
                        urls.append(src)
            except:
                continue
        
        return list(set(urls))[:5]
    
    def _get_gallery_urls(self) -> List[str]:
        """Get gallery thumbnail URLs (click each to get full-size)"""
        urls = []
        
        try:
            # Find thumbnail container
            thumbs = self.driver.find_elements(By.CSS_SELECTOR, 
                'ul.picLayout--masonryWrap--njZmY0n img, div[class*="thumbnail"] img, li[class*="pic"] img')
            
            for thumb in thumbs:
                # Try to get the larger image URL
                src = thumb.get_attribute('src') or thumb.get_attribute('data-src')
                if src and 'alicdn' in src:
                    urls.append(src)
        except:
            pass
        
        return list(set(urls))
    
    def _get_detail_image_urls(self) -> List[str]:
        """Get detail/description image URLs using scroll-based lazy loading"""
        urls = []
        downloaded_urls = set()  # Track to avoid duplicates
        
        try:
            # STEP 1: Scroll incrementally to trigger lazy loading
            # This is critical for Taobao detail sections which load on scroll
            print("      → Scrolling to load detail images...")
            
            total_height = self.driver.execute_script("return document.body.scrollHeight")
            scroll_steps = [
                int(total_height * 0.33),  # 1/3 down
                int(total_height * 0.50),  # 1/2 down
                int(total_height * 0.75),  # 3/4 down
                total_height               # Bottom
            ]
            
            for scroll_pos in scroll_steps:
                self.driver.execute_script(f"window.scrollTo(0, {scroll_pos});")
                time.sleep(1.5)  # Wait for lazy load to trigger
            
            # STEP 2: Find detail section container
            detail_selectors = [
                'div[id*="description"]',
                'div[class*="description"]',
                'div[class*="detail"]',
                'div[class*="desc"]',
                'div[id*="detail"]',
                '#J_DivItemDesc',
                '.item-desc',
            ]
            
            detail_section = None
            for sel in detail_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, sel)
                    for el in elements:
                        # Find one with images
                        imgs = el.find_elements(By.TAG_NAME, 'img')
                        if len(imgs) >= 3:
                            detail_section = el
                            print(f"      → Found detail section: {sel} ({len(imgs)} images)")
                            break
                    if detail_section:
                        break
                except:
                    continue
            
            # STEP 3: Extract images from detail section (or page if not found)
            if detail_section:
                imgs = detail_section.find_elements(By.TAG_NAME, 'img')
            else:
                # Fallback: all images in lower half of page
                all_imgs = self.driver.find_elements(By.TAG_NAME, 'img')
                viewport_height = self.driver.execute_script("return window.innerHeight")
                imgs = [img for img in all_imgs if img.location.get('y', 0) > viewport_height]
            
            for img in imgs:
                try:
                    # Check multiple lazy-load attribute sources
                    img_url = None
                    
                    # Try standard src first
                    src = img.get_attribute('src')
                    if src and not src.startswith('data:') and len(src) > 30:
                        img_url = src
                    
                    # Try lazy-load attributes
                    if not img_url:
                        lazy_attrs = ['data-src', 'data-lazy-src', 'data-original', 'data-lazyload']
                        for attr in lazy_attrs:
                            val = img.get_attribute(attr)
                            if val and not val.startswith('data:') and len(val) > 30:
                                img_url = val
                                break
                    
                    # Try JS extraction for complex cases
                    if not img_url:
                        all_attrs = self.driver.execute_script("""
                            var img = arguments[0];
                            var result = {};
                            var attrs = ['src', 'data-src', 'data-lazy-src', 'data-original'];
                            attrs.forEach(function(a) {
                                var v = img.getAttribute(a);
                                if (v && !v.startsWith('data:') && v.length > 30) result[a] = v;
                            });
                            return result;
                        """, img)
                        if all_attrs:
                            img_url = list(all_attrs.values())[0]
                    
                    if not img_url:
                        continue
                    
                    # Skip already collected
                    if img_url in downloaded_urls:
                        continue
                    
                    # Skip videos and gifs
                    if any(v in img_url.lower() for v in ['video', 'mp4', 'webm', '.mov', '.gif']):
                        continue
                    
                    # Skip tiny images
                    try:
                        size = img.size
                        if size.get('width', 0) < 100 or size.get('height', 0) < 100:
                            continue
                    except:
                        pass
                    
                    urls.append(img_url)
                    downloaded_urls.add(img_url)
                    
                    if len(urls) >= 30:
                        break
                        
                except:
                    continue
                    
        except Exception as e:
            print(f"      ⚠️  Detail scrape error: {e}")
        
        print(f"      → Found {len(urls)} detail image URLs")
        return urls
    
    def _get_current_main_image_url(self) -> Optional[str]:
        """
        Extract the currently displayed main product image URL from DOM.
        This changes when user clicks different variant options.
        
        Returns:
            High-resolution image URL or None
        """
        try:
            # Try multiple selectors for main image
            selectors = [
                'img.mainPic--vMTLgVPN',  # Common Taobao main image
                'div[class*="mainPic"] img',
                'div[class*="PicGallery"] img[class*="mainPic"]',
                'img[class*="ImageView"]',
                'div[class*="gallery"] img',
            ]
            
            for sel in selectors:
                try:
                    img = self.driver.find_element(By.CSS_SELECTOR, sel)
                    src = img.get_attribute('src') or img.get_attribute('data-src')
                    
                    if src and 'alicdn' in src and not src.startswith('data:'):
                        # Clean URL to get full resolution
                        src = self._clean_image_url(src)
                        return src
                except:
                    continue
            
            # Fallback: Use JavaScript to find largest image in viewport
            largest_img_url = self.driver.execute_script("""
                var imgs = Array.from(document.querySelectorAll('img'));
                var visibleImgs = imgs.filter(function(img) {
                    var rect = img.getBoundingClientRect();
                    return rect.width > 200 && rect.height > 200 && 
                           rect.top >= 0 && rect.left >= 0 &&
                           img.src && img.src.includes('alicdn');
                });
                
                if (visibleImgs.length === 0) return null;
                
                // Find largest
                var largest = visibleImgs.reduce(function(max, img) {
                    var maxSize = max.width * max.height;
                    var imgSize = img.width * img.height;
                    return imgSize > maxSize ? img : max;
                });
                
                return largest.src || largest.getAttribute('data-src');
            """)
            
            if largest_img_url and 'alicdn' in largest_img_url:
                return self._clean_image_url(largest_img_url)
            
            return None
            
        except Exception as e:
            print(f"         ⚠️  Could not extract main image URL: {e}")
            return None
    
    def _clean_image_url(self, url: str) -> str:
        """Remove size restrictions from Taobao CDN URLs to get full resolution"""
        url = re.sub(r'_\d+x\d+\.[a-z]+$', '', url)
        url = re.sub(r'\?.*$', '', url)
        if 'alicdn.com' in url and not url.endswith(('.jpg', '.png', '.webp')):
            url = url + '.jpg'
        return url
    
    def _capture_all_variant_states(self, product: ScrapedProduct, dimensions: List[Dict], product_folder: str) -> List[Dict]:
        """
        Click through ALL variant combinations and capture complete state.
        
        Each captured state includes:
        - Screenshot showing variant image + price
        - Main image URL (for high-res download)
        - Variant name in Chinese
        - Option values
        
        Returns:
            List of variant state dictionaries
        """
        variant_states = []
        screenshots_folder = os.path.join(product_folder, 'variant_screenshots')
        os.makedirs(screenshots_folder, exist_ok=True)
        
        print(f"      → Capturing variant states for {len(dimensions)} dimension(s)...")
        
        # Generate all combinations
        if len(dimensions) == 1:
            # Single dimension (e.g., just colors)
            combinations = self._generate_single_dimension_combos(dimensions[0])
        else:
            # Multi-dimensional (e.g., color × size)
            combinations = self._generate_multi_dimension_combos(dimensions)
        
        print(f"      → Total combinations: {len(combinations)}")
        
        # Click through each combination
        for i, combo in enumerate(combinations):
            try:
                # Click all buttons for this combination
                for button in combo['buttons']:
                    self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
                    time.sleep(0.2)
                    button.click()
                    time.sleep(0.2)
                
                # CRITICAL: Wait for BOTH image AND price to update
                time.sleep(1.0)
                
                # Scroll to top to capture price in viewport
                self.driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(0.3)
                
                # Take full screenshot
                screenshot_path = os.path.join(screenshots_folder, f'variant_{i+1:03d}.png')
                self.driver.save_screenshot(screenshot_path)
                
                # Extract current main image URL
                main_image_url = self._get_current_main_image_url()
                
                # Check if variant is in stock
                in_stock = not any(
                    self._is_button_disabled(btn) for btn in combo['buttons']
                )
                
                variant_states.append({
                    'index': i + 1,
                    'name_zh': combo['name_zh'],
                    'screenshot_path': screenshot_path,
                    'main_image_url': main_image_url,
                    'option_values': combo['option_values'],
                    'in_stock': in_stock,
                    'timestamp': datetime.now().isoformat()
                })
                
                # Show progress
                status = "✓" if main_image_url else "⚠"
                stock = "📦" if in_stock else "❌"
                print(f"         {status} {stock} Captured {i+1}/{len(combinations)}: {combo['name_zh'][:30]}")
                
            except Exception as e:
                print(f"         ⚠️  Error capturing variant {i+1}: {e}")
                continue
        
        print(f"      → Successfully captured {len(variant_states)}/{len(combinations)} variants")
        return variant_states
    
    def _generate_single_dimension_combos(self, dimension: Dict) -> List[Dict]:
        """Generate combinations for single dimension (e.g., just colors)"""
        combinations = []
        buttons = dimension['buttons']
        label = dimension['label']
        
        seen_names = set()
        for btn in buttons[:30]:  # Limit to 30
            text = btn.text.strip()
            if text and text not in seen_names and '\n' not in text[:30]:
                seen_names.add(text)
                combinations.append({
                    'name_zh': text,
                    'buttons': [btn],
                    'option_values': {label: text}
                })
        
        return combinations
    
    def _generate_multi_dimension_combos(self, dimensions: List[Dict]) -> List[Dict]:
        """Generate all combinations for multiple dimensions (e.g., color × size)"""
        combinations = []
        
        dim1 = dimensions[0]
        dim2 = dimensions[1]
        
        # Get unique options for each dimension
        dim1_options = []
        seen1 = set()
        for btn in dim1['buttons']:
            text = btn.text.strip()
            if text and text not in seen1 and '\n' not in text[:20]:
                seen1.add(text)
                dim1_options.append({'button': btn, 'name': text})
        
        dim2_options = []
        seen2 = set()
        for btn in dim2['buttons']:
            text = btn.text.strip()
            if text and text not in seen2 and '\n' not in text[:20]:
                seen2.add(text)
                dim2_options.append({'button': btn, 'name': text})
        
        # Generate all combinations
        for opt1 in dim1_options:
            for opt2 in dim2_options:
                combinations.append({
                    'name_zh': f"{opt1['name']} / {opt2['name']}",
                    'buttons': [opt1['button'], opt2['button']],
                    'option_values': {
                        dim1['label']: opt1['name'],
                        dim2['label']: opt2['name']
                    }
                })
        
        return combinations
    
    def _download_variant_images(self, variant_states: List[Dict], product_folder: str) -> Dict[int, List[str]]:
        """
        Download high-resolution variant-specific images.
        
        Args:
            variant_states: List with image URLs per variant
            product_folder: Base folder
            
        Returns:
            {1: ['/path/img1.jpg'], 2: ['/path/img2.jpg'], ...}
        """
        variant_images = {}
        downloader = ImageDownloader(product_folder)
        
        print(f"      → Downloading {len(variant_states)} variant-specific images...")
        
        for state in variant_states:
            idx = state['index']
            img_url = state.get('main_image_url')
            
            if not img_url:
                print(f"         ⚠️  Variant {idx}: No image URL")
                continue
            
            # Download to variant-specific subfolder
            subfolder = f'variant_{idx:03d}'
            filename = 'main'
            
            downloaded_path = downloader.download(img_url, filename, subfolder)
            
            if downloaded_path:
                if idx not in variant_images:
                    variant_images[idx] = []
                variant_images[idx].append(downloaded_path)
                print(f"         ✓ Variant {idx}: {os.path.basename(downloaded_path)}")
            else:
                print(f"         ⚠️  Variant {idx}: Download failed")
        
        print(f"      → Downloaded {len(variant_images)}/{len(variant_states)} variant images")
        return variant_images
    
    def _bind_variant_specific_images(self, product: ScrapedProduct, variant_images: Dict[int, List[str]]):
        """
        Bind downloaded images to specific variants.
        
        Strategy:
        - Generic images (hero, details) → ALL variants
        - Variant-specific images → Only that variant
        
        Args:
            product: Product with variants list
            variant_images: Dict mapping variant index → image paths
        """
        print(f"      → Binding variant-specific images...")
        
        # Generic images shown for ALL variants
        generic_image_ids = []
        image_counter = 1
        
        # Add hero image (generic)
        for img_path in product.images.get('Main', [])[:1]:
            img_id = f"img_hero_{image_counter:03d}"
            generic_image_ids.append(img_id)
            image_counter += 1
        
        # Add detail images (generic)
        for img_path in product.images.get('Details', [])[:10]:
            img_id = f"img_detail_{image_counter:03d}"
            generic_image_ids.append(img_id)
            image_counter += 1
        
        print(f"         → Generic images: {len(generic_image_ids)}")
        
        # Bind images to each variant
        variant_specific_count = 0
        
        for i, variant in enumerate(product.variants):
            variant_idx = i + 1
            
            # Start with generic images
            variant.image_ids = list(generic_image_ids)
            
            # Add variant-specific images if available
            if variant_idx in variant_images:
                for img_path in variant_images[variant_idx]:
                    img_id = f"img_var_{variant_idx:03d}"
                    variant.image_ids.append(img_id)
                    variant_specific_count += 1
        
        print(f"         → Variant-specific: {variant_specific_count}")
        print(f"         → Total per variant: {len(generic_image_ids)} generic + 1 variant-specific")
    
    def _extract_variants_by_click(self, product: ScrapedProduct, product_folder: str):
        """
        OPTIMIZED: Detect variants and process with SINGLE API call.
        
        Strategy:
        1. Detect variant dimensions (Color, Size, etc.)
        2. Click each variant combination and capture its price via screenshot
        3. Batch translate all variant names in ONE API call
        """
        try:
            # STEP 1: Detect variant dimensions (groups of options)
            dimension_containers = self._find_variant_dimensions()
            
            if not dimension_containers:
                print("      → No variant dimensions found")
                return
            
            print(f"      → Found {len(dimension_containers)} variant dimension(s)")
            
            # Create screenshots folder
            screenshots_folder = os.path.join(product_folder, 'price_screenshots')
            os.makedirs(screenshots_folder, exist_ok=True)
            
            # STEP 2: Handle single dimension (just colors) or multi-dimension (color + size)
            if len(dimension_containers) == 1:
                # Single dimension - just iterate through options
                self._extract_single_dimension_variants(product, dimension_containers[0], screenshots_folder)
            else:
                # Multi-dimensional - iterate through combinations
                self._extract_multi_dimension_variants(product, dimension_containers, screenshots_folder)
                    
        except Exception as e:
            print(f"      ⚠️  Variant extraction error: {e}")
            import traceback
            traceback.print_exc()
    
    def _find_variant_dimensions(self) -> List[Dict]:
        """
        Find variant dimension groups on the page.
        Returns list of: [{'label': 'Color', 'buttons': [elements...]}, {'label': 'Size', 'buttons': [...]}]
        """
        dimensions = []
        
        # Try to find labeled dimension containers
        dimension_selectors = [
            'div[class*="skuItem"]',           # Common Taobao structure
            'div[class*="sku-item"]',
            'dl[class*="sku"]',
            'div[class*="prop"]',
        ]
        
        for sel in dimension_selectors:
            try:
                containers = self.driver.find_elements(By.CSS_SELECTOR, sel)
                for container in containers:
                    # Find the label (颜色, 尺码, etc.)
                    label = ""
                    try:
                        label_el = container.find_element(By.CSS_SELECTOR, 
                            'span[class*="label"], span[class*="title"], dt, div[class*="name"]')
                        label = label_el.text.strip()
                    except:
                        pass
                    
                    # Find option buttons
                    buttons = container.find_elements(By.CSS_SELECTOR,
                        'div[class*="valueItem"], span[class*="value"], li, a[class*="item"]')
                    
                    if buttons and len(buttons) > 0:
                        # Translate label
                        label_en = DIMENSION_LABELS.get(label, label)
                        if not label_en and len(dimensions) == 0:
                            label_en = "Color"  # First dimension is usually color
                        elif not label_en:
                            label_en = "Size"   # Second dimension is usually size
                        
                        dimensions.append({
                            'label': label_en,
                            'label_zh': label,
                            'buttons': buttons
                        })
                
                if dimensions:
                    break
            except:
                continue
        
        # Fallback: just find all variant buttons
        if not dimensions:
            buttons = self.driver.find_elements(By.CSS_SELECTOR, 
                'div.valueItem--smR4pNt4, div[class*="valueItem"], span[class*="sku-item"]')
            if buttons:
                dimensions.append({
                    'label': 'Color',
                    'label_zh': '',
                    'buttons': buttons
                })
        
        return dimensions
    
    def _extract_single_dimension_variants(self, product: ScrapedProduct, dimension: Dict, screenshots_folder: str):
        """Extract variants from a single dimension (e.g., just colors)"""
        buttons = dimension['buttons']
        label = dimension['label']
        
        print(f"      → Processing {len(buttons)} {label} options...")
        
        # Collect all variant names first, deduplicate by text
        variant_data = []
        seen_names = set()
        for i, btn in enumerate(buttons[:30]):
            text = btn.text.strip()
            # Skip empty, duplicates, and multi-line text (likely includes label)
            if text and text not in seen_names and '\n' not in text[:30]:
                seen_names.add(text)
                variant_data.append({
                    'index': i,
                    'button': btn,
                    'name_zh': text,
                    'price': 0.0
                })
        
        if not variant_data:
            print("      → No variant text found")
            return
        
        # Limit to 30 unique variants
        variant_data = variant_data[:30]
        
        # STEP 1: Click each variant and capture its price (DOM first, Vision as backup)
        print(f"      → Capturing prices for {len(variant_data)} variants...")
        last_known_price = 0.0
        
        for idx, v in enumerate(variant_data):
            try:
                # Click the variant
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", v['button'])
                time.sleep(0.2)
                v['button'].click()
                time.sleep(0.5)  # Wait for price to update
                
                # Try DOM extraction first (fast, no API)
                price = self._extract_current_price()
                
                # If DOM failed and this is first variant, try Vision (unless no-api mode)
                if price <= 0 and idx == 0 and not self.translator.no_api:
                    screenshot_path = os.path.join(screenshots_folder, f'variant_{idx+1:03d}.png')
                    self.driver.execute_script("window.scrollTo(0, 0);")
                    time.sleep(0.5)  # Wait for price to fully load before screenshot
                    self.driver.save_screenshot(screenshot_path)
                    price = self.translator.extract_price_from_screenshot(screenshot_path)
                
                if price > 0:
                    v['price'] = price
                    last_known_price = price
                else:
                    v['price'] = last_known_price
                
            except Exception as e:
                print(f"         ⚠️  Error clicking variant {v['index']}: {e}")
                v['price'] = last_known_price
        
        # STEP 2: Batch translate all variant names (ONE API call)
        variant_names_zh = [v['name_zh'] for v in variant_data]
        print(f"      → 🚀 Batch translating {len(variant_names_zh)} variants...")
        
        batch_result = self.translator.batch_process_product(
            screenshot_path=os.path.join(screenshots_folder, 'price_check.png') if os.path.exists(os.path.join(screenshots_folder, 'price_check.png')) else "",
            title_zh=product.title_zh,
            variant_names_zh=variant_names_zh
        )
        
        # Update title if better
        if batch_result['title_en'] and batch_result['title_en'] != product.title_zh:
            product.title_en = batch_result['title_en']
            print(f"      → 📝 Title: {product.title_en[:50]}...")
        
        # STEP 3: Create variant records with individual prices
        for i, (v, name_en) in enumerate(zip(variant_data, batch_result['variants_en'])):
            parsed = self.parser.parse(name_en)
            
            # Use individual price, fall back to batch price if 0
            price = v['price'] if v['price'] > 0 else batch_result['price']
            
            product.variants.append(ScrapedVariant(
                variant_name_zh=v['name_zh'],
                variant_name_en=parsed['normalized'],
                option_type_1=label,
                option_value_1=parsed['optionValue1'] or name_en,
                option_type_2=parsed['optionType2'],
                option_value_2=parsed['optionValue2'],
                price_cny=price,
                sku_key=f"variant_{i+1}",
                in_stock=True
            ))
            
            print(f"         → {v['name_zh']} → {parsed['normalized']} @ ¥{price}")
    
    def _extract_multi_dimension_variants(self, product: ScrapedProduct, dimensions: List[Dict], screenshots_folder: str):
        """
        Extract variants from multiple dimensions (e.g., Size + Style).
        Creates combinations like "One Size / Set A", "S / Set B", etc.
        """
        dim1 = dimensions[0]  # Usually Size or Color
        dim2 = dimensions[1]  # Usually Style or Size
        
        print(f"      → Multi-dimensional: {dim1['label']} ({len(dim1['buttons'])}) × {dim2['label']} ({len(dim2['buttons'])})")
        
        # Collect ALL unique option names with deduplication (no artificial limits)
        dim1_options = []
        seen1 = set()
        for btn in dim1['buttons']:  # No limit - get all options
            text = btn.text.strip()
            if text and text not in seen1 and '\n' not in text[:20]:
                seen1.add(text)
                dim1_options.append({'button': btn, 'name_zh': text})
        
        dim2_options = []
        seen2 = set()
        for btn in dim2['buttons']:  # No limit - get all options
            text = btn.text.strip()
            if text and text not in seen2 and '\n' not in text[:20]:
                seen2.add(text)
                dim2_options.append({'button': btn, 'name_zh': text})
        
        if not dim1_options or not dim2_options:
            print("      → Missing options in dimensions")
            return
        
        print(f"      → Unique options: {len(dim1_options)} × {len(dim2_options)} = {len(dim1_options) * len(dim2_options)} combinations")
        
        # Take screenshot for batch processing
        screenshot_path = os.path.join(screenshots_folder, 'multi_dim.png')
        self.driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(0.3)
        self.driver.save_screenshot(screenshot_path)
        
        # Batch translate dimension options
        print(f"      → 🚀 Batch translating {len(dim1_options)} {dim1['label']} + {len(dim2_options)} {dim2['label']} options...")
        
        all_names_zh = [o['name_zh'] for o in dim1_options] + [o['name_zh'] for o in dim2_options]
        
        batch_result = self.translator.batch_process_product(
            screenshot_path=screenshot_path,
            title_zh=product.title_zh,
            variant_names_zh=all_names_zh
        )
        
        # Split translations back
        dim1_translations = batch_result['variants_en'][:len(dim1_options)]
        dim2_translations = batch_result['variants_en'][len(dim1_options):]
        
        # Update title
        if batch_result['title_en'] and batch_result['title_en'] != product.title_zh:
            product.title_en = batch_result['title_en']
            print(f"      → 📝 Title: {product.title_en[:50]}...")
        
        # Create variant combinations with INDIVIDUAL prices for each
        variant_count = 0
        seen_combos = set()  # Prevent duplicate combinations
        last_known_price = 0.0  # Track price from Vision
        
        print(f"      → Capturing individual prices for each variant (using Vision API)...")
        
        for i, (opt1, name1_en) in enumerate(zip(dim1_options, dim1_translations)):
            # Click dimension 1 option
            try:
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", opt1['button'])
                time.sleep(0.2)
                opt1['button'].click()
                time.sleep(0.5)  # Wait for price to update
            except:
                continue
            
            for j, (opt2, name2_en) in enumerate(zip(dim2_options, dim2_translations)):
                # Create combo key for deduplication
                combo_key = f"{opt1['name_zh']}|{opt2['name_zh']}"
                if combo_key in seen_combos:
                    continue
                seen_combos.add(combo_key)
                
                # Check if this combination is out of stock (button disabled)
                is_out_of_stock = self._is_button_disabled(opt2['button'])
                
                # Skip out-of-stock variants entirely
                if is_out_of_stock:
                    continue
                
                # Click dimension 2 option
                try:
                    opt2['button'].click()
                    time.sleep(0.5)  # Wait for price to update after click
                    
                    # First try DOM extraction (fast, no API)
                    price = self._extract_current_price()
                    
                    # If DOM failed and this is first variant or when changing dim1, try Vision (unless no-api mode)
                    if price <= 0 and ((variant_count == 0) or (j == 0)) and not self.translator.no_api:
                        # Take screenshot and use Vision to read price
                        screenshot_path = os.path.join(screenshots_folder, f'variant_{variant_count+1:03d}.png')
                        self.driver.execute_script("window.scrollTo(0, 0);")
                        time.sleep(0.5)  # Wait for price to fully load before screenshot
                        self.driver.save_screenshot(screenshot_path)
                        price = self.translator.extract_price_from_screenshot(screenshot_path)
                    
                    # Update last known price if we got a valid one
                    if price > 0:
                        last_known_price = price
                    else:
                        # Fall back to last known price
                        price = last_known_price
                    
                    variant_count += 1
                    
                    # Create combined variant
                    combined_name = f"{name1_en} / {name2_en}"
                    
                    product.variants.append(ScrapedVariant(
                        variant_name_zh=f"{opt1['name_zh']} / {opt2['name_zh']}",
                        variant_name_en=combined_name,
                        option_type_1=dim1['label'],
                        option_value_1=name1_en,
                        option_type_2=dim2['label'],
                        option_value_2=name2_en,
                        price_cny=price,
                        sku_key=f"variant_{variant_count}",
                        in_stock=True
                    ))
                    
                    print(f"         → {opt1['name_zh']}/{opt2['name_zh']} → {combined_name} @ ¥{price}")
                    
                except Exception as e:
                    continue
        
        print(f"      → Created {variant_count} variant combinations")
    
    def _is_button_disabled(self, button) -> bool:
        """Check if a variant button is disabled/out-of-stock (blacked out)"""
        try:
            # Check various disabled indicators
            result = self.driver.execute_script("""
                var btn = arguments[0];
                
                // Check CSS classes for disabled/unavailable indicators
                var classes = btn.className.toLowerCase();
                if (classes.includes('disabled') || 
                    classes.includes('unavailable') || 
                    classes.includes('soldout') || 
                    classes.includes('out-of-stock') ||
                    classes.includes('cannot') ||
                    classes.includes('grayed')) {
                    return true;
                }
                
                // Check computed opacity (blacked out buttons often have low opacity)
                var style = window.getComputedStyle(btn);
                var opacity = parseFloat(style.opacity);
                if (opacity < 0.5) return true;
                
                // Check for disabled attribute
                if (btn.disabled || btn.getAttribute('disabled') !== null) return true;
                
                // Check aria attributes
                if (btn.getAttribute('aria-disabled') === 'true') return true;
                
                // Check for diagonal line overlay (common Taobao out-of-stock indicator)
                var bgImage = style.backgroundImage;
                if (bgImage && bgImage.includes('diagonal')) return true;
                
                // Check pointer-events
                if (style.pointerEvents === 'none') return true;
                
                return false;
            """, button)
            return result
        except:
            return False

    def _extract_current_price(self) -> float:
        """Extract the currently displayed price from DOM using JavaScript for accuracy"""
        
        # Use JavaScript to find the price - simpler regex for reliability
        js_price_scripts = [
            # Script 1: Look for highlightPrice (current selected variant price)
            """
            var el = document.querySelector('[class*="highlightPrice"]');
            if (el) {
                var text = el.textContent;
                var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                if (nums && nums.length > 0) {
                    var num = parseFloat(nums[0]);
                    if (num >= 5 && num <= 5000) return num;
                }
            }
            return 0;
            """,
            # Script 2: Look for normalPrice
            """
            var el = document.querySelector('[class*="normalPrice"]');
            if (el) {
                var text = el.textContent;
                var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                if (nums && nums.length > 0) {
                    var num = parseFloat(nums[0]);
                    if (num >= 5 && num <= 5000) return num;
                }
            }
            return 0;
            """,
            # Script 3: Look for priceInt elements
            """
            var el = document.querySelector('[class*="priceInt"]');
            if (el) {
                var text = el.textContent;
                var nums = text.match(/[0-9]+/g);
                if (nums && nums.length > 0) {
                    var num = parseFloat(nums[0]);
                    if (num >= 5 && num <= 5000) return num;
                }
            }
            return 0;
            """,
            # Script 4: Look for any element with ¥ symbol
            """
            var els = document.querySelectorAll('[class*="Price"], [class*="price"]');
            for (var i = 0; i < els.length; i++) {
                var text = els[i].textContent;
                if (text.indexOf('¥') >= 0) {
                    var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                    if (nums && nums.length > 0) {
                        var num = parseFloat(nums[0]);
                        if (num >= 5 && num <= 5000) return num;
                    }
                }
            }
            return 0;
            """
        ]
        
        for script in js_price_scripts:
            try:
                price = self.driver.execute_script(script)
                if price and price > 0:
                    return float(price)
            except:
                continue
        
        # Fallback: CSS selectors
        selectors = [
            'span.Price--priceInt--ZlsSi_M',
            'span[class*="Price--priceInt"]',
        ]
        
        for sel in selectors:
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, sel)
                for el in elements:
                    text = el.text.strip()
                    if not text:
                        continue
                    match = re.search(r'[\d.]+', text)
                    if match:
                        price = float(match.group())
                        if 5 <= price <= 5000:
                            return price
            except:
                continue
        
        return 0.0
    
    def _extract_base_price(self) -> float:
        """Extract base price from DOM"""
        selectors = [
            'span.Price--priceInt--ZlsSi_M',
            'span[class*="priceInt"]',
            'em.tb-rmb-num',
        ]
        
        for sel in selectors:
            try:
                el = self.driver.find_element(By.CSS_SELECTOR, sel)
                text = el.text.strip()
                match = re.search(r'[\d,.]+', text)
                if match:
                    return float(match.group().replace(',', ''))
            except:
                continue
        
        return 0.0
    
    def _bind_images_to_variants(self, product: ScrapedProduct):
        """
        Bind images to variants based on their primary option (Color/Style).
        
        Strategy:
        1. Hero/Main images → ALL variants (generic product images)
        2. Gallery images → Try to match by primary option (Color/Style)
        3. Detail images → ALL variants (product specs/features)
        
        Image IDs are generated from file paths for tracking.
        """
        # Generate image IDs from file paths
        all_image_ids = []
        image_id_map = {}  # path → id
        
        idx = 1
        for category in ['Main', 'Catalogue', 'Details']:
            for img_path in product.images.get(category, []):
                img_id = f"img_{idx:03d}"
                all_image_ids.append(img_id)
                image_id_map[img_path] = img_id
                idx += 1
        
        if not all_image_ids:
            print("      → No images to bind")
            return
        
        # Generic images (shown for all variants)
        generic_image_ids = []
        
        # Main/Hero images are always generic
        for img_path in product.images.get('Main', []):
            if img_path in image_id_map:
                generic_image_ids.append(image_id_map[img_path])
        
        # Detail images are always generic (specs, features, etc.)
        for img_path in product.images.get('Details', []):
            if img_path in image_id_map:
                generic_image_ids.append(image_id_map[img_path])
        
        print(f"      → Generic images: {len(generic_image_ids)} (shown for all variants)")
        
        # TODO: Implement smart variant-specific image detection
        # For now, assign all gallery images as generic too
        # Future enhancement: Use AI to detect which gallery images match which colors/styles
        for img_path in product.images.get('Catalogue', []):
            if img_path in image_id_map:
                generic_image_ids.append(image_id_map[img_path])
        
        # Assign images to each variant
        for variant in product.variants:
            # Start with generic images
            variant.image_ids = list(generic_image_ids)
            
            # TODO: Add variant-specific images based on option_value_1 (Color/Style)
            # This would require AI vision to detect which images show which colors
            # For MVP, all variants get all images
        
        print(f"      → Assigned {len(generic_image_ids)} images to {len(product.variants)} variants")
        print(f"      → Image IDs: {', '.join(generic_image_ids[:5])}{'...' if len(generic_image_ids) > 5 else ''}")
    
    def _push_to_knack(self, product: ScrapedProduct):
        """Push product and variants to Knack database with pricing"""
        if not self.knack_api:
            return
        
        try:
            # Find or create product
            existing = self.knack_api.find_record(
                PRODUCTS_OBJECT_KEY,
                PRODUCT_FIELDS['url'],
                product.url
            )
            
            if existing:
                product_record_id = existing['id']
                print(f"      → Found existing product: {product_record_id}")
            else:
                # Create new product with base pricing
                product_data = {
                    PRODUCT_FIELDS['id']: product.product_id,
                    PRODUCT_FIELDS['title']: product.title_en,
                    PRODUCT_FIELDS['titleOriginal']: product.title_zh,
                    PRODUCT_FIELDS['url']: product.url,
                    PRODUCT_FIELDS['status']: 'Active',
                }
                
                # Add base price if available
                if 'priceCadBase' in PRODUCT_FIELDS and product.base_price_cad > 0:
                    product_data[PRODUCT_FIELDS['priceCadBase']] = product.base_price_cad
                
                if self.dry_run:
                    print(f"      → [DRY RUN] Would create product: {product.title_en[:40]}")
                    return
                
                result = self.knack_api.create_record(PRODUCTS_OBJECT_KEY, product_data)
                product_record_id = result['id']
                print(f"      → Created product: {product_record_id}")
            
            # Push variants with pricing
            for v in product.variants:
                # Calculate pricing if not already done
                if v.price_cad == 0 and v.price_cny > 0:
                    pricing = calculate_price_cad(v.price_cny)
                    v.cost_cad = pricing['cost_cad']
                    v.price_cad = pricing['price_cad']
                    v.margin_standard = pricing['margin_standard']
                
                variant_data = {
                    VARIANT_FIELDS['product']: [product_record_id],  # Connection field
                    VARIANT_FIELDS['variantName']: v.variant_name_en,
                    VARIANT_FIELDS['optionType1']: v.option_type_1,
                    VARIANT_FIELDS['optionValue1']: v.option_value_1,
                    VARIANT_FIELDS['optionType2']: v.option_type_2,
                    VARIANT_FIELDS['optionValue2']: v.option_value_2,
                    VARIANT_FIELDS['priceCny']: v.price_cny,
                    VARIANT_FIELDS['status']: 'Active' if v.in_stock else 'Out of Stock',
                }
                
                # Add CAD pricing fields
                variant_data[VARIANT_FIELDS['priceCad']] = v.price_cad
                variant_data[VARIANT_FIELDS['costCad']] = v.cost_cad
                variant_data[VARIANT_FIELDS['marginStandard']] = v.margin_standard  # As percentage (30.5)
                variant_data[VARIANT_FIELDS['marginPromo']] = v.margin_promo  # As percentage (14.2)
                
                # Add image IDs (serialize as JSON array)
                if v.image_ids:
                    variant_data[VARIANT_FIELDS['imageIdsJson']] = json.dumps(v.image_ids)
                
                if self.dry_run:
                    print(f"         → [DRY RUN] Would create variant: {v.variant_name_en} @ ${v.price_cad}")
                    continue
                
                # Check if variant exists
                existing_variant = self.knack_api.find_record(
                    VARIANTS_OBJECT_KEY,
                    VARIANT_FIELDS['variantName'],
                    v.variant_name_en
                )
                
                if existing_variant:
                    self.knack_api.update_record(VARIANTS_OBJECT_KEY, existing_variant['id'], variant_data)
                    print(f"         → Updated: {v.variant_name_en} @ ${v.price_cad}")
                else:
                    self.knack_api.create_record(VARIANTS_OBJECT_KEY, variant_data)
                    print(f"         → Created: {v.variant_name_en} @ ${v.price_cad}")
                
                time.sleep(0.2)  # Rate limit
                
        except Exception as e:
            print(f"      ⚠️  Knack error: {e}")
    
    def _batch_translate_all_products(self):
        """Batch translate all product titles and variants in a single API call"""
        print(f"\n{'='*60}")
        print("📝 BATCH TRANSLATION")
        print(f"{'='*60}")
        
        # Collect all texts that need translation
        all_texts = []
        text_mapping = []  # (product_idx, 'title' | variant_idx)
        
        for p_idx, product in enumerate(self.products):
            # Add title
            if product.title_zh and product.title_zh != product.title_en:
                all_texts.append(product.title_zh)
                text_mapping.append((p_idx, 'title'))
            
            # Add variants
            for v_idx, variant in enumerate(product.variants):
                if variant.variant_name_zh and variant.variant_name_zh != variant.variant_name_en:
                    all_texts.append(variant.variant_name_zh)
                    text_mapping.append((p_idx, v_idx))
        
        if not all_texts:
            print("   No texts need translation")
            return
        
        print(f"   Found {len(all_texts)} texts to translate")
        
        # Batch translate
        translations = self.translator.batch_translate_all(all_texts)
        
        # Apply translations back to products
        for (p_idx, target), translation in zip(text_mapping, translations):
            if target == 'title':
                self.products[p_idx].title_en = translation
            else:
                v_idx = target
                # Also parse the translation into option types/values
                parsed = self.parser.parse(translation)
                self.products[p_idx].variants[v_idx].variant_name_en = parsed['normalized']
                self.products[p_idx].variants[v_idx].option_type_1 = parsed['optionType1']
                self.products[p_idx].variants[v_idx].option_value_1 = parsed['optionValue1']
                self.products[p_idx].variants[v_idx].option_type_2 = parsed['optionType2']
                self.products[p_idx].variants[v_idx].option_value_2 = parsed['optionValue2']
        
        print(f"   ✅ Applied translations to {len(self.products)} products")
    
    def run(self, urls: List[str], test_mode: bool = False):
        """Run the full pipeline"""
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        os.makedirs(MEDIA_DIR, exist_ok=True)
        
        self.setup_driver()
        self.setup_knack()
        
        try:
            if test_mode:
                urls = urls[:1]
            
            print(f"\n🚀 AI Scraper V3 - {len(urls)} URLs")
            if self.dry_run:
                print("   Mode: 🧪 DRY RUN (no Knack changes)")
            if self.skip_knack:
                print("   Mode: ⏭️  SKIP KNACK (scrape only)")
            if self.batch_translate:
                print("   Mode: 📝 BATCH TRANSLATE (at end)")
            
            for i, url in enumerate(urls, 1):
                product = self.scrape_product(url, i)
                if product:
                    self.products.append(product)
                time.sleep(2)
            
            # Batch translate if requested
            if self.batch_translate:
                self._batch_translate_all_products()
            
            self._export()
            
            print(f"\n✅ Done! {len(self.products)} products scraped")
            print(f"   📁 Output: {OUTPUT_DIR}")
            
        finally:
            if self.driver:
                self.driver.quit()
    
    def _export(self):
        """Export to CSV and JSON with calculated pricing"""
        
        # Calculate pricing for all variants first
        print("   💰 Calculating CAD pricing with margins...")
        for p in self.products:
            for v in p.variants:
                pricing = calculate_price_cad(v.price_cny)
                v.shipping_cny = pricing['shipping_cny']
                v.cost_cad = pricing['cost_cad']
                v.price_cad = pricing['price_cad']
                v.margin_standard = pricing['margin_standard']
                v.margin_promo = pricing['margin_promo']
            
            # Set base price from first variant or base_price_cny
            if p.variants:
                p.base_price_cad = p.variants[0].price_cad
            elif p.base_price_cny > 0:
                pricing = calculate_price_cad(p.base_price_cny)
                p.base_price_cad = pricing['price_cad']
        
        # CSV with pricing columns
        with open(CSV_OUTPUT, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'URL', 'Product ID', 'Title (EN)', 'Title (ZH)',
                'Variant Name (EN)', 'Variant Name (ZH)',
                'Option Type 1', 'Option Value 1',
                'Option Type 2', 'Option Value 2',
                'Price CNY', 'Shipping CNY', 'Cost CAD', 'Price CAD',
                'Margin %', 'Margin Promo %',
                'SKU Key', 'In Stock',
                'Main Images', 'Gallery Images', 'Detail Images'
            ])
            writer.writeheader()
            
            for p in self.products:
                for v in p.variants:
                    # Skip out-of-stock variants
                    if not v.in_stock:
                        continue
                    
                    writer.writerow({
                        'URL': p.url,
                        'Product ID': p.product_id,
                        'Title (EN)': p.title_en,
                        'Title (ZH)': p.title_zh,
                        'Variant Name (EN)': v.variant_name_en,
                        'Variant Name (ZH)': v.variant_name_zh,
                        'Option Type 1': v.option_type_1,
                        'Option Value 1': v.option_value_1,
                        'Option Type 2': v.option_type_2,
                        'Option Value 2': v.option_value_2,
                        'Price CNY': v.price_cny,
                        'Shipping CNY': v.shipping_cny,
                        'Cost CAD': v.cost_cad,
                        'Price CAD': v.price_cad,
                        'Margin %': v.margin_standard,
                        'Margin Promo %': v.margin_promo,
                        'SKU Key': v.sku_key,
                        'In Stock': 'Yes',
                        'Main Images': len(p.images.get('Main', [])),
                        'Gallery Images': len(p.images.get('Catalogue', [])),
                        'Detail Images': len(p.images.get('Details', [])),
                    })
                
                # Add a row even if no variants
                if not p.variants:
                    pricing = calculate_price_cad(p.base_price_cny) if p.base_price_cny > 0 else {'shipping_cny': 30, 'cost_cad': 0, 'price_cad': 0, 'margin_standard': 0, 'margin_promo': 0}
                    writer.writerow({
                        'URL': p.url,
                        'Product ID': p.product_id,
                        'Title (EN)': p.title_en,
                        'Title (ZH)': p.title_zh,
                        'Variant Name (EN)': 'Default',
                        'Variant Name (ZH)': '',
                        'Option Type 1': '',
                        'Option Value 1': '',
                        'Option Type 2': '',
                        'Option Value 2': '',
                        'Price CNY': p.base_price_cny,
                        'Shipping CNY': pricing['shipping_cny'],
                        'Cost CAD': pricing['cost_cad'],
                        'Price CAD': pricing['price_cad'],
                        'Margin %': pricing['margin_standard'],
                        'Margin Promo %': pricing['margin_promo'],
                        'SKU Key': '',
                        'In Stock': 'Yes',
                        'Main Images': len(p.images.get('Main', [])),
                        'Gallery Images': len(p.images.get('Catalogue', [])),
                        'Detail Images': len(p.images.get('Details', [])),
                    })
        
        print(f"   📄 CSV: {CSV_OUTPUT}")
        
        # JSON with full pricing data
        with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
            json.dump({
                'products': [asdict(p) for p in self.products],
                'count': len(self.products),
                'pricing_config': PRICING_CONFIG,
                'timestamp': datetime.now().isoformat()
            }, f, ensure_ascii=False, indent=2)
        
        print(f"   📄 JSON: {JSON_OUTPUT}")
        
        # Print pricing summary
        self._print_pricing_summary()
    
    def _print_pricing_summary(self):
        """Print a summary of pricing calculations (in-stock only)"""
        print(f"\n   {'='*60}")
        print(f"   💰 PRICING SUMMARY (In-Stock Only)")
        print(f"   {'='*60}")
        print(f"   Config: ¥{PRICING_CONFIG['shipping_cny']} shipping, {PRICING_CONFIG['exchange_rate']} rate, {int(PRICING_CONFIG['target_margin']*100)}% margin")
        print(f"   {'─'*60}")
        
        total_variants = 0
        out_of_stock = 0
        total_cny = 0
        total_cad = 0
        min_margin = 100
        max_margin = 0
        
        for p in self.products:
            for v in p.variants:
                if not v.in_stock:
                    out_of_stock += 1
                    continue
                total_variants += 1
                total_cny += v.price_cny
                total_cad += v.price_cad
                min_margin = min(min_margin, v.margin_standard)
                max_margin = max(max_margin, v.margin_standard)
        
        if total_variants > 0:
            avg_cny = total_cny / total_variants
            avg_cad = total_cad / total_variants
            print(f"   Variants: {total_variants} in stock" + (f", {out_of_stock} skipped (out of stock)" if out_of_stock else ""))
            print(f"   Avg Price: ¥{avg_cny:.0f} CNY → ${avg_cad:.2f} CAD")
            print(f"   Margin Range: {min_margin:.1f}% - {max_margin:.1f}%")
            
            # Show price breakdown for first few in-stock variants
            print(f"\n   Sample Pricing:")
            print(f"   {'Variant':<35} {'CNY':>8} {'Cost':>8} {'Price':>8} {'Margin':>8}")
            print(f"   {'-'*67}")
            
            shown = 0
            for p in self.products:
                for v in p.variants:
                    if not v.in_stock:
                        continue
                    name = v.variant_name_en[:33] if len(v.variant_name_en) > 33 else v.variant_name_en
                    print(f"   {name:<35} ¥{v.price_cny:>6.0f} ${v.cost_cad:>6.2f} ${v.price_cad:>6.2f} {v.margin_standard:>6.1f}%")
                    shown += 1
                    if shown >= 10:
                        break
                if shown >= 10:
                    break
            
            if total_variants > 10:
                print(f"   ... and {total_variants - 10} more variants")
        
        print(f"   {'='*60}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='AI Scraper V3 - Taobao → Knack Pipeline')
    parser.add_argument('--login', action='store_true', help='Interactive login setup')
    parser.add_argument('--test', action='store_true', help='Test on first URL only')
    parser.add_argument('--headless', action='store_true', help='Run headless')
    parser.add_argument('--push-knack', action='store_true', help='Push to Knack after scraping (default: scrape only)')
    parser.add_argument('--dry-run', action='store_true', help='Simulate Knack updates')
    parser.add_argument('--skip-knack', action='store_true', help='[DEPRECATED] Use default behavior instead')
    parser.add_argument('--no-api', action='store_true', help='No API calls (DOM/rule-based only)')
    parser.add_argument('--batch-translate', action='store_true', help='Batch all translations at end (more efficient)')
    parser.add_argument('--links', type=str, help='Custom links file (default: taobao_links.txt)')
    parser.add_argument('--limit', type=int, help='Limit number of URLs to process')
    args = parser.parse_args()

    # Default is now to skip Knack unless --push-knack is specified
    skip_knack = not args.push_knack

    scraper = AIScraper(
        headless=args.headless,
        dry_run=args.dry_run,
        skip_knack=skip_knack,
        no_api=args.no_api,
        batch_translate=args.batch_translate
    )

    if args.login:
        scraper.login_setup()
        return

    # Read URLs from custom or default file
    links_file = args.links if args.links else LINK_FILE
    if not os.path.exists(links_file):
        print(f"❌ No URL file: {links_file}")
        return

    with open(links_file) as f:
        urls = [l.strip() for l in f if l.strip() and not l.startswith('#')]
    
    if not urls:
        print(f"❌ No URLs in {links_file}")
        return

    # Apply limit if specified
    if args.limit and args.limit > 0:
        urls = urls[:args.limit]
        print(f"📋 Limiting to first {len(urls)} URLs")

    scraper.run(urls, test_mode=args.test)


if __name__ == '__main__':
    main()
