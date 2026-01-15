#!/bin/bash
# Quick test script for hero images implementation

echo "🧪 TESTING HERO IMAGES IMPLEMENTATION"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -d "shop" ] || [ ! -d "scraper" ]; then
    echo "❌ Error: Must run from protocol-zero root directory"
    exit 1
fi

echo "1️⃣  Checking scraper structure..."
if [ -d "scraper/ai_scraper_output/media" ]; then
    PRODUCT_COUNT=$(ls -d scraper/ai_scraper_output/media/product_* 2>/dev/null | wc -l)
    echo "   ✅ Found $PRODUCT_COUNT product folders"
else
    echo "   ⚠️  No scraper output found at scraper/ai_scraper_output/media"
fi

echo ""
echo "2️⃣  Checking shop images directory..."
if [ -d "shop/public/images" ]; then
    HERO_COUNT=$(ls shop/public/images/*-hero-*.jpg 2>/dev/null | wc -l)
    DETAIL_COUNT=$(ls shop/public/images/*-details.jpg 2>/dev/null | wc -l)
    LEGACY_COUNT=$(ls shop/public/images/*-main.jpg 2>/dev/null | wc -l)
    
    echo "   Hero images (new): $HERO_COUNT"
    echo "   Detail images: $DETAIL_COUNT"
    echo "   Legacy images (old): $LEGACY_COUNT"
    
    if [ $HERO_COUNT -eq 0 ] && [ $LEGACY_COUNT -gt 0 ]; then
        echo "   💡 TIP: Run 'python3 scraper/migrate_hero_images.py' to convert legacy images"
    fi
else
    echo "   ❌ Images directory not found"
fi

echo ""
echo "3️⃣  Sample product check..."
SAMPLE_IMAGE=$(ls shop/public/images/*-hero-01.jpg 2>/dev/null | head -n 1)
if [ -n "$SAMPLE_IMAGE" ]; then
    PRODUCT_ID=$(basename "$SAMPLE_IMAGE" | sed 's/-hero-01.jpg//')
    echo "   ✅ Sample product: $PRODUCT_ID"
    
    # Count hero images for this product
    HERO_FILES=$(ls shop/public/images/${PRODUCT_ID}-hero-*.jpg 2>/dev/null | wc -l)
    echo "   Hero images: $HERO_FILES"
    
    # Check for detail image
    if [ -f "shop/public/images/${PRODUCT_ID}-details.jpg" ]; then
        echo "   ✅ Detail image exists"
    else
        echo "   ⚠️  No detail image found"
    fi
    
    echo ""
    echo "   🌐 Test URL: http://localhost:3000/shop/$PRODUCT_ID"
else
    echo "   ⚠️  No hero images found"
fi

echo ""
echo "======================================"
echo "📝 QUICK ACTIONS:"
echo ""
echo "Sync scraped images:"
echo "  cd scraper && python3 sync_media.py"
echo ""
echo "Migrate legacy images:"
echo "  python3 scraper/migrate_hero_images.py"
echo ""
echo "Start development server:"
echo "  cd shop && npm run dev"
echo ""
echo "Test a product:"
echo "  open http://localhost:3000/shop/[product-id]"
echo ""
