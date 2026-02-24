"""
AI Scraper V3 - Complete Taobao → Knack + Notion Pipeline

End-to-end automation:
1. SCRAPE   - Load Taobao URL, capture images (download by URL + screenshot backup)
2. TRANSLATE - Use Gemini to translate Chinese → English (title, variant names)
3. PARSE    - Normalize Color/Size/Style options using variant_engine rules
4. SEED     - Push to Knack database (data) + Notion (images) via REST API

Usage:
    python ai_scraper.py --login              # One-time login setup
    python ai_scraper.py --test               # Test on first URL only
    python ai_scraper.py                      # Full run from taobao_links.txt
    python ai_scraper.py --dry-run            # Simulate Knack updates
    python ai_scraper.py --skip-knack         # Scrape only, no Knack push
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
import random
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict

import requests
from dotenv import load_dotenv
from openai import OpenAI

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Local modules - add core directory to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'core'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'integrations'))

from variant_engine import extract_variants, VariantExtractionResult
from knack_integration import KnackAPI, PRODUCT_FIELDS, VARIANT_FIELDS, PRODUCTS_OBJECT_KEY, VARIANTS_OBJECT_KEY
from notion_integration import push_product_to_notion

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

# Load environment from project root .env
project_root = os.path.join(SCRIPT_DIR, '..')
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_AI_API_KEY')  # Fallback for vision tasks

# Timing
PAGE_LOAD_WAIT = 15
CLICK_DELAY = 0.6

# ============================================================================
# HUMAN-LIKE BEHAVIOR CONFIG
# ============================================================================
# Randomized delays to mimic real browsing patterns and avoid bot detection.
# All values in seconds — actual delay = random.uniform(min, max)

HUMAN_DELAY = {
    'page_load':        (4, 8),      # After navigating to a new page
    'between_products': (15, 35),    # Pause between scraping different products
    'scroll_pause':     (1.5, 4),    # After scrolling to a new section
    'variant_click':    (0.8, 2.0),  # After clicking a variant button
    'variant_settle':   (0.5, 1.2),  # Wait for price to update after variant click
    'before_action':    (0.3, 0.8),  # Small pause before clicks/interactions
    'screenshot':       (0.4, 1.0),  # Before taking a screenshot
    'login_nav':        (2, 4),      # After navigating during login
    'api_rate':         (0.1, 0.4),  # Between Knack API calls
    'overlay_wait':     (8, 15),     # When no input available for captcha
}


def human_delay(action: str, multiplier: float = 1.0) -> float:
    """Sleep for a random human-like duration based on the action type.
    
    Args:
        action: Key from HUMAN_DELAY config
        multiplier: Scale factor (e.g. 1.5 = 50% longer, for extra caution)
    
    Returns:
        The actual delay used (seconds)
    """
    min_s, max_s = HUMAN_DELAY.get(action, (1, 3))
    delay = random.uniform(min_s * multiplier, max_s * multiplier)
    time.sleep(delay)
    return delay


def human_scroll(driver, target_y: int = None, smooth: bool = True):
    """Scroll like a human — incremental with random pauses.
    
    If target_y is None, scrolls to a random position on the page.
    If smooth=True, scrolls in small increments with pauses.
    """
    current_y = driver.execute_script("return window.pageYOffset;")
    page_height = driver.execute_script("return document.body.scrollHeight;")
    viewport = driver.execute_script("return window.innerHeight;")
    
    if target_y is None:
        target_y = random.randint(0, max(0, page_height - viewport))
    
    if smooth and abs(target_y - current_y) > 300:
        # Scroll in 3-6 increments with small pauses
        steps = random.randint(3, 6)
        step_size = (target_y - current_y) / steps
        for i in range(steps):
            next_y = int(current_y + step_size * (i + 1))
            # Add slight jitter to each step
            jitter = random.randint(-30, 30)
            driver.execute_script(f"window.scrollTo(0, {next_y + jitter});")
            time.sleep(random.uniform(0.3, 0.8))
    else:
        driver.execute_script(f"window.scrollTo(0, {target_y});")
        time.sleep(random.uniform(0.5, 1.2))


def human_browse_pause(driver):
    """Simulate a person pausing to look at a page — random scroll + wait.
    
    Called between products to look like natural browsing.
    """
    # Sometimes scroll around the page a bit before moving on
    if random.random() < 0.6:
        page_height = driver.execute_script("return document.body.scrollHeight;")
        viewport = driver.execute_script("return window.innerHeight;")
        
        # Scroll to a random spot
        scroll_to = random.randint(0, max(0, page_height - viewport))
        human_scroll(driver, scroll_to, smooth=True)
        time.sleep(random.uniform(2, 5))
        
        # Maybe scroll back up
        if random.random() < 0.4:
            human_scroll(driver, 0, smooth=True)
            time.sleep(random.uniform(1, 3))


def is_tmall_url(url: str) -> bool:
    """Detect if URL is from Tmall (vs regular Taobao)"""
    return 'tmall.com' in url.lower() or 'tmall.hk' in url.lower()


def is_taobao_url(url: str) -> bool:
    """Detect if URL is from Taobao"""
    return 'taobao.com' in url.lower() or 'item.taobao' in url.lower()

# ============================================================================
# PRICING CONFIGURATION
# ============================================================================

PRICING_CONFIG = {
    'exchange_rate': 0.19,        # 1 CNY = 0.19 CAD
    'shipping_cny': 30,           # Fixed shipping cost per item (CNY)
    'salesperson_cut': 0.10,      # 10% of revenue to salesperson
    'promoter_cut': 0.10,         # 10% to promoter (if promo code used)
    'gross_margin': 0.50,         # 50% gross margin (Price = 2x Cost)
    # Net margins:
    #   Standard: 50% - 10% salesperson = 40% → owner keeps 30% net after overhead
    #   Promo:    50% - 10% salesperson - 10% promoter = 30% net for owner
}

def calculate_price_cad(price_cny: float) -> dict:
    """
    Calculate CAD pricing from CNY price.
    
    Formula:
    - Cost CAD = (Price CNY + Shipping CNY) × Exchange Rate
    - Sale Price = Cost / (1 - gross_margin) = Cost × 2  (50% gross margin)
    
    Margin breakdown per sale:
    - 50% goes to cost of goods
    - 10% to salesperson
    - 10% to promoter (promo only)
    - 30% net to owner
    """
    cfg = PRICING_CONFIG
    
    # Calculate cost in CAD
    cost_cny = price_cny + cfg['shipping_cny']
    cost_cad = cost_cny * cfg['exchange_rate']
    
    # Sale price at 50% gross margin: Price = Cost / (1 - 0.50) = Cost × 2
    divisor = 1 - cfg['gross_margin']
    sale_price_cad = cost_cad / divisor if divisor > 0 else cost_cad * 2
    
    # Round up to nearest .99 for retail pricing (always round UP to protect margin)
    sale_price_cad = int(sale_price_cad) + 0.99
    if sale_price_cad < cost_cad * 1.5:
        sale_price_cad = round(cost_cad * 2, 2)
    
    # Standard margin: after salesperson cut
    revenue_after_salesperson = sale_price_cad * (1 - cfg['salesperson_cut'])
    margin_standard = (revenue_after_salesperson - cost_cad) / sale_price_cad if sale_price_cad > 0 else 0
    
    # Promo margin: 10% customer discount + salesperson + promoter
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
# TRANSLATION DICTIONARIES
# ============================================================================

COLOR_MAP = {
    # Chinese → English (sorted by specificity - longer matches first for compound colors)
    # Compound/specific colors first
    '深灰色': 'Dark Grey', '深灰': 'Dark Grey',
    '浅灰色': 'Light Grey', '浅灰': 'Light Grey',
    '深棕色': 'Dark Brown', '深棕': 'Dark Brown',
    '浅棕色': 'Light Brown', '浅棕': 'Light Brown',
    '消光黑': 'Matte Black', '亮黑': 'Gloss Black', '纯黑': 'Pure Black',
    '狼灰色': 'Wolf Grey', '狼灰': 'Wolf Grey',
    '狼棕色': 'Coyote Brown', '狼棕': 'Coyote Brown', '土狼棕': 'Coyote Brown', '郊狼棕': 'Coyote Brown',
    '军绿色': 'Army Green', '军绿': 'Army Green', '橄榄绿': 'Olive Drab', '墨绿': 'Dark Green',
    '游骑兵绿色': 'Ranger Green', '游骑兵绿': 'Ranger Green',
    '暗夜迷彩': 'Black Camo', '丛林迷彩': 'Jungle Camo', '沙漠迷彩': 'Desert Camo',
    '废墟迷彩': 'Ruins Camo', '废墟': 'Ruins Camo',
    '多地形迷彩': 'MultiCam', 'CP迷彩': 'CP Camo', 'MC迷彩': 'MultiCam',
    '玫红色': 'Rose Red', '枣红色': 'Burgundy', '酒红': 'Wine Red',
    '天蓝色': 'Sky Blue', '深蓝色': 'Navy Blue', '浅蓝色': 'Light Blue', '藏青': 'Navy',
    '米白色': 'Off White', '象牙白': 'Ivory',
    '卡其色': 'Khaki', '卡其': 'Khaki',
    # Base colors
    '黑色': 'Black', '黑': 'Black',
    '白色': 'White', '白': 'White',
    '灰色': 'Grey', '灰': 'Grey',
    '棕色': 'Brown', '棕': 'Brown',
    '沙色': 'Sand', '泥色': 'Tan',
    '绿色': 'Green', '绿': 'Green',
    '红色': 'Red', '红': 'Red',
    '粉色': 'Pink', '粉红色': 'Pink',
    '蓝色': 'Blue', '蓝': 'Blue',
    '金色': 'Gold', '金': 'Gold',
    '银色': 'Silver', '银': 'Silver',
    '黄色': 'Yellow', '黄': 'Yellow',
    '橙色': 'Orange', '橙': 'Orange',
    '紫色': 'Purple', '紫': 'Purple',
    '杏色': 'Beige', '米色': 'Beige', '驼色': 'Camel',
    '迷彩': 'Camouflage', '花色': 'Pattern',
    # English codes (case-insensitive handled separately)
    'BK': 'Black', 'WG': 'Wolf Grey', 'CB': 'Coyote Brown',
    'RG': 'Ranger Green', 'OD': 'Olive Drab', 'MC': 'MultiCam', 'CP': 'CP Camo',
    'FG': 'Foliage Green', 'DE': 'Dark Earth', 'TAN': 'Tan', 'BLK': 'Black',
}

SIZE_MAP = {
    # General sizes
    '均码': 'One Size', '通用': 'Universal', '自由码': 'Free Size', '标准码': 'Standard',
    '大款': 'Large', '小款': 'Small', '短款': 'Short', '矮款': 'Low Profile',
    '加大款': 'XL', '小号': 'Small', '中号': 'Medium', '大号': 'Large',
    '特大号': 'XL', '特小号': 'XS', '加大号': 'XL', '加小号': 'XS',
    # Chinese numbered sizes (1码, 2码, etc.)
    '1码': 'Size 1', '2码': 'Size 2', '3码': 'Size 3', '4码': 'Size 4', '5码': 'Size 5',
    '6码': 'Size 6', '7码': 'Size 7', '8码': 'Size 8', '9码': 'Size 9', '10码': 'Size 10',
    # Fit types
    '宽松版': 'Loose Fit', '修身版': 'Slim Fit', '标准版': 'Standard Fit',
    # Quantities
    '一个': '1 pc', '一块': '1 pc', '一只': '1 pc', '单个': '1 pc',
    '两个': '2 pcs', '2个': '2 pcs', '双': '2 pcs',
    '三个': '3 pcs', '3个': '3 pcs',
    '四个': '4 pcs', '4个': '4 pcs',
    '五个': '5 pcs', '5个': '5 pcs',
    '一套': '1 Set', '套装': 'Set', '全套': 'Full Set',
    '一对': '1 Pair', '一双': '1 Pair',
    # Length/profile
    '长款': 'Long', '加长款': 'Extra Long', '超长款': 'Extra Long',
    '高款': 'High Profile', '低款': 'Low Profile', '中款': 'Mid Profile',
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

# AI Model Configuration
# Using DeepSeek for cost-efficient translation
DEEPSEEK_MODEL = 'deepseek-chat'  # Most cost-efficient

# Gemini models kept for vision tasks only (price extraction)
GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash',
]

# Delay between API calls
TRANSLATION_DELAY = 0.5  # DeepSeek has generous rate limits
INTERNAL_DELAY = 0.1     # Shorter delay for batched calls


class AITranslator:
    """Translate Chinese text using DeepSeek API (with Gemini fallback for vision)"""
    
    def __init__(self, no_api: bool = False):
        self.deepseek_key = DEEPSEEK_API_KEY if not no_api else None
        self.gemini_key = GEMINI_API_KEY if not no_api else None
        self.no_api = no_api
        
        # Initialize DeepSeek client (OpenAI-compatible)
        if self.deepseek_key:
            self.client = OpenAI(
                api_key=self.deepseek_key,
                base_url="https://api.deepseek.com"
            )
        else:
            self.client = None
        
        # Gemini setup for vision tasks
        self.gemini_base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        self.failed_models = set()
        self.last_call_time = 0
        
        if no_api:
            print("⏭️  No API mode - using rule-based translation only")
        elif self.deepseek_key:
            print(f"🤖 AI Translation: DeepSeek ({DEEPSEEK_MODEL})")
        else:
            print("⚠️  No DEEPSEEK_API_KEY - using rule-based translation")
        
    def reset_failed_models(self):
        """Reset failed models list - call at start of each product"""
        self.failed_models = set()
    
    def _rate_limit_wait(self, delay: float = TRANSLATION_DELAY):
        """Ensure we don't exceed rate limits"""
        elapsed = time.time() - self.last_call_time
        if elapsed < delay:
            wait_time = delay - elapsed
            time.sleep(wait_time)
        self.last_call_time = time.time()
    
    def _get_gemini_endpoint(self, model: str) -> str:
        """Get Gemini API endpoint (for vision tasks only)"""
        return f"{self.gemini_base_url}/{model}:generateContent?key={self.gemini_key}"
    
    def _try_gemini_model(self, model: str, payload: dict) -> tuple[bool, str]:
        """Try a specific Gemini model (for vision). Returns (success, result_or_error)"""
        try:
            endpoint = self._get_gemini_endpoint(model)
            response = requests.post(endpoint, json=payload, timeout=30)
            
            if response.ok:
                result = response.json()
                translated = result['candidates'][0]['content']['parts'][0]['text'].strip()
                translated = translated.replace('"', '').replace("'", '').strip()
                return True, translated
            elif response.status_code == 429:
                print(f"      ⚠️  {model}: Rate limited")
                self.failed_models.add(model)
                return False, "rate_limited"
            else:
                return False, f"error_{response.status_code}"
        except Exception as e:
            return False, str(e)
    
    def extract_price_from_screenshot(self, screenshot_path: str, is_tmall: bool = False) -> float:
        """
        Use Gemini Vision to extract the highlighted price from a screenshot.
        Supports both Taobao and Tmall layouts.

        Args:
            screenshot_path: Path to the screenshot image
            is_tmall: Whether this is a Tmall page (different layout)
        """
        if not self.gemini_key:
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

            # Different prompts for Taobao vs Tmall
            if is_tmall:
                prompt = """You are reading a Tmall product page screenshot to find the MAIN PRODUCT PRICE.

CRITICAL INSTRUCTIONS for TMALL:
1. Find the LARGE RED/ORANGE price number - on Tmall it's typically in a prominent position
2. Tmall often shows "天猫价" (Tmall Price) or "促销价" (Promo Price) - look for the main sale price
3. The price format is: ¥XX.X or ¥XXX (may show as just numbers without ¥)
4. Read the COMPLETE number - if you see "56.9", return "56.9" NOT "5" or "6.9"
5. Ignore crossed-out prices (原价/original price) - we want the current selling price
6. The price is typically between ¥20 and ¥2000 for tactical/airsoft gear

Return ONLY the complete price number. Example: 56.9 or 128 or 89"""
            else:
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
            
            # Try Gemini models for vision
            for model in GEMINI_MODELS:
                if model in self.failed_models:
                    continue
                
                success, result = self._try_gemini_model(model, payload)
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
        """Translate Chinese to English using DeepSeek"""
        if not self.client:
            return self._rule_based_translate(text)
        
        if not self._has_chinese(text):
            return text
        
        # Rate limit - use shorter delay for batch variant translations
        delay = INTERNAL_DELAY if use_short_delay else TRANSLATION_DELAY
        self._rate_limit_wait(delay)
        
        prompt = f"""Translate this Chinese tactical/airsoft product text to English for a professional milsim equipment catalog.

**KEEP True Identifiers (DO NOT remove):**
- Model numbers/codes: L4G24, HL-ACC-73-T, PEQ-15, DBAL-A3, MK18, 6094, MICH 2000
- Platform names: M4, AK, Glock, 1911, AR-15, MP5
- Camo patterns: MultiCam, M81 Woodland, AOR1, Flecktarn, CP Camo
- Interface standards: Picatinny (1913), M-LOK, KeyMod, QD
- Rail/mount types: Wilcox, Ops-Core, ARC, Unity, Reptilia
- NV/IR terms: NVG, Night Vision, IR, Laser, PEQ, PVS-14
- Material standards: Cordura, 500D Nylon, 6061 Aluminum

**REMOVE Generic Branding + Marketing Fluff:**
- Store names, "factory direct", "OEM/ODM", "hot sale", "premium", "high quality"
- "tactical" when used as empty marketing, "military grade", "same as", "1:1", "replica"
- Chinese: 爆款, 正品, 外贸, 高品质, 热销, 同款
- Random brand words: 悟空, WOSPORT, 骏马, 战狼, FMA, TMC (unless clearly real identifier)
- **Never invent a brand**. If uncertain, omit it.

**APPLY Milsim Terminology:**
- 快拆 → QD
- 导轨/皮轨/20mm/1913 → Picatinny (1913)
- 织带/MOLLE → MOLLE
- 背心 → Plate Carrier (if tactical) or Vest
- 夜视仪 → NVG or Night Vision
- 头盔 → Helmet
- Drop "战术" as generic adjective unless it distinguishes category

**Colors (normalize):**
黑色/黑 → Black, 消光黑 → Matte Black, 沙色/土黄 → Tan, 军绿/橄榄绿 → OD Green, 狼棕 → Coyote Brown, 狼灰 → Wolf Grey

**Examples:**
- "WOSPORT黑色头盔" → "Black Helmet"
- "FMA PVS-14夜视仪" → "PVS-14 Night Vision"
- "6094战术背心" → "6094 Plate Carrier"

Text: {text}

English translation (no quotes, no explanation):"""

        try:
            response = self.client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            
            result = response.choices[0].message.content.strip()
            result = result.replace('"', '').replace("'", '').strip()
            return result
            
        except Exception as e:
            print(f"      ⚠️  DeepSeek translation failed: {str(e)[:50]}")
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

    # ================================================================
    # BULK TRANSLATION - 2 API calls total for entire scrape session
    # ================================================================

    def bulk_translate_products(self, titles_zh: List[str]) -> List[str]:
        """
        Translate ALL product titles in ONE DeepSeek API call.
        
        Sends a numbered list of all Chinese titles, gets numbered translations back.
        Massive token savings vs individual calls.
        
        Args:
            titles_zh: List of Chinese product titles
            
        Returns:
            List of English translations (same order)
        """
        if not self.client:
            print("   ⚠️  No API key - using rule-based translation for titles")
            return [self._rule_based_translate(t) for t in titles_zh]
        
        if not titles_zh:
            return []
        
        print(f"\n   🚀 Bulk translating {len(titles_zh)} product titles in 1 API call...")
        self._rate_limit_wait()
        
        # Build numbered list
        numbered = "\n".join([f"{i+1}. {t}" for i, t in enumerate(titles_zh)])
        
        prompt = f"""Translate these Chinese airsoft/tactical product titles to English for a professional milsim equipment catalog.

**KEEP True Identifiers (DO NOT remove):**
- Model numbers/codes: L4G24, HL-ACC-73-T, PEQ-15, DBAL-A3, MK18, 6094, MICH 2000
- Platform names: M4, AK, Glock, 1911, AR-15, MP5
- Camo patterns: MultiCam, M81 Woodland, AOR1, Flecktarn, CP Camo
- Interface standards: Picatinny (1913), M-LOK, KeyMod, QD
- Rail/mount types: Wilcox, Ops-Core, ARC, Unity, Reptilia
- NV/IR terms: NVG, Night Vision, IR, Laser, PEQ, PVS-14
- Material standards: Cordura, 500D Nylon, 6061 Aluminum

**REMOVE Generic Branding + Marketing Fluff:**
- Store names, "factory direct", "OEM/ODM", "hot sale", "premium", "high quality"
- "tactical" when used as empty marketing, "military grade", "same as", "1:1", "replica"
- Chinese: 爆款, 正品, 外贸, 高品质, 热销, 同款
- Random brand words: 悟空, WOSPORT, 骏马, 战狼, FMA, TMC (unless clearly real identifier)
- **Never invent a brand**. If uncertain, omit it.

**APPLY Milsim Terminology:**
- 快拆 → QD
- 导轨/皮轨/20mm/1913 → Picatinny (1913)
- 织带/MOLLE → MOLLE
- 背心 → Plate Carrier (if tactical) or Vest
- 夜视仪 → NVG or Night Vision
- 头盔 → Helmet
- Drop "战术" as generic adjective unless it distinguishes category

**Colors (normalize):**
黑色/黑 → Black, 消光黑 → Matte Black, 沙色/土黄 → Tan, 军绿/橄榄绿 → OD Green, 狼棕 → Coyote Brown, 狼灰 → Wolf Grey

**Title Format:** [Model/Identifier] + [Item Type] + [Key Specs] + [Compatibility] + [Color if important]
- Keep concise, remove filler, use Title Case
- Example: "L4G24 NVG Mount - Aluminum - Wilcox Compatible"

**Output format:** One translation per line with the SAME number prefix.

Titles to translate:
{numbered}

Translations (one per line with number):"""

        try:
            response = self.client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max(3000, len(titles_zh) * 50),
                temperature=0.3,
            )
            
            result_text = response.choices[0].message.content.strip()
            translations = self._parse_numbered_response(result_text, len(titles_zh))
            
            print(f"   ✅ Translated {len(translations)}/{len(titles_zh)} product titles")
            
            # Fill any gaps with rule-based fallback
            while len(translations) < len(titles_zh):
                idx = len(translations)
                translations.append(self._rule_based_translate(titles_zh[idx]))
            
            return translations
            
        except Exception as e:
            print(f"   ❌ Bulk product translation failed: {e}")
            print(f"   ⚠️  Falling back to rule-based translation")
            return [self._rule_based_translate(t) for t in titles_zh]
    
    def bulk_translate_variants(self, names_zh: List[str]) -> List[str]:
        """
        Translate ALL variant names in ONE DeepSeek API call.
        
        Args:
            names_zh: List of Chinese variant names (colors, sizes, styles)
            
        Returns:
            List of English translations (same order)
        """
        if not self.client:
            print("   ⚠️  No API key - using rule-based translation for variants")
            return [self._rule_based_translate(t) for t in names_zh]
        
        if not names_zh:
            return []
        
        # For very large variant lists, chunk into groups of ~200 to stay within token limits
        MAX_PER_CALL = 200
        if len(names_zh) > MAX_PER_CALL:
            print(f"   📦 Large variant set ({len(names_zh)}) - chunking into {(len(names_zh) + MAX_PER_CALL - 1) // MAX_PER_CALL} API calls...")
            all_translations = []
            for start in range(0, len(names_zh), MAX_PER_CALL):
                chunk = names_zh[start:start + MAX_PER_CALL]
                chunk_translations = self.bulk_translate_variants(chunk)
                all_translations.extend(chunk_translations)
            return all_translations
        
        print(f"\n   🚀 Bulk translating {len(names_zh)} variant names in 1 API call...")
        self._rate_limit_wait()
        
        # Build numbered list
        numbered = "\n".join([f"{i+1}. {t}" for i, t in enumerate(names_zh)])
        
        prompt = f"""Translate these Chinese variant names (colors/sizes/styles) to English using milsim/tactical conventions.

**Colors (normalize):**
黑色/黑 → Black, 消光黑 → Matte Black, 沙色/土黄/黄褐 → Tan or Coyote Brown
卡其 → Khaki, 泥色 → FDE, 狼棕 → Coyote Brown, 狼灰 → Wolf Grey
军绿/橄榄绿 → OD Green, 游骑兵绿 → Ranger Green
灰色 → Grey, CP迷彩 → CP Camo, 暗夜迷彩 → Black Camo, 丛林迷彩 → Jungle Camo
multicam/MC → MultiCam

**Sizes (normalize):**
Standard: XXS, XS, S, M, L, XL, XXL, 2XL, 3XL, 4XL
均码 → One Size, 通用 → Universal
大款 → Large, 小款 → Small, 短款 → Short, 矮款 → Low Profile
Keep numeric sizes exactly: 80-110, 85-125cm, 20cm, 30mm
Quantity: 一个 → 1 pc, 两个 → 2 pcs, 一套 → 1 Set

**Materials/Style (normalize):**
金属 → Metal, 铝合金 → Aluminum, 尼龙 → Nylon, CNC → CNC
标准 → Standard, 升级版 → Upgraded, 套装 → Set
单 → Single, 双 → Dual, 左 → Left, 右 → Right

**Format:** Translate to short, consistent English. If multiple dimensions, keep explicit: "FDE / QD Mount", "Black / Low Mount"

**Output format:** One translation per line with the SAME number prefix.

Variant names to translate:
{numbered}

Translations (one per line with number):"""

        try:
            response = self.client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max(5000, len(names_zh) * 30),
                temperature=0.3,
            )
            
            result_text = response.choices[0].message.content.strip()
            translations = self._parse_numbered_response(result_text, len(names_zh))
            
            print(f"   ✅ Translated {len(translations)}/{len(names_zh)} variant names")
            
            # Fill any gaps with rule-based fallback
            while len(translations) < len(names_zh):
                idx = len(translations)
                translations.append(self._rule_based_translate(names_zh[idx]))
            
            return translations
            
        except Exception as e:
            print(f"   ❌ Bulk variant translation failed: {e}")
            print(f"   ⚠️  Falling back to rule-based translation")
            return [self._rule_based_translate(t) for t in names_zh]
    
    def _parse_numbered_response(self, response: str, expected_count: int) -> List[str]:
        """Parse a numbered list response (e.g., '1. Black\\n2. Tan') into ordered list"""
        lines = response.strip().split('\n')
        # Use dict to handle out-of-order numbers
        by_number = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Match "1. Translation" or "1) Translation"
            match = re.match(r'^(\d+)[\.\)]\s*(.+)$', line)
            if match:
                idx = int(match.group(1))
                translation = match.group(2).strip().strip('"').strip("'")
                by_number[idx] = translation
        
        # Build ordered list
        result = []
        for i in range(1, expected_count + 1):
            if i in by_number:
                result.append(by_number[i])
            else:
                result.append("")  # Gap - will be filled by caller
        
        return result

    # Keep old method for backward compatibility with click-based variant extraction
    def batch_translate_all(self, texts: List[str]) -> List[str]:
        """
        Batch translate a large list of Chinese texts in a single DeepSeek API call.
        Used for efficient translation of all variants at end of scraping.
        
        Args:
            texts: List of Chinese texts to translate
            
        Returns:
            List of English translations (same order as input)
        """
        if not self.client:
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
        
        prompt = f"""Translate these Chinese variant names (colors/sizes/styles) to English using milsim/tactical conventions.

**Colors (normalize):**
黑色/黑 → Black
消光黑 → Matte Black
沙色/土黄/黄褐 → Tan or Coyote Brown
卡其 → Khaki
泥色 → FDE
狼棕 → Coyote Brown (if brown) or Wolf Grey (if grey)
军绿/橄榄绿 → OD Green
游骑兵绿 → Ranger Green
灰色/狼灰 → Wolf Grey
CP迷彩 → CP Camo
暗夜迷彩 → Black Camo
丛林迷彩 → Jungle Camo
multicam/MC → MultiCam

**Sizes (normalize):**
Standard: XXS, XS, S, M, L, XL, XXL, XXXL, 2XL, 3XL, 4XL
均码 → One Size
通用 → Universal
大款 → Large, 小款 → Small, 短款 → Short, 矮款 → Low Profile
Keep numeric sizes exactly: 80-110, 85-125cm, 20cm, 30mm
Quantity: 一个/一块 → 1 pc, 两个 → 2 pcs, 一套 → 1 Set

**Materials/Style (normalize):**
金属 → Metal
铝合金 → Aluminum
尼龙 → Nylon
考度拉 → Cordura
CNC → CNC
标准 → Standard
升级版 → Upgraded
套装 → Set
单 → Single, 双 → Dual, 左 → Left, 右 → Right

**Format:** Translate to short, consistent English. Preserve context: color, size, material, compatibility.
- If multiple dimensions, keep explicit: "FDE / QD Mount", "Black / Low Mount"
- Normalize units, keep numbers exactly

**Examples:**
"黑色" → "Black"
"狼灰色 / WG - M" → "Wolf Grey - M"
"85-125cm" → "85-125cm"
"黑色 CNC" → "Black / CNC"
"均码" → "One Size"

## TEXTS TO TRANSLATE:
{text_list}

**Output format:** One translation per line with the same number.

Translations (one per line with number):"""

        try:
            response = self.client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=4000,
                temperature=0.3,
            )
            
            result = response.choices[0].message.content.strip()
            
            # Parse numbered response
            translations = self._parse_batch_translations(result, len(chinese_texts))
            
            # Rebuild full list with translations inserted
            output = list(texts)  # Copy original
            for orig_idx, trans in zip(chinese_indices, translations):
                output[orig_idx] = trans
            
            print(f"   ✅ Batch translated {len(translations)} texts")
            return output
            
        except Exception as e:
            print(f"   ⚠️  Batch translation failed: {str(e)[:50]}")
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
        Process entire product: extract price (Gemini Vision) + translate (DeepSeek).
        
        Returns: {
            'price': float,
            'title_en': str,
            'variants_en': [str, str, ...]  # Same order as input
        }
        """
        # Extract price using Gemini Vision
        price = self.extract_price_from_screenshot(screenshot_path) if os.path.exists(screenshot_path) else 0.0
        
        # Translate title using DeepSeek
        title_en = self.translate(title_zh)
        
        # Translate variants using DeepSeek (efficiently batch them)
        variants_en = self.batch_translate_all(variant_names_zh)
        
        return {
            'price': price,
            'title_en': title_en,
            'variants_en': variants_en
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
        """Find and normalize color in text (longest match wins for compound colors)"""
        text_lower = text.lower()

        # Check Chinese colors - sort by length descending to match longest first
        # This ensures "深灰色" matches before "灰色"
        sorted_colors = sorted(COLOR_MAP.items(), key=lambda x: len(x[0]), reverse=True)
        for zh, en in sorted_colors:
            if zh in text:
                return en

        # Check English colors - also prioritize longer matches
        colors = [
            'multicam', 'coyote brown', 'wolf grey', 'ranger green', 'olive drab',
            'dark grey', 'light grey', 'dark brown', 'matte black',
            'black', 'white', 'grey', 'gray', 'brown', 'tan', 'sand',
            'green', 'blue', 'red', 'pink', 'gold', 'silver', 'camo',
            'khaki', 'beige', 'orange', 'yellow', 'purple'
        ]
        for c in colors:
            if c in text_lower:
                # Proper title case for multi-word colors
                return ' '.join(word.title() for word in c.split())

        return None
    
    def _find_size(self, text: str) -> Optional[str]:
        """Find and normalize size in text"""
        # Check size map - sort by length descending for longest match first
        sorted_sizes = sorted(SIZE_MAP.items(), key=lambda x: len(x[0]), reverse=True)
        for zh, en in sorted_sizes:
            if zh in text:
                return en

        # Standard sizes - check longer patterns first
        sizes = ['XXXL', '3XL', 'XXL', '2XL', 'XL', 'XXS', 'XS', 'L', 'M', 'S',
                 '4XL', '5XL', '6XL', 'OS', 'F']  # OS=One Size, F=Free
        text_upper = text.upper()
        for s in sizes:
            # Match as standalone word or at boundaries
            if re.search(rf'(?:^|[^A-Z0-9]){s}(?:$|[^A-Z0-9])', text_upper):
                if s == 'OS':
                    return 'One Size'
                if s == 'F':
                    return 'Free Size'
                return s

        # Chinese measurement format: 165/88A (height/chest)
        match = re.search(r'(\d{2,3}/\d{2,3}[A-Z]?)', text)
        if match:
            return match.group(1)

        # Numeric ranges (measurements) - support various separators
        match = re.search(r'(\d+[-–~]\d+)\s*(?:cm|mm|码)?', text)
        if match:
            return match.group(1)

        # Single number with unit (e.g., "30cm", "50mm")
        match = re.search(r'(\d+)\s*(cm|mm|inch|寸)', text)
        if match:
            return f"{match.group(1)}{match.group(2)}"

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
# SKU GENERATION
# ============================================================================

def slugify_sku(text: str) -> str:
    """
    Convert text to SKU-friendly format:
    - Remove special characters except hyphens and spaces
    - Replace spaces with hyphens
    - Convert to uppercase
    - Remove multiple consecutive hyphens
    
    Example: "Tactical Plate Carrier" -> "TACTICAL-PLATE-CARRIER"
    """
    # Remove special characters, keep alphanumeric, spaces, and hyphens
    text = re.sub(r'[^a-zA-Z0-9\s\-]', '', text)
    # Replace spaces with hyphens
    text = re.sub(r'\s+', '-', text)
    # Remove multiple consecutive hyphens
    text = re.sub(r'-+', '-', text)
    # Remove leading/trailing hyphens
    text = text.strip('-')
    # Convert to uppercase
    return text.upper()

def generate_product_sku(title_en: str, product_id: str) -> str:
    """
    Generate product SKU from translated title.
    
    Format: {SLUGIFIED-TITLE}
    Example: "Tactical Plate Carrier" -> "TACTICAL-PLATE-CARRIER"
    
    Args:
        title_en: Translated product title
        product_id: Taobao product ID (used as fallback)
    
    Returns:
        SKU string
    """
    sku = slugify_sku(title_en)
    # Fallback to product ID if title is too short or empty
    if len(sku) < 3:
        sku = f"PRODUCT-{product_id}"
    return sku

def generate_variant_sku(product_sku: str, variant_name_en: str, variant_index: int,
                         option_type1: str = "", option_value1: str = "",
                         option_type2: str = "", option_value2: str = "") -> str:
    """
    Generate variant SKU combining product and variant identifiers.
    Uses hash-based suffix to prevent collisions.

    Format: {PRODUCT-SKU}-{VARIANT-SLUG}-{HASH}
    Example: "TACTICAL-PLATE-CARRIER-BLACK-LARGE-A3F2"

    Args:
        product_sku: Parent product SKU
        variant_name_en: Translated variant name
        variant_index: Variant index (1-based)
        option_type1: First option type (e.g., "Color")
        option_value1: First option value (e.g., "Black")
        option_type2: Second option type (e.g., "Size")
        option_value2: Second option value (e.g., "M")

    Returns:
        Unique variant SKU
    """
    variant_slug = slugify_sku(variant_name_en)

    # Create a deterministic hash from all variant properties
    # This ensures same variant always gets same SKU, but different variants get unique SKUs
    hash_input = f"{product_sku}|{variant_name_en}|{option_type1}|{option_value1}|{option_type2}|{option_value2}|{variant_index}"
    hash_suffix = hashlib.md5(hash_input.encode()).hexdigest()[:4].upper()

    # Fallback to index + hash if variant name is empty or too short
    if len(variant_slug) < 2:
        return f"{product_sku}-V{variant_index:02d}-{hash_suffix}"

    # For normal variants, include hash to prevent collision
    # Limit slug length to keep SKU reasonable
    max_slug_len = 30
    if len(variant_slug) > max_slug_len:
        variant_slug = variant_slug[:max_slug_len]

    return f"{product_sku}-{variant_slug}-{hash_suffix}"


# Track generated SKUs to detect collisions at runtime
_generated_skus = set()


def get_unique_variant_sku(product_sku: str, variant_name_en: str, variant_index: int,
                           option_type1: str = "", option_value1: str = "",
                           option_type2: str = "", option_value2: str = "") -> str:
    """
    Generate a guaranteed unique variant SKU, handling collisions.

    Wrapper around generate_variant_sku that tracks used SKUs and
    appends additional suffix if collision detected.
    """
    base_sku = generate_variant_sku(
        product_sku, variant_name_en, variant_index,
        option_type1, option_value1, option_type2, option_value2
    )

    sku = base_sku
    collision_count = 0

    while sku in _generated_skus:
        collision_count += 1
        sku = f"{base_sku}-{collision_count}"
        print(f"      ⚠️  SKU collision detected, using: {sku}")

    _generated_skus.add(sku)
    return sku


def reset_sku_tracker():
    """Reset the SKU tracker (call at start of each scraping session)"""
    global _generated_skus
    _generated_skus = set()

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
    sku: str  # Changed from sku_key to sku - this is the full descriptive SKU
    in_stock: bool = True
    # Calculated pricing fields
    shipping_cny: float = 0.0
    cost_cad: float = 0.0
    price_cad: float = 0.0
    margin_standard: float = 0.0
    margin_promo: float = 0.0


@dataclass 
class ScrapedProduct:
    url: str
    product_id: str
    title_zh: str
    title_en: str
    product_sku: str = ""  # Human-readable SKU from product title
    variants: List[ScrapedVariant] = field(default_factory=list)
    images: Dict[str, List[str]] = field(default_factory=dict)
    base_price_cny: float = 0.0
    base_price_cad: float = 0.0
    media_folder: str = ""  # Stable folder name based on product_id
    timestamp: str = ""


class AIScraper:
    """Main scraper with full pipeline"""
    
    def __init__(self, headless: bool = False, dry_run: bool = False, skip_knack: bool = False, no_api: bool = False):
        self.driver = None
        self.headless = headless
        self.dry_run = dry_run
        self.skip_knack = skip_knack
        self.no_api = no_api
        
        self.translator = AITranslator(no_api=no_api)
        self.parser = VariantParser()
        self.knack_api = None
        
        self.products: List[ScrapedProduct] = []
        self.pending_translations: List[dict] = []  # For batch translation mode
        
    def setup_driver(self):
        """Initialize Chrome with anti-detection stealth and load cookies"""
        options = webdriver.ChromeOptions()
        
        # === ANTI-DETECTION: Make Chrome look like a normal browser ===
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--remote-debugging-port=9222')
        # Realistic user-agent (Chrome 120 on macOS)
        options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        # Disable automation flags that sites check
        options.add_experimental_option('excludeSwitches', ['enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)
        # Set realistic language/locale
        options.add_argument('--lang=zh-CN')
        options.add_argument('--accept-lang=zh-CN,zh;q=0.9,en;q=0.8')
        
        if self.headless:
            options.add_argument('--headless=new')
        
        print("🚀 Starting Chrome (stealth mode)...")
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)
        self.driver.set_page_load_timeout(45)
        
        # Remove webdriver navigator flag (another detection vector)
        self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
                window.chrome = { runtime: {} };
            '''
        })
        
        # Load saved cookies if available
        cookies_file = os.path.join(SCRIPT_DIR, 'taobao_cookies.json')
        if os.path.exists(cookies_file):
            print("🍪 Loading saved Taobao cookies...")
            self.driver.get('https://www.taobao.com/')
            human_delay('login_nav')
            with open(cookies_file, 'r') as f:
                cookies = json.load(f)
                if not cookies:
                    print("⚠️  Cookie file is empty - run: python3 ai_scraper.py --login")
                else:
                    for cookie in cookies:
                        try:
                            self.driver.add_cookie(cookie)
                        except:
                            pass
            # Reload page so cookies take effect (login session recognized)
            self.driver.get('https://www.taobao.com/')
            human_delay('page_load')
            
            # Verify login by checking for username element
            try:
                nick = self.driver.find_element(By.CSS_SELECTOR, '.site-nav-login-info-nick, .J_UserNick, a[class*="nick"]')
                print(f"✅ Logged in as: {nick.text}")
            except:
                print("⚠️  Cookies loaded but login not detected - you may need to re-login: python3 ai_scraper.py --login")
        else:
            print("⚠️  No saved cookies found - run: python3 ai_scraper.py --login")
        
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
        
        # Navigate to taobao.com to ensure we capture all domain cookies
        self.driver.get('https://www.taobao.com/')
        human_delay('login_nav')
        
        # Save cookies
        cookies = self.driver.get_cookies()
        if cookies:
            with open(os.path.join(SCRIPT_DIR, 'taobao_cookies.json'), 'w') as f:
                json.dump(cookies, f)
            print(f"✅ Login saved! ({len(cookies)} cookies captured)")
        else:
            print("❌ No cookies captured - login may have failed")
        
        self.driver.quit()
    
    def scrape_product(self, url: str, index: int) -> Optional[ScrapedProduct]:
        """Scrape a single product with full pipeline"""
        print(f"\n{'='*60}")
        print(f"📦 Product {index}: {url[:70]}...")
        print(f"{'='*60}")
        
        # Reset failed models for each new product - start fresh with priority order
        self.translator.reset_failed_models()
        
        try:
            # Load page
            self.driver.get(url)
            human_delay('page_load')
            
            # Wait for title
            try:
                WebDriverWait(self.driver, PAGE_LOAD_WAIT).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'h1, span[class*="title"]'))
                )
            except TimeoutException:
                print("   ⚠️  Page timeout - may need login")
                return None
            
            # Human behavior: scroll down a bit like reading the page, then back up
            human_scroll(self.driver, random.randint(200, 600), smooth=True)
            human_delay('scroll_pause')
            human_scroll(self.driver, 0, smooth=False)
            
            # Extract product ID from URL
            product_id = self._extract_product_id(url)
            
            # Create media folder using product_id for stable naming
            # This prevents image mix-ups if scraping order changes or a product fails
            product_folder = os.path.join(MEDIA_DIR, product_id)
            os.makedirs(product_folder, exist_ok=True)
            
            downloader = ImageDownloader(product_folder)
            
            # Extract Chinese title (translation done in batch after all products scraped)
            title_zh = self._extract_title()
            print(f"   📝 Title (ZH): {title_zh[:50]}...")
            
            # Create product (title_en and SKU will be updated by batch translation)
            product = ScrapedProduct(
                url=url,
                product_id=product_id,
                title_zh=title_zh,
                title_en=title_zh,  # Placeholder, will be updated by batch
                product_sku="",  # Will be generated after translation
                images={'Main': [], 'Catalogue': [], 'Details': []},
                media_folder=product_id,
                timestamp=datetime.now().isoformat()
            )
            
            # === STEP 1: CAPTURE IMAGES ===
            print("   📸 Capturing images...")
            
            # Main/Hero image
            main_urls = self._get_main_image_urls()
            for i, img_url in enumerate(main_urls[:1]):  # First one is hero
                path = downloader.download(img_url, f"main_{i+1:02d}", 'Main')
                if path:
                    product.images['Main'].append(path)
            print(f"      → Main: {len(product.images['Main'])} captured")
            
            # Gallery/Catalogue images
            gallery_urls = self._get_gallery_urls()
            for i, img_url in enumerate(gallery_urls[:15]):
                path = downloader.download(img_url, f"catalogue_{i+1:02d}", 'Catalogue')
                if path:
                    product.images['Catalogue'].append(path)
            print(f"      → Gallery: {len(product.images['Catalogue'])} captured")
            
            # Detail images (scroll down — human-like incremental)
            human_scroll(self.driver, self.driver.execute_script("return document.body.scrollHeight;"), smooth=True)
            human_delay('scroll_pause')
            
            detail_urls = self._get_detail_image_urls()
            for i, img_url in enumerate(detail_urls[:30]):
                path = downloader.download(img_url, f"detail_{i+1:02d}", 'Details')
                if path:
                    product.images['Details'].append(path)
            print(f"      → Details: {len(product.images['Details'])} captured")
            
            # Scroll back up
            human_scroll(self.driver, 0, smooth=True)
            human_delay('scroll_pause')
            
            # === STEP 2: EXTRACT VARIANTS ===
            print("   🔍 Extracting variants...")
            
            variant_result = extract_variants(driver=self.driver)
            
            if variant_result.variants:
                print(f"      → Found {len(variant_result.variants)} variants via {variant_result.method}")
                
                for v in variant_result.variants:
                    # Get Chinese variant name
                    variant_zh = ' / '.join(v.option_values_zh.values()) if v.option_values_zh else v.prop_path
                    
                    # Always defer translation - batch translate at end for efficiency
                    scraped_variant = ScrapedVariant(
                        variant_name_zh=variant_zh,
                        variant_name_en=variant_zh,  # Placeholder, batch translated later
                        option_type_1='',
                        option_value_1='',
                        option_type_2='',
                        option_value_2='',
                        price_cny=v.price_cny or 0.0,
                        sku=v.sku_id or v.prop_path,
                        in_stock=v.available
                    )
                    product.variants.append(scraped_variant)
                    print(f"         → {variant_zh} (pending batch translation)")
            else:
                # Fallback: click-based variant detection with screenshot price extraction
                print("      → No structured variants, trying click detection...")
                self._extract_variants_by_click(product, product_folder)
            
            # Base price (from first variant or DOM)
            if product.variants:
                product.base_price_cny = product.variants[0].price_cny
            else:
                product.base_price_cny = self._extract_base_price()
            
            print(f"   💰 Base price: ¥{product.base_price_cny}")
            
            # === STEP 3: PUSH TO KNACK ===
            if self.knack_api and not self.skip_knack:
                print("   📤 Pushing to Knack...")
                self._push_to_knack(product)
            
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
                human_delay('scroll_pause')  # Random wait for lazy load
            
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
            
            # Create screenshots folders (for price extraction and variant hero images)
            screenshots_folder = os.path.join(product_folder, 'price_screenshots')
            os.makedirs(screenshots_folder, exist_ok=True)
            
            variant_images_folder = os.path.join(product_folder, 'variant_screenshots')
            os.makedirs(variant_images_folder, exist_ok=True)
            
            # STEP 2: Handle single dimension (just colors) or multi-dimension (color + size)
            if len(dimension_containers) == 1:
                # Single dimension - just iterate through options
                self._extract_single_dimension_variants(product, dimension_containers[0], screenshots_folder, variant_images_folder)
            else:
                # Multi-dimensional - iterate through combinations
                self._extract_multi_dimension_variants(product, dimension_containers, screenshots_folder, variant_images_folder)
                    
        except Exception as e:
            print(f"      ⚠️  Variant extraction error: {e}")
            import traceback
            traceback.print_exc()
    
    def _dismiss_overlays(self):
        """Pause when anti-bot overlay/captcha appears so you can solve it manually."""
        try:
            overlays = self.driver.find_elements(By.CSS_SELECTOR, '.J_MIDDLEWARE_FRAME_WIDGET')
            captchas = self.driver.find_elements(By.CSS_SELECTOR, 'iframe[src*="punish"], iframe[src*="captcha"]')
            if overlays or captchas:
                print("      ⚠️  Taobao anti-bot detected. Please solve the captcha/overlay in the browser, then press Enter to continue...")
                try:
                    input("      ↩️  Press Enter after solving...")
                except EOFError:
                    human_delay('overlay_wait')
        except Exception:
            pass
    
    def _find_variant_dimensions(self) -> List[Dict]:
        """
        Find variant dimension groups on the page.
        Returns list of: [{'label': 'Color', 'buttons': [elements...]}, {'label': 'Size', 'buttons': [...]}]
        """
        dimensions = []

        # Clear blocking middleware/captcha overlays before interacting
        self._dismiss_overlays()
        
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
    
    def _extract_single_dimension_variants(self, product: ScrapedProduct, dimension: Dict, screenshots_folder: str, variant_images_folder: str):
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
        
        # STEP 1: Click each variant and capture its price (DOM first, Screenshot Vision as backup)
        print(f"      → Capturing prices for {len(variant_data)} variants (DOM + Screenshot backup)...")
        last_known_price = 0.0
        dom_failures = 0
        
        for idx, v in enumerate(variant_data):
            try:
                self._dismiss_overlays()
                # Click the variant
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", v['button'])
                human_delay('before_action')
                v['button'].click()
                human_delay('variant_settle')  # Wait for price to update
                
                # Try DOM extraction first (fast, no API cost)
                price = self._extract_current_price()
                
                # BACKUP: If DOM fails, use Screenshot + Vision API (more accurate)
                if price <= 0 and not self.translator.no_api:
                    dom_failures += 1
                    screenshot_path = os.path.join(screenshots_folder, f'variant_{idx+1:03d}.png')
                    self.driver.execute_script("window.scrollTo(0, 0);")
                    human_delay('screenshot')  # Wait for price to load before screenshot
                    self.driver.save_screenshot(screenshot_path)
                    price = self.translator.extract_price_from_screenshot(screenshot_path)
                    
                    if price > 0:
                        print(f"         ⚠️  DOM failed, used Screenshot Vision: ¥{price}")
                else:
                    # ALWAYS save variant hero image for variant-specific display in Shopify
                    variant_image_path = os.path.join(variant_images_folder, f'variant_{idx+1:03d}.png')
                    self.driver.execute_script("window.scrollTo(0, 0);")
                    human_delay('screenshot')
                    self.driver.save_screenshot(variant_image_path)
                
                if price > 0:
                    v['price'] = price
                    last_known_price = price
                else:
                    v['price'] = last_known_price
                
            except Exception as e:
                print(f"         ⚠️  Error clicking variant {v['index']}: {e}")
                v['price'] = last_known_price
        
        # Report backup usage
        if dom_failures > 0:
            print(f"      → ⚠️  Used Screenshot Vision backup for {dom_failures}/{len(variant_data)} variants")
        
        # STEP 2: Batch translate all variant names (ONE API call)
        variant_names_zh = [v['name_zh'] for v in variant_data]
        print(f"      → 🚀 Batch translating {len(variant_names_zh)} variants...")
        
        batch_result = self.translator.batch_process_product(
            screenshot_path=os.path.join(screenshots_folder, 'price_check.png') if os.path.exists(os.path.join(screenshots_folder, 'price_check.png')) else "",
            title_zh=product.title_zh,
            variant_names_zh=variant_names_zh
        )
        
        # Update title and generate product SKU
        if batch_result['title_en'] and batch_result['title_en'] != product.title_zh:
            product.title_en = batch_result['title_en']
            product.product_sku = generate_product_sku(product.title_en, product.product_id)
            print(f"      → 📝 Title: {product.title_en[:50]}...")
            print(f"      → 📝 Product SKU: {product.product_sku}")
        
        # STEP 3: Create variant records with individual prices and descriptive SKUs
        for i, (v, name_en) in enumerate(zip(variant_data, batch_result['variants_en'])):
            parsed = self.parser.parse(name_en)

            # Use individual price, fall back to batch price if 0
            price = v['price'] if v['price'] > 0 else batch_result['price']

            # Generate unique variant SKU with collision prevention
            variant_sku = get_unique_variant_sku(
                product.product_sku, parsed['normalized'], i+1,
                option_type1=label,
                option_value1=parsed['optionValue1'] or name_en,
                option_type2=parsed['optionType2'] or "",
                option_value2=parsed['optionValue2'] or ""
            )

            product.variants.append(ScrapedVariant(
                variant_name_zh=v['name_zh'],
                variant_name_en=parsed['normalized'],
                option_type_1=label,
                option_value_1=parsed['optionValue1'] or name_en,
                option_type_2=parsed['optionType2'],
                option_value_2=parsed['optionValue2'],
                price_cny=price,
                sku=variant_sku,
                in_stock=True
            ))

            print(f"         → {v['name_zh']} → {parsed['normalized']}")
            print(f"            SKU: {variant_sku} @ ¥{price}")
    
    def _extract_multi_dimension_variants(self, product: ScrapedProduct, dimensions: List[Dict], screenshots_folder: str, variant_images_folder: str):
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
        human_delay('screenshot')
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
        
        # Update title and generate product SKU
        if batch_result['title_en'] and batch_result['title_en'] != product.title_zh:
            product.title_en = batch_result['title_en']
            product.product_sku = generate_product_sku(product.title_en, product.product_id)
            print(f"      → 📝 Title: {product.title_en[:50]}...")
            print(f"      → 📝 Product SKU: {product.product_sku}")
        
        # Create variant combinations with INDIVIDUAL prices for each
        variant_count = 0
        seen_combos = set()  # Prevent duplicate combinations
        last_known_price = 0.0  # Track price from Vision
        
        print(f"      → Capturing individual prices for each variant (using Vision API)...")
        
        for i, (opt1, name1_en) in enumerate(zip(dim1_options, dim1_translations)):
            # Click dimension 1 option
            try:
                self._dismiss_overlays()
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", opt1['button'])
                human_delay('before_action')
                opt1['button'].click()
                human_delay('variant_click')  # Wait for price to update
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
                    self._dismiss_overlays()
                    opt2['button'].click()
                    human_delay('variant_settle')  # Wait for price to update after click
                    
                    # First try DOM extraction (fast, no API cost)
                    price = self._extract_current_price()
                    
                    # BACKUP: If DOM fails, use Screenshot + Vision API (more accurate)
                    if price <= 0 and not self.translator.no_api:
                        # Take screenshot and use Vision to read price
                        screenshot_path = os.path.join(screenshots_folder, f'variant_{variant_count+1:03d}.png')
                        self.driver.execute_script("window.scrollTo(0, 0);")
                        human_delay('screenshot')  # Wait for price to load before screenshot
                        self.driver.save_screenshot(screenshot_path)
                        price = self.translator.extract_price_from_screenshot(screenshot_path)
                        
                        if price > 0:
                            print(f"         ⚠️  DOM failed, used Screenshot Vision: ¥{price}")
                    else:
                        # ALWAYS save variant hero image for variant-specific display in Shopify
                        variant_image_path = os.path.join(variant_images_folder, f'variant_{variant_count+1:03d}.png')
                        self.driver.execute_script("window.scrollTo(0, 0);")
                        human_delay('screenshot')
                        self.driver.save_screenshot(variant_image_path)
                    
                    # Update last known price if we got a valid one
                    if price > 0:
                        last_known_price = price
                    else:
                        # Fall back to last known price
                        price = last_known_price
                    
                    variant_count += 1

                    # Create combined variant
                    combined_name = f"{name1_en} / {name2_en}"

                    # Generate unique variant SKU with collision prevention
                    variant_sku = get_unique_variant_sku(
                        product.product_sku, combined_name, variant_count,
                        option_type1=dim1['label'],
                        option_value1=name1_en,
                        option_type2=dim2['label'],
                        option_value2=name2_en
                    )

                    product.variants.append(ScrapedVariant(
                        variant_name_zh=f"{opt1['name_zh']} / {opt2['name_zh']}",
                        variant_name_en=combined_name,
                        option_type_1=dim1['label'],
                        option_value_1=name1_en,
                        option_type_2=dim2['label'],
                        option_value_2=name2_en,
                        price_cny=price,
                        sku=variant_sku,
                        in_stock=True
                    ))

                    print(f"         → {opt1['name_zh']}/{opt2['name_zh']} → {combined_name}")
                    print(f"            SKU: {variant_sku} @ ¥{price}")
                    
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

    def _extract_current_price(self, url: str = "") -> float:
        """Extract the currently displayed price from DOM using JavaScript for accuracy.

        Supports both Taobao and Tmall page layouts.
        """
        is_tmall = is_tmall_url(url) if url else False

        # Tmall-specific scripts (try first if Tmall URL)
        tmall_scripts = [
            # Tmall promo/sale price
            """
            var el = document.querySelector('[class*="tm-price"], [class*="tm-promo-price"]');
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
            # Tmall main price display
            """
            var el = document.querySelector('.tm-price-panel .tm-price, .tm-fcs-panel .tm-price');
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
        ]

        # Standard Taobao scripts
        taobao_scripts = [
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
        ]

        # Generic scripts that work on both platforms
        generic_scripts = [
            # Look for any element with ¥ symbol in price-related class
            """
            var els = document.querySelectorAll('[class*="Price"], [class*="price"], [class*="tm-price"]');
            for (var i = 0; i < els.length; i++) {
                var text = els[i].textContent;
                if (text.indexOf('¥') >= 0 || text.match(/^[0-9]+\\.?[0-9]*$/)) {
                    var nums = text.match(/[0-9]+\\.?[0-9]*/g);
                    if (nums && nums.length > 0) {
                        var num = parseFloat(nums[0]);
                        if (num >= 5 && num <= 5000) return num;
                    }
                }
            }
            return 0;
            """,
        ]

        # Build script list based on platform
        if is_tmall:
            js_price_scripts = tmall_scripts + taobao_scripts + generic_scripts
        else:
            js_price_scripts = taobao_scripts + tmall_scripts + generic_scripts

        for script in js_price_scripts:
            try:
                price = self.driver.execute_script(script)
                if price and price > 0:
                    return float(price)
            except:
                continue

        # Fallback: CSS selectors (platform-specific)
        if is_tmall:
            selectors = [
                '.tm-price',
                '.tm-promo-price',
                'span[class*="tm-price"]',
                'span.Price--priceInt--ZlsSi_M',
                'span[class*="Price--priceInt"]',
            ]
        else:
            selectors = [
                'span.Price--priceInt--ZlsSi_M',
                'span[class*="Price--priceInt"]',
                'em.tb-rmb-num',
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
    
    def _push_to_knack(self, product: ScrapedProduct):
        """Push product and variants to BOTH Knack (data) and Notion (images) simultaneously"""
        if not self.knack_api:
            return
        
        try:
            # ============================================
            # PUSH TO KNACK (product data + variant data)
            # ============================================
            
            # Find or create product
            existing = self.knack_api.find_record(
                PRODUCTS_OBJECT_KEY,
                PRODUCT_FIELDS['url'],
                product.url
            )
            
            if existing:
                product_record_id = existing['id']
                print(f"      → Knack: Found existing product: {product_record_id}")
            else:
                # Create new product with base pricing
                product_data = {
                    PRODUCT_FIELDS['id']: product.product_id,
                    PRODUCT_FIELDS['sku']: product.product_sku,
                    PRODUCT_FIELDS['title']: product.title_en,
                    PRODUCT_FIELDS['titleOriginal']: product.title_zh,
                    PRODUCT_FIELDS['url']: product.url,
                    PRODUCT_FIELDS['status']: 'Active',
                }
                
                # Add base price if available
                if 'priceCadBase' in PRODUCT_FIELDS and product.base_price_cad > 0:
                    product_data[PRODUCT_FIELDS['priceCadBase']] = product.base_price_cad
                
                if self.dry_run:
                    print(f"      → [DRY RUN] Would create product in Knack: {product.title_en[:40]}")
                    return
                
                result = self.knack_api.create_record(PRODUCTS_OBJECT_KEY, product_data)
                product_record_id = result['id']
                print(f"      → Knack: Created product: {product_record_id}")
            
            # Push variants with pricing to Knack
            for v in product.variants:
                # Calculate pricing if not already done
                if v.price_cad == 0 and v.price_cny > 0:
                    pricing = calculate_price_cad(v.price_cny)
                    v.cost_cad = pricing['cost_cad']
                    v.price_cad = pricing['price_cad']
                    v.margin_standard = pricing['margin_standard']
                
                variant_data = {
                    VARIANT_FIELDS['product']: [product_record_id],  # Connection field (maintains relationship)
                    VARIANT_FIELDS['sku']: v.sku,  # Unique SKU - used for lookups/relationships
                    VARIANT_FIELDS['variantName']: v.variant_name_en,  # Display name - editable in Knack portal
                    VARIANT_FIELDS['optionType1']: v.option_type_1,
                    VARIANT_FIELDS['optionValue1']: v.option_value_1,
                    VARIANT_FIELDS['optionType2']: v.option_type_2,
                    VARIANT_FIELDS['optionValue2']: v.option_value_2,
                    VARIANT_FIELDS['priceCny']: v.price_cny,
                    VARIANT_FIELDS['status']: 'Active' if v.in_stock else 'Out of Stock',
                }
                
                # Add CAD pricing fields
                variant_data[VARIANT_FIELDS['priceCad']] = v.price_cad
                variant_data[VARIANT_FIELDS['totalCostCad']] = v.cost_cad
                variant_data[VARIANT_FIELDS['marginStandard']] = v.margin_standard  # As percentage (30.5)
                variant_data[VARIANT_FIELDS['marginPromo']] = v.margin_promo  # As percentage (14.2)
                
                if self.dry_run:
                    print(f"         → [DRY RUN] Would create variant: {v.variant_name_en} @ ${v.price_cad}")
                    continue
                
                # Check if variant exists by SKU (not display name)
                existing_variant = self.knack_api.find_record(
                    VARIANTS_OBJECT_KEY,
                    VARIANT_FIELDS['sku'],
                    v.sku
                )
                
                if existing_variant:
                    self.knack_api.update_record(VARIANTS_OBJECT_KEY, existing_variant['id'], variant_data)
                    print(f"         → Knack: Updated: {v.variant_name_en} @ ${v.price_cad}")
                else:
                    self.knack_api.create_record(VARIANTS_OBJECT_KEY, variant_data)
                    print(f"         → Knack: Created: {v.variant_name_en} @ ${v.price_cad}")
                
                time.sleep(0.2)  # Knack rate limit (server-side, keep short)
            
            # ============================================
            # PUSH TO NOTION (image URLs)
            # ============================================
            print(f"      → Notion: Pushing image URLs...")
            
            # Convert ScrapedProduct to dict for Notion
            product_dict = {
                'product_id': product.product_id,
                'product_sku': product.product_sku,
                'title_en': product.title_en,
                'title_zh': product.title_zh,
                'url': product.url,
                'images': product.images,
                'variants': [
                    {
                        'variant_name_en': v.variant_name_en,
                        'sku': v.sku,
                        'image_url': getattr(v, 'image_url', None)
                    }
                    for v in product.variants
                ]
            }
            
            push_product_to_notion(product_dict, dry_run=self.dry_run)
                
        except Exception as e:
            print(f"      ⚠️  Push error: {e}")
    
    def _batch_translate_all_products(self):
        """Batch translate all product titles and variants in a single API call"""
        print(f"\n{'='*60}")
        print("📝 BATCH TRANSLATION (2 API calls)")
        print(f"{'='*60}")
        
        # Load translation cache
        cache = self._load_translation_cache()
        
        # ── PHASE 1: Collect & bulk-translate all product titles ──
        titles_to_translate = []  # (product_idx, title_zh)
        
        for p_idx, product in enumerate(self.products):
            title_zh = product.title_zh or ''
            if not title_zh or title_zh == '登录':
                continue
            # Check cache first
            if title_zh in cache:
                product.title_en = cache[title_zh]
                print(f"   [{p_idx+1}] ✓ Cached: {cache[title_zh][:50]}")
            elif self.translator._has_chinese(title_zh):
                titles_to_translate.append((p_idx, title_zh))
        
        print(f"\n   📦 Product titles needing translation: {len(titles_to_translate)}")
        
        if titles_to_translate:
            title_translations = self.translator.bulk_translate_products(
                [t for _, t in titles_to_translate]
            )
            
            # Apply title translations
            for (p_idx, title_zh), title_en in zip(titles_to_translate, title_translations):
                self.products[p_idx].title_en = title_en
                cache[title_zh] = title_en
                print(f"   [{p_idx+1}] → {title_en[:60]}")
        
        # ── PHASE 2: Generate SKUs from translated titles ──
        for product in self.products:
            product.product_sku = generate_product_sku(product.title_en, product.product_id)
        
        # ── PHASE 3: Collect & bulk-translate all variant names ──
        variants_to_translate = []  # (product_idx, variant_idx, variant_zh)
        
        for p_idx, product in enumerate(self.products):
            for v_idx, variant in enumerate(product.variants):
                variant_zh = variant.variant_name_zh or ''
                cache_key = f"variant:{variant_zh}"
                
                if cache_key in cache:
                    parsed = self.parser.parse(cache[cache_key])
                    variant.variant_name_en = parsed['normalized']
                    variant.option_type_1 = parsed['optionType1']
                    variant.option_value_1 = parsed['optionValue1']
                    variant.option_type_2 = parsed['optionType2']
                    variant.option_value_2 = parsed['optionValue2']
                elif self.translator._has_chinese(variant_zh):
                    variants_to_translate.append((p_idx, v_idx, variant_zh))
        
        print(f"\n   🏷️  Variant names needing translation: {len(variants_to_translate)}")
        
        if variants_to_translate:
            variant_translations = self.translator.bulk_translate_variants(
                [v for _, _, v in variants_to_translate]
            )
            
            # Apply variant translations
            for (p_idx, v_idx, variant_zh), variant_en in zip(variants_to_translate, variant_translations):
                parsed = self.parser.parse(variant_en)
                self.products[p_idx].variants[v_idx].variant_name_en = parsed['normalized']
                self.products[p_idx].variants[v_idx].option_type_1 = parsed['optionType1']
                self.products[p_idx].variants[v_idx].option_value_1 = parsed['optionValue1']
                self.products[p_idx].variants[v_idx].option_type_2 = parsed['optionType2']
                self.products[p_idx].variants[v_idx].option_value_2 = parsed['optionValue2']
                cache[f"variant:{variant_zh}"] = variant_en
        
        # ── PHASE 4: Generate variant SKUs ──
        reset_sku_tracker()
        for product in self.products:
            for v_idx, variant in enumerate(product.variants):
                variant.sku = get_unique_variant_sku(
                    product.product_sku, variant.variant_name_en, v_idx + 1,
                    option_type1=variant.option_type_1,
                    option_value1=variant.option_value_1,
                    option_type2=variant.option_type_2,
                    option_value2=variant.option_value_2
                )
        
        # ── PHASE 5: Validate translations ──
        issues = self._validate_translations()
        
        # Save cache
        self._save_translation_cache(cache)
        
        api_calls = (1 if titles_to_translate else 0) + (1 if variants_to_translate else 0)
        print(f"\n   ✅ Batch translation complete")
        print(f"      API calls made: {api_calls}")
        print(f"      Products translated: {len(titles_to_translate)}")
        print(f"      Variants translated: {len(variants_to_translate)}")
        if issues['untranslated_titles'] or issues['untranslated_variants']:
            print(f"      ⚠️  Untranslated titles: {len(issues['untranslated_titles'])}")
            print(f"      ⚠️  Untranslated variants: {len(issues['untranslated_variants'])}")
        else:
            print(f"      ✅ All translations validated - zero Chinese text remaining")
    
    def _load_translation_cache(self) -> dict:
        """Load translation cache from disk"""
        cache_path = os.path.join(OUTPUT_DIR, 'translation_cache.json')
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def _save_translation_cache(self, cache: dict):
        """Save translation cache to disk"""
        cache_path = os.path.join(OUTPUT_DIR, 'translation_cache.json')
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    
    def _validate_translations(self) -> dict:
        """Validate all translations are complete - no Chinese text remaining"""
        issues = {
            'untranslated_titles': [],
            'untranslated_variants': [],
        }
        
        for product in self.products:
            if self.translator._has_chinese(product.title_en):
                issues['untranslated_titles'].append({
                    'product_id': product.product_id,
                    'title_zh': product.title_zh,
                    'title_en': product.title_en,
                })
            
            for variant in product.variants:
                if self.translator._has_chinese(variant.variant_name_en):
                    issues['untranslated_variants'].append({
                        'product_id': product.product_id,
                        'variant_zh': variant.variant_name_zh,
                        'variant_en': variant.variant_name_en,
                    })
        
        return issues
    
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
            print("   Mode: 📝 BATCH TRANSLATE (2 API calls at end)")
            if self.dry_run:
                print("   Mode: 🧪 DRY RUN (no Knack changes)")
            if self.skip_knack:
                print("   Mode: ⏭️  SKIP KNACK (scrape only)")
            
            for i, url in enumerate(urls, 1):
                product = self.scrape_product(url, i)
                if product:
                    self.products.append(product)
                
                # Human-like pause between products (longer = safer)
                if i < len(urls):
                    delay = human_delay('between_products')
                    print(f"   ⏳ Browsing pause ({delay:.0f}s) before next product...")
                    human_browse_pause(self.driver)
            
            # Always batch translate after all products collected
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
                        'SKU Key': v.sku,
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
    args = parser.parse_args()
    
    # Default is now to skip Knack unless --push-knack is specified
    skip_knack = not args.push_knack
    
    scraper = AIScraper(
        headless=args.headless,
        dry_run=args.dry_run,
        skip_knack=skip_knack,
        no_api=args.no_api,
    )
    
    if args.login:
        scraper.login_setup()
        return
    
    # Read URLs
    if not os.path.exists(LINK_FILE):
        print(f"❌ No URL file: {LINK_FILE}")
        return
    
    with open(LINK_FILE) as f:
        urls = [l.strip() for l in f if l.strip() and not l.startswith('#')]
    
    if not urls:
        print(f"❌ No URLs in {LINK_FILE}")
        return
    
    scraper.run(urls, test_mode=args.test)


if __name__ == '__main__':
    main()
