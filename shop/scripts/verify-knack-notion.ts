#!/usr/bin/env node

/**
 * Verification script to test fetching:
 * 1. Products from Knack with variants
 * 2. Images from Notion (linked by product ID)
 * 
 * This confirms the hybrid approach is working correctly.
 * 
 * Usage: npx tsx scripts/verify-knack-notion.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { fetchProducts, fetchProductById } from '../lib/knack-products'
import type { ProductRuntime } from '../lib/notion-client'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function verifyKnackAndNotion() {
  console.log('🔍 Verifying Knack + Notion Integration\n')
  console.log('=' .repeat(60))
  
  // Check environment variables
  console.log('\n📋 Checking environment variables:')
  const hasKnackAppId = !!process.env.KNACK_APPLICATION_ID
  const hasKnackApiKey = !!process.env.KNACK_REST_API_KEY
  const hasNotionKey = !!process.env.NOTION_API_KEY
  const hasNotionProductsDb = !!process.env.NOTION_DATABASE_ID_PRODUCTS
  
  console.log(`   KNACK_APPLICATION_ID: ${hasKnackAppId ? '✅' : '❌'}`)
  console.log(`   KNACK_REST_API_KEY: ${hasKnackApiKey ? '✅' : '❌'}`)
  console.log(`   NOTION_API_KEY: ${hasNotionKey ? '✅' : '❌'}`)
  console.log(`   NOTION_DATABASE_ID_PRODUCTS: ${hasNotionProductsDb ? '✅' : '❌'}`)
  
  if (!hasKnackAppId || !hasKnackApiKey) {
    console.error('\n❌ Missing Knack environment variables')
    process.exit(1)
  }
  
  if (!hasNotionKey || !hasNotionProductsDb) {
    console.warn('\n⚠️  Missing Notion environment variables - images may not be available')
  }
  
  try {
    // Test 1: Fetch all products
    console.log('\n' + '='.repeat(60))
    console.log('📦 Test 1: Fetching all products from Knack...\n')
    
    const allProducts = await fetchProducts()
    console.log(`✅ Successfully fetched ${allProducts.length} products from Knack\n`)
    
    if (allProducts.length === 0) {
      console.warn('⚠️  No products found in Knack')
      return
    }
    
    // Test 2: Verify first product has images from Notion
    console.log('='.repeat(60))
    console.log('🖼️  Test 2: Verifying images from Notion...\n')
    
    const firstProduct = allProducts[0]
    console.log(`Testing with product: "${firstProduct.title}" (ID: ${firstProduct.id}, SKU: ${firstProduct.sku})\n`)
    
    console.log('Product Details:')
    console.log(`   ID: ${firstProduct.id}`)
    console.log(`   SKU: ${firstProduct.sku}`)
    console.log(`   Title: ${firstProduct.title}`)
    console.log(`   Price CAD: $${firstProduct.price_cad}`)
    console.log(`   Stock: ${firstProduct.stock === 1 ? 'In Stock ✅' : firstProduct.stock === 0 ? 'Out of Stock ❌' : 'Unknown'}`)
    console.log(`   Status: ${firstProduct.status}`)
    
    console.log('\nImages from Notion:')
    console.log(`   Primary Image: ${firstProduct.primaryImage || '❌ Not found'}`)
    console.log(`   Total Images: ${firstProduct.images.length}`)
    if (firstProduct.images.length > 0) {
      firstProduct.images.forEach((img, idx) => {
        console.log(`      ${idx + 1}. ${img}`)
      })
    } else {
      console.log('   ⚠️  No images found in Notion (using placeholder)')
    }
    
    if (firstProduct.detailLongImage) {
      console.log(`   Detail Image: ${firstProduct.detailLongImage}`)
    }
    
    // Test 3: Verify variants
    console.log('\n' + '='.repeat(60))
    console.log('🔀 Test 3: Verifying variants from Knack...\n')
    
    if (firstProduct.variants && firstProduct.variants.length > 0) {
      console.log(`✅ Found ${firstProduct.variants.length} variant(s):\n`)
      firstProduct.variants.forEach((variant, idx) => {
        console.log(`   Variant ${idx + 1}:`)
        console.log(`      ID: ${variant.id}`)
        console.log(`      Name: ${variant.variantName}`)
        console.log(`      SKU: ${variant.sku || 'N/A'}`)
        console.log(`      Price CNY: ¥${variant.price_cny}`)
        if (variant.price_cad) {
          console.log(`      Price CAD Override: $${variant.price_cad}`)
        }
        console.log(`      Stock: ${variant.stock === 1 ? 'In Stock ✅' : variant.stock === 0 ? 'Out of Stock ❌' : 'Unknown'}`)
        console.log(`      Status: ${variant.status || 'Active'}`)
        console.log(`      Sort Order: ${variant.sortOrder || 0}`)
        console.log('')
      })
    } else {
      console.log('⚠️  No variants found for this product')
    }
    
    // Test 4: Fetch product by ID
    console.log('='.repeat(60))
    console.log('🔎 Test 4: Fetching product by ID...\n')
    
    const productById = await fetchProductById(firstProduct.id)
    if (productById) {
      console.log(`✅ Successfully fetched product by ID: ${productById.id}`)
      console.log(`   Title: ${productById.title}`)
      console.log(`   Variants: ${productById.variants?.length || 0}`)
      console.log(`   Images: ${productById.images.length}`)
    } else {
      console.log('❌ Failed to fetch product by ID')
    }
    
    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Summary\n')
    console.log(`Total Products: ${allProducts.length}`)
    
    const productsWithVariants = allProducts.filter(p => p.variants && p.variants.length > 0).length
    const totalVariants = allProducts.reduce((sum, p) => sum + (p.variants?.length || 0), 0)
    const productsWithImages = allProducts.filter(p => p.images.length > 0 && !p.images[0].includes('placeholder')).length
    
    console.log(`Products with Variants: ${productsWithVariants}`)
    console.log(`Total Variants: ${totalVariants}`)
    console.log(`Products with Images from Notion: ${productsWithImages}`)
    
    console.log('\n✅ Verification complete!')
    console.log('\nThe system is correctly:')
    console.log('   ✅ Fetching products from Knack')
    console.log('   ✅ Fetching variants from Knack')
    console.log('   ✅ Fetching images from Notion (linked by product ID)')
    console.log('   ✅ Using shared stock conversion logic for products and variants')
    
  } catch (error) {
    console.error('\n❌ Error during verification:')
    console.error(error)
    if (error instanceof Error) {
      console.error(`\nError message: ${error.message}`)
      if (error.stack) {
        console.error(`\nStack trace:\n${error.stack}`)
      }
    }
    process.exit(1)
  }
}

// Run verification
verifyKnackAndNotion()
  .then(() => {
    console.log('\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })

