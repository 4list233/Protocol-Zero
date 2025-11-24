#!/usr/bin/env node

const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;

async function inspectImages() {
  console.log('🔍 Inspecting image storage in Notion...\n');

  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
    page_size: 5
  });

  for (const page of response.results) {
    const props = page.properties;
    const title = props['Title']?.title?.[0]?.plain_text || 'Untitled';
    
    console.log(`📦 Product: ${title}`);
    console.log(`   ID: ${page.id}`);
    
    // Check Images property
    const images = props['Images'];
    if (images && images.files && images.files.length > 0) {
      console.log(`   ✅ Images property (${images.files.length} files):`);
      images.files.forEach((file, idx) => {
        console.log(`      ${idx + 1}. Type: ${file.type}`);
        console.log(`         Name: ${file.name}`);
        if (file.external) {
          console.log(`         External URL: ${file.external.url}`);
        }
        if (file.file) {
          console.log(`         Notion URL: ${file.file.url}`);
        }
      });
    } else {
      console.log(`   ⚠️  No images in Images property`);
    }
    
    // Check Detail Image property
    const detailImage = props['Detail Image'];
    if (detailImage && detailImage.files && detailImage.files.length > 0) {
      console.log(`   ✅ Detail Image property:`);
      const file = detailImage.files[0];
      console.log(`      Type: ${file.type}`);
      console.log(`      Name: ${file.name}`);
      if (file.external) {
        console.log(`      External URL: ${file.external.url}`);
      }
      if (file.file) {
        console.log(`      Notion URL: ${file.file.url}`);
      }
    } else {
      console.log(`   ⚠️  No detail image in Detail Image property`);
    }
    
    console.log('');
  }
}

inspectImages().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
