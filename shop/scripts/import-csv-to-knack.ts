// Usage: npx tsx scripts/import-csv-to-knack.ts [path-to-csv] [images-source-dir]
// Imports CSV data to Knack (without images), then creates Notion records with images only
// Images are linked to Knack records by ID/SKU

import { promises as fs } from 'fs'
import path from 'path'
import 'dotenv/config'
import { createProduct } from '../lib/knack-products'
import { Client } from '@notionhq/client'
import type { ProductRuntime } from '../lib/notion-client'

type Row = Record<string, string>

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function parsePrice(input: string | undefined): number {
  if (!input) return 0
  const s = String(input).trim()
  if (!s || s.toUpperCase() === 'N/A') return 0
  const m = s.replace(/[^0-9.,]/g, '').replace(/,/g, '')
  const n = parseFloat(m)
  return isNaN(n) ? 0 : n
}

function parseCsv(text: string): Row[] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  if (lines.length === 0) return []
  const header = splitCsvLine(lines[0]).map(s => s.trim())
  const norm = header.map(h => normalizeKey(h))
  const rows: Row[] = []
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line)
    const row: Row = {}
    for (let i = 0; i < header.length; i++) {
      const key = norm[i]
      row[key] = (cols[i] ?? '').trim()
    }
    rows.push(row)
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase()
}

function guessCategory(title: string): string | undefined {
  const t = title.toLowerCase()
  if (t.includes('molle') || t.includes('pda') || t.includes('panel') || t.includes('包')) return 'Pouches'
  if (t.includes('grenade') || t.includes('手雷')) return 'Grenades'
  return undefined
}

function guessKey(rows: Row[], candidates: string[]): string {
  if (!rows.length) return candidates[0]
  const row = rows[0]
  const keys = Object.keys(row)
  for (const cand of candidates) {
    const c = cand.toLowerCase()
    const match = keys.find(k => k === c || k.replace(/\s+/g, '') === c.replace(/\s+/g, ''))
    if (match) return match
  }
  return candidates[0]
}

async function findFileRecursive(dir: string, basename: string): Promise<string | undefined> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.resolve(dir, ent.name)
    if (ent.isDirectory()) {
      const found = await findFileRecursive(full, basename)
      if (found) return found
    } else if (ent.isFile() && ent.name === basename) {
      return full
    }
  }
  return undefined
}

async function collectImageFolders(root: string): Promise<{ dir: string; files: string[] }[]> {
  const folders: { dir: string; files: string[] }[] = []
  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true })
    const files: string[] = []
    for (const ent of entries) {
      const full = path.resolve(d, ent.name)
      if (ent.isDirectory()) {
        await walk(full)
      } else if (ent.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(ent.name)) {
        files.push(full)
      }
    }
    if (files.length) {
      folders.push({ dir: d, files })
    }
  }
  await walk(root)
  return folders
}

async function findImagesForProduct(folders: { dir: string; files: string[] }[], title: string, url: string): Promise<string[] | undefined> {
  const titleSlug = slugify(title)
  const urlIdMatch = url.match(/(?:[?&]id=)(\d+)/)
  const urlId = urlIdMatch ? urlIdMatch[1] : ''

  let candidate = folders.find(f => urlId && f.dir.includes(urlId))
  if (!candidate) {
    const tokens = titleSlug.split('-').filter(Boolean).slice(0, 4)
    candidate = folders
      .map(f => ({ f, score: tokens.reduce((acc, t) => acc + (f.dir.toLowerCase().includes(t) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score)[0]?.f
  }
  return candidate?.files
}

function detectImageColumn(rows: Row[]): string | undefined {
  if (!rows.length) return undefined
  const keys = Object.keys(rows[0])
  for (const k of keys) {
    if (rows.find(r => r[k] && /\.(png|jpe?g|webp|gif)$/i.test(r[k]))) {
      return k
    }
  }
  return undefined
}

function detectPriceColumn(rows: Row[]): string | undefined {
  if (!rows.length) return undefined
  const keys = Object.keys(rows[0])
  for (const k of keys) {
    if (rows.some(r => parsePrice(r[k]) > 0)) return k
  }
  return undefined
}

// Convert local image paths to Notion file format
function prepareNotionImageFiles(imagePaths: string[]): Array<{ external: { url: string } }> {
  return imagePaths
    .filter((url) => url && !url.includes('placeholder.png'))
    .map((url) => {
      // If it's already a full URL, use as external
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return { external: { url } }
      }
      // For local paths, assume they'll be served from the public directory
      // In production, these should be absolute URLs
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const imageUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/images/${url}`
      return { external: { url: imageUrl } }
    })
}

// Create Notion record with images only (linked to Knack by ID/SKU)
async function createNotionImageRecord(
  notion: Client,
  productsDb: string,
  productId: string,
  sku: string,
  images: string[],
  detailImage?: string
): Promise<void> {
  try {
    const imageFiles = prepareNotionImageFiles(images)
    const detailImageFile = detailImage
      ? prepareNotionImageFiles([detailImage])[0]
      : undefined

    // Check if record already exists
    let existingPage = null
    try {
      const response = await notion.databases.query({
        database_id: productsDb,
        filter: {
          property: 'ID',
          rich_text: { equals: productId },
        },
      })
      if (response.results.length > 0) {
        existingPage = response.results[0]
      }
    } catch {
      // Not found, will create new
    }

    if (existingPage) {
      // Update existing Notion page with images
      await notion.pages.update({
        page_id: existingPage.id,
        properties: {
          ID: {
            rich_text: [{ text: { content: productId } }],
          },
          SKU: {
            rich_text: [{ text: { content: sku } }],
          },
          Images: imageFiles.length > 0 ? { files: imageFiles } : undefined,
          'Detail Image': detailImageFile ? { files: [detailImageFile] } : undefined,
        },
      })
      console.log(`  ✅ Updated Notion images for ${productId}`)
    } else {
      // Create new Notion page with images only
      await notion.pages.create({
        parent: { database_id: productsDb },
        properties: {
          ID: {
            rich_text: [{ text: { content: productId } }],
          },
          SKU: {
            rich_text: [{ text: { content: sku } }],
          },
          Title: {
            title: [{ text: { content: `Images for ${productId}` } }],
          },
          Status: { select: { name: 'Active' } },
          Images: imageFiles.length > 0 ? { files: imageFiles } : undefined,
          'Detail Image': detailImageFile ? { files: [detailImageFile] } : undefined,
        },
      })
      console.log(`  ✅ Created Notion images record for ${productId}`)
    }
  } catch (error) {
    console.error(`  ❌ Error creating Notion images for ${productId}:`, error)
  }
}

async function main() {
  // Check required env vars
  if (!process.env.KNACK_APPLICATION_ID || !process.env.KNACK_REST_API_KEY) {
    console.error('❌ Missing KNACK_APPLICATION_ID or KNACK_REST_API_KEY')
    process.exit(1)
  }

  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID_PRODUCTS) {
    console.error('❌ Missing NOTION_API_KEY or NOTION_DATABASE_ID_PRODUCTS')
    console.error('   Images will not be synced to Notion')
  }

  const csvPath = process.argv[2] || path.resolve(process.cwd(), 'protocol_zero_variants.csv')
  const imagesSourceDir = process.argv[3] // optional path to images

  console.log(`📖 Reading CSV from: ${csvPath}`)
  const csv = await fs.readFile(csvPath, 'utf8')
  const rows = parseCsv(csv)
  console.log(`📊 Found ${rows.length} rows`)

  // Determine actual keys present
  const keyURL = guessKey(rows, ['url'])
  const keyTitle = guessKey(rows, ['translated title', 'product title'])
  const keyOption = guessKey(rows, ['option name', 'option'])
  let keyPrice = guessKey(rows, ['price'])
  if (!rows.some(r => parsePrice(r[keyPrice]) > 0)) {
    const detectedPrice = detectPriceColumn(rows)
    if (detectedPrice) keyPrice = detectedPrice
  }
  let keyShot = guessKey(rows, ['screenshot filename', 'screenshot', 'image', 'image filename'])
  if (!rows.some(r => r[keyShot] && /\.(png|jpe?g|webp|gif)$/i.test(r[keyShot]))) {
    const detected = detectImageColumn(rows)
    if (detected) keyShot = detected
  }
  const keyDesc = guessKey(rows, ['description', 'details'])

  // Group by URL (product page) to aggregate variants/images
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const key = r[keyURL]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  console.log(`📦 Found ${groups.size} unique products\n`)

  // Pre-scan image folders if provided
  let imageFolders: { dir: string; files: string[] }[] = []
  if (imagesSourceDir) {
    console.log(`🖼️  Scanning images from: ${imagesSourceDir}`)
    imageFolders = await collectImageFolders(imagesSourceDir)
    console.log(`   Found ${imageFolders.length} image folders\n`)
  }

  // Initialize Notion client
  let notion: Client | null = null
  const productsDb = process.env.NOTION_DATABASE_ID_PRODUCTS
  if (process.env.NOTION_API_KEY && productsDb) {
    notion = new Client({ auth: process.env.NOTION_API_KEY })
  }

  let successCount = 0
  let errorCount = 0

  // Process each product
  for (const [url, group] of groups) {
    const titleCandidate = group[0][keyTitle]
    const titleRaw = titleCandidate && titleCandidate !== 'TRANSLATION FAILED'
      ? titleCandidate
      : (group[0]['product title'] || titleCandidate)
    const title = (titleRaw || 'Unnamed Product').toString()
    const id = slugify(title).slice(0, 40) || slugify(url)
    const sku = (slugify(title).replace(/-/g, '').toUpperCase().slice(0, 8) || 'SKU') + '-' + (successCount + 1).toString().padStart(3, '0')

    console.log(`\n📦 [${successCount + 1}/${groups.size}] ${title}`)
    console.log(`   ID: ${id}, SKU: ${sku}`)

    // Collect images
    let imageNames = group.map(g => g[keyShot]).filter(Boolean)
    let images = Array.from(new Set(imageNames.map(n => `/images/${path.basename(n)}`)))
    let primaryImage = images.find(p => /main|cover|主图|封面/i.test(p)) || images[0]

    // If CSV does not provide image names, try to discover from media folders
    if ((!images.length || images.every(p => p.endsWith('undefined'))) && imageFolders.length) {
      const found = await findImagesForProduct(imageFolders, title, url)
      if (found && found.length) {
        // Copy discovered images into public/images with id-prefixed filenames
        const outImagesDir = path.resolve(process.cwd(), 'public', 'images')
        await fs.mkdir(outImagesDir, { recursive: true })
        const copied: string[] = []
        for (const src of found) {
          const base = path.basename(src)
          const dstName = `${id}-${base}`
          const dst = path.resolve(outImagesDir, dstName)
          try {
            const buf = await fs.readFile(src)
            await fs.writeFile(dst, buf)
            copied.push(`/images/${dstName}`)
          } catch (e) {
            // ignore copy errors
          }
        }
        if (copied.length) {
          images = copied
          primaryImage = copied.find(p => /main|cover|主图|封面/i.test(p)) || copied[0]
        }
      }
    }

    if (!primaryImage) primaryImage = '/images/placeholder.png'
    if (!images.length) images = [primaryImage]

    // Extract product data
    const optionValues = Array.from(new Set(group.map(g => g[keyOption]).filter(Boolean)))
    const priceCandidates = group.map(g => parsePrice(g[keyPrice])).filter(n => n > 0)
    const price_cad = priceCandidates[0] ?? 0
    const category = guessCategory(title)
    const description = group[0][keyDesc] || undefined

    // Create variants data
    const variants = optionValues.map((option, idx) => ({
      id: `${id}-variant-${idx}`,
      variantName: option,
      sku: `${sku}-${idx + 1}`,
      price_cny: priceCandidates[idx] || price_cad,
      price_cad: undefined,
      stock: undefined,
      status: 'Active' as const,
      sortOrder: idx,
    }))

    try {
      // Step 1: Create product in Knack (WITHOUT images)
      const productData: Omit<ProductRuntime, 'id'> = {
        sku,
        title,
        title_original: undefined,
        price_cad,
        margin: 0.5,
        primaryImage: '', // Not stored in Knack
        images: [], // Not stored in Knack
        detailLongImage: undefined, // Not stored in Knack
        category,
        description,
        status: 'Active',
        stock: undefined,
        url,
        variants: variants.length > 0 ? variants : undefined,
      }

      const createdProductId = await createProduct(productData)
      console.log(`   ✅ Created in Knack: ${createdProductId}`)

      // Step 2: Create Notion record with images only (linked by ID/SKU)
      if (notion && productsDb) {
        await createNotionImageRecord(notion, productsDb, id, sku, images, undefined)
      } else {
        console.log(`   ⚠️  Skipping Notion (not configured)`)
      }

      successCount++
    } catch (error) {
      console.error(`   ❌ Error:`, error)
      errorCount++
    }
  }

  console.log(`\n✅ Import complete!`)
  console.log(`   Success: ${successCount}`)
  console.log(`   Errors: ${errorCount}`)
}

main().catch(err => {
  console.error('❌ Import failed:', err)
  process.exit(1)
})






