#!/usr/bin/env python3
"""
Translate Chinese product titles to English using Gemini AI.
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
from typing import Dict, Optional
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-pro"  # More capable reasoning for military terminology
CACHE_FILE = Path("translation_cache.json")
DEFAULT_CSV = Path("protocol_zero_variants.csv")

# Initialize Gemini
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(GEMINI_MODEL)

# Translation prompt template
TRANSLATION_PROMPT = """You are an expert translator specializing in airsoft and military equipment terminology.

Translate the following Chinese product title into English. Follow these rules:

1. REMOVE ALL BRAND NAMES (e.g., WOSPORT, FMA, TMC, Emerson, Condor, 5.11, etc.) - this is a private label shop

2. REMOVE PROPRIETARY MODEL NUMBERS that are brand-specific alphanumeric codes:
   - Remove: L4G24, HLD-2, TB-FMA-0023, etc. (these are manufacturer SKUs)
   
3. KEEP AUTHENTIC MILITARY DESIGNATIONS (these are standardized across the industry):
   - Keep: PVS-14, PVS-31, AN/PEQ-15, MICH 2000, FAST helmet, M4, AK, etc.
   - Keep: Gen 2, Gen 3 (generation numbers for real equipment)
   - Keep: Standard sizes like 6094, AVS, JPC (plate carrier models)
   - Keep: Wilcox standards like L4G24, L4G19, G24, etc. (these are industry-standard NVG mount models)
   - Keep: ARMS mount numbers like #17, #22, etc.
   
4. How to distinguish:
   - Military models: Used worldwide, found in military manuals, standardized naming
   - Brand models: Random letters/numbers unique to that manufacturer
   
5. Keep military/airsoft acronyms unchanged: MOLLE, NVG, PVS, RIS, MLOK, Picatinny, QD (Quick Detach), etc.

6. Use standard airsoft terminology (not literal translations)

7. Be concise and suitable for e-commerce product listings

8. DO NOT add extra explanations, just return the translated title

Chinese Title: {title_zh}

English Translation:"""


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


def translate_with_gemini(title_zh: str, cache: Dict[str, str]) -> str:
    """
    Translate Chinese title to English using Gemini.
    Uses cache to avoid re-translating.
    """
    # Check cache first
    if title_zh in cache:
        return cache[title_zh]
    
    # Translate with Gemini
    try:
        prompt = TRANSLATION_PROMPT.format(title_zh=title_zh)
        response = model.generate_content(prompt)
        title_en = response.text.strip()
        
        # Clean up any markdown or extra formatting
        title_en = title_en.replace('**', '').replace('*', '').strip()
        
        # Cache the result
        cache[title_zh] = title_en
        save_cache(cache)
        
        return title_en
    
    except Exception as e:
        print(f"❌ Translation error for '{title_zh}': {e}")
        return title_zh  # Return original if translation fails


def translate_csv(input_csv: Path, force: bool = False):
    """
    Translate all Chinese titles in CSV file.
    Updates the 'Translated Title' column.
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
        fieldnames = reader.fieldnames
    
    if 'Product Title ZH' not in fieldnames:
        print("❌ Error: CSV missing 'Product Title ZH' column")
        return
    
    if 'Translated Title' not in fieldnames:
        print("⚠️  Warning: 'Translated Title' column not found, will add it")
        fieldnames = list(fieldnames)
        fieldnames.insert(fieldnames.index('Product Title ZH') + 1, 'Translated Title')
        for row in rows:
            row['Translated Title'] = ''
    
    # Translate rows
    translated_count = 0
    skipped_count = 0
    
    print(f"\n🌐 Translating {len(rows)} products...")
    
    for i, row in enumerate(rows, 1):
        title_zh = row.get('Product Title ZH', '').strip()
        title_en = row.get('Translated Title', '').strip()
        
        # Skip if already translated (unless force mode)
        if title_en and not force:
            print(f"  [{i}/{len(rows)}] ⏭️  Skipped: {title_zh[:50]}...")
            skipped_count += 1
            continue
        
        # Skip if no Chinese title
        if not title_zh:
            print(f"  [{i}/{len(rows)}] ⚠️  Empty Chinese title, skipping")
            skipped_count += 1
            continue
        
        # Translate
        print(f"  [{i}/{len(rows)}] 🔄 Translating: {title_zh[:50]}...")
        title_en = translate_with_gemini(title_zh, cache)
        row['Translated Title'] = title_en
        print(f"              ✅ Result: {title_en[:60]}...")
        translated_count += 1
        
        # Rate limiting (Gemini free tier: 15 requests/minute)
        if translated_count % 10 == 0:
            print("    ⏸️  Pausing 5s to respect rate limits...")
            time.sleep(5)
        else:
            time.sleep(0.5)
    
    # Write updated CSV
    print(f"\n💾 Writing updated CSV...")
    with open(input_csv, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"\n✅ Translation complete!")
    print(f"   Translated: {translated_count}")
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
