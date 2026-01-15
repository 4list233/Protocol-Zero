#!/usr/bin/env tsx
/**
 * Debug script to check variant status values in Knack
 */

import 'dotenv/config'
import { getKnackRecords } from '../lib/knack-client'
import { KNACK_CONFIG } from '../lib/knack-config'

// Helper to get field value from Knack record
function getFieldValue(record: Record<string, unknown>, fieldKey: string, _fieldName: string): unknown {
  return record[fieldKey]
}

const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants

async function debugVariantStatus() {
  console.log('='.repeat(80))
  console.log('DEBUG: Variant Status Values')
  console.log('='.repeat(80))
  console.log('')

  // Fetch ALL variants (no filters)
  console.log('Fetching all variants from Knack...')
  const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY, {
    sortField: VARIANT_FIELDS.sortOrder,
    sortOrder: 'asc',
  })

  console.log(`Found ${allVariants.length} total variants\n`)

  // Analyze status values
  const statusCounts = new Map<string, number>()
  const statusExamples = new Map<string, string[]>()
  let missingStatus = 0
  let activeCount = 0
  let hasPrice = 0
  let noPriceButActive = 0

  for (const variant of allVariants) {
    const id = String(variant.id || '')
    const variantName = String(getFieldValue(variant, VARIANT_FIELDS.variantName, 'Variant Name') || 'Unknown')
    const statusRaw = getFieldValue(variant, VARIANT_FIELDS.status, 'Status')
    const statusValue = statusRaw ? String(statusRaw) : null
    const priceCadRaw = getFieldValue(variant, VARIANT_FIELDS.priceCad, 'Selling Price')
    const priceCad = priceCadRaw ? Number(priceCadRaw) : undefined

    // Count status values
    if (!statusValue) {
      missingStatus++
    } else {
      const currentCount = statusCounts.get(statusValue) || 0
      statusCounts.set(statusValue, currentCount + 1)
      
      const examples = statusExamples.get(statusValue) || []
      if (examples.length < 3) {
        examples.push(`${variantName} (${id})`)
        statusExamples.set(statusValue, examples)
      }

      if (statusValue === 'Active') {
        activeCount++
      }
    }

    // Check price
    if (priceCad && priceCad > 0) {
      hasPrice++
    }

    // Active but no price?
    if (statusValue === 'Active' && (!priceCad || priceCad === 0)) {
      noPriceButActive++
    }
  }

  console.log('STATUS VALUE DISTRIBUTION:')
  console.log('-'.repeat(80))
  for (const [status, count] of Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count} variants`)
    const examples = statusExamples.get(status) || []
    examples.forEach(ex => console.log(`    - ${ex}`))
  }
  
  if (missingStatus > 0) {
    console.log(`  [NO STATUS]: ${missingStatus} variants`)
  }

  console.log('')
  console.log('PRICE ANALYSIS:')
  console.log('-'.repeat(80))
  console.log(`  Variants with price_cad > 0: ${hasPrice}`)
  console.log(`  Variants with Active status: ${activeCount}`)
  console.log(`  Active but no price: ${noPriceButActive}`)

  console.log('')
  console.log('FILTERING LOGIC IN CODE:')
  console.log('-'.repeat(80))
  console.log(`  Line 522: if (variant.status !== 'Active') { continue }`)
  console.log(`  This will SKIP ${allVariants.length - activeCount} variants`)
  console.log('')

  console.log('RAW FIELD VALUES (first 5 Active variants):')
  console.log('-'.repeat(80))
  let shown = 0
  for (const variant of allVariants) {
    const statusRaw = getFieldValue(variant, VARIANT_FIELDS.status, 'Status')
    if (statusRaw === 'Active' && shown < 5) {
      const variantName = String(getFieldValue(variant, VARIANT_FIELDS.variantName, 'Variant Name') || 'Unknown')
      const priceCadRaw = getFieldValue(variant, VARIANT_FIELDS.priceCad, 'Selling Price')
      
      console.log(`\nVariant: ${variantName}`)
      console.log(`  Status field (${VARIANT_FIELDS.status}): ${JSON.stringify(statusRaw)}`)
      console.log(`  Price CAD field (${VARIANT_FIELDS.priceCad}): ${JSON.stringify(priceCadRaw)}`)
      shown++
    }
  }

  console.log('\n' + '='.repeat(80))
}

debugVariantStatus().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
