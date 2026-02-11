# Protocol Zero - System Refactor Plan

**Version:** 2.0  
**Date:** January 25, 2026  
**Status:** Awaiting External Developer

## 📋 Executive Summary

This document outlines the complete refactoring plan for Protocol Zero, an automated e-commerce system that scrapes Taobao products, processes them through an AI pipeline, and publishes them to a live storefront. The current system uses Knack/Notion as databases. The goal is to modernize the architecture with a proper database (Supabase), clean up the codebase, and deploy to Vercel with full functionality.

---

## 🎯 Project Goals

### Primary Objectives
1. **Replace Knack + Notion** → Migrate to **Supabase** (or similar PostgreSQL-based solution)
2. **Clean & Modularize Codebase** → Remove redundant scripts, organize by feature
3. **Deploy to Vercel** → Full production deployment with environment management
4. **Complete Workflow Automation** → From Taobao scraping to live website
5. **Database as Source of Truth** → All product edits happen in database, sync to website

### Success Criteria
- [ ] Zero dependencies on Knack/Notion APIs
- [ ] One-command scraping workflow (`./workflow.sh`)
- [ ] Live website on Vercel with working product pages
- [ ] Admin panel to edit products directly in database
- [ ] Complete documentation for future maintenance

---

## 🏗️ Current System Architecture

### Overview
```
┌─────────────────┐
│  Taobao.com     │  (Source)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Python Scraper │  (ai_scraper.py)
│  - Selenium     │
│  - Gemini AI    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Knack DB       │  ← REPLACE THIS
│  + Notion       │  ← REPLACE THIS
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Next.js Shop   │  (shop/)
│  - PostgreSQL   │  (currently minimal schema)
│  - Firebase Auth│
└─────────────────┘
```

### Key Components

#### 1. Scraper (`/scraper`)
- **Language:** Python 3.12+
- **Main Files:**
  - `ai_scraper.py` - Complete scraping pipeline
  - `variant_engine.py` - Variant/option extraction
  - `knack_integration.py` - Database sync (REMOVE)
  - `notion_integration.py` - Image upload (REMOVE)
  - `translate.py` - Gemini AI translation
  - `image_utils.py` - Image stitching/processing

#### 2. Shop (`/shop`)
- **Framework:** Next.js 15
- **Database:** PostgreSQL via Prisma
- **Auth:** Firebase Authentication
- **Hosting:** Intended for Vercel
- **Current Schema:** User/Post/Comment models (not e-commerce)

#### 3. Shared Data (`/shared`)
- `media/` - Product images
- `data/` - JSON manifests
- Currently NOT being used by shop

---

## 🛠️ Scraper Pipeline (Current Workflow)

### Step-by-Step Process

#### 1. **Scraping from Taobao**
- **Tool:** Selenium WebDriver (Chrome)
- **Input:** `taobao_links.txt` (list of product URLs)
- **Process:**
  - Login to Taobao (persistent Chrome profile)
  - Navigate to product page
  - Extract all images (main, variants, details)
  - Capture variant options (color, size, style)
  - Extract pricing (CNY)
  - Screenshot fallback for images

#### 2. **Price Processing**
- **Formula:**
  ```python
  cost_cny = price_cny + shipping_cny (¥30)
  cost_cad = cost_cny × 0.19 (exchange rate)
  sale_price = cost_cad / (1 - 0.10 - 0.30)  # 10% salesperson, 30% margin
  sale_price = round(sale_price) - 0.01      # .99 pricing
  ```
- **Output Fields:**
  - `cost_cny`, `shipping_cny`, `cost_cad`, `price_cad`
  - `margin_standard`, `margin_promo`

#### 3. **Image Processing**
- **Download:** All images from Taobao CDN
- **Stitching:** Combine variant images into comparison grids
- **Deletion:** Remove duplicate/unwanted images (manual review)
- **Naming Convention:**
  ```
  {product-slug}_main_{index}.jpg       # Main gallery
  {product-slug}_{variant}_variant.jpg  # Variant-specific
  {product-slug}_detail_{index}.jpg     # Product details
  {product-slug}_stitch.jpg             # Stitched comparison
  ```

#### 4. **Translation (Gemini AI)**
- **Tool:** Google Gemini API
- **Process:**
  - Translate product title (Chinese → English)
  - Tactical naming (e.g., "战术背心" → "Tactical Plate Carrier")
  - Translate variant names
  - Context-aware (military/tactical gear)
- **Dictionaries:**
  - `COLOR_MAP` - Color translations
  - `DIMENSION_TRANSLATIONS` - Option type translations

#### 5. **Variant Classification**
- **Tool:** `variant_engine.py`
- **Logic:**
  - Extract option dimensions (Color, Size, Style)
  - Normalize option values
  - Create SKUs for each combination
  - Detect multi-dimensional variants (e.g., Color + Size)

#### 6. **Database Upload (Current)**
- **Knack API:** Push product + variant records
- **Notion API:** Upload images to Notion pages
- **Problem:** This is slow, unreliable, and expensive

#### 7. **Output Files**
- `ai_scraper_output/products.csv` - All scraped data
- `ai_scraper_output/products.json` - Structured JSON
- `ai_scraper_output/media/` - All images organized

---

## 🎨 Website Features (Current & Needed)

### Current Shop (`/shop`)
- Next.js 15 with App Router
- Firebase Authentication (login/signup)
- Basic PostgreSQL schema (not e-commerce)
- No product pages yet
- No cart/checkout

### Required Features

#### Product Display
- [ ] Product listing page (grid view)
- [ ] Product detail page (images, variants, pricing)
- [ ] Variant selector (dropdown for color/size)
- [ ] Image gallery with zoom
- [ ] Related products

#### Shopping Features
- [ ] Add to cart
- [ ] Cart page
- [ ] Checkout flow
- [ ] Order confirmation
- [ ] Email notifications

#### Admin Features
- [ ] Admin dashboard (view all products)
- [ ] Edit product details
- [ ] Update pricing
- [ ] Manage inventory
- [ ] Bulk actions (publish/unpublish)

---

## 🗄️ Target Database Schema (Supabase)

### Why Supabase?
- PostgreSQL-based (same as Prisma)
- Built-in REST API + Realtime subscriptions
- Row Level Security (RLS) for admin access
- Storage buckets for images
- Free tier suitable for small e-commerce
- Easy Vercel integration

### Proposed Schema

```prisma
// Products Table
model Product {
  id              String    @id @default(cuid())
  sku             String    @unique
  title           String
  titleOriginal   String?   // Chinese title
  description     String?   @db.Text
  category        String?
  status          String    @default("draft") // draft, active, archived
  url             String?   // Taobao source URL
  
  // Pricing (base price, variants may override)
  priceCadBase    Decimal?  @db.Decimal(10,2)
  margin          Decimal?  @db.Decimal(5,2)
  
  // Stock
  stock           Int       @default(0)
  
  // Media
  primaryImage    String?   // URL to main image
  images          String[]  // Array of image URLs
  detailImages    String[]  // Product detail images
  
  // Metadata
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations
  variants        Variant[]
}

// Variants Table (Color/Size/Style options)
model Variant {
  id                String   @id @default(cuid())
  productId         String
  product           Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  // Identification
  sku               String   @unique
  variantName       String   // e.g., "Black / Medium"
  sortOrder         Int      @default(0)
  
  // Pricing (CNY → CAD)
  priceCny          Decimal  @db.Decimal(10,2)
  shippingCny       Decimal  @db.Decimal(10,2) @default(30)
  costCad           Decimal  @db.Decimal(10,2) // Landed cost
  priceCad          Decimal  @db.Decimal(10,2) // Sale price
  marginStandard    Decimal  @db.Decimal(5,2)  // Standard margin %
  marginPromo       Decimal  @db.Decimal(5,2)  // Promo margin %
  competitorPrice   Decimal? @db.Decimal(10,2)
  
  // Options (multi-dimensional)
  optionType1       String?  // e.g., "Color"
  optionValue1      String?  // e.g., "Black"
  optionType2       String?  // e.g., "Size"
  optionValue2      String?  // e.g., "Medium"
  
  // Stock & Status
  stock             Int      @default(0)
  status            String   @default("active") // active, archived
  
  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  orderItems        OrderItem[]
}

// Orders Table
model Order {
  id                String      @id @default(cuid())
  userId            String
  user              User        @relation(fields: [userId], references: [id])
  
  // Order details
  orderNumber       String      @unique
  status            String      @default("pending") // pending, paid, shipped, delivered, cancelled
  totalCad          Decimal     @db.Decimal(10,2)
  
  // Shipping
  shippingAddress   Json        // { name, address, city, province, postal, phone }
  shippingMethod    String?
  trackingNumber    String?
  
  // Payment
  paymentMethod     String?
  paymentStatus     String      @default("pending")
  paidAt            DateTime?
  
  // Metadata
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  // Relations
  items             OrderItem[]
}

// Order Items
model OrderItem {
  id                String   @id @default(cuid())
  orderId           String
  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  variantId         String
  variant           Variant  @relation(fields: [variantId], references: [id])
  
  quantity          Int
  priceCad          Decimal  @db.Decimal(10,2) // Price at time of order
  
  createdAt         DateTime @default(now())
}

// Users (already exists, extend as needed)
model User {
  id            String    @id @default(cuid())
  name          String?
  username      String?   @unique
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          String    @default("customer") // customer, admin
  
  orders        Order[]
  // ... existing fields
}
```

---

## 🔄 Refactored Workflow

### New Architecture
```
┌─────────────────┐
│  Taobao.com     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Python Scraper         │
│  1. Scrape              │
│  2. Translate (Gemini)  │
│  3. Process Images      │
│  4. Calculate Prices    │
└────────┬────────────────┘
         │
         ▼ (Direct REST API)
┌─────────────────────────┐
│  Supabase Database      │  ← SOURCE OF TRUTH
│  - Products             │
│  - Variants             │
│  - Orders               │
│  + Storage (Images)     │
└────────┬────────────────┘
         │
         ▼ (Auto-sync)
┌─────────────────────────┐
│  Next.js Shop (Vercel)  │
│  - Product Pages        │
│  - Cart/Checkout        │
│  - Admin Dashboard      │
└─────────────────────────┘
```

### Updated Scraper Flow
1. **Scrape** → Same as before (Selenium)
2. **Process** → Images, translation, pricing
3. **Upload Images** → Supabase Storage buckets
4. **Seed Database** → Direct REST API to Supabase
5. **Verify** → Check products in Supabase dashboard

### One-Command Workflow
```bash
./workflow.sh
```
**Steps:**
1. Read `taobao_links.txt`
2. Run scraper (`ai_scraper.py`)
3. Upload images to Supabase Storage
4. Insert products + variants into Supabase
5. Generate summary report
6. Open admin dashboard

---

## 📦 Deliverables Checklist

### Phase 1: Database Migration (Week 1)
- [ ] Set up Supabase project
- [ ] Create Prisma schema (Products, Variants, Orders)
- [ ] Generate Prisma client
- [ ] Seed test data (10 products)
- [ ] Verify queries work

### Phase 2: Scraper Refactor (Week 1-2)
- [ ] Remove Knack/Notion dependencies
- [ ] Create `supabase_integration.py` module
- [ ] Update `ai_scraper.py` to use Supabase
- [ ] Test image upload to Supabase Storage
- [ ] Test product seeding
- [ ] Update `workflow.sh` script

### Phase 3: Frontend Development (Week 2-3)
- [ ] Product listing page (`/shop`)
- [ ] Product detail page (`/shop/[productId]`)
- [ ] Variant selector component
- [ ] Image gallery component
- [ ] Add to cart functionality
- [ ] Cart page
- [ ] Checkout flow (basic)

### Phase 4: Admin Dashboard (Week 3)
- [ ] Admin route (`/admin`)
- [ ] Product list view
- [ ] Product editor (inline editing)
- [ ] Bulk actions (publish/unpublish)
- [ ] Image management
- [ ] Pricing updates

### Phase 5: Deployment (Week 4)
- [ ] Environment variables setup
- [ ] Vercel deployment
- [ ] Domain configuration
- [ ] Error monitoring (Sentry/LogRocket)
- [ ] Performance optimization
- [ ] SEO meta tags

### Phase 6: Testing & Documentation (Week 4)
- [ ] End-to-end testing
- [ ] User acceptance testing
- [ ] Complete README.md
- [ ] API documentation
- [ ] Video walkthrough
- [ ] Handoff meeting

---

## 🔧 Technical Requirements

### Environment Variables
```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=  # For admin operations

# Database
DATABASE_URL=  # Supabase PostgreSQL connection string

# AI Translation
GEMINI_API_KEY=

# Firebase Auth (keep as-is)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
# ... other Firebase vars

# Vercel (auto-populated)
VERCEL_URL=
NEXT_PUBLIC_SITE_URL=
```

### Dependencies to Add

**Scraper (`requirements.txt`):**
```txt
selenium>=4.16.0
requests>=2.31.0
pillow>=10.1.0
python-dotenv>=1.0.0
supabase>=2.0.0  # NEW
google-generativeai>=0.3.0  # Keep for translation
```

**Shop (`package.json`):**
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/auth-helpers-nextjs": "^0.8.7"
  }
}
```

### Prisma Commands
```bash
# Generate client
npx prisma generate

# Push schema to Supabase
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

---

## 📝 File Organization (After Cleanup)

### Scraper Structure
```
scraper/
├── core/
│   ├── scraper.py           # Main scraping logic
│   ├── variant_engine.py    # Variant extraction
│   ├── translator.py        # Gemini translation
│   └── image_processor.py   # Image stitching/processing
├── integrations/
│   └── supabase_integration.py  # Database sync
├── utils/
│   ├── pricing.py           # Price calculations
│   └── helpers.py           # Utility functions
├── config/
│   ├── constants.py         # Color maps, translations
│   └── settings.py          # Configuration
├── workflow.sh              # Main automation script
├── requirements.txt
└── README.md
```

### Shop Structure
```
shop/
├── app/
│   ├── shop/
│   │   ├── page.tsx             # Product listing
│   │   └── [productId]/
│   │       └── page.tsx         # Product detail
│   ├── cart/
│   │   └── page.tsx
│   ├── checkout/
│   │   └── page.tsx
│   └── admin/
│       ├── page.tsx             # Dashboard
│       └── products/
│           ├── page.tsx         # Product list
│           └── [id]/
│               └── page.tsx     # Product editor
├── components/
│   ├── product/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGallery.tsx
│   │   ├── VariantSelector.tsx
│   │   └── AddToCart.tsx
│   ├── cart/
│   │   └── CartItem.tsx
│   └── admin/
│       ├── ProductTable.tsx
│       └── ProductEditor.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser client
│   │   ├── server.ts        # Server client
│   │   └── admin.ts         # Admin client
│   ├── prisma.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma
└── public/
    └── images/
```

---

## 🚨 Known Issues to Fix

### High Priority
1. **No e-commerce schema** - Current Prisma schema is for social app, not shop
2. **Knack dependency** - All scraper scripts push to Knack API
3. **Notion dependency** - Image uploads go to Notion pages
4. **No product pages** - Shop has no product display yet
5. **No cart/checkout** - Shopping features missing

### Medium Priority
6. **Redundant scripts** - Many duplicate/test scripts in `/scraper`
7. **Hardcoded values** - Pricing formulas, API keys in code
8. **No error handling** - Scraper crashes on Taobao changes
9. **Image organization** - Media files not optimized for web
10. **No logging** - Difficult to debug scraper issues

### Low Priority
11. **Code style** - Inconsistent formatting, no linting
12. **Documentation gaps** - Some modules undocumented
13. **No tests** - Zero unit/integration tests
14. **SEO** - Missing meta tags, sitemaps
15. **Performance** - Images not optimized, no caching

---

## 🎓 Learning Resources

### For Developer

**Supabase:**
- [Supabase Docs](https://supabase.com/docs)
- [Supabase with Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

**Next.js:**
- [Next.js App Router](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

**Prisma:**
- [Prisma Schema](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Prisma with Next.js](https://www.prisma.io/nextjs)

**Vercel:**
- [Vercel Deployment](https://vercel.com/docs/deployments/overview)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)

---

## 💬 Questions for Developer

Before starting, please review and answer:

1. **Database Choice:** Are you comfortable with Supabase, or would you prefer AWS RDS / PlanetScale / another PostgreSQL host?

2. **Image Storage:** Should we use Supabase Storage, or a CDN like Cloudflare R2 / AWS S3?

3. **Payment Gateway:** Will checkout be live (Stripe/PayPal), or just a contact form for now?

4. **Timeline:** Can this be completed in 4 weeks, or do you need more time?

5. **Additional Features:** Any features you'd recommend adding (analytics, reviews, wishlists)?

---

## 📞 Contact & Support

**Project Owner:** [Your Name]  
**Email:** [Your Email]  
**GitHub Repo:** `/Users/5425855/Documents/protocol-zero`

**Preferred Communication:**
- Daily updates via [Slack/Email/Discord]
- Weekly video calls (30 min)
- GitHub issues for bug tracking

---

## ✅ Acceptance Criteria

The project is considered complete when:

1. ✅ **Scraper works end-to-end:**
   - Run `./workflow.sh`
   - Products appear in Supabase database
   - Images uploaded to storage

2. ✅ **Website is live:**
   - Deployed on Vercel
   - Product pages load with correct data
   - Cart/checkout functional (even if dummy)

3. ✅ **Admin can edit products:**
   - Login to `/admin`
   - Edit product title, price, images
   - Changes reflect on frontend immediately

4. ✅ **Documentation is complete:**
   - Updated README.md
   - API documentation
   - Video walkthrough (5-10 min)

5. ✅ **Handoff meeting completed:**
   - Code review
   - Q&A session
   - Future maintenance plan

---

**Last Updated:** January 25, 2026  
**Version:** 2.0  
**Status:** Ready for Development
