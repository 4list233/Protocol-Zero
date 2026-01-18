#!/usr/bin/env python3
"""
Test runner for the updated scraper with new translation prompts.
Tests the first 10 links from taobao_links.txt with detailed logging.
"""

import os
import sys
import time
from datetime import datetime

# Modify the scraper's LINK_FILE to use our test file
import ai_scraper

# Override the link file path
original_link_file = ai_scraper.LINK_FILE
ai_scraper.LINK_FILE = os.path.join(ai_scraper.SCRIPT_DIR, 'test_links_10.txt')

print("=" * 80)
print("🧪 SCRAPER TEST RUN - First 10 Products")
print("=" * 80)
print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Test file: test_links_10.txt")
print(f"Output dir: {ai_scraper.OUTPUT_DIR}")
print("=" * 80)
print()

# Read the URLs
with open(ai_scraper.LINK_FILE, 'r') as f:
    urls = [line.strip() for line in f if line.strip()]

print(f"📋 Found {len(urls)} URLs to test\n")

# Parse arguments
import argparse
parser = argparse.ArgumentParser(description='Test scraper on first 10 links')
parser.add_argument('--skip-knack', action='store_true', help='Skip Knack upload')
parser.add_argument('--dry-run', action='store_true', help='Dry run mode (simulate Knack)')
parser.add_argument('--no-api', action='store_true', help='No API mode (rule-based translation only)')
parser.add_argument('--headless', action='store_true', help='Run browser in headless mode')
args = parser.parse_args()

print("⚙️  Configuration:")
print(f"   Skip Knack: {args.skip_knack}")
print(f"   Dry Run: {args.dry_run}")
print(f"   No API: {args.no_api}")
print(f"   Headless: {args.headless}")
print()

try:
    # Initialize scraper
    scraper = ai_scraper.AIScraper(
        headless=args.headless,
        dry_run=args.dry_run,
        skip_knack=args.skip_knack,
        no_api=args.no_api
    )
    
    # Run scraper
    start_time = time.time()
    scraper.run(urls, test_mode=False)  # Process all 10 URLs
    elapsed = time.time() - start_time
    
    print()
    print("=" * 80)
    print("✅ TEST COMPLETE")
    print("=" * 80)
    print(f"Time elapsed: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"Average per product: {elapsed/len(urls):.1f} seconds")
    print()
    print("📊 Check results:")
    print(f"   JSON: {ai_scraper.JSON_OUTPUT}")
    print(f"   CSV:  {ai_scraper.CSV_OUTPUT}")
    print(f"   Media: {ai_scraper.MEDIA_DIR}")
    print("=" * 80)
    
except KeyboardInterrupt:
    print("\n\n⚠️  Test interrupted by user")
    sys.exit(1)
except Exception as e:
    print(f"\n\n❌ Test failed with error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    # Restore original link file
    ai_scraper.LINK_FILE = original_link_file
