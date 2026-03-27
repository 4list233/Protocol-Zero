// Knack-based products operations
// Images are now fetched from Knack's Product Images table (object_14)
import {
  getKnackRecords,
  getKnackRecord,
  createKnackRecord,
  updateKnackRecord,
  isKnackConfigured,
} from './knack-client'
import { KNACK_CONFIG, getFieldValue, parseKnackNumber, extractCleanUrl } from './knack-config'
import type { ProductRuntime, ProductVariant } from './catalog'

// Product Images object and fields from config
const PRODUCT_IMAGES_OBJECT_KEY = KNACK_CONFIG.objectKeys.productImages
const PRODUCT_IMAGE_FIELDS = KNACK_CONFIG.fields.productImages

// Knack image cache - stores product record ID to images mapping
const knackImageCache = new Map<string, {
  primaryImage?: string
  galleryImages: string[]
  detailImage?: string
  variantImages: Map<string, string>  // variantId (SKU) → imageUrl
}>()

// Preload all images from Knack's Product Images table in a single batch query
async function preloadKnackImages(): Promise<void> {
  if (!isKnackConfigured()) return

  // Clear previous cache to prevent duplicate images when called multiple times
  // (e.g. fetchProducts + fetchProductById both call this)
  knackImageCache.clear()

  try {
    // Fetch all product images from Knack
    const imageRecords = await getKnackRecords<Record<string, unknown>>(PRODUCT_IMAGES_OBJECT_KEY, {
      sortField: PRODUCT_IMAGE_FIELDS.sortOrder,
      sortOrder: 'asc',
    })

    // Group images by product connection
    for (const record of imageRecords) {
      // Get the product connection - try _raw field first (Knack returns both formats)
      const productConnectionRaw = record[`${PRODUCT_IMAGE_FIELDS.product}_raw`]
      const productConnection = productConnectionRaw || getFieldValue(record, PRODUCT_IMAGE_FIELDS.product, 'Product')
      const productRecordId = extractProductRecordId(productConnection)

      if (!productRecordId) continue

      // Get image URL from the image field - try _raw field first (contains full URL info)
      const imageFieldRaw = record[`${PRODUCT_IMAGE_FIELDS.image}_raw`]
      const imageField = imageFieldRaw || getFieldValue(record, PRODUCT_IMAGE_FIELDS.image, 'Image')
      const imageUrl = extractImageUrl(imageField)

      if (!imageUrl) continue

      // Get image type (Primary, Gallery, Detail, etc.)
      const imageType = String(getFieldValue(record, PRODUCT_IMAGE_FIELDS.imageType, 'Image Type') || 'Gallery')

      // Get variantId if present (for Variant images)
      const variantId = String(getFieldValue(record, PRODUCT_IMAGE_FIELDS.variantId, 'Variant ID') || '')

      // Get or create cache entry for this product
      if (!knackImageCache.has(productRecordId)) {
        knackImageCache.set(productRecordId, {
          primaryImage: undefined,
          galleryImages: [],
          detailImage: undefined,
          variantImages: new Map<string, string>(),
        })
      }
      const cached = knackImageCache.get(productRecordId)!

      // Categorize the image
      if (imageType === 'Primary') {
        cached.primaryImage = imageUrl
      } else if (imageType === 'Detail') {
        cached.detailImage = imageUrl
      } else if (imageType === 'Variant' && variantId) {
        // Store variant-specific image keyed by variant SKU
        cached.variantImages.set(variantId, imageUrl)
      } else {
        // Gallery, Catalog
        cached.galleryImages.push(imageUrl)
      }
    }

    console.log(`[Knack Images] Preloaded images for ${knackImageCache.size} products`)
  } catch (error) {
    console.error('Error preloading Knack images:', error)
  }
}

// Extract product record ID from connection field
function extractProductRecordId(connection: unknown): string | null {
  if (!connection) return null

  // If it's a string, could be ID or HTML
  if (typeof connection === 'string') {
    // Check for Knack ID in class attribute (HTML format)
    if (connection.includes('<')) {
      const classMatch = connection.match(/class="([a-f0-9]{24})"/)
      if (classMatch && classMatch[1]) {
        return classMatch[1]
      }
    }
    // Plain string ID
    if (/^[a-f0-9]{24}$/.test(connection)) {
      return connection
    }
    return null
  }

  // If it's an array, get first item's ID
  if (Array.isArray(connection) && connection.length > 0) {
    const first = connection[0]
    if (typeof first === 'string') {
      if (/^[a-f0-9]{24}$/.test(first)) {
        return first
      }
      // Try to extract from HTML
      const match = first.match(/class="([a-f0-9]{24})"/)
      if (match && match[1]) {
        return match[1]
      }
    }
    if (typeof first === 'object' && first !== null) {
      const obj = first as Record<string, unknown>
      if (obj.id) return String(obj.id)
    }
  }

  // If it's an object with id
  if (typeof connection === 'object' && connection !== null) {
    const obj = connection as Record<string, unknown>
    if (obj.id) return String(obj.id)
  }

  return null
}

// Get images from Knack cache (by product record ID)
function getImagesForProduct(productRecordId: string): { images: string[]; detailImage?: string; variantImages?: Record<string, string> } {
  const cached = knackImageCache.get(productRecordId)

  if (cached) {
    // Build images array: primary first, then gallery
    const images: string[] = []
    if (cached.primaryImage) {
      images.push(cached.primaryImage)
    }
    images.push(...cached.galleryImages)

    if (images.length > 0) {
      // Convert variantImages Map to Record for consistency
      const variantImagesRecord = cached.variantImages.size > 0
        ? Object.fromEntries(cached.variantImages)
        : undefined

      return {
        images,
        detailImage: cached.detailImage,
        variantImages: variantImagesRecord,
      }
    }
  }

  // Fallback to placeholder if no images found
  return {
    images: ['/images/placeholder.png'],
    detailImage: undefined,
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

    // Knack file fields typically have 'url' property (use for API access)
    // or 'signed_url_inline' (for direct S3 access without download prompt)
    // or 'signed_url' (for S3 access with download prompt)
    if (fileObj.signed_url_inline && typeof fileObj.signed_url_inline === 'string') {
      return fileObj.signed_url_inline
    }
    if (fileObj.signed_url && typeof fileObj.signed_url === 'string') {
      return fileObj.signed_url
    }
    if (fileObj.url && typeof fileObj.url === 'string') {
      return fileObj.url
    }
    // Sometimes it's nested in 'file' object
    if (fileObj.file && typeof fileObj.file === 'object') {
      const file = fileObj.file as Record<string, unknown>
      if (file.signed_url_inline && typeof file.signed_url_inline === 'string') {
        return file.signed_url_inline
      }
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
// Images are fetched from Knack's Product Images table (object_14)
async function mapKnackRecordToProduct(record: Record<string, unknown>, variants: ProductVariant[] = []): Promise<ProductRuntime> {
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

  // Get images from Knack cache (preloaded from Product Images table)
  // Use knackRecordId to match product connection in images table
  const imageData = getImagesForProduct(knackRecordId)
  const knackImages = imageData.images || []
  const knackDetailImage = imageData.detailImage
  const knackVariantImages = imageData.variantImages

  // Use Knack images if available, otherwise fallback to placeholder
  const images = knackImages.length > 0 ? knackImages : ['/images/placeholder.png']
  const primaryImage = images[0] || '/images/placeholder.png'
  const detailLongImage = knackDetailImage

  // Get status directly from record - no price-based overrides
  const status = (getFieldValue(record, PRODUCT_FIELDS.status, 'Status') || 'Active') as ProductRuntime['status']

  return {
    id: productId,
    sku,
    title: String(getFieldValue(record, PRODUCT_FIELDS.title, 'Title') || ''),
    // Price is in field_138, but we'll use variant pricing instead
    // Set base price to 0 since all products should have variants with pricing
    price_cad: 0, // Variant pricing will be used instead
    margin: parseKnackNumber(getFieldValue(record, PRODUCT_FIELDS.margin, 'Margin')) || 0.5,
    primaryImage,
    images,
    detailLongImage,
    variantImages: knackVariantImages,
    category: getFieldValue(record, PRODUCT_FIELDS.category, 'Category')
      ? String(getFieldValue(record, PRODUCT_FIELDS.category, 'Category'))
      : undefined,
    description: getFieldValue(record, PRODUCT_FIELDS.description, 'Description')
      ? String(getFieldValue(record, PRODUCT_FIELDS.description, 'Description'))
      : undefined,
    status: status,
    // Stock is a yes/no (boolean) field in Knack - converted to number (1 = in stock, 0 = out of stock)
    stock: convertKnackStockToNumber(getFieldValue(record, PRODUCT_FIELDS.stock, 'Stock')),
    url: extractCleanUrl(getFieldValue(record, PRODUCT_FIELDS.url, 'URL')) || undefined,
    createdAt: getFieldValue(record, PRODUCT_FIELDS.createdAt, 'Created At')
      ? String(getFieldValue(record, PRODUCT_FIELDS.createdAt, 'Created At'))
      : undefined,
    variants: variants.length > 0 ? variants : undefined,
  }
}

// CNY to CAD conversion rate (approximate - update as needed)
const CNY_TO_CAD_RATE = 0.19

// Map Knack variant record to ProductVariant type
function mapKnackRecordToVariant(record: Record<string, unknown>): ProductVariant {
  const priceCny = parseKnackNumber(getFieldValue(record, VARIANT_FIELDS.priceCny, 'Price CNY'))
  // Variant CAD price is in field_138 (Selling Price)
  const priceCadValue = getFieldValue(record, VARIANT_FIELDS.priceCad, 'Selling Price')
  const priceCad = priceCadValue ? parseKnackNumber(priceCadValue) : undefined
  
  // Extract shipping and cost fields
  const shippingCny = getFieldValue(record, VARIANT_FIELDS.shippingCny, 'Shipping CNY')
  const costCad = getFieldValue(record, VARIANT_FIELDS.costCad, 'Cost CAD')
  const marginStandard = getFieldValue(record, VARIANT_FIELDS.marginStandard, 'Margin Standard')
  const marginPromo = getFieldValue(record, VARIANT_FIELDS.marginPromo, 'Margin Promo')
  
  // Extract multi-dimensional option fields
  const optionType1 = getFieldValue(record, VARIANT_FIELDS.optionType1, 'Option Type 1')
  const optionValue1 = getFieldValue(record, VARIANT_FIELDS.optionValue1, 'Option Value 1')
  const optionType2 = getFieldValue(record, VARIANT_FIELDS.optionType2, 'Option Type 2')
  const optionValue2 = getFieldValue(record, VARIANT_FIELDS.optionValue2, 'Option Value 2')
  
  // Extract add-on pricing fields
  const isAddonItem = getFieldValue(record, VARIANT_FIELDS.isAddonItem, 'Is Add-on Item')
  const addonPriceCad = getFieldValue(record, VARIANT_FIELDS.addonPriceCad, 'Add-on Price CAD')
  const addonCostCad = getFieldValue(record, VARIANT_FIELDS.addonCostCad, 'Add-on Cost CAD')
  const addonMargin = getFieldValue(record, VARIANT_FIELDS.addonMargin, 'Add-on Margin')
  const minCartForAddon = getFieldValue(record, VARIANT_FIELDS.minCartForAddon, 'Min Cart for Add-on')
  
  return {
    id: String(record.id || ''),
    variantName: String(getFieldValue(record, VARIANT_FIELDS.variantName, 'Variant Name') || ''),
    sku: getFieldValue(record, VARIANT_FIELDS.sku, 'SKU')
      ? String(getFieldValue(record, VARIANT_FIELDS.sku, 'SKU'))
      : undefined,
    price_cny: priceCny,
    // shipping_cny is internal - used for cost calculation but not exposed
    // cost_cad includes (price_cny + shipping_cny) * exchange_rate
    cost_cad: costCad ? parseKnackNumber(costCad) : undefined,
    price_cad: priceCad,
    margin: marginStandard ? parseKnackNumber(marginStandard) : undefined,
    margin_promo: marginPromo ? parseKnackNumber(marginPromo) : undefined,
    // Stock is a yes/no (boolean) field in Knack - converted to number (1 = in stock, 0 = out of stock)
    // Uses the same conversion logic as products
    stock: convertKnackStockToNumber(getFieldValue(record, VARIANT_FIELDS.stock, 'Stock')),
    status: (getFieldValue(record, VARIANT_FIELDS.status, 'Status') || 'Active') as ProductVariant['status'],
    sortOrder: getFieldValue(record, VARIANT_FIELDS.sortOrder, 'Sort Order')
      ? Number(getFieldValue(record, VARIANT_FIELDS.sortOrder, 'Sort Order'))
      : 0,
    // Multi-dimensional variant options
    optionType1: optionType1 ? String(optionType1) : undefined,
    optionValue1: optionValue1 ? String(optionValue1) : undefined,
    optionType2: optionType2 ? String(optionType2) : undefined,
    optionValue2: optionValue2 ? String(optionValue2) : undefined,
    // Add-on pricing (for items cheaper when added to another order)
    isAddonEligible: isAddonItem === true || isAddonItem === 'Yes' || isAddonItem === 'yes',
    addonPrice: addonPriceCad ? parseKnackNumber(addonPriceCad) : undefined,
    addonCost: addonCostCad ? parseKnackNumber(addonCostCad) : undefined,
    addonMargin: addonMargin ? parseKnackNumber(addonMargin) : undefined,
    minCartForAddon: minCartForAddon ? parseKnackNumber(minCartForAddon) : undefined,
  }
}

/**
 * Fetch all active products with their variants
 */
export async function fetchProducts(): Promise<ProductRuntime[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  // Preload all images from Knack Product Images table (single batch query)
  await preloadKnackImages()

  // Fetch only products with status=Active
  const products = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
    filters: { [PRODUCT_FIELDS.status]: 'Active' },
    sortField: PRODUCT_FIELDS.title,
    sortOrder: 'asc',
  })

  // Products fetched from Knack

  // Fetch ALL variants (don't filter by status - user manages variant availability via price)
  const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY, {
    sortField: VARIANT_FIELDS.sortOrder,
    sortOrder: 'asc',
  })

  // Variants fetched from Knack

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
        // Extract Knack ID from class attribute (e.g., class="692e7261392bfc02f0730548")
        const classMatch = productConnection.match(/class="([a-f0-9]{24})"/)
        if (classMatch && classMatch[1]) {
          extractedValues.push(classMatch[1])
        }
        
        // Also extract text content as fallback
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
      
      // Only include variants with status = 'Active'
      if (variant.status !== 'Active') {
        continue // Skip non-active variants
      }
      
      if (!variantsByProductRecordId.has(matchedProductRecordId)) {
        variantsByProductRecordId.set(matchedProductRecordId, [])
      }
      variantsByProductRecordId.get(matchedProductRecordId)!.push(variant)
    }
  }
  
  // Variants grouped by product

  // Map products with their variants - only include products with at least one active variant
  const mappedProducts = await Promise.all(
    products.map(async (product) => {
      const knackRecordId = String(product.id || '')
      if (!knackRecordId) {
        return null
      }
      
      // Get variants for this product by Knack record ID
      const variants = variantsByProductRecordId.get(knackRecordId) || []
      // Sort variants by price ascending (cheapest first) for display
      variants.sort((a, b) => {
        const aPrice = a.price_cad ?? Number.MAX_SAFE_INTEGER
        const bPrice = b.price_cad ?? Number.MAX_SAFE_INTEGER
        return aPrice - bPrice
      })
      
      // Skip products with no active variants
      if (variants.length === 0) {
        return null
      }
      
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

  // Preload all images from Knack Product Images table (single batch query)
  await preloadKnackImages()

  let product: Record<string, unknown> | null = null
  
  // Strategy: Prioritize ID field lookup (field_45) since that's what we use in URLs
  // 1. Try by ID field first (field_45) - this is what we use in URLs
  const byIdField = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
    filters: { [PRODUCT_FIELDS.id]: id },
  })
  if (byIdField.length > 0) {
    product = byIdField[0]
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
    return null
  }

  // Get the Knack record ID for variant lookup (variants are connected by record ID)
  const knackRecordId = String(product.id || '')
  if (!knackRecordId) {
    return null
  }

  // Get the product's ID field value (field_45) - this is what variants link to
  const productIdField = getFieldValue(product, PRODUCT_FIELDS.id, 'ID')
  const productIdFieldValue = productIdField ? String(productIdField) : ''
  
  if (!productIdFieldValue) {
    return await mapKnackRecordToProduct(product, [])
  }

  // Fetch ALL variants first (without status filter) to debug
  const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY, {
    sortField: VARIANT_FIELDS.sortOrder,
    sortOrder: 'asc',
  })

  // Match variants by checking multiple possible connection formats
  const validVariants: ProductVariant[] = []
  for (const variantRecord of allVariants) {
    // Get the variant's product connection (field_61)
    const productConnection = getFieldValue(variantRecord, VARIANT_FIELDS.product, 'Product')
    
    // Extract all possible ID values from the connection
    let extractedValues: string[] = []
    
    if (typeof productConnection === 'string') {
      // Check if it's HTML
      if (productConnection.includes('<') && productConnection.includes('>')) {
        // Extract Knack record ID from class attribute (e.g., class="695c386a9b81574973a16f68")
        const classMatch = productConnection.match(/class="([a-f0-9]{24})"/)
        if (classMatch && classMatch[1]) {
          extractedValues.push(classMatch[1])
        }
        
        // Also extract text content
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
    
    // Check if any extracted value matches product's field_45 OR Knack record ID
    const matchesField45 = extractedValues.some(v => v === productIdFieldValue)
    const matchesRecordId = extractedValues.some(v => v === knackRecordId)
    
    // Include variant if it matches AND has Active status
    if (matchesField45 || matchesRecordId) {
      const variant = mapKnackRecordToVariant(variantRecord)
      // Only include Active variants
      if (variant.status === 'Active') {
        validVariants.push(variant)
      }
    }
  }

  // Active variants found for product

  // Sort variants: cheapest first (by price ascending)
  validVariants.sort((a, b) => {
    const aPrice = a.price_cad ?? Number.MAX_SAFE_INTEGER
    const bPrice = b.price_cad ?? Number.MAX_SAFE_INTEGER
    return aPrice - bPrice
  })

  return await mapKnackRecordToProduct(product, validVariants)
}

/**
 * Create a new product
 * Data and images live in Knack (linked by ID/SKU).
 */
export async function createProduct(data: Omit<ProductRuntime, 'id'>): Promise<string> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  // Use SKU as product ID (or generate one if not provided)
  const productId = data.sku || `PROD-${Date.now()}`

  // Create product in Knack
  const productData: Record<string, unknown> = {}
  productData[PRODUCT_FIELDS.id] = productId
  productData[PRODUCT_FIELDS.sku] = data.sku
  productData[PRODUCT_FIELDS.title] = data.title
  productData[PRODUCT_FIELDS.description] = data.description || null
  productData[PRODUCT_FIELDS.category] = data.category || null
  productData[PRODUCT_FIELDS.status] = data.status || 'Active'
  productData[PRODUCT_FIELDS.priceCadBase] = data.price_cad
  productData[PRODUCT_FIELDS.margin] = data.margin || 0.5
  productData[PRODUCT_FIELDS.stock] = data.stock || null
  productData[PRODUCT_FIELDS.url] = data.url || null
  // Images are stored in Knack Product Images table
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

  // Images are managed via Knack's Product Images table (object_14)
  // Use the upload_to_knack.py script to upload images

  return productId
}

/**
 * Update an existing product
 * Data updates go to Knack. Images are managed via Product Images table (object_14).
 */
export async function updateProduct(productId: string, data: Partial<ProductRuntime>): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  // Update product data in Knack
  const updateData: Record<string, unknown> = {}

  if (data.title !== undefined) updateData[PRODUCT_FIELDS.title] = data.title
  if (data.description !== undefined) updateData[PRODUCT_FIELDS.description] = data.description
  if (data.category !== undefined) updateData[PRODUCT_FIELDS.category] = data.category
  if (data.status !== undefined) updateData[PRODUCT_FIELDS.status] = data.status
  if (data.price_cad !== undefined) updateData[PRODUCT_FIELDS.priceCadBase] = data.price_cad
  if (data.margin !== undefined) updateData[PRODUCT_FIELDS.margin] = data.margin
  if (data.stock !== undefined) updateData[PRODUCT_FIELDS.stock] = data.stock
  if (data.url !== undefined) updateData[PRODUCT_FIELDS.url] = data.url
  if (data.sku !== undefined) updateData[PRODUCT_FIELDS.sku] = data.sku

  await updateKnackRecord(PRODUCTS_OBJECT_KEY, productId, updateData)

  // Note: Images are managed via Knack's Product Images table (object_14)
  // Use the admin dashboard or upload_to_knack.py script to manage images
}
