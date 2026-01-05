#!/bin/bash
#
# MASTER WORKFLOW: Scrape → Review → Stitch → Port to Knack → Sync to Notion
# Usage: ./workflow.sh [--skip-scrape] [--skip-review] [--skip-stitch]
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCRAPER_DIR="/Users/5425855/Documents/protocol-zero/scraper"
SHARED_DIR="/Users/5425855/Documents/protocol-zero/shared"
SHOP_DIR="/Users/5425855/Documents/protocol-zero/shop"
OUTPUT_DIR="$SCRAPER_DIR/ai_scraper_output"
MEDIA_DIR="$SHARED_DIR/media"
PUBLIC_IMAGES="$SHOP_DIR/public/images"

# Parse flags
SKIP_SCRAPE=false
SKIP_REVIEW=false
SKIP_STITCH=false
SKIP_KNACK=false

for arg in "$@"; do
  case $arg in
    --skip-scrape)
      SKIP_SCRAPE=true
      ;;
    --skip-review)
      SKIP_REVIEW=true
      ;;
    --skip-stitch)
      SKIP_STITCH=true
      ;;
    --skip-knack)
      SKIP_KNACK=true
      ;;
  esac
done

# Step 1: SCRAPE + TRANSLATE + CALCULATE MARGINS
if [ "$SKIP_SCRAPE" = false ]; then
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}STEP 1: SCRAPE + TRANSLATE + CALCULATE MARGINS${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "🚀 Starting AI Scraper..."
  echo "   • Extracting variants (multi-dimensional)"
  echo "   • Translating with Gemini"
  echo "   • Calculating CAD pricing & margins"
  echo "   • Capturing images (Main, Gallery, Details)"
  echo ""
  
  cd "$SCRAPER_DIR"
  python3 ai_scraper.py --skip-knack
  
  echo ""
  echo -e "${GREEN}✅ Scraping complete!${NC}"
  echo "   📁 Data: $OUTPUT_DIR/products.csv"
  echo "   📁 JSON: $OUTPUT_DIR/products.json"
  echo "   📁 Images: $MEDIA_DIR/"
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping scrape (--skip-scrape)${NC}"
fi

# Step 2: MANUAL IMAGE REVIEW
if [ "$SKIP_REVIEW" = false ]; then
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}STEP 2: MANUAL IMAGE REVIEW${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "📸 Opening image folder for review..."
  echo ""
  echo "   Location: $MEDIA_DIR"
  echo ""
  echo "   Review checklist:"
  echo "   ☐ Check Main images (clear, good quality)"
  echo "   ☐ Check Gallery images (show variants)"
  echo "   ☐ Check Detail images (specifications)"
  echo "   ☐ Delete any placeholder or bad quality images"
  echo "   ☐ Rename if needed (keep format: {id}-{type}-{n}.jpg)"
  echo ""
  
  # Open Finder to media folder
  open "$MEDIA_DIR"
  
  echo -e "${YELLOW}⏸️  Press ENTER when review is complete...${NC}"
  read -r
  
  echo ""
  echo -e "${GREEN}✅ Image review complete!${NC}"
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping review (--skip-review)${NC}"
fi

# Step 3: STITCH DETAIL IMAGES
if [ "$SKIP_STITCH" = false ]; then
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}STEP 3: STITCH DETAIL IMAGES${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "🧵 Stitching detail images into long verticals..."
  echo ""
  
  cd "$SCRAPER_DIR"
  python3 stitch-details.py
  
  echo ""
  echo -e "${GREEN}✅ Stitching complete!${NC}"
  echo "   📁 Long images: $MEDIA_DIR/*-Details_Long.jpg"
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping stitch (--skip-stitch)${NC}"
fi

# Step 4: COPY IMAGES TO PUBLIC FOLDER
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}STEP 4: COPY IMAGES TO PUBLIC FOLDER${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "📋 Copying reviewed images to shop/public/images/..."
echo ""

# Ensure public images directory exists
mkdir -p "$PUBLIC_IMAGES"

# Copy all images from media to public
rsync -av --include='*.jpg' --include='*.png' --include='*.webp' \
  --exclude='*' "$MEDIA_DIR/" "$PUBLIC_IMAGES/"

echo ""
echo -e "${GREEN}✅ Images copied!${NC}"
echo "   📁 Destination: $PUBLIC_IMAGES"
echo ""

# Step 5: PORT TO KNACK
if [ "$SKIP_KNACK" = false ]; then
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}STEP 5: PORT TO KNACK DATABASE${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "📤 Pushing products + variants to Knack..."
  echo ""
  echo "   This will:"
  echo "   • Create/update product records"
  echo "   • Create/update variant records"
  echo "   • Link variants to products"
  echo "   • Include all pricing (cost, margin, promo)"
  echo "   • Set multi-dimensional options (Type 1/2, Value 1/2)"
  echo ""
  
  cd "$SCRAPER_DIR"
  python3 ai_scraper.py --test  # Remove --test to do all products
  
  echo ""
  echo -e "${GREEN}✅ Knack push complete!${NC}"
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping Knack push (--skip-knack)${NC}"
fi

# Step 6: SYNC TO NOTION
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}STEP 6: SYNC IMAGES TO NOTION${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "☁️  Syncing images to Notion database..."
echo ""

cd "$SHARED_DIR/scripts"
node sync-media.js

echo ""
echo -e "${GREEN}✅ Notion sync complete!${NC}"
echo ""

# Step 7: SUMMARY
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 WORKFLOW COMPLETE!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 Summary:"
echo ""
echo "   ✅ Products scraped with multi-dimensional variants"
echo "   ✅ Translations completed (Chinese → English)"
echo "   ✅ Margins calculated (Cost, Price, Margin %, Promo %)"
echo "   ✅ Images reviewed and stitched"
echo "   ✅ Data pushed to Knack database"
echo "   ✅ Images synced to Notion"
echo ""
echo "🔍 Next Steps:"
echo ""
echo "   1. Verify in Knack:"
echo "      → https://builder.knack.com/protocol-zero"
echo "      → Check Products & Variants objects"
echo "      → Verify Option Type 1/2 fields populated"
echo ""
echo "   2. Check frontend:"
echo "      → cd $SHOP_DIR"
echo "      → npm run dev"
echo "      → Open http://localhost:3000/shop"
echo "      → Test multi-dimensional variant selector"
echo ""
echo "   3. Verify images:"
echo "      → Images should display from /images/ folder"
echo "      → Detail images should show stitched long view"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
