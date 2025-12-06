#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;

async function checkIds() {
  console.log('🔍 Checking Notion product IDs...\n');

  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
    page_size: 10
  });

  console.log(`Found ${response.results.length} products in Notion:\n`);

  for (const page of response.results) {
    const props = page.properties;
    const title = props['Title']?.title?.[0]?.plain_text || 'Untitled';
    
    // Check for ID property (rich_text)
    const idProp = props['ID'];
    const idValue = idProp?.rich_text?.[0]?.plain_text || 'NO ID SET';
    
    // Check for SKU property
    const skuProp = props['SKU'];
    const skuValue = skuProp?.rich_text?.[0]?.plain_text || 'NO SKU SET';
    
    console.log(`📦 ${title}`);
    console.log(`   Notion Page ID: ${page.id}`);
    console.log(`   ID Property: ${idValue}`);
    console.log(`   SKU Property: ${skuValue}`);
    console.log(`   Properties available: ${Object.keys(props).join(', ')}`);
    console.log('');
  }
}

checkIds().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});






