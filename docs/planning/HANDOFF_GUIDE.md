# Developer Handoff Guide

**Project:** Protocol Zero - E-Commerce System Refactor  
**Version:** 2.0  
**Date:** January 25, 2026  
**Status:** Ready for Development

---

## 🎯 Welcome!

This document is your starting point for refactoring the Protocol Zero e-commerce system. You'll be transforming a working-but-messy scraper + database setup into a clean, production-ready system deployed on Vercel with a proper database.

---

## 📚 Documentation Index

Please read these documents in order:

1. **[REFACTOR_PLAN.md](REFACTOR_PLAN.md)** *(READ FIRST)*
   - Executive summary
   - Current vs. target architecture
   - Database schema (Supabase)
   - Deliverables checklist
   - Questions to answer before starting

2. **[SCRAPER_SPECIFICATIONS.md](SCRAPER_SPECIFICATIONS.md)**
   - Complete scraper workflow
   - Feature requirements (scraping, translation, images, pricing)
   - Integration with Supabase
   - Error handling
   - Testing requirements

3. **[WEBSITE_SPECIFICATIONS.md](WEBSITE_SPECIFICATIONS.md)**
   - Frontend features (shop, cart, checkout)
   - Admin dashboard
   - API routes
   - Component library
   - Deployment to Vercel

4. **[This Document](HANDOFF_GUIDE.md)**
   - Quick start guide
   - File tour
   - Step-by-step refactoring plan
   - Common pitfalls

---

## 🚀 Quick Start

### 1. Environment Setup

**Prerequisites:**
- Node.js 18+ (recommend 20 LTS)
- Python 3.12+
- Git
- Chrome browser
- Code editor (VS Code recommended)

**Clone and Install:**
```bash
# Navigate to project
cd /Users/5425855/Documents/protocol-zero

# Install scraper dependencies
cd scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# Install shop dependencies
cd shop
npm install
cd ..
```

### 2. Explore Current System

**Test Current Scraper:**
```bash
cd scraper
source .venv/bin/activate

# Login to Taobao (one-time)
python3 ai_scraper.py --login

# Test scrape (first URL only)
python3 ai_scraper.py --test
```

**Review Output:**
- `ai_scraper_output/products.csv` - Scraped data
- `ai_scraper_output/media/` - Downloaded images

**Test Current Shop:**
```bash
cd shop
npm run dev
# Open http://localhost:3000
```

**Note:** Shop currently has no e-commerce features, just auth pages.

---

## 🗂️ Project Structure Tour

### Key Directories

```
protocol-zero/
├── scraper/                    # Python scraping system
│   ├── ai_scraper.py          # ⭐ Main scraper (2,388 lines)
│   ├── variant_engine.py      # Variant extraction logic
│   ├── knack_integration.py   # ❌ TO BE REMOVED (uses Knack)
│   ├── notion_integration.py  # ❌ TO BE REMOVED (uses Notion)
│   ├── translate.py           # Gemini translation
│   ├── image_utils.py         # Image stitching
│   ├── taobao_links.txt       # 📝 Input URLs
│   ├── requirements.txt       # Python dependencies
│   └── ai_scraper_output/     # Output directory
│       ├── products.csv
│       ├── products.json
│       └── media/
│
├── shop/                       # Next.js storefront
│   ├── app/                   # Next.js 15 App Router
│   │   ├── page.tsx           # Homepage
│   │   ├── shop/              # ❌ TO BE CREATED
│   │   ├── cart/              # ❌ TO BE CREATED
│   │   ├── checkout/          # ❌ TO BE CREATED
│   │   └── admin/             # ❌ TO BE CREATED
│   ├── components/            # React components
│   ├── lib/                   # Utilities
│   ├── prisma/
│   │   └── schema.prisma      # ❌ NEEDS REWRITE (no e-commerce models)
│   ├── .env.local             # Environment variables
│   └── package.json
│
├── shared/                     # Shared data (not currently used)
│   ├── media/                 # Product images
│   └── data/                  # JSON manifests
│
└── docs/                       # Documentation
    ├── README.md
    ├── variants/              # Variant system docs
    ├── workflows/
    └── ...
```

---

## 🛠️ Step-by-Step Refactoring Plan

### Phase 1: Database Setup (Days 1-2)

#### Step 1.1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project: `protocol-zero`
3. Copy Database URL (Settings → Database)
4. Copy API keys (Settings → API)

#### Step 1.2: Update Prisma Schema
1. Open `shop/prisma/schema.prisma`
2. **Replace entire file** with schema from [REFACTOR_PLAN.md](REFACTOR_PLAN.md#target-database-schema-supabase)
3. Update `DATABASE_URL` in `shop/.env.local`
4. Run:
   ```bash
   cd shop
   npx prisma generate
   npx prisma db push
   ```

#### Step 1.3: Verify Database
```bash
npx prisma studio
```
- Should open GUI at `http://localhost:5555`
- Verify tables: Product, Variant, Order, OrderItem, User

#### Step 1.4: Seed Test Data
Create `shop/prisma/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test product
  const product = await prisma.product.create({
    data: {
      sku: 'PZ-TEST-001',
      title: 'Tactical Plate Carrier (Test)',
      titleOriginal: '战术背心（测试）',
      category: 'Vests',
      status: 'active',
      priceCadBase: 49.99,
      stock: 10,
      primaryImage: 'https://via.placeholder.com/800',
      images: ['https://via.placeholder.com/800'],
      detailImages: [],
    },
  });

  // Create test variants
  const colors = ['Black', 'Tan', 'Coyote Brown', 'Ranger Green'];
  for (let i = 0; i < colors.length; i++) {
    await prisma.variant.create({
      data: {
        productId: product.id,
        sku: `PZ-TEST-001-V${i + 1}`,
        variantName: `${colors[i]}`,
        priceCny: 150,
        shippingCny: 30,
        costCad: 34.2,
        priceCad: 49.99 + i * 5, // Vary prices slightly
        marginStandard: 25.6,
        marginPromo: 7.4,
        optionType1: 'Color',
        optionValue1: colors[i],
        stock: 10,
        status: 'active',
        sortOrder: i,
      },
    });
  }

  console.log('✅ Test data seeded!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run seed:
```bash
npx tsx prisma/seed.ts
```

---

### Phase 2: Scraper Refactor (Days 3-5)

#### Step 2.1: Remove Old Dependencies
1. Delete `scraper/knack_integration.py`
2. Delete `scraper/notion_integration.py`
3. Update `requirements.txt`:
   ```txt
   selenium>=4.16.0
   requests>=2.31.0
   pillow>=10.1.0
   python-dotenv>=1.0.0
   supabase>=2.3.0
   google-generativeai>=0.3.0
   ```

#### Step 2.2: Create Supabase Integration
Create `scraper/supabase_integration.py`:
```python
"""
Supabase integration for Protocol Zero scraper
Replaces Knack + Notion with direct Supabase calls
"""

import os
from typing import Dict, List
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment
load_dotenv('../shop/.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')  # Admin key

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_image(local_path: str, remote_path: str) -> str:
    """Upload image to Supabase Storage"""
    with open(local_path, 'rb') as f:
        supabase.storage.from_('product-images').upload(
            remote_path,
            f,
            file_options={"content-type": "image/jpeg"}
        )
    
    # Get public URL
    public_url = supabase.storage.from_('product-images').get_public_url(remote_path)
    return public_url


def create_product(data: Dict) -> str:
    """Create product in database, returns product ID"""
    response = supabase.table('Product').insert(data).execute()
    return response.data[0]['id']


def create_variant(data: Dict) -> str:
    """Create variant in database, returns variant ID"""
    response = supabase.table('Variant').insert(data).execute()
    return response.data[0]['id']


def get_product_by_sku(sku: str) -> Dict | None:
    """Check if product already exists"""
    response = supabase.table('Product').select('*').eq('sku', sku).execute()
    return response.data[0] if response.data else None
```

#### Step 2.3: Update Main Scraper
In `scraper/ai_scraper.py`:

1. **Replace imports:**
   ```python
   # Old
   from knack_integration import KnackAPI
   from notion_integration import push_product_to_notion
   
   # New
   from supabase_integration import (
       upload_image,
       create_product,
       create_variant,
       get_product_by_sku
   )
   ```

2. **Update seeding function:**
   Find `seed_to_knack()` function and replace with:
   ```python
   def seed_to_supabase(product_data: Dict):
       """Upload product + variants to Supabase"""
       # Check if exists
       existing = get_product_by_sku(product_data['sku'])
       if existing:
           print(f"⚠️  Product {product_data['sku']} already exists, skipping")
           return
       
       # Upload images first
       image_urls = []
       for img_path in product_data['image_paths']:
           remote_path = f"products/{product_data['sku']}/{os.path.basename(img_path)}"
           url = upload_image(img_path, remote_path)
           image_urls.append(url)
       
       # Create product
       product_payload = {
           'sku': product_data['sku'],
           'title': product_data['title_en'],
           'titleOriginal': product_data['title_zh'],
           'category': product_data.get('category', 'Uncategorized'),
           'status': 'draft',
           'priceCadBase': product_data['base_price_cad'],
           'primaryImage': image_urls[0] if image_urls else None,
           'images': image_urls,
           'url': product_data['url'],
       }
       product_id = create_product(product_payload)
       print(f"✅ Created product: {product_data['sku']}")
       
       # Create variants
       for variant in product_data['variants']:
           variant_payload = {
               'productId': product_id,
               'sku': variant['sku'],
               'variantName': variant['name_en'],
               'priceCny': variant['price_cny'],
               'shippingCny': 30,
               'costCad': variant['cost_cad'],
               'priceCad': variant['price_cad'],
               'marginStandard': variant['margin_standard'],
               'marginPromo': variant['margin_promo'],
               'optionType1': variant.get('option_type_1'),
               'optionValue1': variant.get('option_value_1'),
               'optionType2': variant.get('option_type_2'),
               'optionValue2': variant.get('option_value_2'),
               'stock': 0,  # Update manually
               'status': 'active',
               'sortOrder': variant['sort_order'],
           }
           create_variant(variant_payload)
           print(f"  ✅ Created variant: {variant['sku']}")
   ```

#### Step 2.4: Test Scraper
```bash
cd scraper
source .venv/bin/activate

# Test with one URL
python3 ai_scraper.py --test

# Check Supabase
# - Go to Supabase dashboard
# - Table Editor → Product, Variant
# - Verify data inserted
```

---

### Phase 3: Frontend Development (Days 6-14)

#### Step 3.1: Setup Supabase Client
Create `shop/lib/supabase/client.ts`:
```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createClientComponentClient();
```

Create `shop/lib/supabase/server.ts`:
```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const createClient = () => {
  return createServerComponentClient({ cookies });
};
```

#### Step 3.2: Create Product Listing Page
Create `shop/app/shop/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server';
import ProductGrid from '@/components/product/ProductGrid';

export default async function ShopPage() {
  const supabase = createClient();
  
  // Fetch active products with variants
  const { data: products } = await supabase
    .from('Product')
    .select(`
      *,
      variants:Variant(*)
    `)
    .eq('status', 'active')
    .order('createdAt', { ascending: false });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Shop</h1>
      <ProductGrid products={products || []} />
    </div>
  );
}
```

#### Step 3.3: Create Product Detail Page
Create `shop/app/shop/[productId]/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ProductGallery from '@/components/product/ProductGallery';
import VariantSelector from '@/components/product/VariantSelector';
import AddToCartButton from '@/components/product/AddToCartButton';

export default async function ProductPage({ 
  params 
}: { 
  params: { productId: string } 
}) {
  const supabase = createClient();
  
  const { data: product } = await supabase
    .from('Product')
    .select(`
      *,
      variants:Variant(*)
    `)
    .eq('id', params.productId)
    .single();
  
  if (!product) notFound();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Images */}
        <ProductGallery images={product.images} />
        
        {/* Right: Details */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.title}</h1>
          <p className="text-2xl font-semibold mb-6">
            ${product.priceCadBase} CAD
          </p>
          
          <VariantSelector 
            variants={product.variants} 
          />
          
          <AddToCartButton />
        </div>
      </div>
    </div>
  );
}
```

#### Step 3.4: Create Components
See [WEBSITE_SPECIFICATIONS.md](WEBSITE_SPECIFICATIONS.md#component-library) for full component specs.

Key components to build:
- `ProductCard` - Grid item
- `ProductGallery` - Image carousel
- `VariantSelector` - Color/size picker
- `AddToCartButton` - Add to cart logic
- `CartItem` - Cart line item

#### Step 3.5: Cart Implementation
Use **localStorage** + React Context for cart state:

Create `shop/lib/cart-context.tsx`:
```typescript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface CartItem {
  variantId: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) setItems(JSON.parse(saved));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = (variantId: string, quantity: number) => {
    setItems(prev => {
      const existing = prev.find(item => item.variantId === variantId);
      if (existing) {
        return prev.map(item =>
          item.variantId === variantId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { variantId, quantity }];
    });
  };

  // ... other methods

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
```

#### Step 3.6: Admin Dashboard
See [WEBSITE_SPECIFICATIONS.md](WEBSITE_SPECIFICATIONS.md#admin-dashboard) for complete specs.

**Key pages:**
- `/admin` - Dashboard overview
- `/admin/products` - Product list with filters
- `/admin/products/[id]` - Product editor
- `/admin/orders` - Order management

**Access Control:**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Check if admin route
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Verify Firebase token has role: admin
    // Redirect to / if not admin
  }
}
```

---

### Phase 4: Deployment (Days 15-16)

#### Step 4.1: Prepare for Deployment
1. **Environment Check:**
   - Verify all env vars in `.env.local`
   - Copy to Vercel dashboard

2. **Build Test:**
   ```bash
   cd shop
   npm run build
   npm run start
   ```

3. **Fix Build Errors:**
   - TypeScript errors
   - Missing imports
   - API route issues

#### Step 4.2: Deploy to Vercel
1. **Connect GitHub:**
   - Push code to GitHub
   - Go to Vercel dashboard
   - Import repository

2. **Configure Project:**
   - Root Directory: `shop`
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Add Environment Variables:**
   Copy from `.env.local` to Vercel dashboard

4. **Deploy:**
   - Click "Deploy"
   - Wait for build (2-5 min)
   - Test deployment URL

#### Step 4.3: Domain Setup (Optional)
- Add custom domain in Vercel
- Configure DNS records
- Enable HTTPS (automatic)

---

### Phase 5: Testing & Documentation (Days 17-18)

#### Step 5.1: Test Checklist
- [ ] Homepage loads
- [ ] Product listing page (/shop)
- [ ] Product detail page with variant selector
- [ ] Add to cart functionality
- [ ] Cart page
- [ ] Checkout flow (even if dummy)
- [ ] Admin login
- [ ] Admin product list
- [ ] Edit product
- [ ] Mobile responsiveness

#### Step 5.2: Documentation
Update these files:
- **README.md** - Quick start guide
- **DEPLOYMENT.md** - Deployment instructions
- **API.md** - API documentation

#### Step 5.3: Video Walkthrough
Record 10-min video showing:
1. Running scraper (`./workflow.sh`)
2. Viewing products in Supabase
3. Product appearing on website
4. Adding to cart, checkout
5. Admin editing product

---

## ⚠️ Common Pitfalls

### 1. Supabase Row Level Security (RLS)
**Problem:** Queries fail with "permission denied"

**Solution:** Disable RLS for development, or create policies:
```sql
-- Allow public read on active products
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active products"
ON "Product" FOR SELECT
USING (status = 'active');
```

### 2. Image Upload Failures
**Problem:** Images fail to upload to Supabase Storage

**Solution:**
- Check bucket exists: `product-images`
- Verify bucket is public
- Check file size limits (10MB max)
- Use service key (not anon key) for uploads

### 3. Prisma Client Not Synced
**Problem:** TypeScript errors on Prisma models

**Solution:**
```bash
cd shop
npx prisma generate
```

### 4. Environment Variables Not Loading
**Problem:** `process.env.XYZ` is undefined

**Solution:**
- Verify `.env.local` exists in `shop/`
- Restart Next.js dev server
- For client-side access, use `NEXT_PUBLIC_` prefix

### 5. Scraper Login Issues
**Problem:** Taobao detects bot and blocks

**Solution:**
- Run with `headless=False` (show browser)
- Manual login, then close browser
- Session persists in Chrome profile
- Use delays between requests

---

## 📞 Communication

### Daily Updates
Please provide daily progress updates including:
- What you completed today
- What you're working on tomorrow
- Any blockers or questions

### Questions
If you encounter issues:
1. Check documentation first
2. Search existing code for examples
3. Ask specific questions with context
4. Share screenshots/error messages

---

## ✅ Definition of Done

The project is complete when:

1. **Scraper works end-to-end:**
   - Run `./workflow.sh`
   - Products appear in Supabase
   - Images uploaded to storage
   - No errors in console

2. **Website is live:**
   - Deployed on Vercel
   - Product pages load with correct data
   - Can add to cart
   - Checkout flow works (even if dummy)
   - Mobile responsive

3. **Admin can edit:**
   - Login to `/admin`
   - View product list
   - Edit product details
   - Changes reflected on frontend

4. **Documentation is complete:**
   - Updated README
   - API documentation
   - Video walkthrough (10 min)

5. **Handoff complete:**
   - Code review call
   - Q&A session
   - Access to Vercel/Supabase transferred

---

## 🎁 Bonus Features (If Time Permits)

- [ ] Search functionality (product titles)
- [ ] Sorting (price, newest)
- [ ] Pagination (load more)
- [ ] Product reviews (basic)
- [ ] Email notifications (order confirmation)
- [ ] Analytics dashboard (sales charts)

---

## 📚 Additional Resources

**Supabase:**
- [Getting Started](https://supabase.com/docs)
- [Storage Guide](https://supabase.com/docs/guides/storage)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

**Next.js:**
- [App Router Docs](https://nextjs.org/docs/app)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

**Vercel:**
- [Deployment Guide](https://vercel.com/docs/deployments/overview)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)

**Prisma:**
- [Quickstart](https://www.prisma.io/docs/getting-started/quickstart)
- [Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

---

## 🙏 Thank You!

Looking forward to seeing this project come to life. Feel free to ask questions anytime. Good luck! 🚀

---

**Last Updated:** January 25, 2026  
**Prepared By:** [Your Name]  
**Contact:** [Your Email]
