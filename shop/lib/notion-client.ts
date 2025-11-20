import { Client } from '@notionhq/client'

const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS as string
const VARIANTS_DB = process.env.NOTION_DATABASE_ID_VARIANTS as string

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

function text(rt: any[] | undefined): string {
  if (!rt || rt.length === 0) return ''
  return rt.map((t: any) => t.plain_text || t.text?.content || '').join('')
}

function sel(s: any): string | undefined {
  return s?.name
}

function num(n: any): number {
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
  const notion = getNotionClient()
  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
    filter: { property: 'Status', select: { equals: 'Active' } },
  })

  const products = await Promise.all(
    response.results.map(async (page: any) => {
      const props = page.properties

      const variantsRes = await getNotionClient().databases.query({
        database_id: VARIANTS_DB,
        filter: { property: 'Product', relation: { contains: page.id } },
        sorts: [{ property: 'Sort Order', direction: 'ascending' }],
      })

      const variants: ProductVariant[] = variantsRes.results.map((vp: any) => {
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
      const imageFiles = props['Images']?.files || []
      const images: string[] = imageFiles.map((f: any) => {
        return f.external?.url || f.file?.url || ''
      }).filter(Boolean)

      // Extract detail image
      const detailFiles = props['Detail Image']?.files || []
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
        status: sel(props['Status']?.select) as any,
        stock: props['Stock']?.number ?? undefined,
        url: props['URL']?.url || undefined,
        variants: variants.length ? variants : undefined,
      }
    })
  )

  return products
}

export async function fetchProductById(id: string): Promise<ProductRuntime | null> {
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

  const page: any = response.results[0]
  const props = page.properties

  const variantsRes = await notion.databases.query({
    database_id: VARIANTS_DB,
    filter: { property: 'Product', relation: { contains: page.id } },
    sorts: [{ property: 'Sort Order', direction: 'ascending' }],
  })

  const variants: ProductVariant[] = variantsRes.results.map((vp: any) => {
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
    status: sel(props['Status']?.select) as any,
    stock: props['Stock']?.number ?? undefined,
    url: props['URL']?.url || undefined,
    variants: variants.length ? variants : undefined,
  }
}
