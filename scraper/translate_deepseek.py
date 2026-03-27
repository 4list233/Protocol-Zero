#!/usr/bin/env python3
"""
BULK translate products using DeepSeek API (maximum cost optimization)
- 1 API call for ALL products
- 1 API call for ALL variants
"""
import os
import sys
import json
import time
import argparse
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import re

def contains_chinese(text: str) -> bool:
    if not text:
        return False
    return bool(re.search(r'[\u4e00-\u9fff]', text))

# Load environment
load_dotenv()

DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
if not DEEPSEEK_API_KEY:
    print("❌ DEEPSEEK_API_KEY not found in .env")
    sys.exit(1)

# Initialize DeepSeek client (OpenAI-compatible)
client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

# Most cost-efficient model
MODEL = "deepseek-chat"

# Cache
CACHE_FILE = Path('ai_scraper_output/translation_cache.json')


def load_cache():
    """Load translation cache"""
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache):
    """Save translation cache"""
    CACHE_FILE.parent.mkdir(exist_ok=True)
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def bulk_translate_products(products_to_translate, cache):
    """
    Translate ALL products in 1 API call
    
    Args:
        products_to_translate: List of (index, title_zh) tuples
        cache: Translation cache
        
    Returns:
        Dict mapping index -> translation
    """
    if not products_to_translate:
        return {}
    
    print(f"\n🚀 Bulk translating {len(products_to_translate)} products in 1 API call...")
    
    # Build bulk input
    numbered_items = []
    for idx, title_zh in products_to_translate:
        numbered_items.append(f"{idx}. {title_zh}")
    
    bulk_input = "\n".join(numbered_items)
    
    # Detailed milsim/tactical translation prompt
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

**Title Format:** [Model/Identifier] + [Item Type] + [Key Specs] + [Compatibility] + [Color if important]
- Keep concise, remove filler, use Title Case
- Example: "L4G24 NVG Mount - Aluminum - Wilcox Compatible"

**Output format:** One translation per line with the same number.

Titles to translate:
{bulk_input}

Translations (one per line with number):"""
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
            temperature=0.3,
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse numbered responses
        translations = {}
        for line in result_text.split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # Extract number and translation
            parts = line.split('.', 1)
            if len(parts) == 2:
                try:
                    idx = int(parts[0].strip())
                    translation = parts[1].strip()
                    translations[idx] = translation
                    
                    # Cache it
                    original_zh = next((t for i, t in products_to_translate if i == idx), None)
                    if original_zh:
                        cache[original_zh] = translation
                except ValueError:
                    continue
        
        save_cache(cache)
        print(f"   ✅ Translated {len(translations)}/{len(products_to_translate)} products")
        
        return translations
        
    except Exception as e:
        print(f"   ❌ BULK TRANSLATION FAILED: {e}")
        raise


def bulk_translate_variants(variants_to_translate, cache):
    """
    Translate ALL variants in 1 API call
    
    Args:
        variants_to_translate: List of (index, variant_zh) tuples
        cache: Translation cache
        
    Returns:
        Dict mapping index -> translation
    """
    if not variants_to_translate:
        return {}
    
    print(f"\n🚀 Bulk translating {len(variants_to_translate)} variants in 1 API call...")
    
    # Build bulk input
    numbered_items = []
    for idx, variant_zh in variants_to_translate:
        numbered_items.append(f"{idx}. {variant_zh}")
    
    bulk_input = "\n".join(numbered_items)
    
    # Detailed variant translation prompt with milsim conventions
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

**Output format:** One translation per line with the same number.

Variant names to translate:
{bulk_input}

Translations (one per line with number):"""
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=5000,
            temperature=0.3,
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse numbered responses
        translations = {}
        for line in result_text.split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # Extract number and translation
            parts = line.split('.', 1)
            if len(parts) == 2:
                try:
                    idx = int(parts[0].strip())
                    translation = parts[1].strip()
                    translations[idx] = translation
                    
                    # Cache it
                    original_zh = next((v for i, v in variants_to_translate if i == idx), None)
                    if original_zh:
                        cache[f"variant:{original_zh}"] = translation
                except ValueError:
                    continue
        
        save_cache(cache)
        print(f"   ✅ Translated {len(translations)}/{len(variants_to_translate)} variants")
        
        return translations
        
    except Exception as e:
        print(f"   ❌ BULK VARIANT TRANSLATION FAILED: {e}")
        raise


def translate_products_json(input_file='ai_scraper_output/products.json',
                           output_file=None,
                           force=False):
    """Translate products using BULK DeepSeek API calls"""
    
    if not output_file:
        output_file = input_file.replace('.json', '_translated.json')
    
    print(f"\n{'='*60}")
    print(f"🚀 DEEPSEEK BULK TRANSLATION")
    print(f"{'='*60}")
    print(f"Model:  {MODEL}")
    print(f"Input:  {input_file}")
    print(f"Output: {output_file}")
    print(f"Force:  {force}")
    print(f"Method: BULK (1 call for products, 1 call for variants)\n")
    
    # Load data
    with open(input_file, encoding='utf-8') as f:
        data = json.load(f)
    
    products = data.get('products', [])
    print(f"📦 Found {len(products)} products\n")
    
    # Load cache
    cache = load_cache()
    
    # PHASE 1: Collect all products that need translation
    print("📋 Phase 1: Collecting products to translate...")
    products_to_translate = []
    skipped = 0
    
    for idx, product in enumerate(products, 1):
        title_zh = product.get('title_zh', '')
        title_en = product.get('title_en', '')
        
        # Skip login pages
        if title_zh == '登录':
            skipped += 1
            continue
        
        # Check if needs translation
        if force or not title_en or contains_chinese(title_en):
            if title_zh not in cache:
                products_to_translate.append((idx, title_zh))
                print(f"   [{idx}] {title_zh[:60]}...")
            else:
                # Use cached
                product['title_en'] = cache[title_zh]
                print(f"   [{idx}] ✓ Cached")
    
    print(f"\n   Need translation: {len(products_to_translate)} products")
    print(f"   Skipped: {skipped} login pages\n")
    
    # PHASE 2: Bulk translate all products in 1 API call
    product_translations = {}
    if products_to_translate:
        product_translations = bulk_translate_products(products_to_translate, cache)
        
        # Apply translations
        for idx, translation in product_translations.items():
            if idx <= len(products):
                products[idx-1]['title_en'] = translation
                print(f"   [{idx}] → {translation[:70]}")
    
    # PHASE 3: Collect all variants that need translation
    print("\n📋 Phase 3: Collecting variants to translate...")
    variants_to_translate = []
    variant_counter = 0
    
    for product_idx, product in enumerate(products, 1):
        for variant in product.get('variants', []):
            variant_zh = variant.get('variant_name_zh', '')
            variant_en = variant.get('variant_name_en', '')

            # Always re-translate from Chinese source if it has Chinese text,
            # since rule-based scraper translations (e.g. "Red", "Green") are
            # too simplistic and should be replaced by DeepSeek translations.
            needs_translation = (
                force
                or not variant_en
                or contains_chinese(variant_en)
                or (variant_zh and contains_chinese(variant_zh))
            )

            if needs_translation:
                cache_key = f"variant:{variant_zh}"
                variant_counter += 1

                if cache_key not in cache:
                    variants_to_translate.append((variant_counter, variant_zh))
                else:
                    # Use cached
                    variant['variant_name_en'] = cache[cache_key]
    
    print(f"\n   Need translation: {len(variants_to_translate)} variants\n")
    
    # PHASE 4: Bulk translate all variants in 1 API call
    if variants_to_translate:
        variant_translations = bulk_translate_variants(variants_to_translate, cache)
        
        # Apply translations
        variant_map = {v: t for i, v in variants_to_translate for t in [variant_translations.get(i, v)]}
        
        for product in products:
            for variant in product.get('variants', []):
                variant_zh = variant.get('variant_name_zh', '')
                if variant_zh in variant_map:
                    variant['variant_name_en'] = variant_map[variant_zh]
    
    # Save translated data
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ BULK TRANSLATION COMPLETE")
    print(f"{'='*60}")
    print(f"Products translated: {len(product_translations)}")
    print(f"Variants translated: {len(variant_translations) if variants_to_translate else 0}")
    print(f"Skipped (login pages): {skipped}")
    print(f"API calls made: 2 (1 for products, 1 for variants)")
    print(f"\n💾 Saved to: {output_file}\n")


def main():
    parser = argparse.ArgumentParser(description='Translate products using DeepSeek')
    parser.add_argument('--input', default='ai_scraper_output/products.json',
                       help='Input JSON file')
    parser.add_argument('--output', help='Output JSON file')
    parser.add_argument('--force', action='store_true',
                       help='Re-translate even if English exists')
    
    args = parser.parse_args()
    
    translate_products_json(args.input, args.output, args.force)


if __name__ == '__main__':
    main()
