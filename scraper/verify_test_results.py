#!/usr/bin/env python3
"""
Verification script for scraper test results.
Checks:
1. Pricing accuracy (margins calculated correctly)
2. Image binding (variant-specific images exist)
3. Translation quality (milsim conventions applied)
4. Workflow completeness
"""

import os
import json
from pathlib import Path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'ai_scraper_output')
JSON_OUTPUT = os.path.join(OUTPUT_DIR, 'products.json')
MEDIA_DIR = os.path.join(OUTPUT_DIR, 'media')

# Pricing config from ai_scraper.py
PRICING_CONFIG = {
    'exchange_rate': 0.19,
    'shipping_cny': 30,
    'salesperson_cut': 0.10,
    'promoter_cut': 0.10,
    'target_margin': 0.30,
}

def calculate_expected_price_cad(price_cny: float) -> float:
    """Calculate expected CAD price"""
    cfg = PRICING_CONFIG
    cost_cny = price_cny + cfg['shipping_cny']
    cost_cad = cost_cny * cfg['exchange_rate']
    divisor = 1 - cfg['salesperson_cut'] - cfg['target_margin']
    sale_price_cad = cost_cad / divisor if divisor > 0 else cost_cad * 2
    return round(sale_price_cad) - 0.01

def check_pricing_accuracy(products: list) -> dict:
    """Verify pricing calculations"""
    results = {
        'total_variants': 0,
        'correct_pricing': 0,
        'incorrect_pricing': 0,
        'errors': []
    }
    
    for product in products:
        for variant in product.get('variants', []):
            results['total_variants'] += 1
            
            price_cny = variant.get('price_cny', 0)
            price_cad = variant.get('price_cad', 0)
            
            if price_cny > 0:
                expected_cad = calculate_expected_price_cad(price_cny)
                
                if abs(price_cad - expected_cad) < 0.02:  # Allow 2 cent difference
                    results['correct_pricing'] += 1
                else:
                    results['incorrect_pricing'] += 1
                    results['errors'].append({
                        'product': product.get('title_en', ''),
                        'variant': variant.get('name_en', ''),
                        'price_cny': price_cny,
                        'expected_cad': expected_cad,
                        'actual_cad': price_cad,
                        'difference': abs(price_cad - expected_cad)
                    })
    
    return results

def check_image_binding(products: list) -> dict:
    """Verify variant-specific images"""
    results = {
        'total_variants': 0,
        'variants_with_images': 0,
        'variants_without_images': 0,
        'unique_image_count': 0,
        'shared_images_only': 0,
        'errors': []
    }
    
    for product in products:
        all_variant_images = set()
        
        for variant in product.get('variants', []):
            results['total_variants'] += 1
            
            image_ids = variant.get('image_ids', [])
            
            if image_ids:
                results['variants_with_images'] += 1
                all_variant_images.update(image_ids)
            else:
                results['variants_without_images'] += 1
                results['errors'].append({
                    'product': product.get('title_en', ''),
                    'variant': variant.get('name_en', ''),
                    'issue': 'No images assigned'
                })
        
        # Check if variants have unique images
        if len(product.get('variants', [])) > 1:
            image_counts = {}
            for variant in product['variants']:
                for img_id in variant.get('image_ids', []):
                    image_counts[img_id] = image_counts.get(img_id, 0) + 1
            
            # Count how many images are unique to single variants
            unique_images = sum(1 for count in image_counts.values() if count == 1)
            results['unique_image_count'] += unique_images
            
            # Check if all variants share all images (broken binding)
            if unique_images == 0 and len(image_counts) > 0:
                results['shared_images_only'] += len(product['variants'])
    
    return results

def check_translation_quality(products: list) -> dict:
    """Verify milsim naming conventions applied"""
    results = {
        'total_products': len(products),
        'total_variants': 0,
        'good_translations': 0,
        'questionable_translations': 0,
        'errors': []
    }
    
    # Marketing fluff that should be removed
    bad_terms = ['爆款', '正品', '外贸', 'hot sale', 'premium', 'high quality', 
                 'factory direct', 'OEM', 'tactical' ]  # "tactical" alone is generic
    
    # Good milsim terms
    good_terms = ['Black', 'Tan', 'OD Green', 'Wolf Grey', 'Coyote Brown', 
                  'Ranger Green', 'FDE', 'MultiCam', 'QD', 'Picatinny', 
                  'MOLLE', 'Plate Carrier', 'NVG', 'Mount']
    
    for product in products:
        title_en = product.get('title_en', '').lower()
        
        # Check for bad terms in title
        has_bad_terms = any(term.lower() in title_en for term in bad_terms)
        has_good_terms = any(term.lower() in title_en for term in good_terms)
        
        for variant in product.get('variants', []):
            results['total_variants'] += 1
            
            name_en = variant.get('name_en', '').lower()
            
            # Check if translation seems good
            if (not has_bad_terms or has_good_terms) and name_en:
                results['good_translations'] += 1
            else:
                results['questionable_translations'] += 1
                if has_bad_terms:
                    results['errors'].append({
                        'product': product.get('title_en', ''),
                        'variant': variant.get('name_en', ''),
                        'issue': 'Contains marketing fluff terms'
                    })
    
    return results

def check_workflow_completeness(products: list) -> dict:
    """Verify all workflow phases completed"""
    results = {
        'total_products': len(products),
        'complete_products': 0,
        'incomplete_products': 0,
        'errors': []
    }
    
    for product in products:
        has_title = bool(product.get('title_en'))
        has_variants = len(product.get('variants', [])) > 0
        has_images = len(product.get('images', {}).get('Main', [])) > 0
        
        # Check if at least one variant has price and images
        variant_complete = False
        for variant in product.get('variants', []):
            if variant.get('price_cny', 0) > 0 and len(variant.get('image_ids', [])) > 0:
                variant_complete = True
                break
        
        if has_title and has_variants and has_images and variant_complete:
            results['complete_products'] += 1
        else:
            results['incomplete_products'] += 1
            issues = []
            if not has_title: issues.append('Missing title')
            if not has_variants: issues.append('No variants')
            if not has_images: issues.append('No images')
            if not variant_complete: issues.append('Variants incomplete')
            
            results['errors'].append({
                'product': product.get('url', ''),
                'issues': issues
            })
    
    return results

def main():
    print("=" * 80)
    print("🔍 SCRAPER TEST VERIFICATION")
    print("=" * 80)
    print()
    
    # Load results
    if not os.path.exists(JSON_OUTPUT):
        print(f"❌ Results file not found: {JSON_OUTPUT}")
        print("   Run the scraper test first!")
        return
    
    with open(JSON_OUTPUT, 'r') as f:
        data = json.load(f)
    
    # Handle both formats: {"products": [...]} or [...]
    if isinstance(data, dict) and 'products' in data:
        products = data['products']
    elif isinstance(data, list):
        products = data
    else:
        print(f"❌ Unexpected JSON format")
        return
    
    print(f"📊 Loaded {len(products)} products from results\n")
    
    # Run checks
    print("1️⃣  Checking Pricing Accuracy...")
    pricing_results = check_pricing_accuracy(products)
    print(f"   ✅ Correct: {pricing_results['correct_pricing']}/{pricing_results['total_variants']}")
    print(f"   ❌ Incorrect: {pricing_results['incorrect_pricing']}/{pricing_results['total_variants']}")
    if pricing_results['errors']:
        print(f"   ⚠️  {len(pricing_results['errors'])} pricing errors found")
        for err in pricing_results['errors'][:3]:  # Show first 3
            print(f"      - {err['product']} / {err['variant']}: ¥{err['price_cny']} → expected ${err['expected_cad']:.2f}, got ${err['actual_cad']:.2f}")
    print()
    
    print("2️⃣  Checking Image Binding...")
    image_results = check_image_binding(products)
    print(f"   ✅ Variants with images: {image_results['variants_with_images']}/{image_results['total_variants']}")
    print(f"   📸 Unique variant images: {image_results['unique_image_count']}")
    print(f"   ⚠️  Variants sharing all images: {image_results['shared_images_only']}")
    if image_results['errors']:
        print(f"   ❌ {len(image_results['errors'])} image binding errors")
    print()
    
    print("3️⃣  Checking Translation Quality...")
    translation_results = check_translation_quality(products)
    print(f"   ✅ Good translations: {translation_results['good_translations']}/{translation_results['total_variants']}")
    print(f"   ⚠️  Questionable: {translation_results['questionable_translations']}/{translation_results['total_variants']}")
    if translation_results['errors']:
        print(f"   ⚠️  {len(translation_results['errors'])} translation issues found")
    print()
    
    print("4️⃣  Checking Workflow Completeness...")
    workflow_results = check_workflow_completeness(products)
    print(f"   ✅ Complete products: {workflow_results['complete_products']}/{workflow_results['total_products']}")
    print(f"   ❌ Incomplete: {workflow_results['incomplete_products']}/{workflow_results['total_products']}")
    if workflow_results['errors']:
        print(f"   Issues:")
        for err in workflow_results['errors'][:5]:  # Show first 5
            print(f"      - {err['product'][:60]}...")
            print(f"        {', '.join(err['issues'])}")
    print()
    
    # Overall assessment
    print("=" * 80)
    print("📋 OVERALL ASSESSMENT")
    print("=" * 80)
    
    pricing_rate = pricing_results['correct_pricing'] / max(pricing_results['total_variants'], 1)
    image_rate = image_results['variants_with_images'] / max(image_results['total_variants'], 1)
    translation_rate = translation_results['good_translations'] / max(translation_results['total_variants'], 1)
    completeness_rate = workflow_results['complete_products'] / max(workflow_results['total_products'], 1)
    
    print(f"Pricing Accuracy:    {pricing_rate*100:.1f}% {'✅' if pricing_rate > 0.95 else '⚠️'}")
    print(f"Image Binding:       {image_rate*100:.1f}% {'✅' if image_rate > 0.90 else '⚠️'}")
    print(f"Translation Quality: {translation_rate*100:.1f}% {'✅' if translation_rate > 0.80 else '⚠️'}")
    print(f"Workflow Complete:   {completeness_rate*100:.1f}% {'✅' if completeness_rate > 0.90 else '⚠️'}")
    
    overall_score = (pricing_rate + image_rate + translation_rate + completeness_rate) / 4
    print(f"\nOverall Score:       {overall_score*100:.1f}%")
    
    if overall_score > 0.90:
        print("\n🎉 EXCELLENT! Scraper V2 working as expected!")
    elif overall_score > 0.75:
        print("\n✅ GOOD! Some minor issues to address.")
    else:
        print("\n⚠️  NEEDS WORK! Review errors above.")
    
    print("=" * 80)

if __name__ == '__main__':
    main()
