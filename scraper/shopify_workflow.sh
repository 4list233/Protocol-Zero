#!/bin/bash
# Shopify Export Workflow
# Complete pipeline from Taobao scraper to Shopify import

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "🛒 SHOPIFY EXPORT WORKFLOW"
echo "============================================================"
echo ""

# Default parameters
MARGIN="${MARGIN:-80}"
EXCHANGE_RATE="${EXCHANGE_RATE:-0.19}"
INPUT_CSV="${INPUT_CSV:-protocol_zero_variants.csv}"
OUTPUT_CSV="${OUTPUT_CSV:-shopify_import_$(date +%Y%m%d_%H%M%S).csv}"

echo "⚙️  Configuration:"
echo "   - Input CSV: $INPUT_CSV"
echo "   - Output CSV: $OUTPUT_CSV"
echo "   - Margin: ${MARGIN}%"
echo "   - Exchange Rate: $EXCHANGE_RATE CNY/CAD"
echo ""

# Step 1: Check if translations exist
echo "📝 Step 1: Checking for translated titles..."
if ! grep -q "Translated Title" "$INPUT_CSV" 2>/dev/null; then
    echo "⚠️  No translations found. Running translate.py..."
    echo "   (This may take a while for large catalogs)"
    
    if [ -f "translate.py" ]; then
        python3 translate.py --input "$INPUT_CSV" || {
            echo "❌ Translation failed. Continue anyway? (y/n)"
            read -r response
            if [ "$response" != "y" ]; then
                exit 1
            fi
        }
    else
        echo "⚠️  translate.py not found. Continuing with Chinese titles..."
        echo "   (Recommended: Run translate.py separately for English titles)"
    fi
else
    echo "✅ Translations found"
fi

echo ""

# Step 2: Validate CSV structure
echo "📋 Step 2: Validating CSV structure..."
required_columns=("URL" "Product Title" "Price CNY")
missing_columns=()

for col in "${required_columns[@]}"; do
    if ! head -1 "$INPUT_CSV" | grep -q "$col"; then
        missing_columns+=("$col")
    fi
done

if [ ${#missing_columns[@]} -gt 0 ]; then
    echo "❌ Missing required columns: ${missing_columns[*]}"
    echo "   Please ensure CSV has: URL, Product Title, Price CNY"
    exit 1
fi

echo "✅ CSV structure valid"
echo ""

# Step 3: Count products
echo "📊 Step 3: Analyzing products..."
total_rows=$(($(wc -l < "$INPUT_CSV") - 1))  # Subtract header
unique_products=$(tail -n +2 "$INPUT_CSV" | cut -d',' -f1 | sort -u | wc -l)

echo "   - Total rows: $total_rows"
echo "   - Unique products: $unique_products"
echo ""

# Step 4: Run Shopify export
echo "🚀 Step 4: Exporting to Shopify format..."
python3 shopify_export.py \
    --input "$INPUT_CSV" \
    --output "$OUTPUT_CSV" \
    --margin "$MARGIN" \
    --exchange-rate "$EXCHANGE_RATE" || {
        echo "❌ Export failed"
        exit 1
    }

echo ""

# Step 5: Validation
echo "✅ Step 5: Validating output..."
if [ ! -f "$OUTPUT_CSV" ]; then
    echo "❌ Output file not created"
    exit 1
fi

output_rows=$(($(wc -l < "$OUTPUT_CSV") - 1))
if [ $output_rows -eq 0 ]; then
    echo "❌ No data exported"
    exit 1
fi

echo "✅ Exported $output_rows variant rows"
echo ""

# Step 6: Preview output
echo "📝 Step 6: Preview (first 3 products)..."
head -20 "$OUTPUT_CSV" | cut -c1-120
echo ""

# Step 7: Summary
echo "============================================================"
echo "✅ EXPORT COMPLETE"
echo "============================================================"
echo ""
echo "📁 Output file: $OUTPUT_CSV"
echo "📊 Statistics:"
echo "   - Input products: $unique_products"
echo "   - Output variants: $output_rows"
echo "   - Margin: ${MARGIN}%"
echo ""
echo "📋 Next Steps:"
echo "   1. Review CSV: head -50 $OUTPUT_CSV"
echo "   2. Open in spreadsheet for validation"
echo "   3. Upload to Shopify:"
echo "      - Go to Products > Import"
echo "      - Upload $OUTPUT_CSV"
echo "      - Review and confirm import"
echo ""
echo "💡 Quick Commands:"
echo "   # View pricing samples"
echo "   python3 shopify_pricing_calculator.py --cost 50 --compare"
echo ""
echo "   # Re-export with different margin"
echo "   MARGIN=100 ./shopify_workflow.sh"
echo ""
echo "   # Export specific CSV"
echo "   INPUT_CSV=custom.csv OUTPUT_CSV=output.csv ./shopify_workflow.sh"
echo ""

echo "✅ Ready for Shopify import!"
