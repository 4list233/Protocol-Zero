#!/usr/bin/env node

/**
 * Master script to clear and reseed Notion with images from Knack
 * This ensures a clean state with all images properly mapped to numeric product IDs
 */

const { clearNotionImages } = require('./clear-notion-images');
const { reseedImages } = require('./reseed-images-from-knack');

async function resetAndReseed() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  NOTION IMAGE RESET & RESEED');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('Step 1: Clearing existing Notion image records...\n');
  await clearNotionImages();
  
  console.log('\n\nStep 2: Reseeding with images from Knack products...\n');
  await reseedImages();
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ RESET & RESEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
}

if (require.main === module) {
  resetAndReseed().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { resetAndReseed };
