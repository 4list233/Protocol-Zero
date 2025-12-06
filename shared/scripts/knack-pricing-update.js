#!/usr/bin/env node
/**
 * Knack Pricing Update Script
 * 
 * This script:
 * 1. Fetches all products and variants from Knack
 * 2. Calculates prices using ratio-based scaling
 * 3. Calculates costs and margins
 * 4. Updates the Knack database with calculated values
 * 
 * Prerequisites:
 * - Add the new pricing fields to Knack (see KNACK_PRICING_SETUP.md)
 * - Update the FIELD_KEYS section below with your actual field keys
 * - Set KNACK_APPLICATION_ID and KNACK_REST_API_KEY in environment
 * 
 * Usage:
 *   node knack-pricing-update.js [--dry-run] [--product-id=XXX]
 * 
 * Options:
 *   --dry-run       Show what would be updated without making changes
 *   --product-id    Only process a specific product
 */

const https = require('https')

// ============ CONFIGURATION ============

const CONFIG = {
  // Exchange rate (CNY to CAD) - using buffered rate for margin protection
  exchangeRate: 0.20,
  
  // Shipping cost (CNY) - per PRODUCT, not per variant
  // For bundle products: $70 total regardless of which variant selected
  // For standalone products (no base variant): $70 per item
  shippingCnyPerProduct: 70,
  
  // Revenue cuts
  salespersonCut: 0.10,
  promoCut: 0.10,
  customerDiscount: 0.10,
  
  // Competitor undercut percentage
  competitorUndercut: 0.15,
  
  // Minimum acceptable margins (for warnings)
  minMarginStandard: 0.15,
  minMarginPromo: 0.00,
}

// ============ KNACK FIELD KEYS ============
// These match the fields in your Knack Variants object (object_7)

const FIELD_KEYS = {
  // Products (object_6) - existing fields
  products: {
    objectKey: process.env.KNACK_OBJECT_KEY_PRODUCTS || 'object_6',
    id: 'field_45',
    title: 'field_47',
    status: 'field_51',
  },
  
  // Variants (object_7) - all fields including pricing
  variants: {
    objectKey: process.env.KNACK_OBJECT_KEY_VARIANTS || 'object_7',
    
    // Existing fields
    product: 'field_61',
    variantName: 'field_62',
    priceCny: 'field_64',           // Taobao selling price (also used as cost if no separate cost field)
    priceCad: 'field_138',          // Our selling price CAD
    status: 'field_67',
    
    // Pricing fields (from your Knack setup)
    shippingCny: 'field_151',       // Shipping allocation per item
    isBaseVariant: 'field_152',     // Boolean - base for ratio calc
    competitorPriceCad: 'field_139', // Research price from competitors
    competitorProducts: 'field_137', // Competitor product links/notes
    totalCostCad: 'field_153',      // Calculated total cost CAD
    marginStandard: 'field_154',    // Calculated margin %
    marginPromo: 'field_155',       // Calculated margin with promo %
    isBundle: 'field_156',          // Boolean - is this a bundle?
    bundleComponents: 'field_157',  // What's in the bundle
  }
}

// ============ KNACK API CLIENT ============

class KnackClient {
  constructor() {
    this.applicationId = process.env.KNACK_APPLICATION_ID
    this.apiKey = process.env.KNACK_REST_API_KEY
    
    if (!this.applicationId || !this.apiKey) {
      throw new Error(
        'Missing Knack credentials. Set KNACK_APPLICATION_ID and KNACK_REST_API_KEY environment variables.'
      )
    }
  }
  
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.knack.com',
        port: 443,
        path: `/v1${path}`,
        method,
        headers: {
          'X-Knack-Application-Id': this.applicationId,
          'X-Knack-REST-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        }
      }
      
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (res.statusCode >= 400) {
              reject(new Error(`Knack API error ${res.statusCode}: ${JSON.stringify(json)}`))
            } else {
              resolve(json)
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`))
          }
        })
      })
      
      req.on('error', reject)
      
      if (body) {
        req.write(JSON.stringify(body))
      }
      
      req.end()
    })
  }
  
  async getRecords(objectKey, filters = null) {
    let path = `/objects/${objectKey}/records?rows_per_page=1000`
    if (filters) {
      const filterStr = encodeURIComponent(JSON.stringify(filters))
      path += `&filters=${filterStr}`
    }
    const response = await this.request('GET', path)
    return response.records || []
  }
  
  async updateRecord(objectKey, recordId, data) {
    const path = `/objects/${objectKey}/records/${recordId}`
    return this.request('PUT', path, data)
  }
}

// ============ PRICING CALCULATIONS ============

/**
 * Calculate cost in CAD
 * @param {number} costCny - Item cost in CNY
 * @param {number} shippingCny - Shipping allocation in CNY
 * @param {boolean} isStandalone - If true, each item has its own $70 shipping
 *                                 If false (bundle product), $70 is shared across order
 */
function calculateCost(costCny, shippingCny, isStandalone = false) {
  const cost = costCny || 0
  // For bundle products: $70 flat shipping regardless of variant
  // For standalone products: $70 per item
  const shipping = shippingCny || CONFIG.shippingCnyPerProduct
  return (cost + shipping) * CONFIG.exchangeRate
}

function calculateMarginStandard(priceCad, costCad) {
  if (priceCad <= 0) return -1
  const afterSalesperson = priceCad * (1 - CONFIG.salespersonCut)
  const profit = afterSalesperson - costCad
  return profit / priceCad
}

function calculateMarginPromo(priceCad, costCad) {
  if (priceCad <= 0) return -1
  const netRevenue = priceCad * (1 - CONFIG.customerDiscount)
  const afterCuts = netRevenue * (1 - CONFIG.salespersonCut - CONFIG.promoCut)
  const profit = afterCuts - costCad
  return profit / netRevenue
}

// ============ MAIN PRICING LOGIC ============

function calculateProductPricing(product, variants) {
  const results = {
    productId: product.id,
    productTitle: getFieldValue(product, FIELD_KEYS.products.title),
    variants: [],
    warnings: [],
    errors: [],
    skipped: 0,
    hasBaseVariants: false,
  }
  
  // Filter to only variants with Price CNY entered (skip unpopulated ones)
  const populatedVariants = variants.filter(v => {
    const priceCny = Number(getFieldValue(v, FIELD_KEYS.variants.priceCny)) || 0
    return priceCny > 0
  })
  
  if (populatedVariants.length === 0) {
    results.errors.push('No variants with Price CNY entered')
    results.skipped = variants.length
    return results
  }
  
  results.skipped = variants.length - populatedVariants.length
  
  // Collect ALL base variants (items that can be sold individually)
  // Each base variant has its own competitor price
  const baseVariants = []
  let referenceBase = null  // First base variant, used for ratio scaling bundles
  
  for (const variant of populatedVariants) {
    const isBase = getFieldValue(variant, FIELD_KEYS.variants.isBaseVariant)
    if (isBase === true || isBase === 'Yes' || isBase === 'yes') {
      const competitorRaw = getFieldValue(variant, FIELD_KEYS.variants.competitorPriceCad)
      const competitorPrice = parsePrice(competitorRaw)
      baseVariants.push({
        variant,
        priceCny: Number(getFieldValue(variant, FIELD_KEYS.variants.priceCny)) || 0,
        competitorPrice,
        priceCad: competitorPrice > 0 ? competitorPrice * (1 - CONFIG.competitorUndercut) : 0
      })
      if (!referenceBase) {
        referenceBase = baseVariants[baseVariants.length - 1]
      }
    }
  }
  
  results.hasBaseVariants = baseVariants.length > 0
  
  // If no base variants, treat as standalone product (like Claymore plushie)
  if (baseVariants.length === 0) {
    // Use first variant's competitor price or existing price
    const firstVariant = populatedVariants[0]
    const competitorRaw = getFieldValue(firstVariant, FIELD_KEYS.variants.competitorPriceCad)
    const competitorPrice = parsePrice(competitorRaw)
    const existingPrice = parsePrice(getFieldValue(firstVariant, FIELD_KEYS.variants.priceCad))
    const priceCny = Number(getFieldValue(firstVariant, FIELD_KEYS.variants.priceCny)) || 0
    
    let basePriceCad = 0
    if (competitorPrice > 0) {
      basePriceCad = competitorPrice * (1 - CONFIG.competitorUndercut)
    } else if (existingPrice > 0) {
      basePriceCad = existingPrice
    } else {
      basePriceCad = priceCny * CONFIG.exchangeRate * 2 // Default 2x markup
    }
    
    referenceBase = {
      variant: firstVariant,
      priceCny,
      competitorPrice,
      priceCad: basePriceCad
    }
  }
  
  if (!referenceBase || referenceBase.priceCny <= 0) {
    results.errors.push('No valid reference for pricing')
    return results
  }
  
  // Calculate prices for all populated variants
  for (const variant of populatedVariants) {
    const variantName = getFieldValue(variant, FIELD_KEYS.variants.variantName) || 'Unknown'
    const priceCny = Number(getFieldValue(variant, FIELD_KEYS.variants.priceCny)) || 0
    
    // Check if this is a base variant
    const isBase = getFieldValue(variant, FIELD_KEYS.variants.isBaseVariant)
    const isThisBase = isBase === true || isBase === 'Yes' || isBase === 'yes'
    
    // Find matching base variant info if this IS a base
    const baseInfo = baseVariants.find(b => b.variant === variant)
    
    let priceCad = 0
    if (isThisBase && baseInfo && baseInfo.priceCad > 0) {
      // BASE VARIANT: Use its own competitor price directly
      priceCad = Math.round(baseInfo.priceCad * 100) / 100
    } else {
      // BUNDLE or STANDALONE: Scale from reference base using CNY ratio
      const ratio = priceCny / referenceBase.priceCny
      priceCad = Math.round(referenceBase.priceCad * ratio * 100) / 100
    }
    
    // Cost = Price CNY (Taobao selling price is our cost)
    const costCny = priceCny
    
    // Shipping: $70 CNY per product (flat per order-line)
    const shippingCny = CONFIG.shippingCnyPerProduct
    
    // Bundle = non-base variant in a product that HAS base variants
    const isBundle = results.hasBaseVariants && !isThisBase
    
    // Calculate cost and margins
    const totalCostCad = calculateCost(costCny, shippingCny)
    const marginStandard = calculateMarginStandard(priceCad, totalCostCad)
    const marginPromo = calculateMarginPromo(priceCad, totalCostCad)
    
    // Check for margin warnings
    const variantWarnings = []
    if (marginStandard < CONFIG.minMarginStandard) {
      variantWarnings.push(`Low margin: ${(marginStandard * 100).toFixed(1)}%`)
    }
    if (marginPromo < CONFIG.minMarginPromo) {
      variantWarnings.push(`Negative promo margin: ${(marginPromo * 100).toFixed(1)}%`)
    }
    
    results.variants.push({
      id: variant.id,
      variantName,
      priceCny,
      costCny,
      shippingCny,
      priceCad,
      totalCostCad: Math.round(totalCostCad * 100) / 100,
      marginStandard: Math.round(marginStandard * 1000) / 10, // Store as percentage
      marginPromo: Math.round(marginPromo * 1000) / 10,
      isBase: isThisBase,
      isBundle: isBundle,
      warnings: variantWarnings,
    })
    
    if (variantWarnings.length > 0) {
      results.warnings.push(`${variantName}: ${variantWarnings.join(', ')}`)
    }
  }
  
  return results
}

// ============ HELPERS ============

function getFieldValue(record, fieldKey) {
  if (!fieldKey) return undefined
  return record[fieldKey]
}

/**
 * Parse price value that may have currency symbol (e.g., "$15", "¥70", "15")
 */
function parsePrice(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  // Remove currency symbols and parse
  const cleaned = String(value).replace(/[$¥,\s]/g, '')
  return Number(cleaned) || 0
}

function formatCurrency(value, currency = 'CAD') {
  const symbol = currency === 'CAD' ? '$' : '¥'
  return `${symbol}${value.toFixed(2)}`
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`
}

// ============ MAIN ============

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const productIdArg = args.find(a => a.startsWith('--product-id='))
  const targetProductId = productIdArg ? productIdArg.split('=')[1] : null
  
  console.log('='.repeat(80))
  console.log('KNACK PRICING UPDATE')
  console.log('='.repeat(80))
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`)
  if (targetProductId) {
    console.log(`Target Product: ${targetProductId}`)
  }
  console.log('')
  
  // All pricing fields are now configured
  console.log('✓ All pricing fields configured')
  console.log(`  Exchange Rate: ${CONFIG.exchangeRate} CAD/CNY`)
  console.log(`  Shipping per Product: ¥${CONFIG.shippingCnyPerProduct}`)
  console.log(`  Salesperson Cut: ${CONFIG.salespersonCut * 100}%`)
  console.log(`  Promo Discount: ${CONFIG.customerDiscount * 100}% + ${CONFIG.promoCut * 100}% promoter`)
  console.log('')
  
  try {
    const knack = new KnackClient()
    
    // Fetch products
    console.log('Fetching products from Knack...')
    let products = await knack.getRecords(FIELD_KEYS.products.objectKey)
    console.log(`Found ${products.length} products`)
    
    // Filter by status if not targeting specific product
    if (!targetProductId) {
      products = products.filter(p => 
        getFieldValue(p, FIELD_KEYS.products.status) === 'Active'
      )
      console.log(`${products.length} active products`)
    } else {
      products = products.filter(p => 
        getFieldValue(p, FIELD_KEYS.products.id) === targetProductId ||
        p.id === targetProductId
      )
      if (products.length === 0) {
        console.log(`Product not found: ${targetProductId}`)
        return
      }
    }
    
    // Fetch all variants
    console.log('Fetching variants from Knack...')
    const allVariants = await knack.getRecords(FIELD_KEYS.variants.objectKey)
    console.log(`Found ${allVariants.length} variants`)
    
    // Group variants by product
    const variantsByProduct = new Map()
    for (const variant of allVariants) {
      const productConnection = getFieldValue(variant, FIELD_KEYS.variants.product)
      
      // Extract product ID from connection (handles various formats)
      let productId = null
      if (typeof productConnection === 'string') {
        // Try to extract from HTML or use directly
        const match = productConnection.match(/>([^<]+)</) 
        productId = match ? match[1].trim() : productConnection.trim()
      } else if (Array.isArray(productConnection) && productConnection.length > 0) {
        const first = productConnection[0]
        productId = typeof first === 'object' ? first.id : String(first)
      } else if (typeof productConnection === 'object' && productConnection) {
        productId = productConnection.id || productConnection.identifier
      }
      
      if (productId) {
        if (!variantsByProduct.has(productId)) {
          variantsByProduct.set(productId, [])
        }
        variantsByProduct.get(productId).push(variant)
      }
    }
    
    // Process each product
    console.log('')
    console.log('-'.repeat(80))
    
    let totalUpdates = 0
    let totalWarnings = 0
    let totalErrors = 0
    
    for (const product of products) {
      const productId = getFieldValue(product, FIELD_KEYS.products.id) || product.id
      const productTitle = getFieldValue(product, FIELD_KEYS.products.title) || 'Unknown'
      
      // Get variants for this product
      const variants = variantsByProduct.get(productId) || 
                      variantsByProduct.get(product.id) || []
      
      if (variants.length === 0) {
        console.log(`⚠️  ${productTitle}: No variants found`)
        totalWarnings++
        continue
      }
      
      // Calculate pricing
      const result = calculateProductPricing(product, variants)
      
      const baseCount = result.variants.filter(v => v.isBase).length
      const bundleCount = result.variants.filter(v => v.isBundle).length
      const productType = result.hasBaseVariants ? `📦 ${baseCount} BASE + ${bundleCount} BUNDLES` : '📦 STANDALONE'
      const skippedNote = result.skipped > 0 ? ` (${result.skipped} skipped - no price)` : ''
      console.log(`\n${productType}: ${productTitle} (${result.variants.length} variants${skippedNote})`)
      
      if (result.errors.length > 0) {
        console.log(`   ❌ Errors: ${result.errors.join(', ')}`)
        totalErrors += result.errors.length
        continue
      }
      
      // Display results table
      console.log('   ' + '-'.repeat(82))
      console.log('   ' + 
        'Variant'.padEnd(30) +
        'Type'.padStart(8) +
        'CNY'.padStart(8) +
        'CAD'.padStart(10) +
        'Cost'.padStart(10) +
        'Margin'.padStart(8) +
        'Status'.padStart(8)
      )
      console.log('   ' + '-'.repeat(82))
      
      for (const v of result.variants) {
        const status = v.warnings.length > 0 ? '⚠️' : '✓'
        const typeLabel = v.isBase ? 'BASE' : (v.isBundle ? 'BUNDLE' : 'ITEM')
        console.log('   ' +
          v.variantName.substring(0, 28).padEnd(30) +
          typeLabel.padStart(8) +
          formatCurrency(v.priceCny, 'CNY').padStart(8) +
          formatCurrency(v.priceCad).padStart(10) +
          formatCurrency(v.totalCostCad).padStart(10) +
          formatPercent(v.marginStandard).padStart(8) +
          status.padStart(8)
        )
      }
      
      if (result.warnings.length > 0) {
        console.log(`   ⚠️  Warnings: ${result.warnings.length}`)
        totalWarnings += result.warnings.length
      }
      
      // Update Knack if not dry run
      if (!dryRun) {
        for (const v of result.variants) {
          const updateData = {}
          
          // Always update price CAD
          updateData[FIELD_KEYS.variants.priceCad] = v.priceCad
          
          // Update cost and margin fields
          if (FIELD_KEYS.variants.totalCostCad) {
            updateData[FIELD_KEYS.variants.totalCostCad] = v.totalCostCad
          }
          if (FIELD_KEYS.variants.marginStandard) {
            updateData[FIELD_KEYS.variants.marginStandard] = v.marginStandard
          }
          if (FIELD_KEYS.variants.marginPromo) {
            updateData[FIELD_KEYS.variants.marginPromo] = v.marginPromo
          }
          
          // Update bundle status (Yes/No for Knack boolean field)
          if (FIELD_KEYS.variants.isBundle) {
            updateData[FIELD_KEYS.variants.isBundle] = v.isBundle ? true : false
          }
          
          try {
            await knack.updateRecord(FIELD_KEYS.variants.objectKey, v.id, updateData)
            totalUpdates++
          } catch (err) {
            console.log(`   ❌ Failed to update ${v.variantName}: ${err.message}`)
            totalErrors++
          }
        }
      } else {
        totalUpdates += result.variants.length
      }
    }
    
    // Summary
    console.log('')
    console.log('='.repeat(80))
    console.log('SUMMARY')
    console.log('='.repeat(80))
    console.log(`Products processed: ${products.length}`)
    console.log(`Variants ${dryRun ? 'to update' : 'updated'}: ${totalUpdates}`)
    console.log(`Warnings: ${totalWarnings}`)
    console.log(`Errors: ${totalErrors}`)
    
    if (dryRun) {
      console.log('')
      console.log('This was a DRY RUN. Run without --dry-run to apply changes.')
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message)
    process.exit(1)
  }
}

main()


