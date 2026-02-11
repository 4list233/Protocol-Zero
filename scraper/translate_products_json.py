#!/usr/bin/env python3
"""
Translate Chinese text in products.json to English using Gemini AI.

Usage:
    python3 translate_products_json.py
    python3 translate_products_json.py --force  # Re-translate even if English exists
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Add utilities to path for translation functions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'utilities'))

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_AI_API_KEY')
if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY not found in .env")
    sys.exit(1)

genai.configure(api_key=GEMINI_API_KEY)

# Use translate.py's translation logic
from translate import (
    TRANSLATION_PROMPT,
    VARIANT_PROMPT,
    contains_chinese,
    load_cache,
    save_cache
)

# Model fallback cascade - USE ALL AVAILABLE MODELS
# Priority: Unused → Light usage → Heavy usage
all_models = [
    "gemini-3-flash-preview",         # Tier 1: Gemini 3 Flash (0/20 RPD - unused)
    "gemini-2.5-flash-lite",          # Tier 2: Flash Lite (1/20 RPD - barely used!)
    "gemini-2.0-flash",               # Tier 3: 2.0 Flash (likely unused)
    "gemini-2.0-flash-001",           # Tier 4: 2.0 Flash variant
    "gemini-2.0-flash-lite",          # Tier 5: 2.0 Lite
    "gemini-2.0-flash-lite-001",      # Tier 6: 2.0 Lite variant
    "gemini-exp-1206",                # Tier 7: Experimental model
    "gemini-flash-latest",            # Tier 8: Latest alias
    "gemini-flash-lite-latest",       # Tier 9: Lite latest alias
    "gemini-2.5-flash",               # Tier 10: Already used 16/20 RPD
    "gemini-2.5-pro",                 # Tier 11: Pro model (last resort)
    "gemini-pro-latest",              # Tier 12: Pro latest (final fallback)
]
current_model_index = [0]  # Mutable to track across function calls

print(f"✅ Starting with model: {all_models[current_model_index[0]]}")
print(f"📋 Fallback chain ({len(all_models)} models): {' → '.join(all_models[:5])}... → {all_models[-1]}")


def get_current_model():
    """Get the current active model instance."""
    return genai.GenerativeModel(all_models[current_model_index[0]])


def switch_to_next_model():
    """Switch to next model in the cascade when quota exceeded."""
    if current_model_index[0] < len(all_models) - 1:
        current_model_index[0] += 1
        print(f"   🔄 Switching to: {all_models[current_model_index[0]]} (model {current_model_index[0]+1}/{len(all_models)})")
        return True
    return False


def translate_text(text_zh: str, cache: dict, is_variant: bool = False) -> str:
    """Translate Chinese text to English using Gemini with model fallback."""
    if not contains_chinese(text_zh):
        return text_zh
    
    # Check cache
    cache_key = f"variant:{text_zh}" if is_variant else text_zh
    if cache_key in cache:
        return cache[cache_key]
    
    # Try ALL models in the cascade (not just 3 attempts)
    attempts_per_model = 2  # Retry each model twice if transient errors
    models_tried = 0
    
    while models_tried < len(all_models):
        for attempt in range(attempts_per_model):
            try:
                if is_variant:
                    prompt = VARIANT_PROMPT.format(variant_zh=text_zh)
                else:
                    prompt = TRANSLATION_PROMPT.format(title_zh=text_zh)
                
                # Get current model dynamically (respects model switches)
                current_model = get_current_model()
                response = current_model.generate_content(prompt)
                text_en = response.text.strip()
                text_en = text_en.replace('**', '').replace('*', '').strip()
                
                # Cache result
                cache[cache_key] = text_en
                save_cache(cache)
                
                time.sleep(0.5)  # Rate limiting
                return text_en
                
            except Exception as e:
                error_str = str(e)
                
                # Check for quota/rate limit errors (429) - switch model immediately
                if "429" in error_str or "quota" in error_str.lower() or "rate limit" in error_str.lower():
                    # Log which quota is actually exceeded
                    if "per day" in error_str.lower() or "daily" in error_str.lower():
                        print(f"   ⚠️  Daily quota exceeded for {all_models[current_model_index[0]]}")
                    elif "per minute" in error_str.lower():
                        print(f"   ⚠️  Per-minute limit for {all_models[current_model_index[0]]}")
                    else:
                        print(f"   ⚠️  Rate limit for {all_models[current_model_index[0]]}: {error_str[:100]}")
                    
                    # Don't wait - switch to next model immediately
                    if switch_to_next_model():
                        print(f"   🔄 Rate limit hit, switching model...")
                        models_tried += 1
                        time.sleep(2)  # Longer cooldown between model switches
                        break  # Break inner loop, continue outer loop with new model
                    else:
                        print(f"   ⚠️  All {len(all_models)} models exhausted")
                        print(f"   💡 All quotas depleted. Wait ~24hrs or upgrade API plan.")
                        return text_zh  # Return original - no more models to try
                
                elif "404" in error_str or "not found" in error_str.lower():
                    # Model not found - try next model immediately
                    if switch_to_next_model():
                        print(f"   🔄 Model not found, trying next...")
                        models_tried += 1
                        break  # Break inner loop, continue outer loop with new model
                    else:
                        print(f"   ⚠️  No more models available")
                        return text_zh
                
                else:
                    # Other errors - retry same model if attempts remaining
                    if attempt < attempts_per_model - 1:
                        print(f"   ⚠️  Error (retry {attempt+1}/{attempts_per_model}): {str(e)[:100]}")
                        time.sleep(2)
                        continue
                    else:
                        # Out of retries for this model, try next
                        print(f"   ⚠️  Translation error: {e}")
                        if switch_to_next_model():
                            print(f"   🔄 Trying next model after error...")
                            models_tried += 1
                            break
                        else:
                            return text_zh
        
        # If we get here without returning, increment models_tried for safety
        if models_tried < len(all_models):
            models_tried += 1
    
    return text_zh


def translate_products_json(input_file: str = 'ai_scraper_output/products.json',
                           output_file: str = None,
                           force: bool = False):
    """Translate products.json file."""
    
    # Default output file
    if not output_file:
        output_file = input_file.replace('.json', '_translated.json')
    
    print(f"\n{'='*60}")
    print(f"🌐 TRANSLATE PRODUCTS.JSON")
    print(f"{'='*60}")
    print(f"Input:  {input_file}")
    print(f"Output: {output_file}")
    print(f"Force:  {force}")
    print()
    
    # Load products.json
    if not os.path.exists(input_file):
        print(f"❌ File not found: {input_file}")
        return
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    products = data.get('products', [])
    print(f"📦 Found {len(products)} products\n")
    
    # Load translation cache
    cache = load_cache()
    
    # Track statistics
    products_translated = 0
    variants_translated = 0
    skipped = 0
    
    # Process each product
    for i, product in enumerate(products, 1):
        title_zh = product.get('title_zh', '')
        title_en = product.get('title_en', '')
        
        # Skip "登录" (login) pages
        if title_zh == '登录':
            print(f"[{i}/{len(products)}] ⚠️  Skipping login page")
            skipped += 1
            continue
        
        print(f"[{i}/{len(products)}] {title_zh[:50]}...")
        
        # Translate product title if needed
        if force or not title_en or contains_chinese(title_en):
            print(f"   🌐 Translating title...")
            product['title_en'] = translate_text(title_zh, cache, is_variant=False)
            products_translated += 1
            print(f"      → {product['title_en']}")
        
        # Translate variants
        variants = product.get('variants', [])
        for v in variants:
            variant_zh = v.get('variant_name_zh', '')
            variant_en = v.get('variant_name_en', '')
            
            if force or not variant_en or contains_chinese(variant_en):
                v['variant_name_en'] = translate_text(variant_zh, cache, is_variant=True)
                variants_translated += 1
    
    # Save translated file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ TRANSLATION COMPLETE")
    print(f"{'='*60}")
    print(f"Products translated: {products_translated}")
    print(f"Variants translated: {variants_translated}")
    print(f"Skipped (login pages): {skipped}")
    print(f"\n💾 Saved to: {output_file}")
    
    if output_file != input_file:
        print(f"\n💡 To use this file for upload, either:")
        print(f"   1. Replace original: mv {output_file} {input_file}")
        print(f"   2. Or backup and rename: mv {input_file} {input_file}.backup && mv {output_file} {input_file}")


def main():
    parser = argparse.ArgumentParser(
        description='Translate Chinese text in products.json to English'
    )
    parser.add_argument('--input', default='ai_scraper_output/products.json',
                       help='Input JSON file path')
    parser.add_argument('--output', help='Output JSON file path (default: input_translated.json)')
    parser.add_argument('--force', action='store_true',
                       help='Re-translate even if English translation exists')
    
    args = parser.parse_args()
    
    translate_products_json(
        input_file=args.input,
        output_file=args.output,
        force=args.force
    )


if __name__ == '__main__':
    main()
