#!/usr/bin/env node

/**
 * Import products from scraper CSV to Knack
 * Reads protocol_zero_variants.csv and creates products/variants in Knack
 * Images are stored as Notion URLs (images must be seeded to Notion first via json-to-notion.js)
 */

const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
// Load environment variables from root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const CSV_PATH = path.join(__dirname, '../../scraper/protocol_zero_variants.csv');
const MEDIA_DIR = path.join(__dirname, '../../scraper/media');
const MANIFEST_PATH = path.join(__dirname, '../data/products_manifest.json');
const NOTION_PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;

// Knack API configuration
const KNACK_API_BASE = 'https://api.knack.com/v1';
const KNACK_APP_ID = process.env.KNACK_APPLICATION_ID;
const KNACK_API_KEY = process.env.KNACK_REST_API_KEY;

// Object keys (from knack-config.ts defaults)
const PRODUCTS_OBJECT_KEY = process.env.KNACK_OBJECT_KEY_PRODUCTS || 'object_6';
const VARIANTS_OBJECT_KEY = process.env.KNACK_OBJECT_KEY_VARIANTS || 'object_7';

// Field keys (from knack-config.ts defaults)
const PRODUCT_FIELDS = {
  id: process.env.KNACK_FIELD_PRODUCTS_ID || 'field_45',
  sku: process.env.KNACK_FIELD_PRODUCTS_SKU || 'field_46',
  title: process.env.KNACK_FIELD_PRODUCTS_TITLE || 'field_47',
  titleOriginal: process.env.KNACK_FIELD_PRODUCTS_TITLE_ORIGINAL || 'field_48',
  description: process.env.KNACK_FIELD_PRODUCTS_DESCRIPTION || 'field_49',
  category: process.env.KNACK_FIELD_PRODUCTS_CATEGORY || 'field_50',
  status: process.env.KNACK_FIELD_PRODUCTS_STATUS || 'field_51',
  priceCadBase: process.env.KNACK_FIELD_PRODUCTS_PRICE_CAD_BASE || 'field_52',
  margin: process.env.KNACK_FIELD_PRODUCTS_MARGIN || 'field_53',
  stock: process.env.KNACK_FIELD_PRODUCTS_STOCK || 'field_54',
  url: process.env.KNACK_FIELD_PRODUCTS_URL || 'field_55',
  primaryImage: process.env.KNACK_FIELD_PRODUCTS_PRIMARY_IMAGE || 'field_140',
  images: process.env.KNACK_FIELD_PRODUCTS_IMAGES || 'field_57',
  detailImage: process.env.KNACK_FIELD_PRODUCTS_DETAIL_IMAGE || 'field_141',
};

const VARIANT_FIELDS = {
  product: process.env.KNACK_FIELD_VARIANTS_PRODUCT || 'field_61',
  variantName: process.env.KNACK_FIELD_VARIANTS_VARIANT_NAME || 'field_62',
  sku: process.env.KNACK_FIELD_VARIANTS_SKU || 'field_63',
  priceCny: process.env.KNACK_FIELD_VARIANTS_PRICE_CNY || 'field_64',
  priceCadOverride: process.env.KNACK_FIELD_VARIANTS_PRICE_CAD_OVERRIDE || 'field_65',
  stock: process.env.KNACK_FIELD_VARIANTS_STOCK || 'field_66',
  status: process.env.KNACK_FIELD_VARIANTS_STATUS || 'field_67',
  sortOrder: process.env.KNACK_FIELD_VARIANTS_SORT_ORDER || 'field_68',
};

// Get Notion image URLs for a product
async function getNotionImageUrls(productId, productTitle) {
  const notionImageUrls = [];
  
  // MUST fetch from Notion API - do not use localhost URLs
  if (!process.env.NOTION_API_KEY || !NOTION_PRODUCTS_DB) {
    console.log(`   ⚠️  Notion API not configured - cannot fetch image URLs`);
    return notionImageUrls;
  }
  
  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    
    // Try matching by ID first
    let response = await notion.databases.query({
      database_id: NOTION_PRODUCTS_DB,
      filter: {
        property: 'ID',
        rich_text: { equals: productId }
      },
      page_size: 1
    });
    
    // If not found, try matching by title
    if (response.results.length === 0 && productTitle) {
      response = await notion.databases.query({
        database_id: NOTION_PRODUCTS_DB,
        filter: {
          property: 'Title',
          title: { equals: productTitle }
        },
        page_size: 1
      });
    }
    
    if (response.results.length > 0) {
      const page = response.results[0];
      const props = page.properties;
      
      // Extract image URLs from Notion Files property
      // These are the actual Notion file URLs, not localhost
      const imageFiles = props['Images']?.files || [];
      for (const file of imageFiles) {
        // Prefer file.url (Notion-hosted) over external.url (if it's a Notion file)
        const url = file.file?.url || file.external?.url;
        if (url && !url.includes('localhost')) {
          notionImageUrls.push(url);
        }
      }
      
      // Get detail image URL
      const detailFiles = props['Detail Image']?.files || [];
      if (detailFiles.length > 0) {
        const detailUrl = detailFiles[0].file?.url || detailFiles[0].external?.url;
        if (detailUrl && !detailUrl.includes('localhost')) {
          notionImageUrls.push(detailUrl);
        }
      }
    } else {
      console.log(`   ⚠️  Product not found in Notion (searched for ID: ${productId}, Title: ${productTitle})`);
    }
  } catch (error) {
    console.log(`   ⚠️  Could not fetch from Notion API: ${error.message}`);
  }
  
  // DO NOT use manifest fallback - it creates localhost URLs
  // We only want actual Notion file URLs
  
  return notionImageUrls;
}

// Knack API helper
async function createKnackRecord(objectKey, data) {
  const response = await fetch(`${KNACK_API_BASE}/objects/${objectKey}/records`, {
    method: 'POST',
    headers: {
      'X-Knack-Application-Id': KNACK_APP_ID,
      'X-Knack-REST-API-Key': KNACK_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Knack API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  return result.id;
}

// Find product record ID by field_45 (Product ID)
async function findProductRecordIdByField45(productId) {
  try {
    const response = await fetch(
      `${KNACK_API_BASE}/objects/${PRODUCTS_OBJECT_KEY}/records?filters[${PRODUCT_FIELDS.id}]=${encodeURIComponent(productId)}`,
      {
        headers: {
          'X-Knack-Application-Id': KNACK_APP_ID,
          'X-Knack-REST-API-Key': KNACK_API_KEY,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.records && data.records.length > 0) {
        return data.records[0].id;
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Could not find product by field_45: ${error.message}`);
  }
  return null;
}

// Helper to slugify text
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Get image paths for a product (returns local file paths - will need to be uploaded/hosted)
function getImagePaths(mediaFolder) {
  const images = [];
  
  // Try exact match first
  let productMediaDir = path.join(MEDIA_DIR, mediaFolder);
  
  // If not found, try to find matching folder (handle trailing dash variations)
  if (!fs.existsSync(productMediaDir)) {
    // Try removing trailing dashes
    const cleanedFolder = mediaFolder.replace(/-+$/, '');
    const altPath = path.join(MEDIA_DIR, cleanedFolder);
    if (fs.existsSync(altPath)) {
      productMediaDir = altPath;
    } else {
      // Try to find folder that starts with the same prefix
      // Extract the slug part (after product_X_)
      const match = mediaFolder.match(/^product_\d+_(.+)/);
      if (match) {
        const slug = match[1].replace(/-+$/, ''); // Remove trailing dashes
        const folders = fs.readdirSync(MEDIA_DIR).filter(f => {
          if (!f.startsWith('product_')) return false;
          const folderSlug = f.replace(/^product_\d+_/, '').replace(/-+$/, '');
          return folderSlug === slug || f.includes(slug);
        });
        if (folders.length > 0) {
          productMediaDir = path.join(MEDIA_DIR, folders[0]);
        }
      }
    }
  }
  
  if (!fs.existsSync(productMediaDir)) {
    console.log(`   ⚠️  Media folder not found: ${mediaFolder} (tried: ${productMediaDir})`);
    return images;
  }
  
  // Main image - check both Main/Main.jpg and Main/Main.jpg (direct file)
  const mainDir = path.join(productMediaDir, 'Main');
  if (fs.existsSync(mainDir)) {
    // Check for Main.jpg directly in Main folder
    const mainPath1 = path.join(mainDir, 'Main.jpg');
    if (fs.existsSync(mainPath1)) {
      images.push(mainPath1);
    } else {
      // Check for any .jpg file in Main folder
      const mainFiles = fs.readdirSync(mainDir)
        .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
        .sort();
      if (mainFiles.length > 0) {
        images.push(path.join(mainDir, mainFiles[0]));
      }
    }
  }
  
  // Catalogue images
  const catalogueDir = path.join(productMediaDir, 'Catalogue');
  if (fs.existsSync(catalogueDir)) {
    const catalogueFiles = fs.readdirSync(catalogueDir)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .sort();
    catalogueFiles.forEach(file => {
      images.push(path.join(catalogueDir, file));
    });
  }
  
  return images;
}

// Get detail long image path
function getDetailImagePath(mediaFolder) {
  // Try exact match first
  let productMediaDir = path.join(MEDIA_DIR, mediaFolder);
  
  // If not found, try to find matching folder (handle trailing dash variations)
  if (!fs.existsSync(productMediaDir)) {
    const cleanedFolder = mediaFolder.replace(/-+$/, '');
    const altPath = path.join(MEDIA_DIR, cleanedFolder);
    if (fs.existsSync(altPath)) {
      productMediaDir = altPath;
    } else {
      const folderPrefix = mediaFolder.replace(/^product_\d+_/, '');
      const folders = fs.readdirSync(MEDIA_DIR).filter(f => 
        f.startsWith('product_') && f.includes(folderPrefix)
      );
      if (folders.length > 0) {
        productMediaDir = path.join(MEDIA_DIR, folders[0]);
      }
    }
  }
  
  const detailPath = path.join(productMediaDir, 'Details', 'Details_Long.jpg');
  
  if (fs.existsSync(detailPath)) {
    return detailPath;
  }
  
  return null;
}

async function importToKnack() {
  console.log('🚀 Importing products from CSV to Knack\n');
  
  // Check Knack configuration
  if (!KNACK_APP_ID || !KNACK_API_KEY) {
    console.error('❌ Missing Knack configuration!');
    console.error('   Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY in shop/.env.local');
    process.exit(1);
  }
  
  console.log(`📄 Reading CSV: ${CSV_PATH}\n`);
  
  if (!await fs.pathExists(CSV_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_PATH}`);
    process.exit(1);
  }
  
  // Read CSV
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log(`📊 Found ${rows.length} variant rows\n`);
  
  // Group by URL (product)
  const productsMap = new Map();
  
  for (const row of rows) {
    const url = row.URL || row.url;
    if (!url) continue;
    
    if (!productsMap.has(url)) {
      const title = row['Translated Title'] || row['Product Title'] || 'Unnamed Product';
      const titleOriginal = row['Product Title ZH'] || row['Product Title'] || '';
      const mediaFolder = row['Media Folder'] || '';
      const slug = slugify(title).slice(0, 50) || slugify(url).slice(0, 50);
      
      // Generate SKU
      const skuBase = slugify(title).replace(/-/g, '').toUpperCase().slice(0, 8) || 'PROD';
      const sku = `${skuBase}-${String(productsMap.size + 1).padStart(3, '0')}`;
      
      // Get images
      const images = getImagePaths(mediaFolder);
      const detailImage = getDetailImagePath(mediaFolder);
      
      productsMap.set(url, {
        id: slug,
        sku,
        title,
        title_original: titleOriginal,
        url,
        images,
        detailLongImage: detailImage,
        price_cad: 0, // Will be set manually in Knack
        margin: 0.5,
        status: 'Inactive',
        variants: []
      });
    }
    
    // Add variant
    const product = productsMap.get(url);
    // Use Chinese variant name (Option Name ZH)
    const optionName = row['Option Name ZH'] || row['Option Name'] || '';
    
    if (optionName) {
      product.variants.push({
        variantName: optionName,
        price_cny: parseFloat(row['Price CNY'] || 0),
        price_cad: parseFloat(row['Price CAD'] || 0) || undefined,
        stock: undefined,
        status: 'Inactive',
        sortOrder: product.variants.length
      });
    }
  }
  
  console.log(`📦 Found ${productsMap.size} unique products\n`);
  
  // Import to Knack
  const products = Array.from(productsMap.values());
  // Import all products (no limit)
  const productsToImport = products;
  let successCount = 0;
  let errorCount = 0;
  
  console.log(`📦 Importing all ${productsToImport.length} products\n`);
  
  // PAUSE: Wait for user to review images before uploading
  console.log(`\n⏸️  PAUSE: Review images in scraper/media/ before uploading to Notion`);
  console.log(`   Press Enter to continue with image upload, or Ctrl+C to stop...`);
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  await new Promise((resolve) => {
    rl.on('line', () => {
      rl.close();
      resolve();
    });
  });
  
  for (let i = 0; i < productsToImport.length; i++) {
    const product = productsToImport[i];
    console.log(`\n[${i + 1}/${productsToImport.length}] 📦 ${product.title}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Variants: ${product.variants.length}`);
    console.log(`   Images: ${product.images.length} (Main: ${product.images[0] ? path.basename(product.images[0]) : 'none'})`);
    console.log(`   Detail Image: ${product.detailLongImage ? path.basename(product.detailLongImage) : 'No'}`);
    
    try {
      // Get Notion image URLs using Knack product ID (SKU) - will fetch after uploading images
      
      // Prepare product data for Knack
      const productData = {};
      productData[PRODUCT_FIELDS.id] = product.id; // field_45: Product ID (slug)
      productData[PRODUCT_FIELDS.sku] = product.sku; // field_46: SKU
      productData[PRODUCT_FIELDS.title] = product.title;
      productData[PRODUCT_FIELDS.titleOriginal] = product.title_original || null;
      productData[PRODUCT_FIELDS.description] = null;
      productData[PRODUCT_FIELDS.category] = null;
      productData[PRODUCT_FIELDS.status] = product.status || 'Inactive';
      productData[PRODUCT_FIELDS.priceCadBase] = product.price_cad || 0;
      productData[PRODUCT_FIELDS.margin] = product.margin || 0.5;
      productData[PRODUCT_FIELDS.stock] = null;
      productData[PRODUCT_FIELDS.url] = product.url || null;
      
      // Images will be uploaded to Notion first, then we'll fetch the URLs
      // We'll update the product with Notion URLs after creation
      
      // Create product
      const productRecordId = await createKnackRecord(PRODUCTS_OBJECT_KEY, productData);
      console.log(`   ✅ Created product in Knack (Record ID: ${productRecordId})`);
      console.log(`   📋 Product ID field (field_45): ${product.id}`);
      console.log(`   📋 SKU field (field_46): ${product.sku}`);
      
      // Small delay to ensure product is fully created before creating variants
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Upload images to Notion using Knack product ID (field_45) and SKU (field_46)
      let notionImageUrls = [];
      try {
        const { uploadImagesToNotion } = require('./json-to-notion');
        await uploadImagesToNotion(
          product.id, // Knack product ID (field_45) - matches Notion ID
          product.sku, // Knack SKU (field_46) - matches Notion SKU
          product.images || [],
          product.detailLongImage || null
        );
        console.log(`   ✅ Images uploaded to Notion (ID: ${product.id}, SKU: ${product.sku})`);
        
        // Fetch Notion image URLs using the product ID (field_45)
        notionImageUrls = await getNotionImageUrls(product.id, product.title);
        if (notionImageUrls.length > 0) {
          console.log(`   ✅ Found ${notionImageUrls.length} Notion image URL(s)`);
        }
      } catch (notionError) {
        console.log(`   ⚠️  Failed to upload/fetch images from Notion: ${notionError.message}`);
      }
      
      // Update Knack product with Notion image URLs if we have them
      if (notionImageUrls.length > 0) {
        try {
          const updateData = {};
          // Primary image field (field_140) - first Notion URL
          updateData[PRODUCT_FIELDS.primaryImage] = notionImageUrls[0];
          // Images field (field_57) - JSON string of all Notion image URLs
          updateData[PRODUCT_FIELDS.images] = JSON.stringify(notionImageUrls);
          // Detail image field (field_141) - last URL (usually the detail image)
          if (notionImageUrls.length > 1) {
            updateData[PRODUCT_FIELDS.detailImage] = notionImageUrls[notionImageUrls.length - 1];
          } else {
            updateData[PRODUCT_FIELDS.detailImage] = notionImageUrls[0];
          }
          
          // Update the product record in Knack
          const updateResponse = await fetch(`${KNACK_API_BASE}/objects/${PRODUCTS_OBJECT_KEY}/records/${productRecordId}`, {
            method: 'PUT',
            headers: {
              'X-Knack-Application-Id': KNACK_APP_ID,
              'X-Knack-REST-API-Key': KNACK_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
          });
          
          if (updateResponse.ok) {
            console.log(`   ✅ Updated Knack product with Notion image URLs`);
          } else {
            console.log(`   ⚠️  Failed to update Knack product with image URLs`);
          }
        } catch (updateError) {
          console.log(`   ⚠️  Error updating Knack product: ${updateError.message}`);
        }
      }
      
      // Create variants
      for (const variant of product.variants) {
        const variantData = {};
        // Connection field: Use array format with product record ID
        // Knack connection fields require the record ID in array format
        variantData[VARIANT_FIELDS.product] = [productRecordId];
        variantData[VARIANT_FIELDS.variantName] = variant.variantName;
        variantData[VARIANT_FIELDS.sku] = null;
        variantData[VARIANT_FIELDS.priceCny] = variant.price_cny || 0;
        variantData[VARIANT_FIELDS.priceCadOverride] = variant.price_cad || null;
        variantData[VARIANT_FIELDS.stock] = variant.stock || null;
        variantData[VARIANT_FIELDS.status] = variant.status || 'Inactive';
        variantData[VARIANT_FIELDS.sortOrder] = variant.sortOrder || 0;
        
        await createKnackRecord(VARIANTS_OBJECT_KEY, variantData);
        console.log(`      ✅ Created variant: ${variant.variantName}`);
      }
      
      console.log(`   ✅ Created ${product.variants.length} variant(s)`);
      successCount++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Import complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`\n⚠️  Note: Prices need to be set manually in Knack browser UI`);
  console.log(`ℹ️  Note: Images are stored as Notion URLs in field_57 (Images field)`);
  console.log(`ℹ️  Note: Ensure products are seeded to Notion first (npm run seed-notion)`);
}

// Run if called directly
if (require.main === module) {
  importToKnack().catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
}

module.exports = { importToKnack };
