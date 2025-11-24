#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;
const MANIFEST_PATH = path.join(__dirname, '../data/products_manifest.json');

async function countNotionActiveProducts() {
  let hasMore = true;
  let start_cursor = undefined;
  let count = 0;

  while (hasMore) {
    const res = await notion.databases.query({
      database_id: PRODUCTS_DB,
      filter: { property: 'Status', select: { equals: 'Active' } },
      page_size: 100,
      start_cursor
    });
    count += res.results.length;
    hasMore = res.has_more;
    start_cursor = res.next_cursor || undefined;
  }
  return count;
}

async function main() {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  const items = Array.isArray(manifest) ? manifest : (manifest.products || []);
  const manifestCount = items.length;

  const notionCount = await countNotionActiveProducts();

  console.log(`📦 Manifest products: ${manifestCount}`);
  console.log(`🧭 Notion Active products: ${notionCount}`);

  if (notionCount >= manifestCount) {
    console.log('✅ Notion contains expected number of products (or more).');
  } else {
    console.log('⚠️ Notion has fewer products than manifest. Check for errors during seeding.');
  }
}

main().catch(err => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
