#!/usr/bin/env node

const fs = require('fs/promises')
const path = require('path')
// Load environment variables from root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

const MANIFEST_PATH = path.join(__dirname, '../data/products_manifest.json')
const OVERRIDES_PATH = path.join(__dirname, '../data/product_overrides.json')
const OUTPUT_PATH = path.join(__dirname, '../../shop/lib/products.generated.ts')
const DEFAULT_MARGIN = parseFloat(process.env.DEFAULT_PRODUCT_MARGIN ?? '0.5')

async function loadJson(filePath, fallback = {}) {
	try {
		const raw = await fs.readFile(filePath, 'utf8')
		return JSON.parse(raw)
	} catch (error) {
		if (error.code === 'ENOENT') {
			return fallback
		}
		throw error
	}
}

function normalizeNumber(value, fallback = 0) {
	const num = Number(value)
	return Number.isFinite(num) ? num : fallback
}

function buildProduct(product, index, overrides) {
	const id = product.id || `product-${index + 1}`
	const sku = product.sku || `AUTO-${String(index + 1).padStart(3, '0')}`
	// Prefer translated English title when available; fallback to provided title, then original
	const title = product.title_en || product.title || product.title_original || 'Unnamed Product'
	// Output only the translated title; keep originals only in manifest
	const url = product.url || ''
	const primaryImage = product.primaryImage || (product.images?.[0] ?? '')

	const imageSet = new Set()
	if (primaryImage) imageSet.add(primaryImage)
	;(product.images || []).filter(Boolean).forEach(img => imageSet.add(img))
	const images = Array.from(imageSet)

	const override = overrides[id] || overrides[url] || {}
	const margin = typeof override.margin === 'number'
		? override.margin
		: (typeof product.margin === 'number' ? product.margin : DEFAULT_MARGIN)

	const variants = Array.isArray(product.variants)
		? product.variants
				.filter(v => v && v.option)
				.map(v => ({
					option: v.option,
					price_cny: normalizeNumber(v.price_cny),
					price_cad: normalizeNumber(v.price_cad)
				}))
		: undefined

	const options = Array.isArray(product.options)
		? product.options.filter(opt => opt && Array.isArray(opt.values) && opt.values.length > 0)
		: undefined

	const output = {
		id,
		sku,
		title,
		price_cad: normalizeNumber(product.price_cad),
		primaryImage,
		images,
		url,
		margin
	}

	// Do not include title_en/title_original in generated output to avoid duplication
	if (product.detailLongImage) output.detailLongImage = product.detailLongImage
	if (product.category) output.category = product.category
	if (product.description) output.description = product.description
	if (options && options.length) output.options = options
	if (variants && variants.length) output.variants = variants

	return output
}

function serializeProducts(products, lastUpdated) {
	const banner = `// Auto-generated from shared/data/products_manifest.json\n// Last updated: ${lastUpdated || new Date().toISOString()}\n// DO NOT EDIT MANUALLY - Run shared/scripts/generate-products.js\n`
	const body = JSON.stringify(products, null, 2)
	return `import type { Product } from './products'\n\n${banner}\nexport const generatedProducts: Product[] = ${body}\n`
}

async function main() {
	console.log('🧾 Reading manifest...')
	const manifest = await loadJson(MANIFEST_PATH, { products: [] })
	const overrides = await loadJson(OVERRIDES_PATH, {})

	if (!Array.isArray(manifest.products) || manifest.products.length === 0) {
		console.warn('⚠️  No products found in manifest. Did you run the scraper?')
	}

	const cleaned = manifest.products.map((product, index) => buildProduct(product, index, overrides))
	console.log(`   → Processed ${cleaned.length} product(s)`) 

	const output = serializeProducts(cleaned, manifest.last_updated)
	await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
	await fs.writeFile(OUTPUT_PATH, output, 'utf8')
	console.log(`✅ Wrote products to ${OUTPUT_PATH}`)
}

if (require.main === module) {
	main().catch(err => {
		console.error('❌ Failed to generate products:', err)
		process.exit(1)
	})
}

module.exports = { main }
