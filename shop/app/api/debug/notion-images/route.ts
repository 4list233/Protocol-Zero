import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const NOTION_API_KEY = process.env.NOTION_API_KEY
  const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS

  const status = {
    configured: !!(NOTION_API_KEY && PRODUCTS_DB),
    hasApiKey: !!NOTION_API_KEY,
    hasProductsDb: !!PRODUCTS_DB,
    apiKeyLength: NOTION_API_KEY?.length || 0,
    productsDbId: PRODUCTS_DB || 'not set',
  }

  if (!NOTION_API_KEY || !PRODUCTS_DB) {
    return NextResponse.json({
      status,
      error: 'Notion not configured',
      message: 'Missing NOTION_API_KEY or NOTION_DATABASE_ID_PRODUCTS',
    })
  }

  try {
    const notion = new Client({ auth: NOTION_API_KEY })
    
    // Try to query the database
    const response = await notion.databases.query({
      database_id: PRODUCTS_DB,
      page_size: 3,
    })

    // Check the first product's properties
    const sampleProduct = response.results[0] as { properties?: Record<string, unknown> } | undefined
    const propertyNames = sampleProduct?.properties ? Object.keys(sampleProduct.properties) : []

    return NextResponse.json({
      status,
      success: true,
      totalProducts: response.results.length,
      sampleProductProperties: propertyNames,
      sampleProduct: sampleProduct?.properties ? {
        id: (sampleProduct.properties['ID'] as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text?.[0]?.plain_text,
        sku: (sampleProduct.properties['SKU'] as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text?.[0]?.plain_text,
        hasImages: !!(sampleProduct.properties['Images'] as { files?: unknown[] } | undefined)?.files?.length,
        hasDetailImage: !!(sampleProduct.properties['Detail Image'] as { files?: unknown[] } | undefined)?.files?.length,
        imagesPropertyType: (sampleProduct.properties['Images'] as { type?: string } | undefined)?.type,
        detailImagePropertyType: (sampleProduct.properties['Detail Image'] as { type?: string } | undefined)?.type,
      } : null,
    })
  } catch (error) {
    return NextResponse.json({
      status,
      error: 'Failed to query Notion',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

