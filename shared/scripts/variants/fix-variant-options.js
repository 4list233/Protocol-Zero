#!/usr/bin/env node
/**
 * Fix Variant Options - Standardized Format
 * 
 * This script standardizes variant options so:
 * 1. Model variants keep their full names (e.g., "1x Extended Honeycomb Sports Arm Sleeve – White")
 * 2. Sizes become selectable options via Option Type 2
 * 3. All variants use consistent Option Value 1 (model identifier) for grouping
 * 
 * Structure:
 * - Option Type 1 = "Model"
 * - Option Value 1 = Model identifier (e.g., "1x White", "2x Black") - standardized short form
 * - Option Type 2 = "Size" 
 * - Option Value 2 = Size value (e.g., "XXS", "XS", "S", "M", "L")
 * 
 * This makes sizes selectable in the frontend while keeping variant names intact.
 */

const https = require('https')
const path = require('path')
const repoRoot = path.resolve(__dirname, '..', '..', '..')
require('dotenv').config({ path: path.join(repoRoot, '.env') })

const PRODUCT_OBJECT = process.env.KNACK_OBJECT_KEY_PRODUCTS || 'object_6'
const VARIANT_OBJECT = process.env.KNACK_OBJECT_KEY_VARIANTS || 'object_7'
const FIELD_PRODUCT_TITLE = 'field_47'
const FIELD_VARIANT_NAME = 'field_62'
const FIELD_PRODUCT = 'field_61'
const FIELD_STATUS = 'field_67'
const FIELD_OPTION_TYPE_1 = 'field_145'
const FIELD_OPTION_VALUE_1 = 'field_146'
const FIELD_OPTION_TYPE_2 = 'field_147'
const FIELD_OPTION_VALUE_2 = 'field_148'
const FIELD_PRICE_CAD = 'field_138'

function getEnv(n) {
  const v = process.env[n]
  if (!v) throw new Error(`Missing ${n}`)
  return v
}

class KnackClient {
  constructor() {
    this.applicationId = getEnv('KNACK_APPLICATION_ID')
    this.apiKey = getEnv('KNACK_REST_API_KEY')
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.knack.com',
        port: 443,
        path: `/v1${path}`,
        method,
        headers: {
          'X-Knack-Application-Id': this.applicationId,
          'X-Knack-REST-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data || '{}')
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

  async getAllRecords(objectKey) {
    let all = []
    let page = 1
    while (true) {
      const response = await this.request('GET', `/objects/${objectKey}/records?rows_per_page=1000&page=${page}`)
      all = all.concat(response.records || [])
      if (!response.records || response.records.length < 1000) break
      page++
    }
    return all
  }

  updateRecord(objectKey, recordId, data) {
    return this.request('PUT', `/objects/${objectKey}/records/${recordId}`, data)
  }

  createRecord(objectKey, data) {
    return this.request('POST', `/objects/${objectKey}/records`, data)
  }
}

function isModelVariant(name) {
  const n = (name || '').toLowerCase()
  return (n.includes('white') || n.includes('black')) && 
         (n.includes('1x') || n.includes('2x') || n.includes('1×') || n.includes('2×'))
}

function isSizeVariant(name) {
  const n = (name || '').toLowerCase()
  return n.includes('size') && /\b(xxs|xs|s|m|l|xl|xxl|\d+-\d+lb)\b/i.test(n)
}

function extractSize(name) {
  // Try size codes first
  const sizeMatch = (name || '').match(/\b(xxs|xs|s|m|l|xl|xxl)\b/i)
  if (sizeMatch) return sizeMatch[1].toUpperCase()
  
  // Try weight ranges
  const weightMatch = (name || '').match(/(\d+-\d+lb)/i)
  if (weightMatch) return weightMatch[1]
  
  return null
}

function extractModelIdentifier(name) {
  // Create standardized model identifier from variant name
  // e.g., "1x Extended Honeycomb Sports Arm Sleeve – White" -> "1x White"
  const n = (name || '').toLowerCase()
  let qty = ''
  let color = ''
  
  if (n.includes('1x') || n.includes('1×')) qty = '1x'
  else if (n.includes('2x') || n.includes('2×')) qty = '2x'
  
  if (n.includes('white')) color = 'White'
  else if (n.includes('black')) color = 'Black'
  
  if (qty && color) return `${qty} ${color}`
  
  // Fallback: use first few words or a shortened version
  const words = name.split(/\s+/).slice(0, 3).join(' ')
  return words || name
}

async function processProduct(client, productId, dryRun = false) {
  console.log(`\nProcessing product: ${productId}`)

  const allVariants = await client.getAllRecords(VARIANT_OBJECT)
  const productVariants = allVariants.filter((v) => {
    const productConn = v[FIELD_PRODUCT]
    if (typeof productConn === 'string') return productConn.includes(productId)
    if (Array.isArray(productConn)) return productConn.some((p) => String(p).includes(productId))
    if (productConn && typeof productConn === 'object' && productConn.id) return productConn.id === productId
    return false
  })

  const activeVariants = productVariants.filter((v) => v[FIELD_STATUS] === 'Active')
  const modelVariants = activeVariants.filter((v) => isModelVariant(v[FIELD_VARIANT_NAME]))
  const sizeVariants = activeVariants.filter((v) => isSizeVariant(v[FIELD_VARIANT_NAME]))

  console.log(`  Found ${modelVariants.length} model variants, ${sizeVariants.length} size variants`)

  if (sizeVariants.length === 0) {
    console.log(`  No size variants found - skipping`)
    return
  }

  // Extract all available sizes
  const availableSizes = sizeVariants
    .map((v) => extractSize(v[FIELD_VARIANT_NAME]))
    .filter(Boolean)
    .sort()

  console.log(`  Available sizes: ${availableSizes.join(', ')}`)

  // Step 1: Update model variants with standardized Option Value 1
  console.log(`\n  Step 1: Standardizing model variants...`)
  for (const modelVar of modelVariants) {
    const modelName = modelVar[FIELD_VARIANT_NAME]
    const modelId = extractModelIdentifier(modelName)
    const firstSize = availableSizes[0] || ''

    const updateData = {
      // Keep variant name as-is
      // Set Option Value 1 to standardized model identifier for grouping
      [FIELD_OPTION_TYPE_1]: 'Model',
      [FIELD_OPTION_VALUE_1]: modelId, // e.g., "1x White"
      [FIELD_OPTION_TYPE_2]: 'Size',
      [FIELD_OPTION_VALUE_2]: firstSize, // Default to first size
    }

    console.log(`    ${modelName}`)
    console.log(`      → Model ID: ${modelId}`)
    console.log(`      → Default Size: ${firstSize}`)

    if (!dryRun) {
      await client.updateRecord(VARIANT_OBJECT, modelVar.id, updateData)
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  // Step 2: Update size variants to link to each model
  // Each size variant needs to be linked to all model variants
  // We'll create size variants for each model × size combination
  console.log(`\n  Step 2: Creating model × size combinations...`)
  
  for (const modelVar of modelVariants) {
    const modelName = modelVar[FIELD_VARIANT_NAME]
    const modelId = extractModelIdentifier(modelName)
    
    for (const size of availableSizes) {
      // Check if this combination already exists
      const existing = activeVariants.find(v => {
        const vModelId = extractModelIdentifier(v[FIELD_VARIANT_NAME])
        const vSize = extractSize(v[FIELD_VARIANT_NAME])
        return vModelId === modelId && vSize === size
      })

      if (!existing) {
        // Find the size variant to copy price from
        const sizeVariant = sizeVariants.find(v => extractSize(v[FIELD_VARIANT_NAME]) === size)
        const sizePrice = sizeVariant?.[FIELD_PRICE_CAD] || modelVar[FIELD_PRICE_CAD] || 0

        const newVariantName = `${modelName} - ${size}`
        
        console.log(`    Creating: ${newVariantName}`)
        console.log(`      Model ID: ${modelId}, Size: ${size}`)

        if (!dryRun) {
          try {
            const newVariantData = {
              [FIELD_VARIANT_NAME]: newVariantName,
              [FIELD_PRODUCT]: modelVar[FIELD_PRODUCT],
              [FIELD_STATUS]: 'Active',
              [FIELD_OPTION_TYPE_1]: 'Model',
              [FIELD_OPTION_VALUE_1]: modelId,
              [FIELD_OPTION_TYPE_2]: 'Size',
              [FIELD_OPTION_VALUE_2]: size,
              [FIELD_PRICE_CAD]: sizePrice,
            }

            await client.createRecord(VARIANT_OBJECT, newVariantData)
            await new Promise((r) => setTimeout(r, 300))
          } catch (err) {
            console.error(`      Error creating variant: ${err.message}`)
          }
        }
      }
    }
  }

  // Step 3: Archive standalone size variants (they're now part of model × size combos)
  console.log(`\n  Step 3: Archiving standalone size variants...`)
  for (const sizeVar of sizeVariants) {
    console.log(`    Archiving: ${sizeVar[FIELD_VARIANT_NAME]}`)
    if (!dryRun) {
      await client.updateRecord(VARIANT_OBJECT, sizeVar.id, {
        [FIELD_STATUS]: 'Inactive',
      })
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  console.log(`  ✓ Completed${dryRun ? ' (dry run)' : ''}`)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const productIdArg = args.find((a) => a.startsWith('--product-id='))
  const productId = productIdArg ? productIdArg.split('=')[1] : null

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  const client = new KnackClient()

  if (productId) {
    await processProduct(client, productId, dryRun)
  } else {
    console.log('Processing all products...')
    const products = await client.getAllRecords(PRODUCT_OBJECT)
    const activeProducts = products.filter((p) => {
      const status = p['field_51']
      return status === 'Active'
    })

    console.log(`Found ${activeProducts.length} active products`)

    for (const product of activeProducts) {
      await processProduct(client, product.id, dryRun)
    }
  }

  console.log('\n✅ Done!')
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})

