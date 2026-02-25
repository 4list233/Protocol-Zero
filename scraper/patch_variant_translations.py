#!/usr/bin/env python3
"""
Retranslate all variant names using the updated airsoft/milsim prompt,
then patch existing Knack records (matched by SKU) with:
  - New English variant name (field_62 / variantName)
  - Chinese variant name  (field_149 / chineseName)

Run from scraper/ directory:
    python3 patch_variant_translations.py
    python3 patch_variant_translations.py --dry-run
    python3 patch_variant_translations.py --force      # re-translate even if cached
"""

import os
import sys
import json
import argparse
import time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Add integrations to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'integrations'))
from knack_integration import KnackAPI, VARIANTS_OBJECT_KEY, VARIANT_FIELDS

DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
MODEL = "deepseek-chat"
PRODUCTS_JSON = Path('ai_scraper_output/products.json')
CACHE_FILE = Path('ai_scraper_output/translation_cache.json')
MAX_PER_CALL = 200  # chunk size to stay within token limits


def load_cache():
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache):
    CACHE_FILE.parent.mkdir(exist_ok=True)
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def bulk_translate(client, items_zh: list[str]) -> list[str]:
    """
    Translate a list of Chinese variant names in one API call.
    Returns list of English translations in same order.
    Chunks automatically if > MAX_PER_CALL.
    """
    if not items_zh:
        return []

    if len(items_zh) > MAX_PER_CALL:
        all_translations = []
        for start in range(0, len(items_zh), MAX_PER_CALL):
            chunk = items_zh[start:start + MAX_PER_CALL]
            all_translations.extend(bulk_translate(client, chunk))
            time.sleep(1)  # brief pause between chunks
        return all_translations

    numbered = "\n".join([f"{i+1}. {t}" for i, t in enumerate(items_zh)])

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
短款 → Short | 长款 → Long | 消 → Suppressor-Ready (when paired with thread spec)

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
X300/X400/M300/M600, SureFire, Streamlight, Unity, Reptilia, Wilcox, Ops-Core, ARC

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
- Use " / " to separate dimensions: "Black / 30mm", "Tan / 14mm CCW", "Matte Blue / Short / 14mm CCW"
- Include all meaningful specs — don't collapse "Black CNC High Mount" to just "Black"
- Normalize units but keep exact numbers
- If variant describes a compatibility or bundle, say so: "w/ QD Sling Mount", "Glock 17/19 Compatible"
- Use Title Case

**Output:** One translation per line, same number prefix. No explanations.

Variant names to translate:
{numbered}

Translations (one per line with number):"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max(5000, len(items_zh) * 40),
        temperature=0.3,
    )

    result_text = response.choices[0].message.content.strip()

    translations = {}
    for line in result_text.split('\n'):
        line = line.strip()
        if not line:
            continue
        parts = line.split('.', 1)
        if len(parts) == 2:
            try:
                idx = int(parts[0].strip())
                translations[idx] = parts[1].strip()
            except ValueError:
                continue

    # Return in order, fallback to original if missing
    return [translations.get(i + 1, items_zh[i]) for i in range(len(items_zh))]


def main():
    parser = argparse.ArgumentParser(description='Retranslate variants and patch Knack records')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without writing to Knack')
    parser.add_argument('--force', action='store_true', help='Re-translate even if cached')
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("🔄 VARIANT RETRANSLATION + KNACK PATCH")
    print("=" * 60)
    if args.dry_run:
        print("⚠️  DRY RUN — no changes will be written to Knack\n")

    # Load products
    if not PRODUCTS_JSON.exists():
        print(f"❌ {PRODUCTS_JSON} not found")
        sys.exit(1)

    with open(PRODUCTS_JSON, encoding='utf-8') as f:
        data = json.load(f)

    products = data.get('products', [])
    print(f"📦 Loaded {len(products)} products\n")

    # Collect all (sku, variant_name_zh, variant_name_en) triples
    all_variants = []  # (sku, zh, en)
    for product in products:
        for v in product.get('variants', []):
            sku = v.get('sku', '')
            zh = v.get('variant_name_zh', '')
            en = v.get('variant_name_en', '')
            if sku and zh:
                all_variants.append({'sku': sku, 'zh': zh, 'en': en, 'variant': v})

    print(f"🏷️  Total variants: {len(all_variants)}")

    # Load translation cache
    cache = load_cache()

    # Determine which need (re-)translation
    to_translate = []  # indices into all_variants
    for i, v in enumerate(all_variants):
        cache_key = f"v2:{v['zh']}"  # v2 prefix = new prompt version
        if args.force or cache_key not in cache:
            to_translate.append(i)
        else:
            all_variants[i]['en_new'] = cache[cache_key]

    print(f"   Need translation: {len(to_translate)}")
    print(f"   From cache: {len(all_variants) - len(to_translate)}\n")

    # Translate
    if to_translate:
        if not DEEPSEEK_API_KEY:
            print("❌ DEEPSEEK_API_KEY not set in .env")
            sys.exit(1)

        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
        names_zh = [all_variants[i]['zh'] for i in to_translate]

        print(f"🚀 Translating {len(names_zh)} variants via DeepSeek...")
        translations = bulk_translate(client, names_zh)

        for i, (variant_idx, translation) in enumerate(zip(to_translate, translations)):
            all_variants[variant_idx]['en_new'] = translation
            cache_key = f"v2:{all_variants[variant_idx]['zh']}"
            cache[cache_key] = translation

        save_cache(cache)
        print(f"   ✅ Done — cache saved\n")

    # Apply cached translations for those that were cached
    for v in all_variants:
        if 'en_new' not in v:
            cache_key = f"v2:{v['zh']}"
            v['en_new'] = cache.get(cache_key, v['en'])

    # Show preview
    print("📋 Translation preview (first 10):")
    for v in all_variants[:10]:
        changed = "✏️ " if v['en_new'] != v['en'] else "  "
        print(f"  {changed} zh: {v['zh'][:40]:<40}  old: {v['en']:<30}  new: {v['en_new']}")
    if len(all_variants) > 10:
        changed_count = sum(1 for v in all_variants if v['en_new'] != v['en'])
        print(f"  ... ({len(all_variants)} total, {changed_count} changed)\n")

    if args.dry_run:
        print("\n✅ Dry run complete — no changes written.")
        return

    # Patch Knack
    print(f"\n🔧 Patching Knack records...")
    knack = KnackAPI()

    success = 0
    failed = 0
    skipped = 0

    for v in all_variants:
        sku = v['sku']
        zh = v['zh']
        en_new = v['en_new']

        # Find record by SKU
        try:
            record = knack.find_record(VARIANTS_OBJECT_KEY, VARIANT_FIELDS['sku'], sku)
        except Exception as e:
            print(f"   ❌ SKU lookup failed ({sku[:30]}): {e}")
            failed += 1
            continue

        if not record:
            print(f"   ⚠️  Not in Knack (SKU not found): {sku[:40]}")
            skipped += 1
            continue

        record_id = record.get('id', '')

        update_data = {
            VARIANT_FIELDS['variantName']: en_new,
            VARIANT_FIELDS['chineseName']: zh,
        }

        try:
            knack.update_record(VARIANTS_OBJECT_KEY, record_id, update_data)
            print(f"   ✅ {sku[:35]:<35}  → {en_new[:40]}")
            success += 1
        except Exception as e:
            print(f"   ❌ Update failed ({sku[:30]}): {e}")
            failed += 1

        time.sleep(0.15)  # respect Knack rate limits

    print(f"\n{'='*60}")
    print(f"📊 PATCH SUMMARY")
    print(f"{'='*60}")
    print(f"   ✅ Updated:  {success}")
    print(f"   ⚠️  Skipped:  {skipped}")
    print(f"   ❌ Failed:   {failed}")

    # Also update products.json with new translations
    print(f"\n💾 Updating products.json with new translations...")
    en_map = {v['sku']: v['en_new'] for v in all_variants}
    for product in products:
        for variant in product.get('variants', []):
            sku = variant.get('sku', '')
            if sku in en_map:
                variant['variant_name_en'] = en_map[sku]

    with open(PRODUCTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"   ✅ Saved to {PRODUCTS_JSON}")


if __name__ == '__main__':
    main()
