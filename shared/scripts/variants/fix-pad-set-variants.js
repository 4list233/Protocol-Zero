#!/usr/bin/env node
/**
 * Fix variant inconsistencies for "Competition Knee & Elbow Pad Set with Wrist Guards"
 * 
 * Issues to fix:
 * - Some variants (black and white, black and pink) missing size charts/options
 * - Inconsistent Option Type 1/2 labels
 * - Need to standardize: Option Type 1 = "Color", Option Type 2 = "Size"
 * 
 * Usage: node fix-pad-set-variants.js [--dry-run]
 */

const https = require('https')

const PRODUCT_SEARCH_TERMS = [
  'Competition Knee',
  'Knee Elbow Pad',
  'Wrist Guards',
  'knee-elbow-pad-set'
]

const VARIANTS_OBJECT = 'object_7'
const PRODUCTS_OBJECT = 'object_6'

const FIELD_KEYS = {
  // Products
  productId: 'field_45',
  productTitle: 'field_47',
  
  // Variants
  product: 'field_61',        // Connection to product
  variantName: 'field_62',
  sku: 'field_63',
  status: 'field_67',
  optionType1: 'field_145',
  optionValue1: 'field_146',
  optionType2: 'field_147',
  optionValue2: 'field_148',
}

// Standard size options for this product
const STANDARD_SIZES = [
  '80-110斤',
  '110-150斤',
  '150-210斤',
  '80-110 Jin',
  '110-150 Jin',
  '150-210 Jin',
  '80-110',
  '110-150',
  '150-210',
]

// Color mappings for consistency
const COLOR_MAPPINGS = {
  'black and white': 'Black and White',
  'black and pink': 'Black and Pink',
  'black pink': 'Black and Pink',
  'gray black': 'Gray Black',
  'gray': 'Gray',
  'black': 'Black',
}

class KnackClient {
  constructor() {
    this.applicationId = process.env.KNACK_APPLICATION_ID
    this.apiKey = process.env.KNACK_REST_API_KEY
    
    if (!this.applicationId || !this.apiKey) {
      throw new Error('Missing Knack credentials. Set KNACK_APPLICATION_ID and KNACK_REST_API_KEY')
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
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }
  
  async getRecords(objectKey, filters = {}) {
    let allRecords = []
    let page = 1
    const perPage = 1000
    
    while (true) {
      let path = `/objects/${objectKey}/records?rows_per_page=${perPage}&page=${page}`
      
      // Add filters if provided
      if (Object.keys(filters).length > 0) {
        const filterStr = JSON.stringify({ filters })
        path += `&filters=${encodeURIComponent(filterStr)}`
      }
      
      const response = await this.request('GET', path)
      const records = response.records || []
      allRecords.push(...records)
      
      if (!response.has_more || records.length < perPage) break
      page++
    }
    
    return allRecords
  }
  
  async updateRecord(objectKey, recordId, data) {
    const path = `/objects/${objectKey}/records/${recordId}`
    return this.request('PUT', path, data)
  }
  
  async createRecord(objectKey, data) {
    const path = `/objects/${objectKey}/records`
    return this.request('POST', path, data)
  }
}

function normalizeColor(variantName) {
  const name = variantName.toLowerCase()
  for (const [key, value] of Object.entries(COLOR_MAPPINGS)) {
    if (name.includes(key)) {
      return value
    }
  }
  // Try to extract color from variant name
  if (name.includes('black') && name.includes('white')) return 'Black and White'
  if (name.includes('black') && name.includes('pink')) return 'Black and Pink'
  if (name.includes('gray') || name.includes('grey')) return 'Gray'
  if (name.includes('black')) return 'Black'
  return null
}

function extractSize(variantName) {
  const name = variantName.toLowerCase()
  
  // Look for size patterns
  for (const size of STANDARD_SIZES) {
    if (name.includes(size.toLowerCase()) || variantName.includes(size)) {
      // Normalize to standard format
      if (size.includes('80-110')) return '80-110斤'
      if (size.includes('110-150')) return '110-150斤'
      if (size.includes('150-210')) return '150-210斤'
    }
  }
  
  // Check for jin/jin patterns
  const jinMatch = variantName.match(/(\d+)-(\d+)\s*(斤|Jin|jin)/i)
  if (jinMatch) {
    return `${jinMatch[1]}-${jinMatch[2]}斤`
  }
  
  return null
}

function parseVariantOptions(variantName) {
  const color = normalizeColor(variantName)
  const size = extractSize(variantName)
  
  let optionType1 = null
  let optionValue1 = null
  let optionType2 = null
  let optionValue2 = null
  
  if (color) {
    optionType1 = 'Color'
    optionValue1 = color
  }
  
  if (size) {
    if (color) {
      optionType2 = 'Size'
      optionValue2 = size
    } else {
      optionType1 = 'Size'
      optionValue1 = size
    }
  }
  
  return { optionType1, optionValue1, optionType2, optionValue2 }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  
  console.log('='.repeat(60))
  console.log('FIX PAD SET VARIANTS')
  console.log('='.repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`)
  console.log('')
  
  const knack = new KnackClient()
  
  // Find the product
  console.log('Searching for product...')
  const products = await knack.getRecords(PRODUCTS_OBJECT)
  
  const targetProduct = products.find(p => {
    const title = (p[FIELD_KEYS.productTitle] || '').toLowerCase()
    return PRODUCT_SEARCH_TERMS.some(term => title.includes(term.toLowerCase()))
  })
  
  if (!targetProduct) {
    console.error('❌ Product not found!')
    console.log('Searched for:', PRODUCT_SEARCH_TERMS.join(', '))
    console.log('Available products:')
    products.slice(0, 10).forEach(p => {
      console.log(`  - ${p[FIELD_KEYS.productTitle]}`)
    })
    process.exit(1)
  }
  
  const productId = targetProduct.id
  const productTitle = targetProduct[FIELD_KEYS.productTitle]
  console.log(`✅ Found product: ${productTitle}`)
  console.log(`   Product ID: ${productId}`)
  console.log('')
  
  // Get all variants for this product
  console.log('Fetching variants...')
  const allVariants = await knack.getRecords(VARIANTS_OBJECT, {
    [FIELD_KEYS.product]: productId
  })
  
  console.log(`Found ${allVariants.length} variants`)
  console.log('')
  
  // Analyze variants
  const issues = []
  const fixes = []
  const newVariants = []
  
  // Track which color+size combinations exist
  const existingCombos = new Set()
  
  for (const variant of allVariants) {
    const variantName = variant[FIELD_KEYS.variantName] || ''
    const currentType1 = variant[FIELD_KEYS.optionType1]
    const currentValue1 = variant[FIELD_KEYS.optionValue1]
    const currentType2 = variant[FIELD_KEYS.optionType2]
    const currentValue2 = variant[FIELD_KEYS.optionValue2]
    
    const parsed = parseVariantOptions(variantName)
    
    // Check for issues
    const hasIssues = 
      currentType1 !== parsed.optionType1 ||
      currentValue1 !== parsed.optionValue1 ||
      currentType2 !== parsed.optionType2 ||
      currentValue2 !== parsed.optionValue2 ||
      (!parsed.optionType2 && variantName.toLowerCase().includes('black') && 
       (variantName.toLowerCase().includes('white') || variantName.toLowerCase().includes('pink')))
    
    if (hasIssues) {
      issues.push({
        variant,
        variantName,
        current: { currentType1, currentValue1, currentType2, currentValue2 },
        parsed
      })
    }
    
    // Track existing combinations
    const color = parsed.optionValue1 || currentValue1 || 'Unknown'
    const size = parsed.optionValue2 || currentValue2 || 'Unknown'
    existingCombos.add(`${color}|${size}`)
  }
  
  console.log(`Found ${issues.length} variants with issues`)
  console.log('')
  
  // Generate fixes
  for (const issue of issues) {
    const { variant, variantName, parsed } = issue
    
    fixes.push({
      variantId: variant.id,
      variantName,
      updates: {
        [FIELD_KEYS.optionType1]: parsed.optionType1 || '',
        [FIELD_KEYS.optionValue1]: parsed.optionValue1 || '',
        [FIELD_KEYS.optionType2]: parsed.optionType2 || '',
        [FIELD_KEYS.optionValue2]: parsed.optionValue2 || '',
      }
    })
  }
  
  // Check for missing variants (black and white, black and pink with sizes)
  const missingColors = ['Black and White', 'Black and Pink']
  const missingSizes = ['80-110斤', '110-150斤', '150-210斤']
  
  for (const color of missingColors) {
    for (const size of missingSizes) {
      const combo = `${color}|${size}`
      if (!existingCombos.has(combo)) {
        // Check if a variant exists but just missing size
        const existingVariant = allVariants.find(v => {
          const vName = (v[FIELD_KEYS.variantName] || '').toLowerCase()
          const vColor = normalizeColor(v[FIELD_KEYS.variantName] || '')
          return vColor === color && !extractSize(v[FIELD_KEYS.variantName] || '')
        })
        
        if (existingVariant) {
          // Update existing variant to add size
          fixes.push({
            variantId: existingVariant.id,
            variantName: existingVariant[FIELD_KEYS.variantName],
            updates: {
              [FIELD_KEYS.optionType1]: 'Color',
              [FIELD_KEYS.optionValue1]: color,
              [FIELD_KEYS.optionType2]: 'Size',
              [FIELD_KEYS.optionValue2]: size,
            }
          })
        } else {
          // Need to create new variant
          newVariants.push({
            variantName: `${color} / ${size}`,
            optionType1: 'Color',
            optionValue1: color,
            optionType2: 'Size',
            optionValue2: size,
          })
        }
      }
    }
  }
  
  // Display summary
  console.log('='.repeat(60))
  console.log('ANALYSIS SUMMARY')
  console.log('='.repeat(60))
  console.log(`Variants to fix: ${fixes.length}`)
  console.log(`New variants to create: ${newVariants.length}`)
  console.log('')
  
  if (fixes.length > 0) {
    console.log('FIXES NEEDED:')
    fixes.forEach((fix, i) => {
      console.log(`\n${i + 1}. ${fix.variantName}`)
      console.log(`   Current: Type1=${fix.updates[FIELD_KEYS.optionType1] || 'empty'}, Value1=${fix.updates[FIELD_KEYS.optionValue1] || 'empty'}`)
      console.log(`            Type2=${fix.updates[FIELD_KEYS.optionType2] || 'empty'}, Value2=${fix.updates[FIELD_KEYS.optionValue2] || 'empty'}`)
      console.log(`   Update:  Type1=${fix.updates[FIELD_KEYS.optionType1] || 'empty'}, Value1=${fix.updates[FIELD_KEYS.optionValue1] || 'empty'}`)
      console.log(`            Type2=${fix.updates[FIELD_KEYS.optionType2] || 'empty'}, Value2=${fix.updates[FIELD_KEYS.optionValue2] || 'empty'}`)
    })
  }
  
  if (newVariants.length > 0) {
    console.log('\nNEW VARIANTS TO CREATE:')
    newVariants.forEach((nv, i) => {
      console.log(`\n${i + 1}. ${nv.variantName}`)
      console.log(`   Type1=${nv.optionType1}, Value1=${nv.optionValue1}`)
      console.log(`   Type2=${nv.optionType2}, Value2=${nv.optionValue2}`)
    })
  }
  
  if (dryRun) {
    console.log('\n' + '='.repeat(60))
    console.log('DRY RUN - No changes made')
    console.log('='.repeat(60))
    return
  }
  
  // Apply fixes
  console.log('\n' + '='.repeat(60))
  console.log('APPLYING FIXES')
  console.log('='.repeat(60))
  
  let updated = 0
  let created = 0
  let errors = 0
  
  // Update existing variants
  for (const fix of fixes) {
    try {
      await knack.updateRecord(VARIANTS_OBJECT, fix.variantId, fix.updates)
      updated++
      console.log(`✅ Updated: ${fix.variantName}`)
    } catch (err) {
      console.error(`❌ Error updating ${fix.variantName}: ${err.message}`)
      errors++
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Create new variants
  for (const nv of newVariants) {
    try {
      // Need to get other variant fields to copy structure
      const templateVariant = allVariants[0]
      const newVariantData = {
        [FIELD_KEYS.product]: [productId],
        [FIELD_KEYS.variantName]: nv.variantName,
        [FIELD_KEYS.optionType1]: nv.optionType1,
        [FIELD_KEYS.optionValue1]: nv.optionValue1,
        [FIELD_KEYS.optionType2]: nv.optionType2,
        [FIELD_KEYS.optionValue2]: nv.optionValue2,
        // Copy other fields from template if they exist
        [FIELD_KEYS.sku]: templateVariant[FIELD_KEYS.sku] ? `${templateVariant[FIELD_KEYS.sku]}-${nv.optionValue1.replace(/\s+/g, '-')}-${nv.optionValue2.replace(/\s+/g, '-')}` : '',
        [FIELD_KEYS.status]: templateVariant[FIELD_KEYS.status] || 'Active',
      }
      
      await knack.createRecord(VARIANTS_OBJECT, newVariantData)
      created++
      console.log(`✅ Created: ${nv.variantName}`)
    } catch (err) {
      console.error(`❌ Error creating ${nv.variantName}: ${err.message}`)
      errors++
    }
    
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('COMPLETE')
  console.log('='.repeat(60))
  console.log(`Updated: ${updated}`)
  console.log(`Created: ${created}`)
  console.log(`Errors: ${errors}`)
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})

