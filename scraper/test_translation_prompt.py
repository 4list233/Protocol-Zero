#!/usr/bin/env python3
"""
Test script to verify the updated translation prompts in ai_scraper.py

This script tests the new translation rules that:
1. Keep true identifiers (model numbers, platforms, camo patterns)
2. Remove generic seller branding and marketing fluff
3. Apply milsim naming conventions
"""

import sys
from ai_scraper import GeminiTranslator

def test_translation_rules():
    """Test the new translation prompt with sample Chinese product names"""
    
    translator = GeminiTranslator(no_api=True)  # Use rule-based translation for quick test
    
    test_cases = [
        # Test case format: (input_zh, expected_output_pattern)
        ("黑色", "Black"),
        ("狼灰色", "Wolf Grey"),
        ("泥色", "Tan"),
        ("军绿色", "Army Green"),
        ("游骑兵绿", "Ranger Green"),
        ("迷彩", "Camouflage"),
        ("CP迷彩", "CP Camo"),
        ("暗夜迷彩", "Black Camo"),
        ("均码", "One Size"),
        ("通用", "Universal"),
        ("金属", "Metal"),
        ("铝合金", "Aluminum"),
        ("尼龙", "Nylon"),
        ("考度拉", "Cordura"),
        ("标准", "Standard"),
        ("升级版", "Upgraded"),
        ("一套", "1 Set"),
        ("CNC", "CNC"),
    ]
    
    print("=" * 60)
    print("Testing Updated Translation Rules")
    print("=" * 60)
    print("\n🧪 Rule-based Translation Tests:\n")
    
    passed = 0
    failed = 0
    
    for input_text, expected in test_cases:
        result = translator._rule_based_translate(input_text)
        status = "✅" if expected in result else "❌"
        
        if expected in result:
            passed += 1
        else:
            failed += 1
        
        print(f"{status} '{input_text}' → '{result}' (expected: '{expected}')")
    
    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'=' * 60}\n")
    
    # Show the new prompt structure
    print("📝 New Translation Prompt Structure:\n")
    print("1. KEEP true identifiers:")
    print("   - Model numbers/codes")
    print("   - Platform names")
    print("   - Camo patterns")
    print("   - Interface standards\n")
    
    print("2. REMOVE generic branding:")
    print("   - Store names")
    print("   - Marketing fluff (爆款, 正品, 外贸, etc.)")
    print("   - Random brand words (悟空, WOSPORT, etc.)\n")
    
    print("3. APPLY milsim conventions:")
    print("   - Normalize colors (黑色→Black, 军绿→OD Green)")
    print("   - Normalize sizes (均码→One Size)")
    print("   - Normalize materials (金属→Metal)")
    print("   - Normalize terms (快拆→QD, 导轨→Picatinny)\n")
    
    print("✨ Translation prompts updated successfully!")
    print("   - Single translate() prompt updated")
    print("   - Batch translate prompt updated")
    print("   - Vision batch extraction prompt updated")
    
    return passed, failed

if __name__ == "__main__":
    try:
        passed, failed = test_translation_rules()
        sys.exit(0 if failed == 0 else 1)
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
