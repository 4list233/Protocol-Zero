// Knack-based products operations (replaces Notion products)
// Images are fetched from Notion to maintain compatibility
import {
  getKnackRecords,
  getKnackRecord,
  createKnackRecord,
  updateKnackRecord,
  isKnackConfigured,
} from './knack-client'
import { KNACK_CONFIG, getFieldValue } from './knack-config'
import type { ProductRuntime, ProductVariant } from './notion-client'
import { Client } from '@notionhq/client'

// Notion client for fetching images (hybrid approach)
let notionClient: Client | null = null
function getNotionClient(): Client | null {
  if (notionClient) {
    console.log('[Notion Images] ✅ Using existing Notion client')
    return notionClient
  }
  
  console.log('[Notion Images] 🔧 Initializing Notion client...')
  const NOTION_API_KEY = process.env.NOTION_API_KEY
  const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS
  
  if (!NOTION_API_KEY || !PRODUCTS_DB) {
    console.error('[Notion Images] ❌ Notion not configured:', {
      hasApiKey: !!NOTION_API_KEY,
      hasProductsDb: !!PRODUCTS_DB,
      apiKeyLength: NOTION_API_KEY?.length || 0,
      dbIdLength: PRODUCTS_DB?.length || 0
    })
    return null // Notion not configured, images will use placeholder
  }
  
  console.log('[Notion Images] ✅ Notion client initialized successfully')
  notionClient = new Client({ auth: NOTION_API_KEY })
  return notionClient
}

// Helper to extract images from Notion file property
function extractNotionImages(props: Record<string, unknown>): { images: string[]; detailImage?: string } {
  type FileItem = { external?: { url?: string }; file?: { url?: string }; name?: string; type?: string }
  
  // Extract images from Files property
  const imagesProp = props['Images'] as { files?: FileItem[]; type?: string } | undefined
  const imageFiles = imagesProp?.files || []
  
  const images: string[] = imageFiles.map((f: FileItem) => {
    return f.external?.url || f.file?.url || ''
  }).filter(Boolean)

  // Extract detail image
  const detailImageProp = props['Detail Image'] as { files?: FileItem[]; type?: string } | undefined
  const detailFiles = detailImageProp?.files || []
  const detailLongImage = detailFiles.length > 0 
    ? (detailFiles[0].external?.url || detailFiles[0].file?.url) 
    : undefined

  if (images.length > 0 || detailLongImage) {
    console.log(`[Notion Images] Extracted ${images.length} image(s)${detailLongImage ? ' + detail image' : ''}`)
  }

  return { images, detailImage: detailLongImage }
}

// Fix image URLs that were stored with localhost - replace with production URL
function fixImageUrl(url: string): string {
  if (!url) return url
  
  // Get the production base URL
  const productionUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pzairsoft.ca'
  
  // Replace localhost URLs with production URL
  if (url.includes('localhost:3000')) {
    return url.replace(/https?:\/\/localhost:3000/g, productionUrl)
  }
  
  return url
}

// Fetch images from Notion by product ID (primary) or SKU (fallback)
// Images are sourced from Notion under the same product ID
async function fetchImagesFromNotion(productId: string, sku: string): Promise<{ images: string[]; detailImage?: string }> {
  console.log(`[Notion Images] 🔍 START fetching images for product ${productId} (SKU: ${sku})`)
  
  const notion = getNotionClient()
  if (!notion) {
    console.error(`[Notion Images] ❌ Notion client not available for product ${productId}. Check NOTION_API_KEY and NOTION_DATABASE_ID_PRODUCTS env vars.`)
    return { images: [], detailImage: undefined }
  }

  const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS
  if (!PRODUCTS_DB) {
    console.error(`[Notion Images] ❌ NOTION_DATABASE_ID_PRODUCTS not set for product ${productId}`)
    return { images: [], detailImage: undefined }
  }
  
  console.log(`[Notion Images] ✅ Notion client initialized, database ID: ${PRODUCTS_DB.substring(0, 8)}...`)

  try {
    // Primary lookup: find product by ID (field_45) - images are stored under the same product ID
    console.log(`[Notion Images] 🔎 Querying Notion for product ID: ${productId}`)
    let response = await notion.databases.query({
      database_id: PRODUCTS_DB,
      filter: {
        property: 'ID',
        rich_text: { equals: productId },
      },
    })
    console.log(`[Notion Images] 📊 Query result: ${response.results.length} page(s) found by ID`)

    // Fallback: if not found by ID, try SKU
    if (response.results.length === 0) {
      console.log(`[Notion Images] ⚠️ Product ${productId} not found by ID, trying SKU: ${sku}`)
      response = await notion.databases.query({
        database_id: PRODUCTS_DB,
        filter: {
          property: 'SKU',
          rich_text: { equals: sku },
        },
      })
      console.log(`[Notion Images] 📊 SKU query result: ${response.results.length} page(s) found`)
    }

    if (response.results.length > 0) {
      const page = response.results[0] as { properties: Record<string, unknown> }
      const { images, detailImage } = extractNotionImages(page.properties)
      
      console.log(`[Notion Images] Found ${images.length} image(s) for product ${productId}${detailImage ? ' (with detail image)' : ''}`)
      
      // Fix any localhost URLs in the images
      return {
        images: images.map(fixImageUrl),
        detailImage: detailImage ? fixImageUrl(detailImage) : undefined,
      }
    } else {
      console.warn(`[Notion Images] No Notion page found for product ${productId} (ID) or SKU ${sku}`)
    }
  } catch (error) {
    console.error(`[Notion Images] ❌ ERROR fetching images from Notion for product ${productId}:`, error)
    if (error instanceof Error) {
      console.error(`[Notion Images] Error message: ${error.message}`)
      if (error.stack) {
        console.error(`[Notion Images] Error stack: ${error.stack}`)
      }
    }
    // Continue without images rather than breaking product fetching
  }

  return { images: [], detailImage: undefined }
}

// Create or update product images in Notion (linked by ID/SKU)
async function syncImagesToNotion(
  productId: string,
  sku: string,
  images: string[],
  detailImage?: string
): Promise<void> {
  const notion = getNotionClient()
  if (!notion) {
    console.warn('Notion not configured, skipping image sync')
    return
  }

  const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS
  if (!PRODUCTS_DB) {
    console.warn('NOTION_DATABASE_ID_PRODUCTS not set, skipping image sync')
    return
  }

  try {
    // Convert image URLs to Notion file format
    // For local paths (starting with /), convert to full URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pzairsoft.ca'
    
    const imageFiles = images
      .filter((url) => url && !url.includes('placeholder.png'))
      .map((url) => {
        // If it's already a full URL, use as external
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return { external: { url } }
        }
        // Convert local paths to full URLs
        const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/images/${url}`
        return { external: { url: fullUrl } }
      })

    const detailImageFile = detailImage
      ? (() => {
          if (detailImage.startsWith('http://') || detailImage.startsWith('https://')) {
            return [{ external: { url: detailImage } }]
          }
          const fullUrl = detailImage.startsWith('/') 
            ? `${baseUrl}${detailImage}` 
            : `${baseUrl}/images/${detailImage}`
          return [{ external: { url: fullUrl } }]
        })()
      : undefined

    // Try to find existing product in Notion by ID or SKU
    let response = await notion.databases.query({
      database_id: PRODUCTS_DB,
      filter: {
        property: 'ID',
        rich_text: { equals: productId },
      },
    })

    if (response.results.length === 0) {
      response = await notion.databases.query({
        database_id: PRODUCTS_DB,
        filter: {
          property: 'SKU',
          rich_text: { equals: sku },
        },
      })
    }

    if (response.results.length > 0) {
      // Update existing Notion page with images
      const pageId = response.results[0].id
      const updateProps: Record<string, unknown> = {}
      if (imageFiles.length > 0) {
        updateProps.Images = { files: imageFiles }
      }
      if (detailImageFile) {
        updateProps['Detail Image'] = { files: detailImageFile }
      }
      await notion.pages.update({
        page_id: pageId,
        properties: updateProps as any, // Notion API types are complex, using any for flexibility
      })
    } else {
      // Create new Notion page with minimal data (just for images)
      // Link it to Knack by ID and SKU
      const createProps: Record<string, unknown> = {
        ID: {
          rich_text: [{ text: { content: productId } }],
        },
        SKU: {
          rich_text: [{ text: { content: sku } }],
        },
        Title: {
          title: [{ text: { content: `Image record for ${productId}` } }],
        },
        Status: { select: { name: 'Active' } },
      }
      if (imageFiles.length > 0) {
        createProps.Images = { files: imageFiles }
      }
      if (detailImageFile) {
        createProps['Detail Image'] = { files: detailImageFile }
      }
      await notion.pages.create({
        parent: { database_id: PRODUCTS_DB },
        properties: createProps as any, // Notion API types are complex, using any for flexibility
      })
    }
  } catch (error) {
    console.error('Error syncing images to Notion:', error)
    // Don't throw - image sync failure shouldn't break product creation
  }
}

// Knack object keys (from config or env)
const PRODUCTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.products
const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const PRODUCT_FIELDS = KNACK_CONFIG.fields.products
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants

// Convert Knack stock value (yes/no boolean) to number (1 = in stock, 0 = out of stock, undefined = unknown)
// Used for both products and variants
function convertKnackStockToNumber(stockValue: unknown): number | undefined {
  if (stockValue === true || stockValue === 'Yes' || stockValue === 'yes' || stockValue === 1) return 1
  if (stockValue === false || stockValue === 'No' || stockValue === 'no' || stockValue === 0) return 0
  return undefined
}

// Helper to extract URL from Knack file field
function extractImageUrl(imageField: unknown): string {
  if (!imageField) return ''
  
  // If it's already a string URL, return it
  if (typeof imageField === 'string') {
    // Check if it's a JSON string
    try {
      const parsed = JSON.parse(imageField)
      if (Array.isArray(parsed)) {
        return extractImageUrl(parsed[0])
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return extractImageUrl(parsed)
    }
  } catch {
      // Not JSON, treat as URL string (but validate it looks like a URL)
      if (imageField.startsWith('http://') || imageField.startsWith('https://') || imageField.startsWith('/')) {
        return imageField
      }
      // Might be a relative path, try to use it
      return imageField
    }
  }
  
  // If it's an array, get first item
  if (Array.isArray(imageField)) {
    if (imageField.length === 0) return ''
    return extractImageUrl(imageField[0])
  }
  
  // If it's an object (Knack file field format)
  if (typeof imageField === 'object' && imageField !== null) {
    const fileObj = imageField as Record<string, unknown>
    
    // Knack file fields typically have 'url' property
    if (fileObj.url && typeof fileObj.url === 'string') {
      return fileObj.url
    }
    // Sometimes it's nested in 'file' object
    if (fileObj.file && typeof fileObj.file === 'object') {
      const file = fileObj.file as Record<string, unknown>
      if (file.url && typeof file.url === 'string') {
        return file.url
      }
    }
    // Sometimes it's 'file_url', 'link', or 'src'
    if (fileObj.file_url && typeof fileObj.file_url === 'string') {
      return fileObj.file_url
    }
    if (fileObj.link && typeof fileObj.link === 'string') {
      return fileObj.link
    }
    if (fileObj.src && typeof fileObj.src === 'string') {
      return fileObj.src
    }
    // Check for raw property (Knack sometimes uses this)
    if (fileObj.raw && typeof fileObj.raw === 'string') {
      return fileObj.raw
    }
  }
  
  return ''
}

// Map Knack record to ProductRuntime type
// Images are fetched from Notion (hybrid approach)
async function mapKnackRecordToProduct(record: Record<string, unknown>, variants: ProductVariant[] = []): Promise<ProductRuntime> {
  console.log(`[Product Mapping] ⚡ START mapping product (variants: ${variants.length})`)
  
  const knackRecordId = String(record.id || '')
  if (!knackRecordId) {
    throw new Error('Product record must have a Knack record ID')
  }
  
  // Use ID field (field_45) as product ID for URLs, fallback to SKU, then Knack record ID
  const idField = getFieldValue(record, PRODUCT_FIELDS.id, 'ID')
  const sku = String(getFieldValue(record, PRODUCT_FIELDS.sku, 'SKU') || '')
  
  // Product ID for URLs: prefer ID field, then SKU, then Knack record ID as last resort
  const productId = idField 
    ? String(idField) 
    : (sku || knackRecordId)
  
  // Fetch images from Notion (matching by ID or SKU)
  console.log(`[Product Mapping] 📸 Fetching images for product ${productId} (SKU: ${sku})`)
  const { images: notionImages, detailImage: notionDetailImage } = await fetchImagesFromNotion(productId, sku)
  console.log(`[Product Mapping] Got ${notionImages.length} image(s) from Notion for product ${productId}`)
  
  // Use Notion images if available, otherwise fallback to placeholder
  const images = notionImages.length > 0 ? notionImages : ['/images/placeholder.png']
  const primaryImage = images[0] || '/images/placeholder.png'
  const detailLongImage = notionDetailImage

  // Get status directly from record - no price-based overrides
  const status = (getFieldValue(record, PRODUCT_FIELDS.status, 'Status') || 'Active') as ProductRuntime['status']

  return {
    id: productId,
    sku,
    title: String(getFieldValue(record, PRODUCT_FIELDS.title, 'Title') || ''),
    title_original: getFieldValue(record, PRODUCT_FIELDS.titleOriginal, 'Title Original') 
      ? String(getFieldValue(record, PRODUCT_FIELDS.titleOriginal, 'Title Original')) 
      : undefined,
    // Price is in field_138, but we'll use variant pricing instead
    // Set base price to 0 since all products should have variants with pricing
    price_cad: 0, // Variant pricing will be used instead
    margin: Number(getFieldValue(record, PRODUCT_FIELDS.margin, 'Margin') || 0.5),
    primaryImage,
    images,
    detailLongImage,
    category: getFieldValue(record, PRODUCT_FIELDS.category, 'Category')
      ? String(getFieldValue(record, PRODUCT_FIELDS.category, 'Category'))
      : undefined,
    description: getFieldValue(record, PRODUCT_FIELDS.description, 'Description')
      ? String(getFieldValue(record, PRODUCT_FIELDS.description, 'Description'))
      : undefined,
    status: status,
    // Stock is a yes/no (boolean) field in Knack - converted to number (1 = in stock, 0 = out of stock)
    stock: convertKnackStockToNumber(getFieldValue(record, PRODUCT_FIELDS.stock, 'Stock')),
    url: getFieldValue(record, PRODUCT_FIELDS.url, 'URL')
      ? String(getFieldValue(record, PRODUCT_FIELDS.url, 'URL'))
      : undefined,
    variants: variants.length > 0 ? variants : undefined,
  }
}

// CNY to CAD conversion rate (approximate - update as needed)
const CNY_TO_CAD_RATE = 0.19

// Map Knack variant record to ProductVariant type
function mapKnackRecordToVariant(record: Record<string, unknown>): ProductVariant {
  const priceCny = Number(getFieldValue(record, VARIANT_FIELDS.priceCny, 'Price CNY') || 0)
  // Variant CAD price is in field_138 (Selling Price)
  const priceCadValue = getFieldValue(record, VARIANT_FIELDS.priceCad, 'Selling Price')
  const priceCad = priceCadValue ? Number(priceCadValue) : undefined
  
  return {
    id: String(record.id || ''),
    variantName: String(getFieldValue(record, VARIANT_FIELDS.variantName, 'Variant Name') || ''),
    sku: getFieldValue(record, VARIANT_FIELDS.sku, 'SKU')
      ? String(getFieldValue(record, VARIANT_FIELDS.sku, 'SKU'))
      : undefined,
    price_cny: priceCny,
    price_cad: priceCad,
    // Stock is a yes/no (boolean) field in Knack - converted to number (1 = in stock, 0 = out of stock)
    // Uses the same conversion logic as products
    stock: convertKnackStockToNumber(getFieldValue(record, VARIANT_FIELDS.stock, 'Stock')),
    status: (getFieldValue(record, VARIANT_FIELDS.status, 'Status') || 'Active') as ProductVariant['status'],
    sortOrder: getFieldValue(record, VARIANT_FIELDS.sortOrder, 'Sort Order')
      ? Number(getFieldValue(record, VARIANT_FIELDS.sortOrder, 'Sort Order'))
      : 0,
  }
}

/**
 * Fetch all active products with their variants
 */
export async function fetchProducts(): Promise<ProductRuntime[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  // Fetch only products with status=Active
  const products = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
    filters: { [PRODUCT_FIELDS.status]: 'Active' },
    sortField: PRODUCT_FIELDS.title,
    sortOrder: 'asc',
  })

  console.log(`Fetched ${products.length} active products from Knack`)

  // Fetch ALL variants (don't filter by status - user manages variant availability via price)
  const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY, {
    sortField: VARIANT_FIELDS.sortOrder,
    sortOrder: 'asc',
  })

  console.log(`Fetched ${allVariants.length} active variants for ${products.length} products`)

  // Create maps for product lookups - by field_45 AND by Knack record ID
  const productsByIdField = new Map<string, Record<string, unknown>>()
  const productsByRecordId = new Map<string, Record<string, unknown>>()
  
  for (const product of products) {
    const recordId = String(product.id || '')
    const idField = getFieldValue(product, PRODUCT_FIELDS.id, 'ID')
    const idFieldValue = idField ? String(idField) : ''
    
    if (idFieldValue) {
      productsByIdField.set(idFieldValue, product)
    }
    if (recordId) {
      productsByRecordId.set(recordId, product)
    }
    console.log(`Product: record ID=${recordId}, field_45=${idFieldValue}`)
  }

  // Group variants by product - match by field_45 OR Knack record ID
  const variantsByProductRecordId = new Map<string, ProductVariant[]>()
  
  for (const variantRecord of allVariants) {
    const variantId = String(variantRecord.id || '')
    const variantName = getFieldValue(variantRecord, VARIANT_FIELDS.variantName, 'Variant Name')
    
    // Get the product connection from variant's field_61
    const productConnection = getFieldValue(variantRecord, VARIANT_FIELDS.product, 'Product')
    
    // Extract all possible values from the connection
    const extractedValues: string[] = []
    
    if (typeof productConnection === 'string') {
      // Check if it's HTML
      if (productConnection.includes('<') && productConnection.includes('>')) {
        const match = productConnection.match(/data-kn="connection-value">([^<]+)</) || 
                     productConnection.match(/>([^<]+)</)
        if (match && match[1]) extractedValues.push(match[1].trim())
        const stripped = productConnection.replace(/<[^>]*>/g, '').trim()
        if (stripped && !extractedValues.includes(stripped)) extractedValues.push(stripped)
      } else {
        extractedValues.push(productConnection.trim())
      }
    } else if (Array.isArray(productConnection) && productConnection.length > 0) {
      for (const item of productConnection) {
        if (typeof item === 'string') {
          extractedValues.push(item.trim())
          if (item.includes('<')) {
            const stripped = item.replace(/<[^>]*>/g, '').trim()
            if (stripped && !extractedValues.includes(stripped)) extractedValues.push(stripped)
          }
        } else if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          if (obj.id) extractedValues.push(String(obj.id))
          if (obj.identifier) extractedValues.push(String(obj.identifier))
          if (obj[PRODUCT_FIELDS.id]) extractedValues.push(String(obj[PRODUCT_FIELDS.id]))
        }
      }
    } else if (typeof productConnection === 'object' && productConnection !== null) {
      const obj = productConnection as Record<string, unknown>
      if (obj.id) extractedValues.push(String(obj.id))
      if (obj.identifier) extractedValues.push(String(obj.identifier))
      if (obj[PRODUCT_FIELDS.id]) extractedValues.push(String(obj[PRODUCT_FIELDS.id]))
    }
    
    // Find matching product by field_45 or record ID
    let matchedProductRecordId: string | null = null
    
    for (const value of extractedValues) {
      // Try matching by field_45
      if (productsByIdField.has(value)) {
        const product = productsByIdField.get(value)!
        matchedProductRecordId = String(product.id || '')
        break
      }
      // Try matching by record ID
      if (productsByRecordId.has(value)) {
        matchedProductRecordId = value
        break
      }
    }
    
    if (matchedProductRecordId) {
      const variant = mapKnackRecordToVariant(variantRecord)
      if (!variantsByProductRecordId.has(matchedProductRecordId)) {
        variantsByProductRecordId.set(matchedProductRecordId, [])
      }
      variantsByProductRecordId.get(matchedProductRecordId)!.push(variant)
      console.log(`✅ Variant "${variantName}" linked to product ${matchedProductRecordId}`)
    } else {
      console.log(`❌ Variant "${variantName}" (${variantId}) not matched. Values: ${JSON.stringify(extractedValues)}`)
    }
  }
  
  console.log(`\nVariants grouped: ${variantsByProductRecordId.size} products have variants`)

  // Map products with their variants (now async to fetch images from Notion)
  const mappedProducts = await Promise.all(
    products.map(async (product) => {
      const knackRecordId = String(product.id || '')
      if (!knackRecordId) {
        console.warn('Product missing Knack record ID, skipping')
        return null
      }
      
      // Get variants for this product by Knack record ID
      const variants = variantsByProductRecordId.get(knackRecordId) || []
      
      const productTitle = getFieldValue(product, PRODUCT_FIELDS.title, 'Title')
      console.log(`Product "${productTitle}" (${knackRecordId}): ${variants.length} variant(s)`)
      
      return await mapKnackRecordToProduct(product, variants)
    })
  )
  
  // Filter out nulls and return
  return mappedProducts.filter((p): p is ProductRuntime => p !== null)
}

/**
 * Fetch a single product by ID with its variants
 * The ID should be from ID field (field_45), but can also be SKU or Knack record ID
 */
export async function fetchProductById(id: string): Promise<ProductRuntime | null> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  let product: Record<string, unknown> | null = null
  
  // Strategy: Prioritize ID field lookup (field_45) since that's what we use in URLs
  // 1. Try by ID field first (field_45) - this is what we use in URLs
  const byIdField = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
    filters: { [PRODUCT_FIELDS.id]: id },
  })
  if (byIdField.length > 0) {
    product = byIdField[0]
    console.log(`Found product by ID field: ${id} -> ${getFieldValue(product, PRODUCT_FIELDS.title, 'Title')}`)
  } else {
    console.log(`No product found by ID field: ${id} (field key: ${PRODUCT_FIELDS.id})`)
  }

  // 2. If not found by ID field, try by SKU
  if (!product) {
      const bySku = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
        filters: { [PRODUCT_FIELDS.sku]: id },
      })
      if (bySku.length > 0) {
        product = bySku[0]
      }
    }

  // 3. If still not found, try direct record lookup by Knack record ID
  if (!product) {
    try {
      product = await getKnackRecord<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, id)
    } catch {
      // Not a Knack record ID or not found
    }
  }

  if (!product) {
    console.warn(`Product not found with ID: ${id}`)
    return null
  }

  // Get the Knack record ID for variant lookup (variants are connected by record ID)
  const knackRecordId = String(product.id || '')
  if (!knackRecordId) {
    console.error('Product found but has no Knack record ID')
    return null
  }

  // Get the product's ID field value (field_45) - this is what variants link to
  const productIdField = getFieldValue(product, PRODUCT_FIELDS.id, 'ID')
  const productIdFieldValue = productIdField ? String(productIdField) : ''
  
  if (!productIdFieldValue) {
    console.warn(`Product ${knackRecordId} has no ID field (${PRODUCT_FIELDS.id}), cannot fetch variants`)
    return await mapKnackRecordToProduct(product, [])
  }

  // Fetch ALL variants first (without status filter) to debug
  console.log(`\n=== Fetching variants for product ${id} ===`)
  console.log(`Product Knack record ID: ${knackRecordId}`)
  console.log(`Product field_45 value: ${productIdFieldValue}`)
  
  const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY, {
    sortField: VARIANT_FIELDS.sortOrder,
    sortOrder: 'asc',
  })

  console.log(`Total variants in Knack: ${allVariants.length}`)

  // Match variants by checking multiple possible connection formats
  const validVariants: ProductVariant[] = []
  for (const variantRecord of allVariants) {
    const variantId = String(variantRecord.id || '')
    const variantName = getFieldValue(variantRecord, VARIANT_FIELDS.variantName, 'Variant Name')
    const variantStatus = getFieldValue(variantRecord, VARIANT_FIELDS.status, 'Status')
    
    // Get the variant's product connection (field_61)
    const productConnection = getFieldValue(variantRecord, VARIANT_FIELDS.product, 'Product')
    
    console.log(`\nVariant: ${variantName} (${variantId})`)
    console.log(`  Status: ${variantStatus}`)
    console.log(`  Raw field_61: ${JSON.stringify(productConnection)}`)
    console.log(`  Type: ${typeof productConnection}${Array.isArray(productConnection) ? ' (array)' : ''}`)
    
    // Extract all possible ID values from the connection
    let extractedValues: string[] = []
    
    if (typeof productConnection === 'string') {
      // Check if it's HTML
      if (productConnection.includes('<') && productConnection.includes('>')) {
        const match = productConnection.match(/data-kn="connection-value">([^<]+)</) || 
                     productConnection.match(/>([^<]+)</)
        if (match && match[1]) {
          extractedValues.push(match[1].trim())
        }
        // Also try stripping all HTML
        const stripped = productConnection.replace(/<[^>]*>/g, '').trim()
        if (stripped && !extractedValues.includes(stripped)) {
          extractedValues.push(stripped)
        }
      } else {
        extractedValues.push(productConnection.trim())
      }
    } else if (Array.isArray(productConnection) && productConnection.length > 0) {
      for (const item of productConnection) {
        if (typeof item === 'string') {
          extractedValues.push(item.trim())
          // Also try extracting from HTML
          if (item.includes('<')) {
            const stripped = item.replace(/<[^>]*>/g, '').trim()
            if (stripped && !extractedValues.includes(stripped)) {
              extractedValues.push(stripped)
            }
          }
        } else if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          // Try various ID fields
          if (obj.id) extractedValues.push(String(obj.id))
          if (obj.identifier) extractedValues.push(String(obj.identifier))
          if (obj[PRODUCT_FIELDS.id]) extractedValues.push(String(obj[PRODUCT_FIELDS.id]))
        }
      }
    } else if (typeof productConnection === 'object' && productConnection !== null) {
      const obj = productConnection as Record<string, unknown>
      if (obj.id) extractedValues.push(String(obj.id))
      if (obj.identifier) extractedValues.push(String(obj.identifier))
      if (obj[PRODUCT_FIELDS.id]) extractedValues.push(String(obj[PRODUCT_FIELDS.id]))
    }
    
    console.log(`  Extracted values: ${JSON.stringify(extractedValues)}`)
    
    // Check if any extracted value matches product's field_45 OR Knack record ID
    const matchesField45 = extractedValues.some(v => v === productIdFieldValue)
    const matchesRecordId = extractedValues.some(v => v === knackRecordId)
    
    console.log(`  Matches field_45 (${productIdFieldValue}): ${matchesField45}`)
    console.log(`  Matches record ID (${knackRecordId}): ${matchesRecordId}`)
    
    // Include variant if it matches (don't filter by status - user manages via price)
    if (matchesField45 || matchesRecordId) {
      validVariants.push(mapKnackRecordToVariant(variantRecord))
      console.log(`  ✓ LINKED (status: ${variantStatus})`)
    } else {
      console.log(`  ✗ No match`)
    }
  }

  console.log(`\n=== Result: ${validVariants.length} active variants match product ${id} ===\n`)
  console.log(`[fetchProductById] 🚀 About to call mapKnackRecordToProduct with ${validVariants.length} variant(s)`)

  const result = await mapKnackRecordToProduct(product, validVariants)
  console.log(`[fetchProductById] ✅ Product mapped successfully, returning product`)
  return result
}

/**
 * Create a new product
 * Data goes to Knack, images go to Notion (linked by ID/SKU)
 */
export async function createProduct(data: Omit<ProductRuntime, 'id'>): Promise<string> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  // Use SKU as product ID (or generate one if not provided)
  const productId = data.sku || `PROD-${Date.now()}`

  // Create product in Knack (WITHOUT images - those go to Notion)
  const productData: Record<string, unknown> = {}
  productData[PRODUCT_FIELDS.id] = productId
  productData[PRODUCT_FIELDS.sku] = data.sku
  productData[PRODUCT_FIELDS.title] = data.title
  productData[PRODUCT_FIELDS.titleOriginal] = data.title_original || null
  productData[PRODUCT_FIELDS.description] = data.description || null
  productData[PRODUCT_FIELDS.category] = data.category || null
  productData[PRODUCT_FIELDS.status] = data.status || 'Active'
  productData[PRODUCT_FIELDS.priceCadBase] = data.price_cad
  productData[PRODUCT_FIELDS.margin] = data.margin || 0.5
  productData[PRODUCT_FIELDS.stock] = data.stock || null
  productData[PRODUCT_FIELDS.url] = data.url || null
  // Don't store images in Knack - they go to Notion
  productData[PRODUCT_FIELDS.primaryImage] = null
  productData[PRODUCT_FIELDS.images] = null
  productData[PRODUCT_FIELDS.detailImage] = null

  const knackRecordId = await createKnackRecord(PRODUCTS_OBJECT_KEY, productData)

  // Create variants in Knack if provided
  if (data.variants && data.variants.length > 0) {
    for (const variant of data.variants) {
      const variantData: Record<string, unknown> = {}
      variantData[VARIANT_FIELDS.product] = knackRecordId
      variantData[VARIANT_FIELDS.variantName] = variant.variantName
      variantData[VARIANT_FIELDS.sku] = variant.sku || null
      variantData[VARIANT_FIELDS.priceCny] = variant.price_cny
      variantData[VARIANT_FIELDS.priceCad] = variant.price_cad || null
      variantData[VARIANT_FIELDS.stock] = variant.stock || null
      variantData[VARIANT_FIELDS.status] = variant.status || 'Active'
      variantData[VARIANT_FIELDS.sortOrder] = variant.sortOrder || 0
      await createKnackRecord(VARIANTS_OBJECT_KEY, variantData)
    }
  }

  // Sync images to Notion (linked by productId and SKU)
  if (data.images && data.images.length > 0) {
    await syncImagesToNotion(productId, data.sku, data.images, data.detailLongImage)
  }

  return productId
}

/**
 * Update an existing product
 * Data updates go to Knack, image updates go to Notion (linked by ID/SKU)
 */
export async function updateProduct(productId: string, data: Partial<ProductRuntime>): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  // Get current product to find SKU for Notion linking
  const currentProduct = await fetchProductById(productId)
  const sku = data.sku || currentProduct?.sku || ''

  // Update product data in Knack (excluding images)
  const updateData: Record<string, unknown> = {}

  if (data.title !== undefined) updateData[PRODUCT_FIELDS.title] = data.title
  if (data.title_original !== undefined) updateData[PRODUCT_FIELDS.titleOriginal] = data.title_original
  if (data.description !== undefined) updateData[PRODUCT_FIELDS.description] = data.description
  if (data.category !== undefined) updateData[PRODUCT_FIELDS.category] = data.category
  if (data.status !== undefined) updateData[PRODUCT_FIELDS.status] = data.status
  if (data.price_cad !== undefined) updateData[PRODUCT_FIELDS.priceCadBase] = data.price_cad
  if (data.margin !== undefined) updateData[PRODUCT_FIELDS.margin] = data.margin
  if (data.stock !== undefined) updateData[PRODUCT_FIELDS.stock] = data.stock
  if (data.url !== undefined) updateData[PRODUCT_FIELDS.url] = data.url
  if (data.sku !== undefined) updateData[PRODUCT_FIELDS.sku] = data.sku
  // Don't update images in Knack - they're stored in Notion
  // Clear image fields if they're being updated
  if (data.images !== undefined || data.primaryImage !== undefined || data.detailLongImage !== undefined) {
    updateData[PRODUCT_FIELDS.primaryImage] = null
    updateData[PRODUCT_FIELDS.images] = null
    updateData[PRODUCT_FIELDS.detailImage] = null
  }

  await updateKnackRecord(PRODUCTS_OBJECT_KEY, productId, updateData)

  // Sync images to Notion if they're being updated
  if (data.images !== undefined || data.detailLongImage !== undefined) {
    const images = data.images || currentProduct?.images || []
    const detailImage = data.detailLongImage !== undefined ? data.detailLongImage : currentProduct?.detailLongImage
    await syncImagesToNotion(productId, sku, images, detailImage)
  }
}
