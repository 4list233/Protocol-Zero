#!/usr/bin/env node

/**
 * Reseed Notion with images from /shop/public/images/ using Knack product IDs
 * This ensures Notion image records match the actual product IDs from Knack
 */

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

// Load environment variables
const repoRoot = path.resolve(__dirname, '..', '..', '..');
require('dotenv').config({ path: path.join(repoRoot, 'shop', '.env.local') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;
const PUBLIC_IMAGES_DIR = path.join(repoRoot, 'shop', 'public', 'images');
const API_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function fetchKnackProducts() {
  console.log('📡 Fetching products from Knack...');
  const response = await fetch(`${API_URL}/api/products`);
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }
  const products = await response.json();
  console.log(`   Found ${products.length} products\n`);
  return products;
}

async function uploadImagesToNotion(productId, sku, title) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pzairsoft.ca';
  
  // Find all images for this product ID
  const allFiles = fs.readdirSync(PUBLIC_IMAGES_DIR);
  const productImages = allFiles.filter(file => 
    file.startsWith(`${productId}-hero-`) || 
    file.startsWith(`${productId}-Main`) ||
    file.startsWith(`${productId}-cat`)
  );
  
  const detailImage = allFiles.find(file => 
    file.startsWith(`${productId}-details`) || 
    file.startsWith(`${productId}-Details`)
  );

  if (productImages.length === 0 && !detailImage) {
    console.log(`   ⚠️  No images found for ${productId}`);
    return null;
  }

  // Convert to Notion file format
  const imageFiles = productImages.map(filename => ({
    type: 'external',
    name: filename,
    external: { url: `${baseUrl}/images/${filename}` }
  }));

  const detailFile = detailImage ? [{
    type: 'external',
    name: detailImage,
    external: { url: `${baseUrl}/images/${detailImage}` }
  }] : [];

  // Search for existing page with this product ID
  const existingPages = await notion.databases.query({
    database_id: PRODUCTS_DB,
    filter: {
      property: 'ID',
      rich_text: {
        equals: productId
      }
    }
  });

  const properties = {
    ID: {
      rich_text: [{ text: { content: productId } }]
    },
    SKU: {
      rich_text: [{ text: { content: sku || productId } }]
    },
    Title: {
      title: [{ text: { content: title || `Product ${productId}` } }]
    },
    Status: {
      select: { name: 'Active' }
    }
  };

  if (imageFiles.length > 0) {
    properties.Images = { files: imageFiles };
  }

  if (detailFile.length > 0) {
    properties['Detail Image'] = { files: detailFile };
  }

  if (existingPages.results.length > 0) {
    // Update existing page
    const pageId = existingPages.results[0].id;
    await notion.pages.update({
      page_id: pageId,
      properties
    });
    console.log(`   ✓ Updated ${productId}: ${imageFiles.length} images, ${detailFile.length ? '1' : '0'} detail`);
  } else {
    // Create new page
    await notion.pages.create({
      parent: { database_id: PRODUCTS_DB },
      properties
    });
    console.log(`   ✓ Created ${productId}: ${imageFiles.length} images, ${detailFile.length ? '1' : '0'} detail`);
  }

  return { images: imageFiles.length, detailImage: detailFile.length > 0 };
}

async function reseedImages() {
  console.log('🌱 Reseeding Notion with images from Knack products...');
  console.log(`   Database: ${PRODUCTS_DB}`);
  console.log(`   Images directory: ${PUBLIC_IMAGES_DIR}\n`);

  if (!PRODUCTS_DB) {
    console.error('❌ NOTION_DATABASE_ID_PRODUCTS not set');
    process.exit(1);
  }

  if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
    console.error(`❌ Images directory not found: ${PUBLIC_IMAGES_DIR}`);
    process.exit(1);
  }

  try {
    // Fetch all products from Knack
    const products = await fetchKnackProducts();

    let successCount = 0;
    let skipCount = 0;

    for (const product of products) {
      console.log(`Processing: ${product.id} - ${product.title.substring(0, 50)}...`);
      
      try {
        const result = await uploadImagesToNotion(
          product.id,
          product.sku,
          product.title
        );

        if (result) {
          successCount++;
        } else {
          skipCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        skipCount++;
      }
    }

    console.log(`\n✅ Reseeding complete!`);
    console.log(`   Successfully seeded: ${successCount} products`);
    console.log(`   Skipped (no images): ${skipCount} products`);
  } catch (error) {
    console.error('❌ Error reseeding images:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  reseedImages().catch(console.error);
}

module.exports = { reseedImages };
