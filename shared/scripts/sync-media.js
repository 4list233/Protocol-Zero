#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../../scraper/media');
const TARGET_DIR = path.join(__dirname, '../../shop/public/images');

async function syncMedia() {
  console.log('🔄 Starting media sync...');
  console.log(`   Source: ${SOURCE_DIR}`);
  console.log(`   Target: ${TARGET_DIR}`);

  try {
    // Ensure target directory exists
    await fs.ensureDir(TARGET_DIR);

    // Check if source directory exists
    if (!await fs.pathExists(SOURCE_DIR)) {
      console.log('⚠️  Source media directory does not exist yet');
      console.log('   Run the scraper first to generate media files');
      return;
    }

    // Get list of product folders in source
    const productFolders = await fs.readdir(SOURCE_DIR);
    const validFolders = productFolders.filter(f => f.startsWith('product_'));

    if (validFolders.length === 0) {
      console.log('ℹ️  No product folders found in media directory');
      return;
    }

    console.log(`   Found ${validFolders.length} product folder(s)`);

    let totalFiles = 0;
    let copiedFiles = 0;
    let skippedFiles = 0;

    // Copy each product's images
    for (const folder of validFolders) {
      const sourceFolderPath = path.join(SOURCE_DIR, folder);
      const stats = await fs.stat(sourceFolderPath);

      if (!stats.isDirectory()) continue;

      // Get all image files from this product folder (Main, Details, Catalogue subfolders)
      const subfolders = ['Main', 'Details', 'Catalogue'];
      
      for (const subfolder of subfolders) {
        const subfolderPath = path.join(sourceFolderPath, subfolder);
        
        if (!await fs.pathExists(subfolderPath)) continue;

        const files = await fs.readdir(subfolderPath);
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
        
        // Priority: copy Details_Long.jpg if it exists
        const detailsLongExists = imageFiles.includes('Details_Long.jpg');
        if (detailsLongExists && subfolder === 'Details') {
          const sourceFile = path.join(subfolderPath, 'Details_Long.jpg');
          const productSlug = folder.replace(/^product_\d+_/, '');
          const targetFilename = `${productSlug}-Details_Long.jpg`;
          const targetFile = path.join(TARGET_DIR, targetFilename);
          
          await fs.copy(sourceFile, targetFile, { overwrite: true });
          copiedFiles++;
          console.log(`   ✓ ${targetFilename} (long detail image)`);
        }

        for (const file of imageFiles) {
          totalFiles++;
          const sourceFile = path.join(subfolderPath, file);
          
          // Generate target filename: product-slug_subfolder_filename
          // e.g., molle-pda_Detail_01.jpg
          const productSlug = folder.replace(/^product_\d+_/, '');
          const targetFilename = `${productSlug}-${file}`;
          const targetFile = path.join(TARGET_DIR, targetFilename);

          // Check if file already exists and is identical
          if (await fs.pathExists(targetFile)) {
            const sourceStats = await fs.stat(sourceFile);
            const targetStats = await fs.stat(targetFile);
            
            if (sourceStats.size === targetStats.size && 
                sourceStats.mtime <= targetStats.mtime) {
              skippedFiles++;
              continue;
            }
          }

          // Copy file
          await fs.copy(sourceFile, targetFile, { overwrite: true });
          copiedFiles++;
          console.log(`   ✓ ${targetFilename}`);
        }
      }
    }

    console.log('\n✅ Media sync complete!');
    console.log(`   Total files: ${totalFiles}`);
    console.log(`   Copied: ${copiedFiles}`);
    console.log(`   Skipped (unchanged): ${skippedFiles}`);

  } catch (error) {
    console.error('❌ Error syncing media:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncMedia().catch(console.error);
}

module.exports = { syncMedia };
