#!/usr/bin/env node
/**
 * Standardize Variant Options
 * 
 * This script creates a standardized variant structure:
 * - Option Type 1 = "Model" 
 * - Option Value 1 = Model identifier (e.g., "1x White", "2x Black", "No Label")
 * - Option Type 2 = "Size"
 * - Option Value 2 = Size value (e.g., "XXS", "XS", "S", "M", "L", "80-110lb")
 * 
 * This makes sizes selectable in the frontend while keeping variant names intact.
 * Orders will store: variantId + selectedSize for easy tracking in Knack dashboard.
 */

const https = require('https')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

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
const FIELD_PRICE_CNY = 'field_64'

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

function getModelIdentifier(name) {
  const n = (name || '').toLowerCase()
  
  // Extract quantity and color for standardized ID
  let qty = ''
  let color = ''
  
  if (n.includes('1x') || n.includes('1×')) qty = '1x'
  else if (n.includes('2x') || n.includes('2×')) qty = '2x'
  
  if (n.includes('white')) color = 'White'
  else if (n.includes('black')) color = 'Black'
  
  // For products with model names (like "No Label", "Cool Peak")
  if (n.includes('no label')) return 'No Label'
  if (n.includes('cool peak')) return 'Cool Peak Knee Elbow'
  
  // Return standardized format: "1x White", "2x Black", etc.
  if (qty && color) return `${qty} ${color}`
  
  // Fallback: use first part of name before " - "
  const parts = name.split(' - ')
  return parts[0] || name
}

function extractSize(name) {
  // Try size codes first (XXS, XS, S, M, L)
  const sizeMatch = (name || '').match(/\b(xxs|xs|s|m|l|xl|xxl)\b/i)
  if (sizeMatch) return sizeMatch[1].toUpperCase()
  
  // Try weight ranges (80-110lb, etc.)
  const weightMatch = (name || '').match(/(\d+-\d+lb)/i)
  if (weightMatch) return weightMatch[1]
  
  return null
}

function isModelVariant(name) {
  const n = (name || '').toLowerCase()
  // Model variants have quantity indicators
  return (n.includes('1x') || n.includes('2x') || n.includes('1×') || n.includes('2×')) ||
         (n.includes('no label') || n.includes('cool peak'))
}

function isSizeVariant(name) {
  const n = (name || '').toLowerCase()
  return n.includes('size') && extractSize(name) !== null
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

  if (modelVariants.length === 0) {
    console.log(`  No model variants found - skipping`)
    return
  }

  // Extract available sizes from size variants or existing model variants
  const availableSizes = new Set()
  sizeVariants.forEach(v => {
    const size = extractSize(v[FIELD_VARIANT_NAME])
    if (size) availableSizes.add(size)
  })
  // Also check model variants for sizes
  modelVariants.forEach(v => {
    const size = extractSize(v[FIELD_VARIANT_NAME])
    if (size) availableSizes.add(size)
  })
  
  const sizeList = Array.from(availableSizes).sort()
  console.log(`  Available sizes: ${sizeList.join(', ')}`)

  if (sizeList.length === 0) {
    console.log(`  No sizes found - product may not need size options`)
    return
  }

  // Step 1: Update model variants with standardized Option Value 1
  console.log(`\n  Step 1: Standardizing model variants...`)
  for (const modelVar of modelVariants) {
    const modelName = modelVar[FIELD_VARIANT_NAME]
    const modelId = getModelIdentifier(modelName)
    const currentSize = extractSize(modelName) || sizeList[0]

    const updateData = {
      [FIELD_OPTION_TYPE_1]: 'Model',
      [FIELD_OPTION_VALUE_1]: modelId, // Standardized model ID
      [FIELD_OPTION_TYPE_2]: 'Size',
      [FIELD_OPTION_VALUE_2]: currentSize, // Current size or first available
    }

    console.log(`    ${modelName}`)
    console.log(`      → Model ID: "${modelId}", Size: ${currentSize}`)

    if (!dryRun) {
      await client.updateRecord(VARIANT_OBJECT, modelVar.id, updateData)
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  // Step 2: Create model × size combinations for all sizes
  console.log(`\n  Step 2: Creating model × size combinations...`)
  const productLink = modelVariants[0][FIELD_PRODUCT] // Get product link from first model
  
  for (const modelVar of modelVariants) {
    const modelName = modelVar[FIELD_VARIANT_NAME]
    const modelId = getModelIdentifier(modelName)
    
    // Check which sizes already exist for this model
    const existingVariants = productVariants.filter(v => {
      const vModelId = getModelIdentifier(v[FIELD_VARIANT_NAME])
      const vSize = extractSize(v[FIELD_VARIANT_NAME]) || v[FIELD_OPTION_VALUE_2]
      return vModelId === modelId && vSize && sizeList.includes(vSize)
    })
    const existingSizes = new Set(existingVariants.map(v => extractSize(v[FIELD_VARIANT_NAME]) || v[FIELD_OPTION_VALUE_2]).filter(Boolean))

    // Create missing size combinations
    for (const size of sizeList) {
      if (!existingSizes.has(size)) {
        const newVariantName = `${modelName} - ${size}`
        const sizeVariant = sizeVariants.find(v => extractSize(v[FIELD_VARIANT_NAME]) === size)
        const price = sizeVariant?.[FIELD_PRICE_CAD] || modelVar[FIELD_PRICE_CAD] || 0
        const priceCny = sizeVariant?.[FIELD_PRICE_CNY] || modelVar[FIELD_PRICE_CNY] || 0

        console.log(`    Creating: ${newVariantName}`)

        if (!dryRun) {
          try {
            const newVariantData = {
              [FIELD_VARIANT_NAME]: newVariantName,
              [FIELD_PRODUCT]: productLink,
              [FIELD_STATUS]: 'Active',
              [FIELD_OPTION_TYPE_1]: 'Model',
              [FIELD_OPTION_VALUE_1]: modelId,
              [FIELD_OPTION_TYPE_2]: 'Size',
              [FIELD_OPTION_VALUE_2]: size,
              [FIELD_PRICE_CAD]: price,
              [FIELD_PRICE_CNY]: priceCny,
            }

            await client.createRecord(VARIANT_OBJECT, newVariantData)
            await new Promise((r) => setTimeout(r, 400))
          } catch (err) {
            console.error(`      Error: ${err.message}`)
          }
        }
      }
    }
  }

  // Step 3: Archive standalone size variants (they're now part of model × size combos)
  if (sizeVariants.length > 0) {
    console.log(`\n  Step 3: Archiving ${sizeVariants.length} standalone size variants...`)
    for (const sizeVar of sizeVariants) {
      console.log(`    Archiving: ${sizeVar[FIELD_VARIANT_NAME]}`)
      if (!dryRun) {
        await client.updateRecord(VARIANT_OBJECT, sizeVar.id, {
          [FIELD_STATUS]: 'Inactive',
        })
        await new Promise((r) => setTimeout(r, 200))
      }
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

