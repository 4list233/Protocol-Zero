#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const fs = require('fs/promises');
const path = require('path');
// Load environment variables from root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
// Notion is now only used for images, no translation needed

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;
const MANIFEST_PATH = path.join(__dirname, '../data/products_manifest.json');
const MEDIA_DIR = path.join(__dirname, '../media');

function asText(text) {
  if (!text) return '';
  return String(text);
}

async function uploadImageToNotion(imagePath, productId) {
  const fs = require('fs');
  let fullPath = imagePath;
  
  // If it's already a valid external URL, use it
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    if (!imagePath.includes('localhost')) {
      return { 
        type: 'external',
        name: path.basename(imagePath),
        external: { url: imagePath } 
      };
    }
  }
  
  // Resolve full path for local files
  if (!path.isAbsolute(imagePath)) {
    // Try multiple possible locations
    const possiblePaths = [
      path.resolve(__dirname, '../../scraper/media', imagePath),
      path.resolve(__dirname, '../../scraper', imagePath),
      path.resolve(imagePath)
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        fullPath = p;
        break;
      }
    }
  }
  
  if (!fs.existsSync(fullPath)) {
    console.log(`   ⚠️  Image file not found: ${imagePath} (tried: ${fullPath})`);
    return null;
  }
  
  // Copy image to Next.js public folder and use that URL
  try {
    // Create unique filename using product ID and original filename
    const originalFileName = path.basename(fullPath);
    const ext = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, ext);
    // Use productId to make filename unique
    const sanitizedProductId = productId.replace(/[^a-zA-Z0-9]/g, '-');
    const uniqueFileName = `${sanitizedProductId}-${baseName}${ext}`;
    
    const publicDir = path.resolve(__dirname, '../../shop/public/images');
    const publicPath = path.join(publicDir, uniqueFileName);
    
    // Ensure public/images directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Copy file to public folder
    fs.copyFileSync(fullPath, publicPath);
    
    // Construct public URL - use production URL if available, otherwise localhost
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const publicUrl = `${baseUrl}/images/${uniqueFileName}`;
    
    console.log(`   📸 Copied image to public folder: /images/${uniqueFileName}`);
    
    return { 
      type: 'external',
      name: originalFileName,
      external: { url: publicUrl } 
    };
  } catch (error) {
    console.log(`   ⚠️  Failed to copy image ${imagePath}: ${error.message}`);
    return null;
  }
}

// Upload images to Notion for a product using Knack product ID (SKU) and SKU
async function uploadImagesToNotion(knackProductId, knackSku, imagePaths, detailImagePath) {
  if (!process.env.NOTION_API_KEY || !PRODUCTS_DB) {
    throw new Error('Missing NOTION_API_KEY or NOTION_DATABASE_ID_PRODUCTS');
  }

  // Check if product already exists in Notion with this ID (Knack product ID)
  let existingPage = null;
  try {
    const response = await notion.databases.query({
      database_id: PRODUCTS_DB,
      filter: {
        property: 'ID',
        rich_text: { equals: knackProductId }
      },
      page_size: 1
    });
    if (response.results.length > 0) {
      existingPage = response.results[0];
    }
  } catch (err) {
    // Ignore query errors, will create new page
  }

  let pageId;
  if (existingPage) {
    pageId = existingPage.id;
    // Update existing page properties
    await notion.pages.update({
      page_id: pageId,
      properties: {
        'ID': {
          rich_text: [{ text: { content: knackProductId } }] // Match Knack product ID
        },
        'SKU': {
          rich_text: [{ text: { content: knackSku } }] // Match Knack SKU
        }
      }
    });
  } else {
    // Create new page with minimal required fields
    const productPage = await notion.pages.create({
      parent: { database_id: PRODUCTS_DB },
      properties: {
        'Title': {
          title: [{ text: { content: `Product ${knackProductId}` } }]
        },
        'ID': {
          rich_text: [{ text: { content: knackProductId } }] // Match Knack product ID
        },
        'SKU': {
          rich_text: [{ text: { content: knackSku } }] // Match Knack SKU
        }
      }
    });
    pageId = productPage.id;
  }

  // Upload images as blocks and get their URLs
  const imageFiles = [];
  if (imagePaths && Array.isArray(imagePaths)) {
    for (const imgPath of imagePaths) {
      const imageFile = await uploadImageToNotion(imgPath, knackProductId);
      if (imageFile) {
        imageFiles.push(imageFile);
      }
    }
  }

  let detailImageFile = null;
  if (detailImagePath) {
    detailImageFile = await uploadImageToNotion(detailImagePath, knackProductId);
  }

  // Update page with image file properties
  const updateProperties = {};
  if (imageFiles.length > 0) {
    updateProperties['Images'] = { files: imageFiles };
  }
  if (detailImageFile) {
    updateProperties['Detail Image'] = { files: [detailImageFile] };
  }

  if (Object.keys(updateProperties).length > 0) {
    await notion.pages.update({
      page_id: pageId,
      properties: updateProperties
    });
  }

  return pageId;
}

async function seedNotion() {
  if (!process.env.NOTION_API_KEY || !PRODUCTS_DB) {
    console.error('❌ Missing NOTION_API_KEY / NOTION_DATABASE_ID_PRODUCTS');
    process.exit(1);
  }

  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  const items = Array.isArray(manifest) ? manifest : (manifest.products || []);

  console.log(`🌱 Uploading images to Notion from products_manifest.json (${items.length} products)\n`);
  console.log(`⚠️  Note: This script now only uploads images. Products should be created in Knack first.\n`);

  for (let idx = 0; idx < items.length; idx++) {
    const product = items[idx];
    const productId = product.id || product.slug || `auto-${idx + 1}`;

    try {
      console.log(`→ [${idx + 1}/${items.length}] ${product.title || productId}`);

      // Upload images using the product ID (should match Knack product ID) and SKU
      await uploadImagesToNotion(
        productId, // Knack product ID
        product.sku || productId, // Knack SKU
        product.images || [],
        product.detailLongImage
      );

      console.log(`   ✅ Images uploaded to Notion (ID: ${productId})`);

      // Respect rate limits (~3 req/sec)
      await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      console.error(`   ❌ Failed to upload images for ${productId}:`, err?.message || err);
    }
  }

  console.log('\n✅ Image upload complete');
}

// Export function for use by csv-to-knack.js
module.exports = { uploadImagesToNotion };

// Run if called directly
if (require.main === module) {
  seedNotion().catch(err => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
  });
}
