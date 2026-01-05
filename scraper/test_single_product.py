#!/usr/bin/env python3
"""
Test script to validate the scraper on a single product.
"""

import sys
import os

# Set up paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

# Override settings for test
os.environ['TEST_MODE'] = '1'

import scraper

# Use test URLs
scraper.LINK_FILE = os.path.join(SCRIPT_DIR, 'test_links.txt')
scraper.CSV_OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'test_output.csv')

# Create test links file with 1 product
with open(scraper.LINK_FILE, 'w') as f:
    f.write("https://item.taobao.com/item.htm?id=719244198696\n")

print("=" * 60)
print("Running test scraper on 1 product...")
print("=" * 60)

# Run the main scraper
scraper.main()

print("\n" + "=" * 60)
print("Test complete! Check test_output.csv and validation_report.json")
print("=" * 60)
