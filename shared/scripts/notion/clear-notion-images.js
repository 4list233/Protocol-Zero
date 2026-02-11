#!/usr/bin/env node

/**
 * Clear all image records from Notion Products database
 * This will delete all pages to allow for a clean re-seed
 */

const { Client } = require('@notionhq/client');
const path = require('path');

// Load environment variables
const repoRoot = path.resolve(__dirname, '..', '..', '..');
require('dotenv').config({ path: path.join(repoRoot, 'shop', '.env.local') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;

async function clearNotionImages() {
  console.log('🗑️  Clearing all image records from Notion...');
  console.log(`   Database ID: ${PRODUCTS_DB}\n`);

  if (!PRODUCTS_DB) {
    console.error('❌ NOTION_DATABASE_ID_PRODUCTS not set in .env.local');
    process.exit(1);
  }

  try {
    let hasMore = true;
    let nextCursor = undefined;
    let totalDeleted = 0;

    while (hasMore) {
      // Query all pages in the database
      const response = await notion.databases.query({
        database_id: PRODUCTS_DB,
        start_cursor: nextCursor,
        page_size: 100,
      });

      console.log(`   Found ${response.results.length} pages in this batch`);

      // Delete each page
      for (const page of response.results) {
        try {
          await notion.pages.update({
            page_id: page.id,
            archived: true,
          });
          totalDeleted++;
          
          // Get the ID field if it exists
          const idProp = page.properties.ID || page.properties.id;
          const id = idProp?.rich_text?.[0]?.text?.content || page.id.substring(0, 8);
          console.log(`   ✓ Archived: ${id}`);
        } catch (error) {
          console.error(`   ❌ Failed to archive page ${page.id}: ${error.message}`);
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor;
    }

    console.log(`\n✅ Cleared ${totalDeleted} image records from Notion`);
  } catch (error) {
    console.error('❌ Error clearing Notion images:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  clearNotionImages().catch(console.error);
}

module.exports = { clearNotionImages };
