#!/usr/bin/env node

/**
 * Promote reviewed products from scraper/media to shared/media and
 * produce an approved products manifest filtered to approved folders.
 *
 * Review workflow:
 * - After scraping, a human inspects each folder under `scraper/media/product_*_*`
 * - If approved, create an empty file named `APPROVED` in that product folder
 * - Then run this script to copy approved media and filter the manifest
 */

const fs = require('fs-extra')
const path = require('path')

const SCRAPER_MEDIA = path.join(__dirname, '../../scraper', 'media')
const SHARED_MEDIA = path.join(__dirname, '../media')
const DATA_DIR = path.join(__dirname, '../data')
const MANIFEST_PATH = path.join(DATA_DIR, 'products_manifest.json')
const APPROVED_MANIFEST_PATH = path.join(DATA_DIR, 'products_manifest.approved.json')

async function loadManifest(file) {
  if (!await fs.pathExists(file)) return null
  try {
    const s = await fs.readFile(file, 'utf-8')
    return JSON.parse(s)
  } catch (e) {
    console.error('❌ Failed to read manifest:', e.message)
    return null
  }
}

async function main() {
  console.log('🔄 Promoting reviewed media...')
  console.log('   Source:', SCRAPER_MEDIA)
  console.log('   Target:', SHARED_MEDIA)

  await fs.ensureDir(SHARED_MEDIA)

  // Find approved product folders
  const entries = await fs.pathExists(SCRAPER_MEDIA) ? await fs.readdir(SCRAPER_MEDIA) : []
  const productFolders = entries.filter(e => e.startsWith('product_'))

  const approvedSet = new Set()
  for (const folder of productFolders) {
    const p = path.join(SCRAPER_MEDIA, folder)
    const stat = await fs.stat(p)
    if (!stat.isDirectory()) continue

    const approvedFlag = path.join(p, 'APPROVED')
    if (await fs.pathExists(approvedFlag)) {
      approvedSet.add(folder)
    }
  }

  console.log(`   Approved folders: ${approvedSet.size}`)
  if (approvedSet.size === 0) {
    console.log('ℹ️  No approved products found. Add an APPROVED file in product folder(s).')
  }

  // Copy approved media
  let copied = 0
  for (const folder of approvedSet) {
    const src = path.join(SCRAPER_MEDIA, folder)
    const dest = path.join(SHARED_MEDIA, folder)
    await fs.ensureDir(dest)

    // Copy subfolders
    for (const sub of ['Main', 'Catalogue', 'Details']) {
      const ssub = path.join(src, sub)
      const dsub = path.join(dest, sub)
      if (await fs.pathExists(ssub)) {
        await fs.copy(ssub, dsub, { overwrite: true })
        copied++
      }
    }
  }

  console.log(`   Media copied for ${copied} subfolder(s) across ${approvedSet.size} product(s)`) 

  // Filter manifest → approved products only
  const manifest = await loadManifest(MANIFEST_PATH)
  if (!manifest || !manifest.products) {
    console.log('⚠️  No manifest to filter. Skipping approved manifest generation.')
    return
  }

  // A product is approved if any of its image paths include an approved media folder prefix
  const approvedProducts = manifest.products.filter(p => {
    const imgs = Array.isArray(p.images) ? p.images : []
    for (const folder of approvedSet) {
      const prefix = `/images/${folder}-`
      if (imgs.some(i => typeof i === 'string' && i.startsWith(prefix))) return true
      if (typeof p.detailLongImage === 'string' && p.detailLongImage.startsWith(prefix)) return true
    }
    return false
  })

  const newManifest = {
    last_updated: new Date().toISOString(),
    products: approvedProducts,
  }
  await fs.writeFile(APPROVED_MANIFEST_PATH, JSON.stringify(newManifest, null, 2), 'utf-8')

  console.log('✅ Wrote approved manifest:', APPROVED_MANIFEST_PATH)
  console.log('   Approved products:', approvedProducts.length)
}

main().catch(err => {
  console.error('❌ Error promoting reviewed media:', err)
  process.exit(1)
})
