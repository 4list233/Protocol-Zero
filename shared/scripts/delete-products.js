#!/usr/bin/env node

/**
 * Delete products from both Knack and Notion
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const KNACK_API_BASE = 'https://api.knack.com/v1';
const KNACK_APP_ID = process.env.KNACK_APPLICATION_ID;
const KNACK_API_KEY = process.env.KNACK_REST_API_KEY;
const PRODUCTS_OBJECT_KEY = process.env.KNACK_OBJECT_KEY_PRODUCTS || 'object_6';
const VARIANTS_OBJECT_KEY = process.env.KNACK_OBJECT_KEY_VARIANTS || 'object_7';
const NOTION_PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;

async function deleteFromNotion() {
  if (!process.env.NOTION_API_KEY || !NOTION_PRODUCTS_DB) {
    console.log('⚠️  Notion not configured, skipping Notion deletion');
    return;
  }

  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });

    console.log('🗑️  Deleting products from Notion...');
    
    // Get all products
    let hasMore = true;
    let startCursor = undefined;
    let deletedCount = 0;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: NOTION_PRODUCTS_DB,
        start_cursor: startCursor,
        page_size: 100
      });

      for (const page of response.results) {
        try {
          await notion.pages.update({
            page_id: page.id,
            archived: true
          });
          deletedCount++;
        } catch (err) {
          console.log(`   ⚠️  Failed to delete page ${page.id}: ${err.message}`);
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`   ✅ Deleted ${deletedCount} product(s) from Notion`);
  } catch (error) {
    console.error(`   ❌ Error deleting from Notion: ${error.message}`);
  }
}

async function deleteFromKnack() {
  if (!KNACK_APP_ID || !KNACK_API_KEY) {
    console.log('⚠️  Knack not configured, skipping Knack deletion');
    return;
  }

  try {
    console.log('🗑️  Deleting products from Knack...');

    // Delete variants first (they reference products)
    let variantPage = 1;
    let variantDeleted = 0;
    let hasMoreVariants = true;

    while (hasMoreVariants) {
      const variantResponse = await fetch(
        `${KNACK_API_BASE}/objects/${VARIANTS_OBJECT_KEY}/records?page=${variantPage}&rows_per_page=100`,
        {
          headers: {
            'X-Knack-Application-Id': KNACK_APP_ID,
            'X-Knack-REST-API-Key': KNACK_API_KEY,
          },
        }
      );

      if (!variantResponse.ok) {
        hasMoreVariants = false;
        break;
      }

      const variantData = await variantResponse.json();
      const variants = variantData.records || [];

      if (variants.length === 0) {
        hasMoreVariants = false;
        break;
      }

      for (const variant of variants) {
        try {
          const deleteResponse = await fetch(
            `${KNACK_API_BASE}/objects/${VARIANTS_OBJECT_KEY}/records/${variant.id}`,
            {
              method: 'DELETE',
              headers: {
                'X-Knack-Application-Id': KNACK_APP_ID,
                'X-Knack-REST-API-Key': KNACK_API_KEY,
              },
            }
          );

          if (deleteResponse.ok) {
            variantDeleted++;
          }
        } catch (err) {
          console.log(`   ⚠️  Failed to delete variant ${variant.id}: ${err.message}`);
        }
      }

      variantPage++;
      if (variants.length < 100) {
        hasMoreVariants = false;
      }
    }

    console.log(`   ✅ Deleted ${variantDeleted} variant(s) from Knack`);

    // Delete products
    let productPage = 1;
    let productDeleted = 0;
    let hasMoreProducts = true;

    while (hasMoreProducts) {
      const productResponse = await fetch(
        `${KNACK_API_BASE}/objects/${PRODUCTS_OBJECT_KEY}/records?page=${productPage}&rows_per_page=100`,
        {
          headers: {
            'X-Knack-Application-Id': KNACK_APP_ID,
            'X-Knack-REST-API-Key': KNACK_API_KEY,
          },
        }
      );

      if (!productResponse.ok) {
        hasMoreProducts = false;
        break;
      }

      const productData = await productResponse.json();
      const products = productData.records || [];

      if (products.length === 0) {
        hasMoreProducts = false;
        break;
      }

      for (const product of products) {
        try {
          const deleteResponse = await fetch(
            `${KNACK_API_BASE}/objects/${PRODUCTS_OBJECT_KEY}/records/${product.id}`,
            {
              method: 'DELETE',
              headers: {
                'X-Knack-Application-Id': KNACK_APP_ID,
                'X-Knack-REST-API-Key': KNACK_API_KEY,
              },
            }
          );

          if (deleteResponse.ok) {
            productDeleted++;
          }
        } catch (err) {
          console.log(`   ⚠️  Failed to delete product ${product.id}: ${err.message}`);
        }
      }

      productPage++;
      if (products.length < 100) {
        hasMoreProducts = false;
      }
    }

    console.log(`   ✅ Deleted ${productDeleted} product(s) from Knack`);
  } catch (error) {
    console.error(`   ❌ Error deleting from Knack: ${error.message}`);
  }
}

async function main() {
  console.log('🗑️  Deleting all products from Knack and Notion...\n');
  
  await deleteFromKnack();
  console.log('');
  await deleteFromNotion();
  
  console.log('\n✅ Deletion complete!');
}

main().catch((error) => {
  console.error('❌ Deletion failed:', error);
  process.exit(1);
});






