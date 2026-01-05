#!/usr/bin/env python3
"""
Post-process translations for scraped products.
Translates titles and variant names that were missed during scraping.
"""

import os
import sys
import json
import time
import re
import requests
from typing import List, Dict

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output')
JSON_OUTPUT = os.path.join(OUTPUT_DIR, 'products.json')

# Load API key from shop/.env.local
from dotenv import load_dotenv
env_path = os.path.join(SCRIPT_DIR, '..', 'shop', '.env.local')
load_dotenv(env_path)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# API config
GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

def has_chinese(text: str) -> bool:
    return any('\u4e00' <= ch <= '\u9fff' for ch in text)

def translate_batch(texts: List[str]) -> List[str]:
    """Translate a batch of Chinese texts to English"""
    if not GEMINI_API_KEY:
        print("❌ No GEMINI_API_KEY found")
        return texts
    
    # Filter to Chinese-only texts
    chinese_texts = []
    chinese_indices = []
    for i, text in enumerate(texts):
        if has_chinese(text):
            chinese_texts.append(text)
            chinese_indices.append(i)
    
    if not chinese_texts:
        return texts
    
    print(f"   Translating {len(chinese_texts)} texts...")
    
    # Build prompt
    text_list = "\n".join([f"{i+1}. {t}" for i, t in enumerate(chinese_texts)])
    
    prompt = f"""Translate these Chinese tactical/airsoft product texts to English.

TEXTS:
{text_list}

RULES:
1. KEEP model numbers (HL-ACC-73-T, L4G24, MK18, 6094)
2. REMOVE Chinese brand names (WOSPORT, WUKONG)
3. Use tactical terms: Plate Carrier, MOLLE, Pouch, Holster, Mount
4. Translate colors: Black, Tan, OD Green, Grey
5. Translate materials: Metal, Aluminum, Nylon, Polymer

RESPOND with numbered translations only:
1. [translation]
2. [translation]
..."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4000}
    }
    
    for model in GEMINI_MODELS:
        try:
            endpoint = f"{BASE_URL}/{model}:generateContent?key={GEMINI_API_KEY}"
            response = requests.post(endpoint, json=payload, timeout=60)
            
            if response.ok:
                result = response.json()
                text = result['candidates'][0]['content']['parts'][0]['text']
                
                # Parse numbered response
                translations = []
                for line in text.strip().split('\n'):
                    line = line.strip()
                    match = re.match(r'^\d+[\.\)]\s*(.+)$', line)
                    if match:
                        translations.append(match.group(1).strip())
                
                # Pad if needed
                while len(translations) < len(chinese_texts):
                    translations.append(chinese_texts[len(translations)])
                
                # Apply back
                output = list(texts)
                for orig_idx, trans in zip(chinese_indices, translations):
                    output[orig_idx] = trans
                
                return output
                
        except Exception as e:
            print(f"   ⚠️  {model} failed: {e}")
            continue
    
    return texts


def main():
    print("📝 POST-PROCESSING TRANSLATIONS")
    print("="*60)
    
    # Load products
    if not os.path.exists(JSON_OUTPUT):
        print(f"❌ No products.json found")
        return
    
    with open(JSON_OUTPUT, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    products = data.get('products', [])
    print(f"Loaded {len(products)} products")
    
    # Collect all titles that need translation
    titles_to_translate = []
    title_indices = []
    
    for i, p in enumerate(products):
        title_zh = p.get('title_zh', '')
        title_en = p.get('title_en', '')
        
        # Need translation if: no English title, or English still has Chinese
        if title_zh and (not title_en or has_chinese(title_en) or title_en == title_zh):
            titles_to_translate.append(title_zh)
            title_indices.append(i)
    
    print(f"Found {len(titles_to_translate)} titles needing translation")
    
    if titles_to_translate:
        # Translate in batches of 20
        batch_size = 20
        for batch_start in range(0, len(titles_to_translate), batch_size):
            batch = titles_to_translate[batch_start:batch_start + batch_size]
            batch_indices = title_indices[batch_start:batch_start + batch_size]
            
            translated = translate_batch(batch)
            
            for idx, trans in zip(batch_indices, translated):
                products[idx]['title_en'] = trans
                print(f"   {idx+1}. {trans[:60]}...")
            
            time.sleep(2)  # Rate limit
    
    # Collect variants needing translation
    variants_to_fix = []
    for p_idx, p in enumerate(products):
        for v_idx, v in enumerate(p.get('variants', [])):
            name_zh = v.get('variant_name_zh', '')
            name_en = v.get('variant_name_en', '')
            
            # Need translation if: has Chinese name AND (no English OR English has Chinese OR same as Chinese)
            if name_zh and (not name_en or has_chinese(name_en) or name_en == name_zh):
                variants_to_fix.append((p_idx, v_idx, name_zh))
    
    print(f"\nFound {len(variants_to_fix)} variants needing translation fix")
    
    if variants_to_fix:
        batch_size = 50
        for batch_start in range(0, len(variants_to_fix), batch_size):
            batch = variants_to_fix[batch_start:batch_start + batch_size]
            texts = [v[2] for v in batch]
            
            translated = translate_batch(texts)
            
            for (p_idx, v_idx, _), trans in zip(batch, translated):
                products[p_idx]['variants'][v_idx]['variant_name_en'] = trans
            
            print(f"   Batch {batch_start//batch_size + 1}: {len(batch)} variants")
            time.sleep(2)
    
    # Save updated products
    data['products'] = products
    data['post_processed'] = True
    
    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Saved updated products to {JSON_OUTPUT}")


if __name__ == '__main__':
    main()
