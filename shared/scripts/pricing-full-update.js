#!/usr/bin/env node
/**
 * Full Pricing Update Script
 * 
 * This script:
 * 1. Fetches ALL variants with Price CNY entered
 * 2. Recalculates prices based on competitor pricing
 * 3. Calculates costs and margins (standard + promo)
 * 4. IMPORTANT: Sets status based on profitability
 *    - Profitable (margin >= 0%) -> Active
 *    - Unprofitable (negative margin) -> Unprofitable
 * 5. Updates the Knack database
 * 
 * Usage:
 *   node pricing-full-update.js [--dry-run]
 */

const https = require('https')

// ============ CONFIGURATION ============

const CONFIG = {
  // Exchange rate (CNY to CAD)
  exchangeRate: 0.20,
  
  // Shipping cost (CNY) per product
  shippingCnyPerProduct: 70,
  
  // Revenue cuts
  salespersonCut: 0.10,
  promoCut: 0.10,
  customerDiscount: 0.10,
  
  // Competitor undercut percentage
  competitorUndercut: 0.15,
  
  // Minimum acceptable margin for "Active" status
  // Items below this go to "Unprofitable"
  minMarginForActive: 0.00,  // 0% - anything negative is unprofitable
}

// ============ KNACK FIELD KEYS ============

const FIELD_KEYS = {
  products: {
    objectKey: 'object_6',
    id: 'field_45',
    title: 'field_47',
    status: 'field_51',
  },
  variants: {
    objectKey: 'object_7',
    product: 'field_61',
    variantName: 'field_62',
    priceCny: 'field_64',
    priceCad: 'field_138',
    status: 'field_67',
    shippingCny: 'field_151',
    isBaseVariant: 'field_152',
    competitorPriceCad: 'field_139',
    totalCostCad: 'field_153',
    marginStandard: 'field_154',
    marginPromo: 'field_155',
    isBundle: 'field_156',
    // Add-on fields
    isAddonItem: 'field_158',
    addonPriceCad: 'field_159',
    addonCostCad: 'field_160',
    addonMargin: 'field_161',
  }
}

// ============ KNACK API CLIENT ============

class KnackClient {
  constructor() {
    this.applicationId = process.env.KNACK_APPLICATION_ID
    this.apiKey = process.env.KNACK_REST_API_KEY
    
    if (!this.applicationId || !this.apiKey) {
      throw new Error('Missing Knack credentials')
    }
  }
  
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.knack.com',
        port: 443,
        path: `/v1/${path}`,
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
              reject(new Error(json.message || `HTTP ${res.statusCode}`))
            } else {
              resolve(json)
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`))
          }
        })
      })
      
      req.on('error', reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }
  
  async getRecords(objectKey) {
    const records = []
    let page = 1
    const perPage = 100
    
    while (true) {
      const response = await this.request('GET', 
        `objects/${objectKey}/records?page=${page}&rows_per_page=${perPage}`)
      records.push(...(response.records || []))
      if (page >= response.total_pages) break
      page++
    }
    return records
  }
  
  async updateRecord(objectKey, recordId, data) {
    return this.request('PUT', `objects/${objectKey}/records/${recordId}`, data)
  }
}

// ============ PRICING CALCULATIONS ============

function calculateCost(priceCny, shippingCny) {
  return (priceCny + shippingCny) * CONFIG.exchangeRate
}

function calculateMarginStandard(priceCad, totalCostCad) {
  if (priceCad <= 0) return -1
  const afterSalesperson = priceCad * (1 - CONFIG.salespersonCut)
  return (afterSalesperson - totalCostCad) / priceCad
}

function calculateMarginPromo(priceCad, totalCostCad) {
  if (priceCad <= 0) return -1
  const afterDiscount = priceCad * (1 - CONFIG.customerDiscount)
  const afterCuts = afterDiscount * (1 - CONFIG.salespersonCut - CONFIG.promoCut)
  return (afterCuts - totalCostCad) / priceCad
}

function parsePrice(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[$¥,\s]/g, '')
  return Number(cleaned) || 0
}

function getFieldValue(record, fieldKey) {
  if (!fieldKey) return undefined
  return record[fieldKey]
}

// ============ MAIN ============

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  
  console.log('='.repeat(80))
  console.log('FULL PRICING UPDATE - ALL VARIANTS')
  console.log('='.repeat(80))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`)
  console.log('')
  console.log('Configuration:')
  console.log(`  Exchange Rate: ${CONFIG.exchangeRate} CAD/CNY`)
  console.log(`  Shipping: ¥${CONFIG.shippingCnyPerProduct}`)
  console.log(`  Salesperson Cut: ${CONFIG.salespersonCut * 100}%`)
  console.log(`  Promo: -${CONFIG.customerDiscount * 100}% discount, ${CONFIG.promoCut * 100}% promoter cut`)
  console.log(`  Min Margin for Active: ${CONFIG.minMarginForActive * 100}%`)
  console.log('')
  
  try {
    const knack = new KnackClient()
    
    // Fetch ALL products
    console.log('Fetching products...')
    const products = await knack.getRecords(FIELD_KEYS.products.objectKey)
    console.log(`Found ${products.length} products`)
    
    // Build product lookup
    const productMap = new Map()
    for (const p of products) {
      const id = getFieldValue(p, FIELD_KEYS.products.id) || p.id
      const title = getFieldValue(p, FIELD_KEYS.products.title) || 'Unknown'
      productMap.set(id, { id, title, record: p })
      productMap.set(p.id, { id, title, record: p }) // Also by record ID
    }
    
    // Fetch ALL variants
    console.log('Fetching variants...')
    const allVariants = await knack.getRecords(FIELD_KEYS.variants.objectKey)
    console.log(`Found ${allVariants.length} total variants`)
    
    // Filter to variants with Price CNY
    const variants = allVariants.filter(v => {
      const priceCny = Number(getFieldValue(v, FIELD_KEYS.variants.priceCny)) || 0
      return priceCny > 0
    })
    console.log(`Processing ${variants.length} variants with Price CNY`)
    
    // Group variants by product for ratio calculations
    const variantsByProduct = new Map()
    for (const variant of variants) {
      const productConnection = getFieldValue(variant, FIELD_KEYS.variants.product)
      let productId = null
      
      if (typeof productConnection === 'string') {
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
    
    // Counters
    let totalProcessed = 0
    let totalActive = 0
    let totalUnprofitable = 0
    let totalErrors = 0
    
    // Results for display
    const results = []
    
    console.log('')
    console.log('-'.repeat(100))
    console.log('PROCESSING VARIANTS')
    console.log('-'.repeat(100))
    
    // Process each product group
    for (const [productId, productVariants] of variantsByProduct) {
      const productInfo = productMap.get(productId) || { title: 'Unknown Product' }
      
      // Find base variants in this product
      const baseVariants = productVariants.filter(v => {
        const isBase = getFieldValue(v, FIELD_KEYS.variants.isBaseVariant)
        return isBase === true || isBase === 'Yes' || isBase === 'yes'
      })
      
      // Get reference base for ratio scaling
      let referenceBase = null
      if (baseVariants.length > 0) {
        const first = baseVariants[0]
        const competitorPrice = parsePrice(getFieldValue(first, FIELD_KEYS.variants.competitorPriceCad))
        const priceCny = Number(getFieldValue(first, FIELD_KEYS.variants.priceCny)) || 0
        
        if (competitorPrice > 0 && priceCny > 0) {
          referenceBase = {
            priceCny,
            priceCad: competitorPrice * (1 - CONFIG.competitorUndercut)
          }
        }
      }
      
      // If no base variant, use first variant with competitor price
      if (!referenceBase) {
        for (const v of productVariants) {
          const competitorPrice = parsePrice(getFieldValue(v, FIELD_KEYS.variants.competitorPriceCad))
          const priceCny = Number(getFieldValue(v, FIELD_KEYS.variants.priceCny)) || 0
          
          if (competitorPrice > 0 && priceCny > 0) {
            referenceBase = {
              priceCny,
              priceCad: competitorPrice * (1 - CONFIG.competitorUndercut)
            }
            break
          }
        }
      }
      
      // Process each variant
      for (const variant of productVariants) {
        const variantName = getFieldValue(variant, FIELD_KEYS.variants.variantName) || 'Unknown'
        const priceCny = Number(getFieldValue(variant, FIELD_KEYS.variants.priceCny)) || 0
        const currentStatus = getFieldValue(variant, FIELD_KEYS.variants.status) || ''
        
        // Check if base variant
        const isBaseRaw = getFieldValue(variant, FIELD_KEYS.variants.isBaseVariant)
        const isBase = isBaseRaw === true || isBaseRaw === 'Yes' || isBaseRaw === 'yes'
        
        // Calculate price
        let priceCad = 0
        let priceSource = ''
        
        if (isBase) {
          // Base variant: use its own competitor price
          const competitorPrice = parsePrice(getFieldValue(variant, FIELD_KEYS.variants.competitorPriceCad))
          if (competitorPrice > 0) {
            priceCad = competitorPrice * (1 - CONFIG.competitorUndercut)
            priceSource = 'COMPETITOR'
          }
        }
        
        // If not base or no competitor price, use ratio scaling
        if (priceCad <= 0 && referenceBase && referenceBase.priceCny > 0) {
          const ratio = priceCny / referenceBase.priceCny
          priceCad = referenceBase.priceCad * ratio
          priceSource = 'RATIO'
        }
        
        // If still no price, use default markup
        if (priceCad <= 0) {
          priceCad = priceCny * CONFIG.exchangeRate * 2.5
          priceSource = 'DEFAULT'
        }
        
        priceCad = Math.round(priceCad * 100) / 100
        
        // Calculate cost and margins
        const totalCostCad = calculateCost(priceCny, CONFIG.shippingCnyPerProduct)
        const marginStandard = calculateMarginStandard(priceCad, totalCostCad)
        const marginPromo = calculateMarginPromo(priceCad, totalCostCad)
        
        // Determine status based on PROMO margin (worst case)
        // If promo margin is negative, item is unprofitable
        let newStatus = 'Active'
        if (marginPromo < CONFIG.minMarginForActive) {
          newStatus = 'Unprofitable'
          totalUnprofitable++
        } else {
          totalActive++
        }
        
        // Is this a bundle?
        const isBundle = baseVariants.length > 0 && !isBase
        
        // Store result
        results.push({
          productTitle: productInfo.title,
          variantName,
          id: variant.id,
          priceCny,
          priceCad,
          totalCostCad: Math.round(totalCostCad * 100) / 100,
          marginStandard: Math.round(marginStandard * 1000) / 10,
          marginPromo: Math.round(marginPromo * 1000) / 10,
          isBase,
          isBundle,
          priceSource,
          currentStatus,
          newStatus,
          statusChanged: currentStatus !== newStatus,
        })
        
        totalProcessed++
      }
    }
    
    // Sort results by product then variant
    results.sort((a, b) => {
      if (a.productTitle !== b.productTitle) return a.productTitle.localeCompare(b.productTitle)
      return a.variantName.localeCompare(b.variantName)
    })
    
    // Display results
    let currentProduct = ''
    for (const r of results) {
      if (r.productTitle !== currentProduct) {
        console.log('')
        console.log(`📦 ${r.productTitle}`)
        currentProduct = r.productTitle
      }
      
      const typeLabel = r.isBase ? 'BASE' : (r.isBundle ? 'BUNDLE' : 'ITEM')
      const statusIcon = r.newStatus === 'Active' ? '✓' : '❌'
      const changedNote = r.statusChanged ? ` [was: ${r.currentStatus}]` : ''
      
      console.log(`   ${statusIcon} ${r.variantName.substring(0, 35).padEnd(36)} ` +
        `${typeLabel.padStart(6)} | ` +
        `¥${r.priceCny.toString().padStart(4)} → $${r.priceCad.toFixed(2).padStart(6)} | ` +
        `Cost: $${r.totalCostCad.toFixed(2).padStart(5)} | ` +
        `Std: ${r.marginStandard.toFixed(1).padStart(5)}% | ` +
        `Promo: ${r.marginPromo.toFixed(1).padStart(6)}% | ` +
        `${r.newStatus}${changedNote}`)
    }
    
    // Summary
    console.log('')
    console.log('='.repeat(100))
    console.log('SUMMARY')
    console.log('='.repeat(100))
    console.log(`Total variants processed: ${totalProcessed}`)
    console.log(`  → Active (profitable): ${totalActive}`)
    console.log(`  → Unprofitable (negative promo margin): ${totalUnprofitable}`)
    console.log('')
    
    // Show status changes
    const statusChanges = results.filter(r => r.statusChanged)
    if (statusChanges.length > 0) {
      console.log('STATUS CHANGES:')
      for (const r of statusChanges) {
        console.log(`  ${r.productTitle} / ${r.variantName}: ${r.currentStatus} → ${r.newStatus}`)
      }
      console.log('')
    }
    
    // Update Knack
    if (!dryRun) {
      console.log('Updating Knack database...')
      let updateCount = 0
      
      for (const r of results) {
        const updateData = {
          [FIELD_KEYS.variants.priceCad]: r.priceCad,
          [FIELD_KEYS.variants.totalCostCad]: r.totalCostCad,
          [FIELD_KEYS.variants.marginStandard]: r.marginStandard,
          [FIELD_KEYS.variants.marginPromo]: r.marginPromo,
          [FIELD_KEYS.variants.isBundle]: r.isBundle,
          [FIELD_KEYS.variants.status]: r.newStatus,
        }
        
        try {
          await knack.updateRecord(FIELD_KEYS.variants.objectKey, r.id, updateData)
          updateCount++
          process.stdout.write(`\r  Updated ${updateCount}/${results.length}`)
        } catch (err) {
          console.log(`\n  ❌ Failed to update ${r.variantName}: ${err.message}`)
          totalErrors++
        }
      }
      
      console.log('')
      console.log(`✓ Updated ${updateCount} variants`)
      if (totalErrors > 0) {
        console.log(`❌ ${totalErrors} errors`)
      }
    } else {
      console.log('DRY RUN - No changes made')
      console.log('Run without --dry-run to apply changes')
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message)
    process.exit(1)
  }
}

main()

