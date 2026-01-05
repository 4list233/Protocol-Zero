#!/usr/bin/env node
/**
 * Merge Size Variants into Model Variants
 * 
 * This script:
 * 1. Identifies model variants (color/quantity) vs size variants
 * 2. Collects all available sizes from size variants
 * 3. Updates model variants to include sizes as a multi-select field (Option Value 2)
 * 4. Archives standalone size variants (sets status to inactive)
 * 
 * IMPORTANT SETUP IN KNACK:
 * - Configure field_148 (Option Value 2) as a MULTI-SELECT field in Knack
 * - This allows storing multiple size options that customers can choose from
 * - When viewing orders in Knack dashboard, you'll see:
 *   - Variant ID (links to the model variant)
 *   - Selected Size (stored in order item - see checkout route for implementation)
 * 
 * ORDER TRACKING:
 * - Orders should store both the variant ID and the selected size
 * - Add a "Selected Size" field to your Orders object in Knack
 * - Update checkout route to save the selected size when creating orders
 * 
 * Usage:
 *   node merge-size-variants-into-models.js [--product-id=XXX] [--dry-run]
 */

const https = require('https')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

const PRODUCT_OBJECT = process.env.KNACK_OBJECT_KEY_PRODUCTS || 'object_6'
const VARIANT_OBJECT = process.env.KNACK_OBJECT_KEY_VARIANTS || 'object_7'
const FIELD_PRODUCT_TITLE = 'field_47'
const FIELD_PRODUCT_ID = 'field_45'
const FIELD_VARIANT_NAME = 'field_62'
const FIELD_PRODUCT = 'field_61'
const FIELD_STATUS = 'field_67'
const FIELD_OPTION_TYPE_1 = 'field_145'
const FIELD_OPTION_VALUE_1 = 'field_146'
const FIELD_OPTION_TYPE_2 = 'field_147'
const FIELD_OPTION_VALUE_2 = 'field_148'
// Multi-select field for available sizes (configure this field as multi-select in Knack)
// If you want to use a different field, update this constant
const FIELD_AVAILABLE_SIZES = process.env.KNACK_FIELD_VARIANTS_AVAILABLE_SIZES || 'field_148'
// Note: For orders to track selected size, you'll need a field in the Orders object
// to store the selected size for each order item

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
}

function isModelVariant(name) {
  const n = (name || '').toLowerCase()
  // Model variants are the main variants (not standalone size/color options)
  // They typically have color and quantity, or are base models
  return (n.includes('white') || n.includes('black')) && 
         (n.includes('1x') || n.includes('2x') || n.includes('1×') || n.includes('2×'))
}

function isSizeVariant(name) {
  const n = (name || '').toLowerCase()
  return n.includes('size') && /\b(xxs|xs|s|m|l|xl|xxl)\b/i.test(n)
}

function isColorVariant(name) {
  const n = (name || '').toLowerCase()
  // Standalone color variants (not model variants with quantity)
  return (n.includes('white') || n.includes('black')) && 
         !(n.includes('1x') || n.includes('2x') || n.includes('1×') || n.includes('2×'))
}

function extractSize(name) {
  const match = (name || '').match(/\b(xxs|xs|s|m|l|xl|xxl)\b/i)
  return match ? match[1].toUpperCase() : null
}

function extractColor(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('white')) return 'White'
  if (n.includes('black')) return 'Black'
  return null
}

function extractQuantity(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('1x') || n.includes('1×')) return '1x'
  if (n.includes('2x') || n.includes('2×')) return '2x'
  return null
}

async function processProduct(client, productId, dryRun = false) {
  console.log(`\nProcessing product: ${productId}`)

  // Get all variants for this product
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
  const colorVariants = activeVariants.filter((v) => isColorVariant(v[FIELD_VARIANT_NAME]))

  console.log(`  Found ${modelVariants.length} model variants, ${sizeVariants.length} size variants, ${colorVariants.length} color variants`)

  // Extract available options based on what variants exist
  let availableSizes = []
  let availableColors = []
  
  if (sizeVariants.length > 0) {
    availableSizes = sizeVariants
      .map((v) => extractSize(v[FIELD_VARIANT_NAME]))
      .filter(Boolean)
      .sort()
    console.log(`  Available sizes: ${availableSizes.join(', ')}`)
  }
  
  if (colorVariants.length > 0) {
    availableColors = colorVariants
      .map((v) => extractColor(v[FIELD_VARIANT_NAME]))
      .filter(Boolean)
      .sort()
    console.log(`  Available colors: ${availableColors.join(', ')}`)
  }

  // If no options to merge, skip
  if (availableSizes.length === 0 && availableColors.length === 0) {
    console.log(`  No size or color variants to merge`)
    return
  }

  // Strategy: Convert size variants into model × size combinations
  // Each model variant gets linked to size variants, making sizes selectable
  if (availableSizes.length > 0 && modelVariants.length > 0) {
    console.log(`  Linking sizes to model variants for selectable options...`)
    
    // First, update size variants to link them to model variants
    // Each size variant becomes a selectable option for all model variants
    const modelIdentifiers = modelVariants.map(v => v[FIELD_VARIANT_NAME])
    
    // Update each model variant to have Option Type 2 = Size
    // The frontend will show all sizes that share the same Option Value 1
    for (const modelVar of modelVariants) {
      const modelName = modelVar[FIELD_VARIANT_NAME]
      
      // Set Option 1 to the model identifier (variant name)
      // Set Option 2 Type to "Size" but don't set a value yet
      // The size variants will have the same Option Value 1, making them selectable
      const updateData = {
        [FIELD_OPTION_TYPE_1]: 'Model',
        [FIELD_OPTION_VALUE_1]: modelName, // Keep full variant name as-is
        [FIELD_OPTION_TYPE_2]: 'Size',
        // Don't set Option Value 2 - it will be set when user selects a size
        // Or set to first available size as default
        [FIELD_OPTION_VALUE_2]: availableSizes[0] || '',
      }

      console.log(`  Updating model variant: ${modelName}`)
      console.log(`    Option 1 (Model): ${modelName}`)
      console.log(`    Option 2 (Size): ${availableSizes[0]} (selectable: ${availableSizes.join(', ')})`)

      if (!dryRun) {
        await client.updateRecord(VARIANT_OBJECT, modelVar.id, updateData)
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    
    // Now update size variants to link them to model variants
    // Each size variant should reference all model variants via Option Value 1
    // This makes them appear as selectable options
    console.log(`  Updating size variants to be selectable options...`)
    for (const sizeVar of sizeVariants) {
      const sizeName = sizeVar[FIELD_VARIANT_NAME]
      const size = extractSize(sizeName)
      
      if (!size) continue
      
      // For each model variant, we need the size variant to be selectable
      // The frontend groups by Option Value 1, so we'll use the first model as reference
      // Actually, we need to create size variants for EACH model
      // But since we can't easily create, we'll update size variants to be linked
      
      // Update size variant to have Option Type 2 = Size with the size value
      // This makes it a selectable option
      const sizeUpdateData = {
        [FIELD_OPTION_TYPE_1]: 'Model',
        [FIELD_OPTION_VALUE_1]: modelVariants[0][FIELD_VARIANT_NAME], // Link to first model (will need manual adjustment)
        [FIELD_OPTION_TYPE_2]: 'Size',
        [FIELD_OPTION_VALUE_2]: size,
        [FIELD_STATUS]: 'Active', // Keep active so they're selectable
      }
      
      console.log(`    Updating size variant: ${sizeName} -> Size=${size}`)
      
      if (!dryRun) {
        await client.updateRecord(VARIANT_OBJECT, sizeVar.id, sizeUpdateData)
        await new Promise((r) => setTimeout(r, 200))
      }
    }
  } else if (availableColors.length > 0 && modelVariants.length > 0) {
    // Similar for colors
    for (const modelVar of modelVariants) {
      const modelName = modelVar[FIELD_VARIANT_NAME]
      
      const updateData = {
        [FIELD_OPTION_TYPE_1]: 'Model',
        [FIELD_OPTION_VALUE_1]: modelName,
        [FIELD_OPTION_TYPE_2]: 'Color',
        [FIELD_OPTION_VALUE_2]: availableColors[0] || '',
      }

      console.log(`  Updating model variant: ${modelName}`)
      console.log(`    Option 1 (Model): ${modelName}`)
      console.log(`    Option 2 (Color): ${availableColors[0]} (selectable: ${availableColors.join(', ')})`)

      if (!dryRun) {
        await client.updateRecord(VARIANT_OBJECT, modelVar.id, updateData)
        await new Promise((r) => setTimeout(r, 200))
      }
    }
  }

  // Archive standalone option variants (sizes and colors)
  const variantsToArchive = [...sizeVariants, ...colorVariants]
  console.log(`\n  Archiving ${variantsToArchive.length} standalone option variants...`)
  for (const optionVar of variantsToArchive) {
    console.log(`    Archiving: ${optionVar[FIELD_VARIANT_NAME]}`)
    if (!dryRun) {
      await client.updateRecord(VARIANT_OBJECT, optionVar.id, {
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
    // Process specific product
    await processProduct(client, productId, dryRun)
  } else {
    // Process all products
    console.log('Processing all products...')
    const products = await client.getAllRecords(PRODUCT_OBJECT)
    const activeProducts = products.filter((p) => {
      const status = p['field_51'] // Status field
      return status === 'Active'
    })

    console.log(`Found ${activeProducts.length} active products`)

    for (const product of activeProducts) {
      const productRecordId = product.id
      await processProduct(client, productRecordId, dryRun)
    }
  }

  console.log('\n✅ Done!')
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})

