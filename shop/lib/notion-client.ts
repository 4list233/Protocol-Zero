import { Client } from '@notionhq/client'
// Support both Notion and Knack backends
// Set USE_KNACK_DATABASE=true to use Knack, otherwise uses Notion
import { isKnackConfigured } from './knack-client'
import * as knackProducts from './knack-products'

const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS as string
const VARIANTS_DB = process.env.NOTION_DATABASE_ID_VARIANTS as string

// Lazy check - only evaluate on server-side
function shouldUseKnack(): boolean {
  // Only check on server-side where process.env is available
  if (typeof window !== 'undefined') {
    return false
  }
  return process.env.USE_KNACK_DATABASE === 'true' && isKnackConfigured()
}

// Create a singleton client instance
let notionClient: Client | null = null

function getNotionClient(): Client {
  if (!notionClient) {
    if (!process.env.NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY is not defined')
    }
    notionClient = new Client({ 
      auth: process.env.NOTION_API_KEY 
    })
  }
  return notionClient
}

type RichTextItem = {
  plain_text?: string
  text?: { content?: string }
}

type SelectOption = {
  name?: string
}

function text(rt: RichTextItem[] | undefined): string {
  if (!rt || rt.length === 0) return ''
  return rt.map((t: RichTextItem) => t.plain_text || t.text?.content || '').join('')
}

function sel(s: SelectOption | undefined): string | undefined {
  return s?.name
}

function num(n: number | undefined | null): number {
  return typeof n === 'number' ? n : 0
}

export type ProductVariant = {
  id: string
  variantName: string
  sku?: string
  price_cny: number
  price_cad?: number
  stock?: number
  status?: 'Active' | 'Out of Stock'
  sortOrder?: number
}

export type ProductRuntime = {
  id: string
  sku: string
  title: string
  title_original?: string
  price_cad: number
  margin: number
  primaryImage: string
  images: string[]
  detailLongImage?: string
  category?: string
  description?: string
  status?: 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock'
  stock?: number
  url?: string
  variants?: ProductVariant[]
}

export async function fetchProducts(): Promise<ProductRuntime[]> {
  if (shouldUseKnack()) {
    return await knackProducts.fetchProducts()
  }

  const notion = getNotionClient()
  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
    filter: { property: 'Status', select: { equals: 'Active' } },
  })

  const products = await Promise.all(
    response.results.map(async (page: { id: string; properties: Record<string, unknown> }) => {
      const props = page.properties

      const variantsRes = await getNotionClient().databases.query({
        database_id: VARIANTS_DB,
        filter: { property: 'Product', relation: { contains: page.id } },
        sorts: [{ property: 'Sort Order', direction: 'ascending' }],
      })

      const variants: ProductVariant[] = variantsRes.results.map((vp: { id: string; properties: Record<string, unknown> }) => {
        const p = vp.properties
        return {
          id: vp.id,
          variantName: text(p['Variant Name']?.title),
          sku: text(p['SKU']?.rich_text),
          price_cny: num(p['Price CNY']?.number),
          price_cad: p['Price CAD Override']?.number ?? undefined,
          stock: p['Stock']?.number ?? undefined,
          status: sel(p['Status']?.select) as 'Active' | 'Out of Stock' | undefined,
          sortOrder: p['Sort Order']?.number ?? 0,
        }
      })

      // Extract images from Files property
      type FileItem = { external?: { url?: string }; file?: { url?: string } }
      const imageFiles = (props['Images'] as { files?: FileItem[] } | undefined)?.files || []
      const images: string[] = imageFiles.map((f: FileItem) => {
        return f.external?.url || f.file?.url || ''
      }).filter(Boolean)

      // Extract detail image
      const detailImageProp = props['Detail Image'] as { files?: FileItem[] } | undefined
      const detailFiles = detailImageProp?.files || []
      const detailLongImage = detailFiles.length > 0 
        ? (detailFiles[0].external?.url || detailFiles[0].file?.url) 
        : undefined

      return {
        id: text(props['ID']?.rich_text),
        sku: text(props['SKU']?.rich_text),
        title: text(props['Title']?.title),
        title_original: text(props['Title Original']?.rich_text),
        price_cad: num(props['Price CAD (Base)']?.number),
        margin: num(props['Margin']?.number) || 0.5,
        primaryImage: images[0] || '',
        images,
        detailLongImage,
        category: sel(props['Category']?.select),
        description: text(props['Description']?.rich_text),
        status: sel(props['Status'] as { select?: SelectOption } | undefined) as 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock' | undefined,
        stock: props['Stock']?.number ?? undefined,
        url: props['URL']?.url || undefined,
        variants: variants.length ? variants : undefined,
      }
    })
  )

  return products
}

export async function fetchProductById(id: string): Promise<ProductRuntime | null> {
  if (shouldUseKnack()) {
    return await knackProducts.fetchProductById(id)
  }

  const notion = getNotionClient()
  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
    filter: {
      and: [
        { property: 'Status', select: { equals: 'Active' } },
        { property: 'ID', rich_text: { equals: id } },
      ],
    },
  })

  if (response.results.length === 0) return null

  const page = response.results[0] as { id: string; properties: Record<string, unknown> }
  const props = page.properties

  const variantsRes = await notion.databases.query({
    database_id: VARIANTS_DB,
    filter: { property: 'Product', relation: { contains: page.id } },
    sorts: [{ property: 'Sort Order', direction: 'ascending' }],
  })

  const variants: ProductVariant[] = variantsRes.results.map((vp: { id: string; properties: Record<string, unknown> }) => {
    const p = vp.properties
    return {
      id: vp.id,
      variantName: text(p['Variant Name']?.title),
      sku: text(p['SKU']?.rich_text),
      price_cny: num(p['Price CNY']?.number),
      price_cad: p['Price CAD Override']?.number ?? undefined,
      stock: p['Stock']?.number ?? undefined,
      status: sel(p['Status']?.select) as 'Active' | 'Out of Stock' | undefined,
      sortOrder: p['Sort Order']?.number ?? 0,
    }
  })

  const imagePathsText = text(props['Image Paths']?.rich_text)
  let images: string[] = []
  try { images = imagePathsText ? JSON.parse(imagePathsText) : [] } catch { images = [] }

  return {
    id: text(props['ID']?.rich_text),
    sku: text(props['SKU']?.rich_text),
    title: text(props['Title']?.title),
    title_original: text(props['Title Original']?.rich_text),
    price_cad: num(props['Price CAD (Base)']?.number),
    margin: num(props['Margin']?.number) || 0.5,
    primaryImage: images[0] || '',
    images,
    detailLongImage: text(props['Detail Image Path']?.rich_text) || undefined,
    category: sel(props['Category']?.select),
    description: text(props['Description']?.rich_text),
    status: sel(props['Status'] as { select?: SelectOption } | undefined) as 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock' | undefined,
    stock: props['Stock']?.number ?? undefined,
    url: props['URL']?.url || undefined,
    variants: variants.length ? variants : undefined,
  }
}
