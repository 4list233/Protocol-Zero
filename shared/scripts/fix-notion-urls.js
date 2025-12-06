#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;
const PRODUCTION_URL = 'https://pzairsoft.ca';

async function fixUrls() {
  console.log('🔧 Fixing localhost URLs in Notion...\n');

  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
  });

  let fixed = 0;
  let skipped = 0;

  for (const page of response.results) {
    const props = page.properties;
    const title = props['Title']?.title?.[0]?.plain_text || 'Untitled';
    
    // Check Images property
    const images = props['Images'];
    const detailImage = props['Detail Image'];
    
    let needsUpdate = false;
    const updateProps = {};
    
    // Fix Images
    if (images?.files?.length > 0) {
      const fixedFiles = images.files.map(file => {
        if (file.external?.url?.includes('localhost')) {
          needsUpdate = true;
          return {
            type: 'external',
            name: file.name,
            external: { 
              url: file.external.url.replace(/https?:\/\/localhost:3000/g, PRODUCTION_URL)
            }
          };
        }
        return file;
      });
      
      if (needsUpdate) {
        updateProps['Images'] = { files: fixedFiles };
      }
    }
    
    // Fix Detail Image
    if (detailImage?.files?.length > 0) {
      const file = detailImage.files[0];
      if (file.external?.url?.includes('localhost')) {
        needsUpdate = true;
        updateProps['Detail Image'] = { 
          files: [{
            type: 'external',
            name: file.name,
            external: { 
              url: file.external.url.replace(/https?:\/\/localhost:3000/g, PRODUCTION_URL)
            }
          }]
        };
      }
    }
    
    if (needsUpdate) {
      console.log(`📸 Fixing: ${title}`);
      await notion.pages.update({
        page_id: page.id,
        properties: updateProps
      });
      fixed++;
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Done! Fixed: ${fixed}, Skipped: ${skipped}`);
}

fixUrls().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});






