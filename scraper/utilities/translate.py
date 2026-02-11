#!/usr/bin/env python3
"""
Translate Chinese product titles and variant names to English using Gemini AI.
Specialized for airsoft/military equipment terminology.

Usage:
    python3 translate.py                    # Translate untranslated rows in protocol_zero_variants.csv
    python3 translate.py --force            # Re-translate all rows
    python3 translate.py --input custom.csv # Translate specific CSV
"""

import os
import csv
import json
import time
import re
from typing import Dict, Optional
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from root .env file
root_dir = Path(__file__).parent.parent
load_dotenv(dotenv_path=root_dir / '.env')

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Model priority: gemini-2.5-pro -> gemini-2.5-flash -> gemini-2.0-flash
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
CACHE_FILE = Path("translation_cache.json")
DEFAULT_CSV = Path("protocol_zero_variants.csv")

# Initialize Gemini
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

genai.configure(api_key=GEMINI_API_KEY)

# Model priority: gemini-2.5-pro -> gemini-2.5-flash -> gemini-2.0-flash
FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"]
current_model_index = 0
all_models = [GEMINI_MODEL] + FALLBACK_MODELS

# Initialize first model
model = genai.GenerativeModel(all_models[current_model_index])
print(f"✅ Using model: {all_models[current_model_index]}")

def get_current_model():
    """Get the current model instance."""
    return model

def switch_to_next_model():
    """Switch to the next fallback model if quota is exceeded."""
    global model, current_model_index
    if current_model_index < len(all_models) - 1:
        current_model_index += 1
        model = genai.GenerativeModel(all_models[current_model_index])
        print(f"   🔄 Switched to fallback model: {all_models[current_model_index]}")
        return True
    return False

# Translation prompt template
TRANSLATION_PROMPT = """You are an expert translator specializing in airsoft and military equipment terminology.

Translate the following Chinese product title into English. Follow these rules:

1. REMOVE ALL THIRD-PARTY BRAND NAMES (this is a private label shop):
   - Chinese brands: WOSPORT (战术者), FMA, TMC, WUKONG (悟空), JUNMA (骏马), etc.
   - Western brands: Emerson, Condor, 5.11, Blackhawk, Safariland, etc.
   - Generic OEM brands: Any manufacturer/brand identifiers
   - Rule: If it's a company/brand selling products, REMOVE IT

2. REMOVE PROPRIETARY MODEL NUMBERS (brand-specific SKUs):
   - Remove: HLD-2, TB-FMA-0023, WS-12345 (random manufacturer codes)
   - These are unique to specific manufacturers, not industry standards
   
3. KEEP AUTHENTIC MILITARY DESIGNATIONS (standardized across industry):
   - Night Vision: PVS-14, PVS-31, PVS-7, AN/PVS-14, ANVIS
   - Helmets: MICH 2000, FAST helmet, ACH, PASGT, Ops-Core
   - Weapons: M4, AK-47, AK-74, MP5, G36, etc.
   - Optics/Lasers: AN/PEQ-15, ACOG, EOTech, Aimpoint
   - Plate Carriers: 6094, JPC (Jumpable Plate Carrier), AVS, CPC
   - NVG Mounts: L4G24, L4G19, G24 (Wilcox industry standards)
   - Rail Systems: RIS, RAS, MLOK, KeyMod, Picatinny
   - Mount Numbers: ARMS #17, ARMS #22, etc.
   
4. How to distinguish Military vs Brand:
   - Military: Used in military manuals, NATO/US military designations, standardized globally
   - Brand: Proprietary codes/names owned by one manufacturer
   - Example: "PVS-14" = military standard (KEEP), "WS-PVS-14" = brand version (remove "WS-")
   
5. KEEP MILITARY ACRONYMS:
   - MOLLE, NVG, IR, PVS, QD (Quick Detach), RIS, MLOK, Picatinny, etc.

6. Use standard airsoft/tactical terminology (not literal translations)

7. Be concise and suitable for e-commerce product listings

8. DO NOT add extra explanations, just return the translated title

Examples:
- "WOSPORT战术头盔" → "Tactical Helmet" (remove WOSPORT)
- "FMA PVS-14夜视仪" → "PVS-14 Night Vision" (remove FMA, keep PVS-14)
- "6094战术背心" → "6094 Plate Carrier" (keep 6094)

Chinese Title: {title_zh}

English Translation:"""

# Variant name translation prompt (simpler - usually just colors/sizes)
VARIANT_PROMPT = """You are an expert translator specializing in airsoft and military equipment terminology.

Translate the following Chinese variant/option name into English. This is usually a color, size, or material option.

Rules:
1. Translate ALL Chinese text to English - do not leave any Chinese characters
2. Keep standard color names: Black, Tan, OD Green, Coyote Brown, Wolf Gray, etc.
3. Keep standard sizes: Small, Medium, Large, etc.
4. Keep material names: Aluminum, Steel, Nylon, Cordura, etc.
5. Remove brand-specific codes and model numbers if they're not standard military designations
6. Be concise - usually just 1-5 words
7. DO NOT add extra explanations, just return the translated variant name
8. If there are brackets or special characters, translate the content inside them too

Examples:
- "黑色" -> "Black"
- "金属泥色" -> "Metal Tan"
- "【考度拉】狼棕色 CB" -> "Cordura Coyote Brown"
- "BK黑色（除雾器）" -> "Black (Anti-Fog Device)"
- "三块镜片" -> "Three Lenses"

Chinese Variant Name: {variant_zh}

English Translation:"""


def contains_chinese(text: str) -> bool:
    """Check if text contains Chinese characters."""
    chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
    return bool(chinese_pattern.search(text))


def load_cache() -> Dict[str, str]:
    """Load translation cache from JSON file."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Warning: Could not load cache: {e}")
    return {}


def save_cache(cache: Dict[str, str]):
    """Save translation cache to JSON file."""
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def translate_with_gemini(text_zh: str, cache: Dict[str, str], is_variant: bool = False, max_retries: int = 3) -> str:
    """
    Translate Chinese text to English using Gemini.
    Uses cache to avoid re-translating.
    Handles rate limits and quota errors with retry logic.
    Automatically switches to fallback models if quota is exceeded.
    
    Args:
        text_zh: Chinese text to translate
        cache: Translation cache dictionary
        is_variant: If True, use variant prompt (simpler), else use product title prompt
        max_retries: Maximum number of retry attempts for rate limit errors
    """
    global model, current_model_index, all_models
    # Check cache first (use a prefix to distinguish product titles from variants)
    cache_key = f"variant:{text_zh}" if is_variant else text_zh
    if cache_key in cache:
        return cache[cache_key]
    
    # Translate with Gemini (with retry logic for rate limits)
    for attempt in range(max_retries):
        try:
            if is_variant:
                prompt = VARIANT_PROMPT.format(variant_zh=text_zh)
            else:
                prompt = TRANSLATION_PROMPT.format(title_zh=text_zh)
            
            response = model.generate_content(prompt)
            text_en = response.text.strip()
            
            # Clean up any markdown or extra formatting
            text_en = text_en.replace('**', '').replace('*', '').strip()
            
            # Cache the result
            cache[cache_key] = text_en
            save_cache(cache)
            
            return text_en
        
        except Exception as e:
            error_str = str(e)
            
            # Check for quota/rate limit errors
            if "429" in error_str or "quota" in error_str.lower() or "rate limit" in error_str.lower():
                # Check if it's a daily quota (won't reset with retry)
                if "per day" in error_str.lower() or "daily" in error_str.lower() or "limit: 50" in error_str:
                    # Try switching to next model if available
                    if switch_to_next_model():
                        print(f"   🔄 Retrying with fallback model...")
                        continue  # Retry with new model
                    else:
                        print(f"   ⚠️  Daily quota exceeded for '{text_zh[:50]}...'")
                        print(f"   💡 All models have exceeded quota. Quota resets daily.")
                        print(f"   💡 Options: 1) Wait for quota reset, 2) Upgrade API plan, 3) Continue tomorrow")
                        return text_zh  # Return original - no more models to try
                
                # Rate limit (temporary) - can retry
                if attempt < max_retries - 1:
                    # Extract retry delay if available
                    import re
                    delay_match = re.search(r'retry.*?(\d+)', error_str, re.IGNORECASE)
                    delay = int(delay_match.group(1)) if delay_match else (60 * (attempt + 1))  # Default: 60s, 120s, 180s
                    
                    print(f"   ⏸️  Rate limit exceeded. Waiting {delay}s before retry {attempt + 1}/{max_retries}...")
                    time.sleep(delay)
                    continue
                else:
                    print(f"❌ Translation failed after {max_retries} retries (rate limit): '{text_zh[:50]}...'")
                    return text_zh  # Return original if all retries fail
            elif "404" in error_str or "not found" in error_str.lower():
                # Model not found - could be intermittent, retry once
                if attempt < max_retries - 1:
                    print(f"   ⚠️  API error (404) for '{text_zh[:50]}...', retrying...")
                    time.sleep(2)  # Short delay before retry
                    continue
                else:
                    print(f"❌ Model/API error after retries: '{text_zh[:50]}...'")
                    print(f"   💡 This might be a temporary API issue. The variant will keep its current translation.")
                    return text_zh
            else:
                # Other errors - don't retry
                print(f"❌ Translation error for '{text_zh[:50]}...': {e}")
                return text_zh  # Return original if translation fails
    
    # Should never reach here, but just in case
    return text_zh


def translate_csv(input_csv: Path, force: bool = False):
    """
    Translate all Chinese titles and variant names in CSV file.
    Updates the 'Translated Title' and 'Translated Option Name' columns.
    """
    if not input_csv.exists():
        print(f"❌ Error: CSV file not found: {input_csv}")
        return
    
    print(f"📄 Reading CSV: {input_csv}")
    
    # Load cache
    cache = load_cache()
    print(f"💾 Loaded {len(cache)} cached translations")
    
    # Read CSV
    with open(input_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = list(reader.fieldnames)
    
    if 'Product Title ZH' not in fieldnames:
        print("❌ Error: CSV missing 'Product Title ZH' column")
        return
    
    # Add 'Translated Title' column if missing
    if 'Translated Title' not in fieldnames:
        print("⚠️  Warning: 'Translated Title' column not found, will add it")
        fieldnames.insert(fieldnames.index('Product Title ZH') + 1, 'Translated Title')
        for row in rows:
            row['Translated Title'] = ''
    
    # Add 'Translated Option Name' column if missing (for variants)
    if 'Option Name ZH' in fieldnames and 'Translated Option Name' not in fieldnames:
        print("⚠️  Warning: 'Translated Option Name' column not found, will add it")
        option_zh_idx = fieldnames.index('Option Name ZH')
        fieldnames.insert(option_zh_idx + 1, 'Translated Option Name')
        for row in rows:
            row['Translated Option Name'] = ''
    
    # Translate rows
    translated_titles = 0
    translated_variants = 0
    skipped_count = 0
    
    print(f"\n🌐 Translating {len(rows)} rows (products and variants)...")
    
    for i, row in enumerate(rows, 1):
        # Translate product title
        title_zh = row.get('Product Title ZH', '').strip()
        title_en = row.get('Translated Title', '').strip()
        
        if title_zh:
            if not title_en or force:
                print(f"  [{i}/{len(rows)}] 🔄 Translating product: {title_zh[:50]}...")
                title_en = translate_with_gemini(title_zh, cache, is_variant=False)
                row['Translated Title'] = title_en
                print(f"              ✅ Product: {title_en[:60]}...")
                translated_titles += 1
                
                # Rate limiting
                if translated_titles % 10 == 0:
                    print("    ⏸️  Pausing 5s to respect rate limits...")
                    time.sleep(5)
                else:
                    time.sleep(0.5)
            else:
                skipped_count += 1
        
        # Translate variant name (Option Name ZH)
        variant_zh = row.get('Option Name ZH', '').strip()
        variant_en = row.get('Translated Option Name', '').strip()
        
        if variant_zh:
            # Check if translation is needed:
            # 1. No translation exists, OR
            # 2. Force mode, OR
            # 3. Translation still contains Chinese characters (failed translation)
            needs_translation = (
                not variant_en or 
                force or 
                (variant_en and contains_chinese(variant_en))
            )
            
            if needs_translation:
                if contains_chinese(variant_en):
                    print(f"              🔄 Re-translating (still has Chinese): {variant_zh[:40]}...")
                else:
                    print(f"              🔄 Translating variant: {variant_zh[:40]}...")
                variant_en = translate_with_gemini(variant_zh, cache, is_variant=True)
                row['Translated Option Name'] = variant_en
                print(f"              ✅ Variant: {variant_en[:50]}...")
                translated_variants += 1
                
                # Rate limiting (separate from product titles)
                if translated_variants % 10 == 0:
                    print("    ⏸️  Pausing 5s to respect rate limits...")
                    time.sleep(5)
                else:
                    time.sleep(0.5)
        elif not title_zh:
            # Skip row if both are empty
            print(f"  [{i}/{len(rows)}] ⚠️  Empty row, skipping")
            skipped_count += 1
    
    # Write updated CSV
    print(f"\n💾 Writing updated CSV...")
    with open(input_csv, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"\n✅ Translation complete!")
    print(f"   Translated products: {translated_titles}")
    print(f"   Translated variants: {translated_variants}")
    print(f"   Skipped: {skipped_count}")
    print(f"   Total cache: {len(cache)} entries")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Translate product titles using Gemini AI")
    parser.add_argument('--input', type=Path, default=DEFAULT_CSV,
                        help=f"Input CSV file (default: {DEFAULT_CSV})")
    parser.add_argument('--force', action='store_true',
                        help="Re-translate all rows (ignore existing translations)")
    
    args = parser.parse_args()
    
    print("🤖 Protocol Zero - Gemini Translation Tool")
    print("=" * 60)
    
    translate_csv(args.input, force=args.force)


if __name__ == "__main__":
    main()
