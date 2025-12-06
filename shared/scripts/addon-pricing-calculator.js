#!/usr/bin/env node
/**
 * Add-On Pricing Calculator
 * 
 * This script calculates add-on prices for small items that are unprofitable
 * when sold alone but become highly profitable when shipped with other items.
 * 
 * Usage:
 *   node addon-pricing-calculator.js [--dry-run] [--target-margin=0.5]
 * 
 * Options:
 *   --dry-run         Preview without saving to Knack
 *   --target-margin   Target margin for add-on pricing (default: 0.5 = 50%)
 */

const https = require('https')

// ============ CONFIGURATION ============

const CONFIG = {
  // Exchange rate (CNY to CAD)
  exchangeRate: 0.20,
  
  // Target margin for add-on items (50% default)
  targetAddonMargin: 0.50,
  
  // Salesperson cut on revenue
  salespersonCut: 0.10,
  
  // Shipping cost for add-on items (CNY)
  // Lower than standalone (¥70) since shipping together
  addonShippingCny: 20,
  
  // Minimum cart value to unlock add-on pricing (CAD)
  defaultMinCartForAddon: 30,
  
  // Maximum CNY price for an item to be eligible as add-on
  // Items above this are too expensive to give away cheap
  maxCnyForAddon: 60,
}

// ============ KNACK FIELD KEYS ============
// UPDATE THESE after creating the new fields in Knack

const FIELD_KEYS = {
  variants: {
    objectKey: 'object_7',
    variantName: 'field_62',
    priceCny: 'field_64',
    sellingPrice: 'field_138',
    status: 'field_67',
    totalCostCad: 'field_153',
    marginStandard: 'field_154',
    
    // ADD-ON FIELDS
    isAddonItem: 'field_158',      // Yes/No
    addonPriceCad: 'field_159',    // Number
    addonCostCad: 'field_160',     // Number  
    addonMargin: 'field_161',      // Number (%)
    minCartForAddon: 'field_162',  // Number
  }
}

// ============ KNACK CLIENT ============

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
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error(`Parse error: ${data}`))
          }
        })
      })
      
      req.on('error', reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }
  
  async getRecords(objectKey) {
    const response = await this.request('GET', `/objects/${objectKey}/records?rows_per_page=1000`)
    return response.records || []
  }
  
  async updateRecord(objectKey, recordId, data) {
    return this.request('PUT', `/objects/${objectKey}/records/${recordId}`, data)
  }
}

// ============ HELPERS ============

function parsePrice(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[$¥,\s]/g, '')
  return Number(cleaned) || 0
}

/**
 * Calculate add-on cost (item + reduced shipping)
 */
function calculateAddonCost(itemCny) {
  return (itemCny + CONFIG.addonShippingCny) * CONFIG.exchangeRate
}

/**
 * Calculate add-on price for target margin
 * 
 * Formula: price = cost / (1 - margin - salesperson_cut)
 */
function calculateAddonPrice(itemCny, targetMargin) {
  const costCad = calculateAddonCost(itemCny)
  const divisor = 1 - targetMargin - CONFIG.salespersonCut
  const price = costCad / divisor
  return Math.round(price * 100) / 100
}

/**
 * Calculate margin at a given price
 */
function calculateMargin(priceCad, costCad) {
  if (priceCad <= 0) return 0
  const afterSalesperson = priceCad * (1 - CONFIG.salespersonCut)
  return (afterSalesperson - costCad) / priceCad
}

// ============ MAIN ============

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  
  // Parse target margin if provided
  const marginArg = args.find(a => a.startsWith('--target-margin='))
  if (marginArg) {
    CONFIG.targetAddonMargin = parseFloat(marginArg.split('=')[1])
  }
  
  console.log('='.repeat(70))
  console.log('ADD-ON PRICING CALCULATOR')
  console.log('='.repeat(70))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`)
  console.log(`Target Add-on Margin: ${(CONFIG.targetAddonMargin * 100).toFixed(0)}%`)
  console.log(`Add-on Shipping: ¥${CONFIG.addonShippingCny} (vs ¥70 standalone)`)
  console.log(`Min Cart for Add-on: $${CONFIG.defaultMinCartForAddon}`)
  console.log('')
  
  // Check if add-on fields are configured
  const fieldsConfigured = FIELD_KEYS.variants.isAddonItem && 
                          FIELD_KEYS.variants.addonPriceCad
  
  if (!fieldsConfigured) {
    console.log('⚠️  ADD-ON FIELDS NOT YET CONFIGURED IN KNACK')
    console.log('')
    console.log('Please add these fields to Knack Variants object:')
    console.log('  1. Is Add-on Item (Yes/No)')
    console.log('  2. Add-on Price CAD (Number)')
    console.log('  3. Add-on Cost CAD (Number)')
    console.log('  4. Add-on Margin (Number)')
    console.log('  5. Min Cart for Add-on (Number)')
    console.log('')
    console.log('Then update FIELD_KEYS in this script with the field keys.')
    console.log('')
    console.log('Running in PREVIEW MODE to show what would be calculated...')
    console.log('')
  }
  
  const knack = new KnackClient()
  
  // Fetch all variants
  console.log('Fetching variants...')
  const variants = await knack.getRecords(FIELD_KEYS.variants.objectKey)
  console.log(`Found ${variants.length} variants`)
  console.log('')
  
  // Find variants that are:
  // 1. Status = Unprofitable OR have negative margin
  // 2. Price CNY is low enough to be an add-on
  const eligibleForAddon = []
  
  for (const variant of variants) {
    const name = variant[FIELD_KEYS.variants.variantName] || 'Unknown'
    const priceCny = parsePrice(variant[FIELD_KEYS.variants.priceCny])
    const status = variant[FIELD_KEYS.variants.status]
    const marginStd = parsePrice(variant[FIELD_KEYS.variants.marginStandard])
    
    // Skip if no CNY price
    if (priceCny <= 0) continue
    
    // Check if eligible for add-on pricing
    const isUnprofitable = status === 'Unprofitable' || marginStd < 0
    const isSmallEnough = priceCny <= CONFIG.maxCnyForAddon
    
    if (isUnprofitable && isSmallEnough) {
      const addonCostCad = calculateAddonCost(priceCny)
      const addonPriceCad = calculateAddonPrice(priceCny, CONFIG.targetAddonMargin)
      const addonMargin = calculateMargin(addonPriceCad, addonCostCad)
      
      eligibleForAddon.push({
        id: variant.id,
        name,
        priceCny,
        addonCostCad: Math.round(addonCostCad * 100) / 100,
        addonPriceCad,
        addonMargin: Math.round(addonMargin * 1000) / 10,
        currentStatus: status,
      })
    }
  }
  
  console.log('-'.repeat(70))
  console.log('ELIGIBLE FOR ADD-ON PRICING')
  console.log('-'.repeat(70))
  console.log('')
  console.log(
    'Item'.padEnd(45) +
    'CNY'.padStart(8) +
    'Cost'.padStart(10) +
    'Add-on$'.padStart(10) +
    'Margin'.padStart(10)
  )
  console.log('-'.repeat(70))
  
  for (const item of eligibleForAddon) {
    console.log(
      item.name.substring(0, 43).padEnd(45) +
      `¥${item.priceCny}`.padStart(8) +
      `$${item.addonCostCad.toFixed(2)}`.padStart(10) +
      `$${item.addonPriceCad.toFixed(2)}`.padStart(10) +
      `${item.addonMargin}%`.padStart(10)
    )
  }
  
  console.log('')
  console.log('-'.repeat(70))
  console.log(`Total eligible items: ${eligibleForAddon.length}`)
  console.log('')
  
  // Update Knack if fields are configured and not dry run
  if (fieldsConfigured && !dryRun) {
    console.log('Updating Knack...')
    
    for (const item of eligibleForAddon) {
      const updateData = {
        [FIELD_KEYS.variants.isAddonItem]: true,
        [FIELD_KEYS.variants.addonPriceCad]: item.addonPriceCad,
        [FIELD_KEYS.variants.addonCostCad]: item.addonCostCad,
        [FIELD_KEYS.variants.addonMargin]: item.addonMargin,
        [FIELD_KEYS.variants.minCartForAddon]: CONFIG.defaultMinCartForAddon,
        // Also update status to Active (available as add-on)
        [FIELD_KEYS.variants.status]: 'Active',
      }
      
      await knack.updateRecord(FIELD_KEYS.variants.objectKey, item.id, updateData)
      console.log(`  ✓ ${item.name}`)
    }
    
    console.log('')
    console.log('Done!')
  } else if (!fieldsConfigured) {
    console.log('Add the Knack fields and update FIELD_KEYS to enable saving.')
  } else {
    console.log('DRY RUN - no changes made. Remove --dry-run to apply.')
  }
  
  // Summary
  console.log('')
  console.log('='.repeat(70))
  console.log('BUSINESS IMPACT')
  console.log('='.repeat(70))
  
  const totalRevenue = eligibleForAddon.reduce((sum, i) => sum + i.addonPriceCad, 0)
  const totalCost = eligibleForAddon.reduce((sum, i) => sum + i.addonCostCad, 0)
  const totalProfit = totalRevenue * (1 - CONFIG.salespersonCut) - totalCost
  
  console.log(`If each add-on item sells once:`)
  console.log(`  Revenue:      $${totalRevenue.toFixed(2)}`)
  console.log(`  Cost:         $${totalCost.toFixed(2)}`)
  console.log(`  Gross Profit: $${totalProfit.toFixed(2)}`)
  console.log('')
  console.log('These items were LOSING money before. Now they generate profit!')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

