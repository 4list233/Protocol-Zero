#!/usr/bin/env python3
"""
BULK translate products using DeepSeek API (maximum cost optimization)
- 1 API call for ALL products
- 1 API call for ALL variants
- Uses original prompts from translate.py
"""
import os
import sys
import json
import time
import argparse
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# Add utilities to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'utilities'))
from translate import TRANSLATION_PROMPT, VARIANT_PROMPT, contains_chinese

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
    
    # Airsoft/milsim variant translation prompt
    prompt = f"""You are translating Chinese airsoft product variant names to English for a milsim/airsoft equipment catalog.
These are variant selectors on product listings (e.g. color, model spec, thread type, mounting standard, bundle contents).

**CONTEXT: Airsoft / Milsim gear store. Translate with precision — customers use these to select exactly what they're buying.**

---
**COLORS (standardize to milsim palette):**
黑色/哑黑/消光黑 → Matte Black | 亮黑/黑色 → Black
沙色/土黄/黄褐/沙漠黄 → Tan | 狼棕/泥色 → Coyote Brown | 卡其 → Khaki
暗土/FDE → FDE | 军绿/橄榄绿 → OD Green | 游骑兵绿 → Ranger Green
狼灰/灰色 → Wolf Grey | 绿色 → Green | 红色 → Red | 蓝色 → Blue
CP迷彩/CP Camo → CP Camo | 多彩迷彩 → MultiCam | 丛林迷彩 → Jungle Camo
暗夜迷彩 → Black Camo | 数码沙漠 → Desert Digital | 沙漠蟒 → Desert Python

---
**SIZES & DIMENSIONS (keep numbers exactly):**
Clothing: XXS XS S M L XL XXL 2XL 3XL 4XL | 均码 → One Size | 通用/通用尺码 → Universal
Body measurements: keep exact (e.g. 80-230cm, 85-125cm)
Hardware dimensions: keep exact with units (e.g. 30mm, 25.4mm, 14mm CCW, 14mm CW)
Barrel thread: 14mm逆牙/逆螺纹 → 14mm CCW | 14mm正牙/正螺纹 → 14mm CW | M14 → M14

---
**MOUNTING & INTERFACE STANDARDS (use the standard abbreviation):**
20mm导轨/皮轨/1913 → Picatinny (1913) | M-LOK → M-LOK | KeyMod → KeyMod
QD快拆 → QD | 高架/高脚 → High Mount | 低架/低脚 → Low Mount | 中架 → Mid Mount
左轮/左装 → Left Hand | 右轮/右装 → Right Hand

---
**MODEL IDENTIFIERS (preserve exactly — these are the product classification):**
Keep all model numbers, platform codes, compatibility refs exactly:
M4/M16/AR15, AK/AKM, Glock/G17/G18/G19, 1911, MP5, HK416, SCAR, AUG
PEQ-15, DBAL-A3, PVS-14, GPNVG-18, L4G24, MK18, 6094, JPC, MICH 2000
X300/X400, SureFire, Streamlight, Unity, Reptilia, Wilcox, Ops-Core, ARC

---
**MATERIALS & CONSTRUCTION:**
金属/全金属 → Full Metal | 铝合金 → Aluminum | 锌合金 → Zinc Alloy | 钢 → Steel
尼龙/PA66 → Nylon | 考度拉 → Cordura | 1000D/500D/210D → keep as-is
CNC → CNC | 铸造 → Cast | 注塑 → Injection Molded | 碳纤维 → Carbon Fiber

---
**BUNDLE / SET VARIANTS:**
套装/全套 → Full Set | 单品/仅 → [Item] Only | 含...→ w/ [item]
升级版/加强版 → Upgraded | 标准版 → Standard | 豪华版 → Deluxe
一个/1个 → 1 pc | 两个/2个 → 2 pcs | 一套 → 1 Set

---
**OEM / BRANDING — STRIP COMPLETELY:**
Remove: store names, "factory direct", "OEM", "1:1", "same as real", "hot sale", "high quality"
Remove: 爆款 正品 外贸 高品质 热销 同款 厂家直销
Remove: generic brand names (悟空, WOSPORT, 骏马, 战狼, TMC, FMA) UNLESS it's a real product identifier
KEEP: military/government designations (PVS, DBAL, MICH, JPC, 6094, L4G24, etc.)

---
**FORMAT RULES:**
- Use " / " to separate dimensions: "Black / 30mm", "Tan / 14mm CCW"
- Include all meaningful specs — don't collapse "Black CNC High Mount" to just "Black"
- Normalize units but keep exact numbers
- If variant describes a compatibility or bundle, say so: "w/ QD Sling Mount", "Glock 17/19 Compatible"
- Use Title Case

**Output:** One translation per line, same number prefix. No explanations.

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
            
            if force or not variant_en or contains_chinese(variant_en):
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
