#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const path = require('path');
// Load environment variables from root .env file
const repoRoot = path.resolve(__dirname, '..', '..', '..');
require('dotenv').config({ path: path.join(repoRoot, '.env') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function verifySetup() {
  console.log('🔍 Verifying Notion setup...\n');
  
  // Check environment variables
  console.log('📋 Checking environment variables:');
  const hasApiKey = !!process.env.NOTION_API_KEY;
  const hasProductsDb = !!process.env.NOTION_DATABASE_ID_PRODUCTS;
  const hasVariantsDb = !!process.env.NOTION_DATABASE_ID_VARIANTS;
  
  console.log(`   API Key: ${hasApiKey ? '✅' : '❌'}`);
  console.log(`   Products DB ID: ${hasProductsDb ? '✅' : '❌'}`);
  console.log(`   Variants DB ID: ${hasVariantsDb ? '✅' : '❌'}\n`);
  
  if (!hasApiKey || !hasProductsDb || !hasVariantsDb) {
    console.log('❌ Missing required environment variables. Please set them in .env file.\n');
    console.log('Required variables:');
    console.log('  - NOTION_API_KEY');
    console.log('  - NOTION_DATABASE_ID_PRODUCTS');
    console.log('  - NOTION_DATABASE_ID_VARIANTS\n');
    process.exit(1);
  }
  
  try {
    // Test Products database access
    console.log('🔗 Testing Products database access...');
    const productsDb = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID_PRODUCTS,
      page_size: 1
    });
    console.log(`   ✅ Products DB accessible (${productsDb.results.length} items found)\n`);
    
    // Test Variants database access
    console.log('🔗 Testing Variants database access...');
    const variantsDb = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID_VARIANTS,
      page_size: 1
    });
    console.log(`   ✅ Variants DB accessible (${variantsDb.results.length} items found)\n`);
    
    console.log('✅ All checks passed! Notion setup is complete.\n');
    
  } catch (error) {
    console.error('❌ Error accessing Notion:', error.message);
    console.error('\nPossible issues:');
    console.error('  - Database IDs are incorrect');
    console.error('  - Databases are not shared with the integration');
    console.error('  - Integration token is invalid or expired\n');
    process.exit(1);
  }
}

verifySetup();
