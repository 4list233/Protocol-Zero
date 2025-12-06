import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('id') || 'multipurpose-tactical-qd-single-point-sling'
  
  const NOTION_API_KEY = process.env.NOTION_API_KEY
  const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS

  const status = {
    hasApiKey: !!NOTION_API_KEY,
    hasProductsDb: !!PRODUCTS_DB,
    apiKeyLength: NOTION_API_KEY?.length || 0,
    productsDbId: PRODUCTS_DB?.substring(0, 8) || 'not set',
    productIdQueried: productId,
  }

  if (!NOTION_API_KEY || !PRODUCTS_DB) {
    return NextResponse.json({
      status,
      error: 'Notion not configured',
      fix: 'Add NOTION_API_KEY and NOTION_DATABASE_ID_PRODUCTS to Vercel environment variables',
    }, { status: 500 })
  }

  try {
    console.log(`[Test Notion] Querying for product ID: ${productId}`)
    const notion = new Client({ auth: NOTION_API_KEY })
    
    const startTime = Date.now()
    const response = await notion.databases.query({
      database_id: PRODUCTS_DB,
      filter: {
        property: 'ID',
        rich_text: { equals: productId },
      },
    })
    const queryTime = Date.now() - startTime
    
    console.log(`[Test Notion] Query completed in ${queryTime}ms, found ${response.results.length} result(s)`)

    if (response.results.length === 0) {
      return NextResponse.json({
        status,
        queryTime: `${queryTime}ms`,
        result: 'Product not found in Notion',
        suggestion: 'The ID property in Notion does not match the Knack field_45 value',
      })
    }

    const page = response.results[0] as { properties: Record<string, unknown> }
    
    // Extract images
    type FileItem = { external?: { url?: string }; file?: { url?: string }; name?: string }
    const imagesProp = page.properties['Images'] as { files?: FileItem[] } | undefined
    const detailProp = page.properties['Detail Image'] as { files?: FileItem[] } | undefined
    
    const images = imagesProp?.files?.map(f => f.external?.url || f.file?.url || '') || []
    const detailImage = detailProp?.files?.[0]?.external?.url || detailProp?.files?.[0]?.file?.url || null

    return NextResponse.json({
      status,
      queryTime: `${queryTime}ms`,
      found: true,
      productId,
      imagesCount: images.length,
      images,
      detailImage,
      needsUrlFix: images.some(url => url?.includes('localhost')),
    })
  } catch (error) {
    console.error('[Test Notion] Error:', error)
    return NextResponse.json({
      status,
      error: 'Query failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}






