#!/usr/bin/env node
/**
 * Fix Image Paths - Create links for images to match Knack product IDs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images')
const API_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

// Slugify function (must match the one in knack-products.ts)
function slugifyTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')     // Remove leading/trailing hyphens
    .substring(0, 50)          // Limit length
}

async function fetchProducts() {
  const response = await fetch(`${API_URL}/api/products`)
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`)
  }
  return await response.json()
}

async function main() {
  console.log('🔧 Fixing image paths to match Knack product IDs...')
  console.log(`   Images directory: ${PUBLIC_IMAGES_DIR}`)
  console.log(`   API URL: ${API_URL}\n`)

  // Get all products from API
  console.log('📡 Fetching products from API...')
  const products = await fetchProducts()
  console.log(`   Found ${products.length} products\n`)

  // Get all existing image files
  const existingFiles = fs.readdirSync(PUBLIC_IMAGES_DIR)
  
  let copiedCount = 0
  let skippedCount = 0
  let missingCount = 0

  for (const product of products) {
    const productId = product.id
    const title = product.title
    const slug = slugifyTitle(title)
    
    console.log(`Processing: ${productId} - ${title.substring(0, 40)}...`)
    console.log(`  Slug: ${slug}`)

    // Find all image files with this slug prefix
    const slugPattern = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-`)
    
    // Extract key words from the title for fuzzy matching
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    
    const matchingFiles = existingFiles.filter(file => {
      // Try exact slug match first
      if (slugPattern.test(file)) return true
      
      // Try variations (truncated, different separators, etc.)
      const fileBase = file.split('-hero-')[0].split('-Main')[0].split('-details')[0].split('-Details')[0]
      if (fileBase.startsWith(slug.substring(0, 30)) || slug.startsWith(fileBase.substring(0, 30))) {
        return true
      }
      
      // Fuzzy match: count how many key words from title appear in filename
      const filenameLower = file.toLowerCase()
      const matchedWords = titleWords.filter(word => filenameLower.includes(word))
      // Need at least 3 significant words to match
      return matchedWords.length >= Math.min(3, titleWords.length)
    })

    if (matchingFiles.length === 0) {
      console.log(`  ⚠️  No matching images found for slug "${slug}"`)
      missingCount++
      continue
    }

    console.log(`  Found ${matchingFiles.length} matching files`)

    // Copy each file with ID prefix
    for (const file of matchingFiles) {
      // Extract the suffix (everything after the slug prefix)
      // e.g., "2011-light-bearing-...-hero-01.jpg" -> "-hero-01.jpg"
      let suffix = ''
      if (file.includes('-hero-')) {
        suffix = file.substring(file.indexOf('-hero-'))
      } else if (file.includes('-Main')) {
        suffix = file.substring(file.indexOf('-Main'))
      } else if (file.includes('-details')) {
        suffix = file.substring(file.indexOf('-details'))
      } else if (file.includes('-Details')) {
        suffix = file.substring(file.indexOf('-Details'))
      } else {
        // Try to extract any suffix after the first part
        const parts = file.split('-')
        if (parts.length > 2) {
          // Keep the extension and last meaningful part
          suffix = `-${parts.slice(-2).join('-')}`
        } else {
          suffix = file
        }
      }
      
      const newFile = `${productId}${suffix}`
      
      const sourcePath = path.join(PUBLIC_IMAGES_DIR, file)
      const targetPath = path.join(PUBLIC_IMAGES_DIR, newFile)

      // Skip if target already exists
      if (fs.existsSync(targetPath)) {
        skippedCount++
        continue
      }

      try {
        // Create hard link or copy (hard link is faster and saves space)
        fs.linkSync(sourcePath, targetPath)
        console.log(`    ✓ Linked: ${file} -> ${newFile}`)
        copiedCount++
      } catch (error) {
        // Fallback to copy if link fails
        try {
          fs.copyFileSync(sourcePath, targetPath)
          console.log(`    ✓ Copied: ${file} -> ${newFile}`)
          copiedCount++
        } catch (copyError) {
          console.error(`    ❌ Failed to copy: ${file}`, copyError)
        }
      }
    }

    console.log('')
  }

  console.log('\n✅ Done!')
  console.log(`   Files created: ${copiedCount}`)
  console.log(`   Files skipped (already exist): ${skippedCount}`)
  console.log(`   Products with missing images: ${missingCount}`)
}

main().catch(console.error)
