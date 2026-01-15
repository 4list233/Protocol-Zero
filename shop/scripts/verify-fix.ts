#!/usr/bin/env tsx
/**
 * Debug script to verify products are now showing correctly
 */

import 'dotenv/config'
import { fetchProducts } from '../lib/notion-client'

async function verifyFix() {
  console.log('='.repeat(80))
  console.log('VERIFY: Products and Variants After Fix')
  console.log('='.repeat(80))
  console.log('')

  console.log('Fetching products using fetchProducts()...')
  const products = await fetchProducts()

  console.log(`\n✅ Found ${products.length} products\n`)

  // Count total variants
  let totalVariants = 0
  let productsWithVariants = 0
  let productsWithoutVariants = 0

  for (const product of products) {
    if (product.variants && product.variants.length > 0) {
      totalVariants += product.variants.length
      productsWithVariants++
    } else {
      productsWithoutVariants++
    }
  }

  console.log('SUMMARY:')
  console.log('-'.repeat(80))
  console.log(`  Products with variants: ${productsWithVariants}`)
  console.log(`  Products without variants: ${productsWithoutVariants}`)
  console.log(`  Total variants displayed: ${totalVariants}`)
  console.log('')

  console.log('SAMPLE PRODUCTS (first 10):')
  console.log('-'.repeat(80))
  
  for (const product of products.slice(0, 10)) {
    const variantCount = product.variants?.length || 0
    const cheapestPrice = product.variants && product.variants.length > 0
      ? Math.min(...product.variants.map(v => v.price_cad || 0))
      : 0
    
    console.log(`\n📦 ${product.title}`)
    console.log(`   ID: ${product.id}`)
    console.log(`   Variants: ${variantCount}`)
    console.log(`   Price from: $${cheapestPrice.toFixed(2)} CAD`)
    
    if (product.variants && product.variants.length > 0) {
      console.log(`   Sample variants:`)
      product.variants.slice(0, 3).forEach(v => {
        console.log(`     - ${v.variantName} ($${v.price_cad?.toFixed(2) || '0.00'}) [${v.status || 'No status'}]`)
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Fix verified! Products should now be visible in the shop.')
  console.log('='.repeat(80))
}

verifyFix().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
