#!/usr/bin/env python3
"""
Update broken variants to 'Needs Review' status
"""

from knack_integration import KnackAPI, VARIANTS_OBJECT_KEY, VARIANT_FIELDS
import re

api = KnackAPI()

def has_chinese(text: str) -> bool:
    """Check if text contains Chinese characters"""
    if not text:
        return False
    return any('\u4e00' <= c <= '\u9fff' for c in text)

def is_broken_variant(v: dict) -> tuple[bool, list[str]]:
    """
    Check if variant is broken and return reasons
    Returns: (is_broken, [list of reasons])
    """
    reasons = []
    
    variant_name = v.get(VARIANT_FIELDS['variantName'], '')
    price_cny = v.get(VARIANT_FIELDS['priceCny'], '')
    price_cad = v.get(VARIANT_FIELDS['priceCad'], '')
    margin = v.get(VARIANT_FIELDS['marginStandard'], '')
    option1_type = v.get(VARIANT_FIELDS['optionType1'], '')
    option1_value = v.get(VARIANT_FIELDS['optionValue1'], '')
    
    # Check for missing price (critical issue)
    if not price_cny or not price_cad:
        reasons.append('Missing price')
    elif float(price_cny or 0) == 0 or float(price_cad or 0) == 0:
        reasons.append('Zero price')
    
    # Check for invalid margin (critical issue)
    try:
        m = float(margin) if margin else 0
        if m < 0 or m > 1:
            reasons.append(f'Invalid margin ({m})')
    except:
        if margin:
            reasons.append(f'Unparseable margin ({margin})')
    
    # Check for missing options (critical issue)
    if not option1_type or not option1_value:
        reasons.append('Missing options')
    
    return (len(reasons) > 0, reasons)

def update_broken_variants():
    """Update all broken variants to 'Needs Review' status"""
    print("📥 Fetching all variants...")
    variants = api.get_all_records(VARIANTS_OBJECT_KEY)
    
    print(f"📋 Analyzing {len(variants)} variants...\n")
    
    broken_variants = []
    for v in variants:
        status = v.get(VARIANT_FIELDS['status'], '')
        
        # Only process currently Active variants
        if status == 'Active':
            is_broken, reasons = is_broken_variant(v)
            if is_broken:
                broken_variants.append({
                    'id': v.get('id'),
                    'name': v.get(VARIANT_FIELDS['variantName'], ''),
                    'reasons': reasons
                })
    
    print(f"⚠️  Found {len(broken_variants)} broken Active variants\n")
    
    if not broken_variants:
        print("✅ No broken variants found!")
        return
    
    # Show first 10 examples
    print("📝 Examples of broken variants:")
    print("-" * 80)
    for v in broken_variants[:10]:
        print(f"   • {v['name'][:60]}")
        print(f"     Issues: {', '.join(v['reasons'])}")
    if len(broken_variants) > 10:
        print(f"   ... and {len(broken_variants) - 10} more")
    print()
    
    # Ask for confirmation
    confirm = input(f"❓ Update {len(broken_variants)} variants to 'Needs Review' status? (y/n): ").strip().lower()
    
    if confirm != 'y':
        print("❌ Cancelled")
        return
    
    print(f"\n🔄 Updating {len(broken_variants)} variants...")
    
    updated_count = 0
    error_count = 0
    
    for i, v in enumerate(broken_variants, 1):
        try:
            # Update to 'Needs Review' status
            api.update_record(
                VARIANTS_OBJECT_KEY,
                v['id'],
                {VARIANT_FIELDS['status']: 'Needs Review'}
            )
            updated_count += 1
            
            if i % 10 == 0:
                print(f"   [{i}/{len(broken_variants)}] Updated...")
        except Exception as e:
            error_count += 1
            print(f"   ❌ Error updating {v['name'][:40]}: {e}")
    
    print(f"\n" + "=" * 80)
    print(f"✅ Updated {updated_count} variants to 'Needs Review'")
    if error_count > 0:
        print(f"❌ {error_count} errors")
    print("=" * 80)

if __name__ == '__main__':
    update_broken_variants()
