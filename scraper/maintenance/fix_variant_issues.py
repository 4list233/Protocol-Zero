#!/usr/bin/env python3
"""
Identify and fix problematic variants in Knack database
- Translation errors (Chinese text remaining)
- Pricing errors (outliers, missing data)
- Broken formatting
- Non-setup variants
"""

from knack_integration import KnackAPI, VARIANTS_OBJECT_KEY, PRODUCTS_OBJECT_KEY, VARIANT_FIELDS, PRODUCT_FIELDS
import re
from typing import List, Dict, Any

api = KnackAPI()

def has_chinese(text: str) -> bool:
    """Check if text contains Chinese characters"""
    if not text:
        return False
    return any('\u4e00' <= c <= '\u9fff' for c in text)

def analyze_variants() -> Dict[str, List[Dict[str, Any]]]:
    """Analyze all variants and categorize issues"""
    print("📥 Fetching all variants...")
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    products = api.get_all_records(PRODUCTS_OBJECT_KEY)
    
    # Create product lookup
    product_lookup = {p['id']: p for p in products}
    
    issues = {
        'chinese_text': [],
        'missing_price': [],
        'invalid_margin': [],
        'missing_options': [],
        'pricing_outliers': [],
        'broken_format': [],
        'no_product_connection': [],
    }
    
    print(f"📋 Analyzing {len(variants)} variants...\n")
    
    prices = []
    for v in variants:
        variant_id = v.get('id', '')
        variant_name = v.get(VARIANT_FIELDS['variantName'], '')
        price_cny = v.get(VARIANT_FIELDS['priceCny'], '')
        price_cad = v.get(VARIANT_FIELDS['priceCad'], '')
        margin = v.get(VARIANT_FIELDS['marginStandard'], '')
        option1_type = v.get(VARIANT_FIELDS['optionType1'], '')
        option1_value = v.get(VARIANT_FIELDS['optionValue1'], '')
        product_conn = v.get(VARIANT_FIELDS['product'], '')
        status = v.get(VARIANT_FIELDS['status'], '')
        
        variant_info = {
            'id': variant_id,
            'name': variant_name,
            'price_cny': price_cny,
            'price_cad': price_cad,
            'margin': margin,
            'status': status,
        }
        
        # Check for Chinese text
        if has_chinese(variant_name):
            issues['chinese_text'].append(variant_info)
        
        # Check for missing price
        if not price_cny or not price_cad:
            issues['missing_price'].append(variant_info)
        else:
            try:
                prices.append(float(price_cad))
            except:
                pass
        
        # Check for invalid margin
        try:
            m = float(margin) if margin else 0
            if m < 0 or m > 1:
                issues['invalid_margin'].append(variant_info)
        except:
            if margin:  # Has margin but can't parse
                issues['invalid_margin'].append(variant_info)
        
        # Check for missing options
        if not option1_type or not option1_value:
            issues['missing_options'].append(variant_info)
        
        # Check for broken format (no slashes or proper structure)
        if variant_name and '/' not in variant_name and len(variant_name) > 5:
            # Might be untranslated or improperly formatted
            issues['broken_format'].append(variant_info)
        
        # Check for no product connection
        if not product_conn:
            issues['no_product_connection'].append(variant_info)
    
    # Identify pricing outliers (>3 standard deviations from mean)
    if prices:
        import statistics
        mean_price = statistics.mean(prices)
        stdev_price = statistics.stdev(prices) if len(prices) > 1 else 0
        
        for v in variants:
            price_cad = v.get(VARIANT_FIELDS['priceCad'], '')
            try:
                p = float(price_cad)
                if stdev_price > 0 and abs(p - mean_price) > 3 * stdev_price:
                    issues['pricing_outliers'].append({
                        'id': v.get('id'),
                        'name': v.get(VARIANT_FIELDS['variantName'], ''),
                        'price_cad': price_cad,
                        'mean_price': round(mean_price, 2),
                        'deviation': round(abs(p - mean_price) / stdev_price, 2)
                    })
            except:
                pass
    
    return issues

def print_summary(issues: Dict[str, List[Dict[str, Any]]]):
    """Print summary of issues"""
    print("=" * 60)
    print("📊 VARIANT ISSUES SUMMARY")
    print("=" * 60)
    
    total_issues = sum(len(v) for v in issues.values())
    print(f"\n🔍 Total issues found: {total_issues}\n")
    
    for issue_type, variants in issues.items():
        if variants:
            print(f"\n⚠️  {issue_type.replace('_', ' ').title()}: {len(variants)}")
            print("-" * 60)
            for v in variants[:5]:  # Show first 5
                name = v.get('name', '')[:50]
                print(f"   • {name}")
                if issue_type == 'pricing_outliers':
                    print(f"     Price: ${v['price_cad']} (Mean: ${v['mean_price']}, {v['deviation']}σ)")
                elif issue_type == 'missing_price':
                    print(f"     CNY: {v['price_cny']}, CAD: {v['price_cad']}")
                elif issue_type == 'invalid_margin':
                    print(f"     Margin: {v['margin']}")
            if len(variants) > 5:
                print(f"   ... and {len(variants) - 5} more")

def export_issues_to_csv(issues: Dict[str, List[Dict[str, Any]]]):
    """Export issues to CSV for bulk editing"""
    import csv
    from datetime import datetime
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    for issue_type, variants in issues.items():
        if variants:
            filename = f"variant_issues_{issue_type}_{timestamp}.csv"
            
            with open(filename, 'w', newline='', encoding='utf-8') as f:
                if variants:
                    writer = csv.DictWriter(f, fieldnames=variants[0].keys())
                    writer.writeheader()
                    writer.writerows(variants)
            
            print(f"📄 Exported {len(variants)} {issue_type} to {filename}")

def create_filter_view_config():
    """Generate Knack filter configuration to exclude problem variants"""
    print("\n" + "=" * 60)
    print("🔧 KNACK VIEW FILTER CONFIGURATION")
    print("=" * 60)
    print("""
To hide problem variants from your Knack view:

1. Go to: https://builder.knack.com/apps/6924a52a58e68efc03b8752d
2. Navigate to the page with your variants table
3. Click on the table/view to edit
4. Add filters:

RECOMMENDED FILTERS:
-------------------
✅ Show only Active variants:
   Status "is" "Active"

✅ Hide variants without options:
   Option Type 1 "is not blank"

✅ Hide variants with invalid margins:
   Margins "is greater than" 0
   AND Margins "is less than" 1

✅ Hide variants without pricing:
   Price CAD "is not blank"
   AND Price CNY "is not blank"

✅ Hide untranslated variants (no easy filter - requires manual review)

5. Click "Save" to apply filters
""")

if __name__ == '__main__':
    print("🔍 Starting variant issue analysis...\n")
    
    issues = analyze_variants()
    print_summary(issues)
    
    print("\n" + "=" * 60)
    export_choice = input("\n📥 Export issues to CSV files? (y/n): ").strip().lower()
    if export_choice == 'y':
        export_issues_to_csv(issues)
        print(f"\n✅ CSV files created in current directory")
        print(f"   You can open these in Excel/Numbers to bulk edit")
    
    create_filter_view_config()
    
    print("\n" + "=" * 60)
    print("💡 NEXT STEPS")
    print("=" * 60)
    print("""
1. Review CSV files to identify patterns
2. Apply Knack view filters to hide problem variants
3. Use Knack's bulk edit feature to fix issues:
   - Go to variants view in Knack
   - Select multiple variants (checkbox)
   - Click "Edit" to bulk update fields

4. For translation issues, you can:
   - Re-run the migration with expanded dictionaries
   - Manually edit in Knack interface
   - Use bulk CSV import to update

5. For pricing outliers:
   - Review the flagged variants manually
   - Check if Taobao prices changed
   - Recalculate margins if needed
""")
