#!/usr/bin/env node

/**
 * parse-variant-options.js
 * 
 * Migration script to parse existing variant names and extract structured
 * multi-dimensional options (Color, Size, etc.)
 * 
 * Usage:
 *   node parse-variant-options.js --dry-run    # Preview changes without updating
 *   node parse-variant-options.js --update     # Apply changes to Knack
 *   node parse-variant-options.js --analyze    # Just show analysis of variant patterns
 * 
 * This script:
 * 1. Fetches all variants from Knack
 * 2. Parses variantName to extract color/size/style components
 * 3. Updates variants with optionType1/optionValue1 and optionType2/optionValue2
 */

const https = require('https');
const http = require('http');
require('dotenv').config({ path: require('path').join(__dirname, '../../shop/.env.local') });

// Knack API configuration
const KNACK_APP_ID = process.env.KNACK_APPLICATION_ID;
const KNACK_API_KEY = process.env.KNACK_REST_API_KEY;
const VARIANTS_OBJECT = process.env.KNACK_OBJECT_KEY_VARIANTS || 'object_7';

// Field keys for variants (matching knack-config.ts)
const VARIANT_FIELDS = {
  variantName: 'field_62',
  optionType1: 'field_145',   // e.g., "Color", "Style"
  optionValue1: 'field_146',  // e.g., "Black", "Standard"
  optionType2: 'field_147',   // e.g., "Size" (nullable)
  optionValue2: 'field_148',  // e.g., "M", "85-125cm" (nullable)
};

// ============================================================================
// COLOR PATTERNS - Comprehensive list of color identifiers
// ============================================================================
const COLOR_PATTERNS = {
  // Direct English colors
  'black': 'Black',
  'white': 'White',
  'grey': 'Grey',
  'gray': 'Grey',
  'brown': 'Brown',
  'tan': 'Tan',
  'sand': 'Sand',
  'green': 'Green',
  'blue': 'Blue',
  'red': 'Red',
  'pink': 'Pink',
  'purple': 'Purple',
  'orange': 'Orange',
  'yellow': 'Yellow',
  'gold': 'Gold',
  'silver': 'Silver',
  
  // Tactical color codes
  'bk': 'Black',
  'wg': 'Wolf Grey',
  'cb': 'Coyote Brown',
  'rg': 'Ranger Green',
  'od': 'Olive Drab',
  'fg': 'Foliage Green',
  'de': 'Desert',
  'mc': 'MultiCam',
  'cp': 'CP Camo',
  'bcp': 'Black Camo',
  
  // Chinese color names
  '黑色': 'Black',
  '黑': 'Black',
  '白色': 'White',
  '白': 'White',
  '灰色': 'Grey',
  '灰': 'Grey',
  '狼灰色': 'Wolf Grey',
  '狼灰': 'Wolf Grey',
  '棕色': 'Brown',
  '棕': 'Brown',
  '狼棕色': 'Coyote Brown',
  '狼棕': 'Coyote Brown',
  '土狼棕': 'Coyote Brown',
  '沙色': 'Sand',
  '泥色': 'Tan',
  '卡其': 'Khaki',
  '绿色': 'Green',
  '绿': 'Green',
  '军绿色': 'Army Green',
  '军绿': 'Army Green',
  '游骑兵绿色': 'Ranger Green',
  '游骑兵绿': 'Ranger Green',
  '红色': 'Red',
  '红': 'Red',
  '玫红色': 'Rose Red',
  '粉色': 'Pink',
  '粉红色': 'Pink',
  '蓝色': 'Blue',
  '蓝': 'Blue',
  '金色': 'Gold',
  '金': 'Gold',
  '银色': 'Silver',
  '银': 'Silver',
  '消光黑': 'Matte Black',
  
  // Camouflage patterns
  'multicam': 'MultiCam',
  'camouflage': 'Camouflage',
  '迷彩': 'Camouflage',
  'cp迷彩': 'CP Camo',
  '暗夜迷彩': 'Black Camo',
  '丛林迷彩': 'Jungle Camo',
  '废墟迷彩': 'Ruins Camo',
  '废墟': 'Ruins Camo',
  
  // Combined tactical names
  'wolf grey': 'Wolf Grey',
  'coyote brown': 'Coyote Brown',
  'ranger green': 'Ranger Green',
  'olive drab': 'Olive Drab',
  'army green': 'Army Green',
  'black camouflage': 'Black Camo',
  'black camo': 'Black Camo',
  'cordura black': 'Cordura Black',
  'cordura': null, // Material, not color
  'metal black': 'Metal Black',
  'metal tan': 'Metal Tan',
};

// ============================================================================
// SIZE PATTERNS - Standard and weight-based sizes
// ============================================================================
const SIZE_PATTERNS = {
  // Standard clothing sizes
  'xxxs': 'XXXS',
  'xxs': 'XXS',
  'xs': 'XS',
  's': 'S',
  'm': 'M',
  'l': 'L',
  'xl': 'XL',
  'xxl': 'XXL',
  'xxxl': 'XXXL',
  '2xl': '2XL',
  '3xl': '3XL',
  '4xl': '4XL',
  
  // One-size
  '均码': 'One Size',
  'one size': 'One Size',
  'free size': 'One Size',
  'universal': 'Universal',
  '通用': 'Universal',
  
  // Chinese count words (quantity)
  '一个': '1 pc',
  '两个': '2 pcs',
  '三个': '3 pcs',
  '一块': '1 pc',
  '一套': '1 Set',
  '一只': '1 pc',
  '2个': '2 pcs',
  '3个': '3 pcs',
  
  // Small/Large variants
  '大款': 'Large',
  '小款': 'Small',
  '短款': 'Short',
  '矮款': 'Low Profile',
  '加大款': 'XL',
  '小号': 'Small',
  
  // Numeric patterns handled separately
};

// ============================================================================
// STYLE/MATERIAL PATTERNS - Product variations that aren't color or size
// ============================================================================
const STYLE_PATTERNS = {
  'cnc': 'CNC',
  'metal': 'Metal',
  'aluminum': 'Aluminum',
  '铝合金': 'Aluminum',
  'nylon': 'Nylon',
  '尼龙': 'Nylon',
  'cordura': 'Cordura',
  '考度拉': 'Cordura',
  'standard': 'Standard',
  'upgraded': 'Upgraded',
  'set': 'Set',
  '套装': 'Set',
  'single': 'Single',
  '单': 'Single',
  'dual': 'Dual',
  '双': 'Dual',
  'left': 'Left',
  'right': 'Right',
  '左': 'Left',
  '右': 'Right',
};

// ============================================================================
// PARSING LOGIC
// ============================================================================

/**
 * Parse a variant name and extract structured options
 * @param {string} variantName - The raw variant name
 * @returns {Object} Parsed options { optionType1, optionValue1, optionType2, optionValue2 }
 */
function parseVariantName(variantName) {
  if (!variantName) {
    return { optionType1: null, optionValue1: null, optionType2: null, optionValue2: null };
  }

  const normalized = variantName.toLowerCase().trim();
  let color = null;
  let size = null;
  let style = null;

  // First pass: Try to find color
  for (const [pattern, colorName] of Object.entries(COLOR_PATTERNS)) {
    if (colorName === null) continue; // Skip non-color patterns like 'cordura'
    
    // Check for exact word match or at start/end
    const regex = new RegExp(`(^|[^a-z])${escapeRegex(pattern)}($|[^a-z])`, 'i');
    if (regex.test(normalized)) {
      color = colorName;
      break;
    }
  }

  // Second pass: Try to find size
  // Check for numeric range patterns first (e.g., "80-110", "85-125cm")
  const numericRangeMatch = variantName.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})\s*(cm|斤)?/i);
  if (numericRangeMatch) {
    const unit = numericRangeMatch[3] || '';
    size = `${numericRangeMatch[1]}-${numericRangeMatch[2]}${unit}`;
  } else {
    // Check standard size patterns
    for (const [pattern, sizeName] of Object.entries(SIZE_PATTERNS)) {
      const regex = new RegExp(`(^|[^a-z])${escapeRegex(pattern)}($|[^a-z])`, 'i');
      if (regex.test(normalized)) {
        size = sizeName;
        break;
      }
    }
  }
  
  // Check for size at end like "20cm" or just measurements
  if (!size) {
    const sizeEndMatch = variantName.match(/(\d+)\s*(cm|mm|inch|in)/i);
    if (sizeEndMatch) {
      size = `${sizeEndMatch[1]}${sizeEndMatch[2].toLowerCase()}`;
    }
  }

  // Third pass: Try to find style/material
  for (const [pattern, styleName] of Object.entries(STYLE_PATTERNS)) {
    const regex = new RegExp(`(^|[^a-z])${escapeRegex(pattern)}($|[^a-z])`, 'i');
    if (regex.test(normalized)) {
      style = styleName;
      break;
    }
  }

  // Determine option assignments
  // Priority: Color as primary, Size as secondary
  // If no color, use Style as primary
  let optionType1 = null;
  let optionValue1 = null;
  let optionType2 = null;
  let optionValue2 = null;

  if (color) {
    optionType1 = 'Color';
    optionValue1 = color;
    if (size) {
      optionType2 = 'Size';
      optionValue2 = size;
    } else if (style) {
      optionType2 = 'Style';
      optionValue2 = style;
    }
  } else if (size) {
    optionType1 = 'Size';
    optionValue1 = size;
    if (style) {
      optionType2 = 'Style';
      optionValue2 = style;
    }
  } else if (style) {
    optionType1 = 'Style';
    optionValue1 = style;
  }

  return { optionType1, optionValue1, optionType2, optionValue2 };
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// KNACK API HELPERS
// ============================================================================

/**
 * Make an HTTP request to Knack API
 */
function knackRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.knack.com',
      port: 443,
      path: `/v1/objects/${path}`,
      method: method,
      headers: {
        'X-Knack-Application-Id': KNACK_APP_ID,
        'X-Knack-REST-API-Key': KNACK_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Knack API error: ${res.statusCode} - ${body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Fetch all variants from Knack
 */
async function fetchAllVariants() {
  const variants = [];
  let page = 1;
  let hasMore = true;

  console.log('Fetching variants from Knack...');

  while (hasMore) {
    const response = await knackRequest('GET', `${VARIANTS_OBJECT}/records?page=${page}&rows_per_page=100`);
    variants.push(...response.records);
    hasMore = response.total_pages > page;
    page++;
    process.stdout.write(`\r  Fetched ${variants.length} variants...`);
  }

  console.log(`\n  Total: ${variants.length} variants`);
  return variants;
}

/**
 * Update a variant in Knack
 */
async function updateVariant(recordId, data) {
  return knackRequest('PUT', `${VARIANTS_OBJECT}/records/${recordId}`, data);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-n');
  const doUpdate = args.includes('--update') || args.includes('-u');
  const analyzeOnly = args.includes('--analyze') || args.includes('-a');

  if (!isDryRun && !doUpdate && !analyzeOnly) {
    console.log('Usage: node parse-variant-options.js [--dry-run | --update | --analyze]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run, -n   Preview changes without updating Knack');
    console.log('  --update, -u    Apply changes to Knack');
    console.log('  --analyze, -a   Just show analysis of variant patterns');
    process.exit(1);
  }

  if (!KNACK_APP_ID || !KNACK_API_KEY) {
    console.error('Error: KNACK_APPLICATION_ID and KNACK_REST_API_KEY must be set');
    process.exit(1);
  }

  console.log('================================================================================');
  console.log('Multi-Dimensional Variant Options Parser');
  console.log('================================================================================');
  console.log('');

  // Fetch all variants
  const variants = await fetchAllVariants();

  // Parse and analyze
  const stats = {
    total: variants.length,
    withColor: 0,
    withSize: 0,
    withStyle: 0,
    withBothColorAndSize: 0,
    unmatched: 0,
  };

  const parsed = [];
  const unmatchedVariants = [];

  for (const variant of variants) {
    const variantName = variant[VARIANT_FIELDS.variantName] || '';
    const options = parseVariantName(variantName);
    
    parsed.push({
      id: variant.id,
      variantName,
      ...options,
    });

    if (options.optionType1 === 'Color') stats.withColor++;
    if (options.optionType1 === 'Size' || options.optionType2 === 'Size') stats.withSize++;
    if (options.optionType1 === 'Style' || options.optionType2 === 'Style') stats.withStyle++;
    if (options.optionType1 === 'Color' && options.optionType2 === 'Size') stats.withBothColorAndSize++;
    if (!options.optionType1) {
      stats.unmatched++;
      unmatchedVariants.push(variantName);
    }
  }

  // Display analysis
  console.log('');
  console.log('Analysis Results:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total variants:          ${stats.total}`);
  console.log(`With Color option:       ${stats.withColor} (${(stats.withColor/stats.total*100).toFixed(1)}%)`);
  console.log(`With Size option:        ${stats.withSize} (${(stats.withSize/stats.total*100).toFixed(1)}%)`);
  console.log(`With Style option:       ${stats.withStyle} (${(stats.withStyle/stats.total*100).toFixed(1)}%)`);
  console.log(`With Color + Size:       ${stats.withBothColorAndSize} (${(stats.withBothColorAndSize/stats.total*100).toFixed(1)}%)`);
  console.log(`Unmatched (no options):  ${stats.unmatched} (${(stats.unmatched/stats.total*100).toFixed(1)}%)`);
  console.log('');

  if (unmatchedVariants.length > 0) {
    console.log('Unmatched variant names (first 20):');
    console.log('--------------------------------------------------------------------------------');
    unmatchedVariants.slice(0, 20).forEach(name => console.log(`  - "${name}"`));
    if (unmatchedVariants.length > 20) {
      console.log(`  ... and ${unmatchedVariants.length - 20} more`);
    }
    console.log('');
  }

  if (analyzeOnly) {
    console.log('Analysis complete. Use --dry-run or --update to see/apply changes.');
    return;
  }

  // Show sample of parsed results
  console.log('Sample parsed results (first 15):');
  console.log('--------------------------------------------------------------------------------');
  parsed.slice(0, 15).forEach(p => {
    const opt1 = p.optionType1 ? `${p.optionType1}: ${p.optionValue1}` : '-';
    const opt2 = p.optionType2 ? `${p.optionType2}: ${p.optionValue2}` : '-';
    console.log(`  "${p.variantName.substring(0, 40).padEnd(40)}" → [${opt1}] [${opt2}]`);
  });
  console.log('');

  if (isDryRun) {
    console.log('DRY RUN - No changes will be made.');
    console.log('Run with --update to apply changes to Knack.');
    return;
  }

  if (doUpdate) {
    console.log('Updating variants in Knack...');
    console.log('');
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const p of parsed) {
      if (!p.optionType1) {
        skipped++;
        continue;
      }

      try {
        const updateData = {};
        if (p.optionType1) updateData[VARIANT_FIELDS.optionType1] = p.optionType1;
        if (p.optionValue1) updateData[VARIANT_FIELDS.optionValue1] = p.optionValue1;
        if (p.optionType2) updateData[VARIANT_FIELDS.optionType2] = p.optionType2;
        if (p.optionValue2) updateData[VARIANT_FIELDS.optionValue2] = p.optionValue2;

        await updateVariant(p.id, updateData);
        updated++;
        process.stdout.write(`\r  Updated ${updated}/${parsed.length - skipped} variants...`);
        
        // Rate limiting - Knack has API limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        errors++;
        console.error(`\n  Error updating ${p.id}: ${err.message}`);
      }
    }

    console.log('');
    console.log('');
    console.log('Update complete:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped} (no options detected)`);
    console.log(`  Errors: ${errors}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

