# Notion Integration Implementation Guide

Step-by-step instructions to implement runtime Notion integration for Protocol Zero shop, following the architecture defined in `NOTION_INTEGRATION_PLAN.md`.

---

## Prerequisites

- [ ] Notion databases created and configured (see `NOTION_SETUP.md`)
- [ ] Environment variables set in `shared/scripts/.env` and `shop/.env.local`
- [ ] Integration token verified and databases shared
- [ ] Node.js 20+ and npm installed

**Estimated Total Time:** 8-12 hours across 6 phases

---

## ~~Phase 1: Schema + Environment Setup (1-2 hours)~~ ✅

### ~~1.1 Verify Notion Setup~~

```zsh
# Test credentials
cd shared/scripts
npm install @notionhq/client dotenv

# Quick test (paste this script)
node -e "
const { Client } = require('@notionhq/client');
require('dotenv').config();
const notion = new Client({ auth: process.env.NOTION_API_KEY });
notion.databases.query({
  database_id: process.env.NOTION_DATABASE_ID_PRODUCTS,
  page_size: 1
}).then(() => console.log('✅ Connected'))
  .catch(e => console.error('❌ Error:', e.message));
"
```

### ~~1.2 Update Shop Environment~~

Copy the same variables to shop:

```zsh
cd ../shop

# Create/edit .env.local
cat >> .env.local << 'EOF'

# Notion Integration
NOTION_API_KEY=secret_your_key_here
NOTION_DATABASE_ID_PRODUCTS=your_products_db_id
NOTION_DATABASE_ID_VARIANTS=your_variants_db_id
NOTION_CACHE_TTL_SECONDS=120
EOF
```

### ~~1.3 Install Dependencies~~

```zsh
# In shop directory
npm install @notionhq/client
npm install @notionhq/client --save-dev  # For type definitions

# Optional: for Markdown rendering
npm install react-markdown remark-gfm
```

### ~~1.4 Document Schema~~
> Note: Final verification of credentials depends on you adding your Notion API key and database IDs to `.env` files. Scripts and scaffolding are in place.

Create `NOTION_SCHEMA.md` with your actual database IDs and property names (for reference during development).

---

## Phase 2: Data Seeding (2-3 hours)

### ~~2.1 Create Seed Script~~ ✅

Create `shared/scripts/json-to-notion.js`:

```javascript
#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS;
const VARIANTS_DB = process.env.NOTION_DATABASE_ID_VARIANTS;
const MANIFEST_PATH = path.join(__dirname, '../data/products_manifest.json');

async function seedNotion() {
  console.log('🌱 Seeding Notion from products_manifest.json...\n');
  
  // Read existing products
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  const products = manifest.products || [];
  
  console.log(`📦 Found ${products.length} products to seed\n`);
  
  for (const product of products) {
    try {
      console.log(`   Processing: ${product.title || product.id}`);
      
      // Create product page in Notion
      const productPage = await notion.pages.create({
        parent: { database_id: PRODUCTS_DB },
        properties: {
          'Title': {
            title: [{ text: { content: product.title || 'Unnamed Product' } }]
          },
          'ID': {
            rich_text: [{ text: { content: product.id || '' } }]
          },
          'SKU': {
            rich_text: [{ text: { content: product.sku || `AUTO-${products.indexOf(product) + 1}` } }]
          },
          'Title Original': {
            rich_text: [{ text: { content: product.title_original || '' } }]
          },
          'Category': {
            select: { name: product.category || 'Gear' }
          },
          'Status': {
            select: { name: 'Active' }
          },
          'Description': {
            rich_text: [{ text: { content: product.description || '' } }]
          },
          'Price CAD (Base)': {
            number: parseFloat(product.price_cad) || 0
          },
          'Margin': {
            number: product.margin || 0.5
          },
          'Stock': {
            number: product.stock || 0
          },
          'URL': {
            url: product.url || null
          },
          'Image Paths': {
            rich_text: [{ text: { content: JSON.stringify(product.images || []) } }]
          },
          'Detail Image Path': {
            rich_text: [{ text: { content: product.detailLongImage || '' } }]
          }
        }
      });
      
      const productPageId = productPage.id;
      console.log(`   ✅ Created product: ${productPageId}`);
      
      // Create variants if they exist
      const variants = product.variants || [];
      if (variants.length > 0) {
        console.log(`   📎 Creating ${variants.length} variants...`);
        
        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];
          
          await notion.pages.create({
            parent: { database_id: VARIANTS_DB },
            properties: {
              'Variant Name': {
                title: [{ text: { content: variant.option || `Variant ${i + 1}` } }]
              },
              'Product': {
                relation: [{ id: productPageId }]
              },
              'SKU': {
                rich_text: [{ text: { content: variant.sku || '' } }]
              },
              'Price CNY': {
                number: parseFloat(variant.price_cny) || 0
              },
              'Price CAD Override': {
                number: parseFloat(variant.price_cad) || null
              },
              'Stock': {
                number: variant.stock || 0
              },
              'Status': {
                select: { name: 'Active' }
              },
              'Sort Order': {
                number: i + 1
              }
            }
          });
          
          console.log(`      ✓ Variant: ${variant.option}`);
        }
      }
      
      console.log('');
      
      // Rate limit: wait 350ms between products (Notion allows ~3 req/sec)
      await new Promise(resolve => setTimeout(resolve, 350));
      
    } catch (error) {
      console.error(`   ❌ Error with ${product.id}:`, error.message);
    }
  }
  
  console.log('✅ Seeding complete!\n');
}

seedNotion().catch(console.error);
```

Make it executable:

```zsh
chmod +x shared/scripts/json-to-notion.js
```

### ~~2.2 Add NPM Script~~ ✅

Edit `shared/scripts/package.json`:

```json
{
  "name": "protocol-zero-scripts",
  "version": "1.0.0",
  "scripts": {
    "seed-notion": "node json-to-notion.js",
    "generate-products": "node generate-products.js",
    "sync-media": "node sync-media.js"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "dotenv": "^16.4.5"
  }
}
```

Install dependencies:

```zsh
cd shared/scripts
npm install
```

### 2.3 Run Initial Seed (Pending credentials)

```zsh
npm run seed-notion
```

**Expected output:**
```
🌱 Seeding Notion from products_manifest.json...

📦 Found 1 products to seed

   Processing: WOSPORT L4G24 夜视仪支架
   ✅ Created product: xxx-xxx-xxx
   📎 Creating 2 variants...
      ✓ Variant: HL-ACC-73-T
      ✓ Variant: HL-ACC-73-BK

✅ Seeding complete!
```

### 2.4 Verify in Notion (After running seed)

1. Open your Products database in Notion
2. Verify products appear with all fields populated
3. Check Variants database has linked variants
4. Test: click a product's "Variants" relation → should show linked variants

---

## Phase 3: Runtime Data Layer (3-4 hours)

### ~~3.1 Create Notion Client~~ ✅

Create `shop/lib/notion-client.ts`:

```typescript
import { Client } from '@notionhq/client';
import type { QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const PRODUCTS_DB = process.env.NOTION_DATABASE_ID_PRODUCTS!;
const VARIANTS_DB = process.env.NOTION_DATABASE_ID_VARIANTS!;

// Helper: Extract plain text from Notion rich text
function extractText(richText: any[] | undefined): string {
  if (!richText || richText.length === 0) return '';
  return richText.map((rt: any) => rt.plain_text).join('');
}

// Helper: Extract select value
function extractSelect(select: any): string | undefined {
  return select?.name;
}

// Helper: Extract number
function extractNumber(number: any): number {
  return typeof number === 'number' ? number : 0;
}

// Fetch all products with Status = Active
export async function fetchProducts() {
  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
    filter: {
      property: 'Status',
      select: {
        equals: 'Active',
      },
    },
  });

  const products = await Promise.all(
    response.results.map(async (page: any) => {
      const props = page.properties;

      // Fetch variants for this product
      const variantsResponse = await notion.databases.query({
        database_id: VARIANTS_DB,
        filter: {
          property: 'Product',
          relation: {
            contains: page.id,
          },
        },
        sorts: [
          {
            property: 'Sort Order',
            direction: 'ascending',
          },
        ],
      });

      const variants = variantsResponse.results.map((vPage: any) => {
        const vProps = vPage.properties;
        return {
          id: vPage.id,
          variantName: extractText(vProps['Variant Name']?.title),
          sku: extractText(vProps['SKU']?.rich_text),
          price_cny: extractNumber(vProps['Price CNY']?.number),
          price_cad: vProps['Price CAD Override']?.number || undefined,
          stock: vProps['Stock']?.number || undefined,
          status: extractSelect(vProps['Status']?.select) as 'Active' | 'Out of Stock' | undefined,
          sortOrder: vProps['Sort Order']?.number || 0,
        };
      });

      // Parse image paths from JSON string
      const imagePathsText = extractText(props['Image Paths']?.rich_text);
      let images: string[] = [];
      try {
        images = imagePathsText ? JSON.parse(imagePathsText) : [];
      } catch {
        images = [];
      }

      return {
        id: extractText(props['ID']?.rich_text),
        sku: extractText(props['SKU']?.rich_text),
        title: extractText(props['Title']?.title),
        title_original: extractText(props['Title Original']?.rich_text),
        price_cad: extractNumber(props['Price CAD (Base)']?.number),
        margin: extractNumber(props['Margin']?.number) || 0.5,
        primaryImage: images[0] || '',
        images,
        detailLongImage: extractText(props['Detail Image Path']?.rich_text) || undefined,
        category: extractSelect(props['Category']?.select),
        description: extractText(props['Description']?.rich_text),
        status: extractSelect(props['Status']?.select) as 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock' | undefined,
        stock: props['Stock']?.number || undefined,
        url: props['URL']?.url || undefined,
        variants: variants.length > 0 ? variants : undefined,
      };
    })
  );

  return products;
}

// Fetch single product by ID
export async function fetchProductById(productId: string) {
  const response = await notion.databases.query({
    database_id: PRODUCTS_DB,
    filter: {
      and: [
        {
          property: 'Status',
          select: {
            equals: 'Active',
          },
        },
        {
          property: 'ID',
          rich_text: {
            equals: productId,
          },
        },
      ],
    },
  });

  if (response.results.length === 0) return null;

  const page: any = response.results[0];
  const props = page.properties;

  // Fetch variants
  const variantsResponse = await notion.databases.query({
    database_id: VARIANTS_DB,
    filter: {
      property: 'Product',
      relation: {
        contains: page.id,
          },
    },
    sorts: [
      {
        property: 'Sort Order',
        direction: 'ascending',
      },
    ],
  });

  const variants = variantsResponse.results.map((vPage: any) => {
    const vProps = vPage.properties;
    return {
      id: vPage.id,
      variantName: extractText(vProps['Variant Name']?.title),
      sku: extractText(vProps['SKU']?.rich_text),
      price_cny: extractNumber(vProps['Price CNY']?.number),
      price_cad: vProps['Price CAD Override']?.number || undefined,
      stock: vProps['Stock']?.number || undefined,
      status: extractSelect(vProps['Status']?.select) as 'Active' | 'Out of Stock' | undefined,
      sortOrder: vProps['Sort Order']?.number || 0,
    };
  });

  const imagePathsText = extractText(props['Image Paths']?.rich_text);
  let images: string[] = [];
  try {
    images = imagePathsText ? JSON.parse(imagePathsText) : [];
  } catch {
    images = [];
  }

  return {
    id: extractText(props['ID']?.rich_text),
    sku: extractText(props['SKU']?.rich_text),
    title: extractText(props['Title']?.title),
    title_original: extractText(props['Title Original']?.rich_text),
    price_cad: extractNumber(props['Price CAD (Base)']?.number),
    margin: extractNumber(props['Margin']?.number) || 0.5,
    primaryImage: images[0] || '',
    images,
    detailLongImage: extractText(props['Detail Image Path']?.rich_text) || undefined,
    category: extractSelect(props['Category']?.select),
    description: extractText(props['Description']?.rich_text),
    status: extractSelect(props['Status']?.select) as 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock' | undefined,
    stock: props['Stock']?.number || undefined,
    url: props['URL']?.url || undefined,
    variants: variants.length > 0 ? variants : undefined,
  };
}
```

### ~~3.2 Add Caching Layer~~ ✅

Create `shop/lib/notion-cache.ts`:

```typescript
// Simple in-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

const TTL = parseInt(process.env.NOTION_CACHE_TTL_SECONDS || '120') * 1000;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
```

### ~~3.3 Create API Routes~~ ✅

Create `shop/app/api/products/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { fetchProducts } from '@/lib/notion-client';
import { getCached, setCache } from '@/lib/notion-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check cache first
    const cached = getCached<any[]>('products:all');
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      });
    }

    // Fetch from Notion
    const products = await fetchProducts();
    
    // Cache result
    setCache('products:all', products);

    return NextResponse.json(products, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

Create `shop/app/api/products/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { fetchProductById } from '@/lib/notion-client';
import { getCached, setCache } from '@/lib/notion-cache';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check cache
    const cacheKey = `product:${id}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      });
    }

    // Fetch from Notion
    const product = await fetchProductById(id);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Cache result
    setCache(cacheKey, product);

    return NextResponse.json(product, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error(`Error fetching product ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}
```

### 3.4 Create Cache Revalidation Endpoint

Create `shop/app/api/revalidate/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { clearCache } from '@/lib/notion-cache';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = process.env.REVALIDATE_TOKEN || 'dev-token';

    if (authHeader !== `Bearer ${token}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear cache
    clearCache();

    return NextResponse.json({ revalidated: true, timestamp: Date.now() });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error revalidating' },
      { status: 500 }
    );
  }
}
```

Add to `.env.local`:
```env
REVALIDATE_TOKEN=your-secret-token-here
```

---

## Phase 4: UI Integration (2-3 hours)

### 4.1 Update Product Types

Edit `shop/lib/products.ts`:

```typescript
// Product variant (child object)
export type ProductVariant = {
  id: string                    // Notion page ID
  variantName: string           // "Tan", "Black", etc.
  sku?: string                  // Variant-specific SKU
  price_cny: number             // Price in Chinese Yuan
  price_cad?: number            // Override price (if different from base)
  stock?: number                // Variant-specific stock
  status?: 'Active' | 'Out of Stock'
  sortOrder?: number            // Display order
}

// Main product (parent object)
export type Product = {
  id: string                    // Unique slug
  sku: string                   // Base SKU
  title: string                 // Display name (English)
  title_original?: string       // Chinese title
  
  // Pricing
  price_cad: number             // Base price (used if no variants)
  margin: number                // Markup multiplier
  
  // Media
  primaryImage: string          // First image (hero)
  images: string[]              // All product images (shared by variants)
  detailLongImage?: string      // Long scrolling detail image
  
  // Metadata
  category?: string             // Gear, Apparel, etc.
  description?: string          // Rich text → Markdown
  status?: 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock'
  stock?: number                // Global stock (if not using variants)
  url?: string                  // Source Taobao link
  
  // Variants (tree structure)
  variants?: ProductVariant[]   // Child objects
}

// Fetch products from API
export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/products`, {
    cache: 'no-store',
  });
  
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

// Fetch single product
export async function getProductById(id: string): Promise<Product | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/products/${id}`, {
    cache: 'no-store',
  });
  
  if (!res.ok) return null;
  return res.json();
}
```

### 4.2 Update Shop Listing Page

Edit `shop/app/shop/page.tsx` to use new API:

```typescript
import { getProducts } from '@/lib/products';
import ProductCard from '@/components/product-card';

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shop</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
```

### 4.3 Update Product Detail Page

Edit `shop/app/shop/[id]/page.tsx` to fetch from Notion and handle variants:

```typescript
import { getProductById } from '@/lib/products';
import { notFound } from 'next/navigation';
import VariantSelector from '@/components/variant-selector'; // Create this component

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id);

  if (!product) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div>
          <img src={product.primaryImage} alt={product.title} className="w-full" />
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-bold">{product.title}</h1>
          {product.category && (
            <span className="text-sm text-gray-500">{product.category}</span>
          )}

          {product.description && (
            <div className="mt-4 prose">
              {product.description}
            </div>
          )}

          {/* Variant Selector */}
          {product.variants && product.variants.length > 0 ? (
            <VariantSelector product={product} />
          ) : (
            <div className="mt-6">
              <div className="text-2xl font-bold">${product.price_cad.toFixed(2)} CAD</div>
              <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded">
                Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4.4 Create Variant Selector Component

Create `shop/components/variant-selector.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Product, ProductVariant } from '@/lib/products';
import { addToCart } from '@/lib/cart';

export default function VariantSelector({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants?.[0] || null
  );

  const price = selectedVariant?.price_cad || product.price_cad;
  const stock = selectedVariant?.stock || product.stock || 0;
  const isOutOfStock = selectedVariant?.status === 'Out of Stock' || stock === 0;

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.variantName,
      quantity: 1,
    });
  };

  return (
    <div className="mt-6">
      {/* Variant Dropdown */}
      {product.variants && product.variants.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Option</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={selectedVariant?.id || ''}
            onChange={(e) => {
              const variant = product.variants?.find((v) => v.id === e.target.value);
              setSelectedVariant(variant || null);
            }}
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.variantName}
                {variant.status === 'Out of Stock' && ' (Out of Stock)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Price */}
      <div className="text-2xl font-bold mb-2">${price.toFixed(2)} CAD</div>

      {/* Stock Status */}
      {isOutOfStock ? (
        <div className="text-red-600 font-medium">Out of Stock</div>
      ) : stock < 5 ? (
        <div className="text-orange-600">Only {stock} left</div>
      ) : (
        <div className="text-green-600">In Stock</div>
      )}

      {/* Add to Cart Button */}
      <button
        className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded disabled:bg-gray-400"
        disabled={isOutOfStock}
        onClick={handleAddToCart}
      >
        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  );
}
```

---

## Phase 5: Reliability + Backups (1-2 hours)

### ~~5.1 Create Snapshot Script~~ ✅

Create `shared/scripts/snapshot-products.js`:

```javascript
#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

// Same as notion-client.ts but writes to file
async function createSnapshot() {
  // ... (fetch products logic from notion-client.ts)
  // Write to: shop/lib/products.generated.ts

  const timestamp = new Date().toISOString().split('T')[0];
  await fs.writeFile(
    path.join(__dirname, `../data/backups/products-${timestamp}.json`),
    JSON.stringify(products, null, 2)
  );

  console.log(`✅ Snapshot saved: products-${timestamp}.json`);
}

createSnapshot().catch(console.error);
```

Add to `shared/scripts/package.json`:
```json
{
  "scripts": {
    "snapshot:products": "node snapshot-products.js"
  }
}
```

### 5.2 Add Error Handling

Update API routes to fall back to snapshot on error.

### 5.3 Add Monitoring (Optional)

Consider adding Sentry or logging:

```zsh
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

---

## Phase 6: Documentation (1 hour)

### 6.1 Update REGENERATE.md

Add the runtime workflow section from `NOTION_INTEGRATION_PLAN.md`.

### 6.2 Create Operations Runbook

Document common tasks:
- How to revalidate cache
- How to rotate tokens
- How to debug Notion API issues
- How to run snapshot backups

### 6.3 Test Full Workflow

Run through the testing checklist in `NOTION_INTEGRATION_PLAN.md`.

---

## Deployment

### Deploy to Vercel

```zsh
cd shop

# Push to GitHub
git add .
git commit -m "feat: implement Notion runtime integration"
git push origin main

# Vercel will auto-deploy
# Or manually: vercel --prod
```

### Set Vercel Environment Variables

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add:
   - `NOTION_API_KEY`
   - `NOTION_DATABASE_ID_PRODUCTS`
   - `NOTION_DATABASE_ID_VARIANTS`
   - `NOTION_CACHE_TTL_SECONDS` (optional)
   - `REVALIDATE_TOKEN`

---

## Testing

### Test API Routes

```zsh
# List all products
curl http://localhost:3000/api/products

# Get single product
curl http://localhost:3000/api/products/test-nv-mount

# Revalidate cache
curl -X POST http://localhost:3000/api/revalidate \
  -H "Authorization: Bearer your-token"
```

### Test UI

1. Visit http://localhost:3000/shop
2. Click a product
3. Select variant (if available)
4. Add to cart
5. Go to checkout
6. Verify all data is correct

---

## Troubleshooting

See `NOTION_SETUP.md` troubleshooting section.

Additional runtime issues:

### API Returns Empty Array
- Check Status filter (only Active products returned)
- Verify products exist in Notion and are marked Active

### Variants Not Loading
- Verify Relation property is configured correctly
- Check Variants DB has Product relation pointing to correct product

### Cache Not Updating
- Call revalidation endpoint
- Restart dev server
- Check TTL setting

---

## Next Steps

- Set up Notion webhook → Vercel deploy hook (optional)
- Implement automatic image syncing
- Add category filtering UI
- Build admin dashboard

---

**Implementation Complete!** 🎉

Your shop now reads live data from Notion at runtime.
