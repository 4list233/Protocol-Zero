#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();
const { translateTitleSimple, translateVariantSimple } = require('./translate-utils');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;
const VARIANTS_DB = process.env.NOTION_DATABASE_ID_VARIANTS;
const MANIFEST_PATH = path.join(__dirname, '../data/products_manifest.json');
const MEDIA_DIR = path.join(__dirname, '../media');

function asText(text) {
  if (!text) return '';
  return String(text);
}

async function uploadImageToNotion(imagePath) {
  // Check if it's already an external URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return { 
      type: 'external',
      name: path.basename(imagePath),
      external: { url: imagePath } 
    };
  }
  
  // For local files, we need to convert them to a publicly accessible URL
  // For this implementation, we'll assume images are in shared/media
  // and will be served by the Next.js app at /images/
  const fileName = path.basename(imagePath);
  const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${imagePath}`;
  
  return { 
    type: 'external',
    name: fileName,
    external: { url: publicUrl } 
  };
}

async function seedNotion() {
  if (!process.env.NOTION_API_KEY || !PRODUCTS_DB || !VARIANTS_DB) {
    console.error('❌ Missing NOTION_API_KEY / NOTION_DATABASE_ID_PRODUCTS / NOTION_DATABASE_ID_VARIANTS');
    process.exit(1);
  }

  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  const items = Array.isArray(manifest) ? manifest : (manifest.products || []);

  console.log(`🌱 Seeding Notion from products_manifest.json (${items.length} products)\n`);

  for (let idx = 0; idx < items.length; idx++) {
    const product = items[idx];
    const slug = product.id || product.slug || `auto-${idx + 1}`;

    try {
      // Auto-translate if title is missing but title_original (Chinese) exists
      let finalTitle = product.title;
      if (!finalTitle && product.title_original) {
        finalTitle = translateTitleSimple(product.title_original);
        console.log(`   🔤 Auto-translated: "${product.title_original}" → "${finalTitle}"`);
      }
      
      console.log(`→ [${idx + 1}/${items.length}] ${finalTitle || slug}`);

      // Prepare image files for upload
      const imageFiles = [];
      if (product.images && Array.isArray(product.images)) {
        for (const imgPath of product.images) {
          const imageFile = await uploadImageToNotion(imgPath);
          imageFiles.push(imageFile);
        }
      }

      let detailImageFile = null;
      if (product.detailLongImage) {
        detailImageFile = await uploadImageToNotion(product.detailLongImage);
      }

      // Create product page with file properties
      const productPage = await notion.pages.create({
        parent: { database_id: PRODUCTS_DB },
        properties: {
          'Title': {
            title: [{ text: { content: asText(finalTitle || slug) } }]
          },
          'ID': {
            rich_text: [{ text: { content: asText(slug) } }]
          },
          'SKU': {
            rich_text: [{ text: { content: asText(product.sku || '') } }]
          },
          'Title Original': {
            rich_text: [{ text: { content: asText(product.title_original || '') } }]
          },
          'Category': product.category ? { select: { name: asText(product.category) } } : undefined,
          'Status': { select: { name: 'Active' } },
          'Description': product.description ? { rich_text: [{ text: { content: asText(product.description) } }] } : undefined,
          'Price CAD (Base)': { number: Number(product.price_cad) || 0 },
          'Margin': { number: typeof product.margin === 'number' ? product.margin : 0.5 },
          'Stock': { number: Number(product.stock) || 0 },
          'URL': product.url ? { url: asText(product.url) } : null,
          // Store images as files instead of JSON paths
          'Images': imageFiles.length > 0 ? { files: imageFiles } : undefined,
          'Detail Image': detailImageFile ? { files: [detailImageFile] } : undefined,
        }
      });

      const productPageId = productPage.id;

      // Create variant pages
      const variants = product.variants || [];
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        
        // Auto-translate variant name if it's Chinese
        let variantName = v.option || v.variantName || `Variant ${i + 1}`;
        if (/[\u4e00-\u9fff]/.test(variantName)) {
          const translated = translateVariantSimple(variantName);
          if (translated && translated !== variantName) {
            console.log(`      🔤 Variant: "${variantName}" → "${translated}"`);
            variantName = translated;
          }
        }
        
        await notion.pages.create({
          parent: { database_id: VARIANTS_DB },
          properties: {
            'Variant Name': { title: [{ text: { content: asText(variantName) } }] },
            'Product': { relation: [{ id: productPageId }] },
            'SKU': v.sku ? { rich_text: [{ text: { content: asText(v.sku) } }] } : undefined,
            'Price CNY': { number: Number(v.price_cny) || 0 },
            'Price CAD Override': v.price_cad != null ? { number: Number(v.price_cad) } : undefined,
            'Stock': v.stock != null ? { number: Number(v.stock) } : undefined,
            'Status': { select: { name: 'Active' } },
            'Sort Order': { number: i + 1 }
          }
        });
        console.log(`   • Variant ${i + 1}: ${variantName}`);
      }

      // Respect rate limits (~3 req/sec)
      await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      console.error(`   ❌ Failed to create product ${slug}:`, err?.message || err);
    }
  }

  console.log('\n✅ Seeding complete');
}

seedNotion().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
