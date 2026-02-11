# System Architecture Diagrams

**Visual reference for Protocol Zero system**

---

## 📐 Current System (Before Refactor)

```
┌─────────────────────────────────────────────────────────────┐
│                        CURRENT SYSTEM                         │
│                    (Needs Refactoring)                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Taobao.com  │  (Product Source)
│  - Listings  │
│  - Images    │
│  - Pricing   │
└──────┬───────┘
       │ HTTP/Selenium
       │
       ▼
┌─────────────────────────────────────┐
│    Python Scraper (ai_scraper.py)  │
│  ┌───────────────────────────────┐ │
│  │ 1. Extract HTML/JSON          │ │
│  │ 2. Download Images            │ │
│  │ 3. Translate (Gemini AI)      │ │
│  │ 4. Calculate Pricing          │ │
│  │ 5. Classify Variants          │ │
│  └───────────────────────────────┘ │
└────┬─────────────────────┬─────────┘
     │                     │
     │ REST API            │ REST API
     │                     │
     ▼                     ▼
┌────────────┐      ┌────────────┐
│  Knack DB  │      │  Notion    │
│  (3rd      │      │  (Image    │
│   party)   │      │   host)    │
│  ❌ SLOW   │      │  ❌ SLOW   │
│  ❌ $$$$   │      │  ❌ LIMIT  │
└────────────┘      └────────────┘
     │
     │ Manual Sync (not automated)
     │
     ▼
┌─────────────────────────────────────┐
│       Next.js Shop (localhost)      │
│  ⚠️  No product pages yet           │
│  ⚠️  No e-commerce features         │
│  ⚠️  Wrong database schema          │
└─────────────────────────────────────┘
```

**Problems:**
- ❌ Knack is slow and expensive (3rd party SaaS)
- ❌ Notion is not a database (image storage hack)
- ❌ No automated sync between scraper and website
- ❌ Website has no e-commerce features
- ❌ Manual product management

---

## 🎯 Target System (After Refactor)

```
┌─────────────────────────────────────────────────────────────┐
│                        TARGET SYSTEM                          │
│                   (Clean & Production-Ready)                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Taobao.com  │  (Product Source)
│              │
└──────┬───────┘
       │ Selenium WebDriver
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│            Python Scraper (Refactored)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 1. Scrape (Selenium)                                   │ │
│  │ 2. Extract Variants (variant_engine.py)               │ │
│  │ 3. Download Images → Local Cache                      │ │
│  │ 4. Stitch Images (Pillow)                             │ │
│  │ 5. Translate (Gemini AI)                              │ │
│  │ 6. Calculate Pricing (CNY → CAD + margins)            │ │
│  └────────────────────────────────────────────────────────┘ │
└────┬──────────────────────────────────────────────┬──────────┘
     │                                              │
     │ Upload Images                                │ Insert Data
     │ (JPEG/WebP)                                  │ (JSON)
     │                                              │
     ▼                                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (Cloud)                          │
│  ┌─────────────────┐          ┌─────────────────────────┐  │
│  │ Storage Bucket  │          │  PostgreSQL Database    │  │
│  │ (Images/Media)  │          │  - Product              │  │
│  │                 │          │  - Variant              │  │
│  │ /product-images/│          │  - Order                │  │
│  │  ├─ PZ-001/     │          │  - OrderItem            │  │
│  │  │  ├─ main_1   │          │  - User                 │  │
│  │  │  ├─ main_2   │◀────────▶│                         │  │
│  │  │  └─ stitch   │  Links   │  ✅ Fast queries        │  │
│  │  └─ PZ-002/     │          │  ✅ ACID transactions   │  │
│  │                 │          │  ✅ Row Level Security  │  │
│  └─────────────────┘          └─────────────────────────┘  │
│         ▲                                    │               │
│         │ CDN URLs                           │ REST API      │
│         │                                    │               │
└─────────┼────────────────────────────────────┼───────────────┘
          │                                    │
          │                                    ▼
┌─────────┴────────────────────────────────────────────────────┐
│              Next.js 15 Shop (Vercel)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend (React Server Components)                  │   │
│  │  ─────────────────────────────────────────────       │   │
│  │  📄 Homepage (/)                                     │   │
│  │  🛒 Shop (/shop) - Product listing grid             │   │
│  │  📦 Product Detail (/shop/[id]) - Variant selector  │   │
│  │  🛍️ Cart (/cart) - Review items                     │   │
│  │  💳 Checkout (/checkout) - Place order              │   │
│  │  👤 Account (/account) - Order history              │   │
│  │  🔧 Admin (/admin) - Manage products                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Routes (Next.js /api)                          │   │
│  │  ─────────────────────────────────────────          │   │
│  │  GET  /api/products - List products                 │   │
│  │  GET  /api/products/[id] - Product detail           │   │
│  │  POST /api/cart/add - Add to cart                   │   │
│  │  POST /api/orders/create - Place order              │   │
│  │  PUT  /api/admin/products/[id] - Update product     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         │ Firebase Auth (User Login)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase (Auth Only)                      │
│  - User registration                                         │
│  - Login/Logout                                              │
│  - Email verification                                        │
│  - Custom claims (role: admin)                               │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ **Supabase:** Fast, cheap, PostgreSQL-based
- ✅ **Automated:** Scraper → Database → Website (no manual steps)
- ✅ **Scalable:** CDN for images, edge caching
- ✅ **Admin-friendly:** Edit products directly in database
- ✅ **Production-ready:** Deployed on Vercel

---

## 🔄 Data Flow Diagrams

### A. Scraper Workflow (New Product)

```
START: New Taobao URL added to taobao_links.txt
  │
  ▼
┌───────────────────────────────────────┐
│ 1. SCRAPE                             │
│  - Open Chrome (Selenium)             │
│  - Navigate to Taobao page            │
│  - Wait for images to load            │
│  - Extract HTML + JSON data           │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 2. EXTRACT                            │
│  - Product title (Chinese)            │
│  - Base price (CNY)                   │
│  - Main images (gallery)              │
│  - Detail images                      │
│  - Variant options (color/size)       │
│  - Variant prices                     │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 3. DOWNLOAD IMAGES                    │
│  - Download all image URLs            │
│  - Save to: ai_scraper_output/media/  │
│  - Naming: {slug}_main_{n}.jpg        │
│  - Fallback: Screenshot if download   │
│    fails                              │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 4. STITCH IMAGES                      │
│  - Load variant images                │
│  - Resize to uniform height           │
│  - Create comparison grid             │
│  - Save: {slug}_stitch.jpg            │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 5. TRANSLATE                          │
│  - Call Gemini API                    │
│  - Translate title (ZH → EN)          │
│  - Apply tactical naming rules        │
│  - Translate variants                 │
│  - Use color dictionary               │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 6. CALCULATE PRICING                  │
│  - For each variant:                  │
│    cost_cny = price + ¥30 shipping    │
│    cost_cad = cost_cny × 0.19         │
│    sale_cad = cost_cad / (1-0.10-0.30)│
│    round to .99                       │
│  - Calculate margins (standard/promo) │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 7. UPLOAD IMAGES                      │
│  - Supabase Storage API               │
│  - Bucket: product-images             │
│  - Path: products/{sku}/{filename}    │
│  - Get public CDN URLs                │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 8. SEED PRODUCT                       │
│  - Insert into Product table:         │
│    {sku, title, images[], price...}   │
│  - Get product ID                     │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 9. SEED VARIANTS                      │
│  - For each variant:                  │
│    Insert into Variant table:         │
│    {productId, sku, name, options,    │
│     price, stock...}                  │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ 10. VERIFY                            │
│  - Log product ID                     │
│  - Log variant count                  │
│  - Save to CSV (backup)               │
└────────────┬──────────────────────────┘
             │
             ▼
           DONE
    Product live on website!
```

---

### B. Customer Purchase Flow

```
START: Customer visits website
  │
  ▼
┌───────────────────────────────────────┐
│ Homepage (/)                          │
│  - Hero banner                        │
│  - Featured products                  │
│  - Category cards                     │
│  [Shop Now] button                    │
└────────────┬──────────────────────────┘
             │ Click "Shop Now"
             ▼
┌───────────────────────────────────────┐
│ Shop Page (/shop)                     │
│  - Product grid (24/page)             │
│  - Filters: Category, Price, Color    │
│  - Sort: Newest, Price                │
│  [Product Card] × N                   │
└────────────┬──────────────────────────┘
             │ Click product
             ▼
┌───────────────────────────────────────┐
│ Product Detail (/shop/[id])           │
│  ┌─────────────┬─────────────────────┐│
│  │   Image     │  Title: $49.99 CAD  ││
│  │   Gallery   │  ⭐⭐⭐⭐⭐           ││
│  │   (zoom)    │                     ││
│  │             │  Variant Selector:  ││
│  │             │  Color: [⚫][🟤][🟢] ││
│  │             │  Size:  [S][M][L]   ││
│  │             │                     ││
│  │             │  Qty: [- 1 +]       ││
│  │             │  [Add to Cart]      ││
│  └─────────────┴─────────────────────┘│
└────────────┬──────────────────────────┘
             │ Click "Add to Cart"
             ▼
┌───────────────────────────────────────┐
│ Toast Notification                    │
│  ✅ Added to cart!                    │
│  [View Cart] [Continue Shopping]      │
└────────────┬──────────────────────────┘
             │ Click "View Cart"
             ▼
┌───────────────────────────────────────┐
│ Cart Page (/cart)                     │
│  ┌─────────────────────────────────┐ │
│  │ [Image] Tactical Vest           │ │
│  │ Black / M                        │ │
│  │ $49.99 × 1  [- 1 +]  [❌]       │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ [Image] Backpack                │ │
│  │ Tan / L                          │ │
│  │ $87.99 × 2  [- 2 +]  [❌]       │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Subtotal:    $225.97                │
│  Shipping:    $15.00                 │
│  Tax:         $36.14                 │
│  ──────────────────────               │
│  Total:       $277.11 CAD            │
│                                       │
│  [Continue Shopping] [Checkout]      │
└────────────┬──────────────────────────┘
             │ Click "Checkout"
             ▼
┌───────────────────────────────────────┐
│ Checkout (/checkout)                  │
│  Step 1: Shipping Address             │
│  ┌─────────────────────────────────┐ │
│  │ Full Name:    [____________]    │ │
│  │ Email:        [____________]    │ │
│  │ Phone:        [____________]    │ │
│  │ Address:      [____________]    │ │
│  │ City:         [____________]    │ │
│  │ Province:     [▼ Ontario]       │ │
│  │ Postal Code:  [____________]    │ │
│  └─────────────────────────────────┘ │
│  [Continue to Payment]               │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ Step 2: Payment (Phase 1: Simple)    │
│  ○ We'll contact you for payment     │
│  ○ (Future: Stripe integration)      │
│  [Place Order]                        │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ Order Confirmation                    │
│  ✅ Order placed!                     │
│  Order #: PZ-20260125-0001            │
│  Total: $277.11 CAD                   │
│  We'll email you shortly.             │
│  [View Order Status]                  │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ Email Sent (Auto)                     │
│  To: customer@example.com             │
│  Subject: Order Confirmation          │
│  Body: Order details + tracking       │
└───────────────────────────────────────┘
             │
             ▼
           DONE
```

---

### C. Admin Edit Flow

```
START: Admin wants to edit product
  │
  ▼
┌───────────────────────────────────────┐
│ Admin Login (/admin)                  │
│  - Firebase auth check                │
│  - Verify role = admin                │
│  - Redirect to dashboard              │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ Admin Dashboard (/admin)              │
│  📊 Stats: 120 products, $4.5k sales │
│  ⚠️ Low Stock Alerts                  │
│  [Manage Products] button             │
└────────────┬──────────────────────────┘
             │ Click "Manage Products"
             ▼
┌───────────────────────────────────────┐
│ Product List (/admin/products)        │
│  ┌────────────────────────────────┐  │
│  │ [✓] Image | SKU | Title | ...  │  │
│  │ [ ] IMG   PZ-001 Vest   $49.99 │  │
│  │ [ ] IMG   PZ-002 Pack   $87.99 │  │
│  │ ...                             │  │
│  └────────────────────────────────┘  │
│  [Bulk Actions ▼] [Add Product]      │
└────────────┬──────────────────────────┘
             │ Click product row
             ▼
┌───────────────────────────────────────┐
│ Product Editor (/admin/products/[id]) │
│  Tabs: [Info] [Pricing] [Images]     │
│       [Variants] [SEO]                │
│  ┌─────────────────────────────────┐ │
│  │ Title:  [Tactical Vest______]   │ │
│  │ Price:  [$49.99_______] CAD     │ │
│  │ Status: [▼ Active]              │ │
│  │                                 │ │
│  │ Images: [+ Upload]              │ │
│  │  [IMG1] [IMG2] [IMG3]           │ │
│  │                                 │ │
│  │ Variants: (4)                   │ │
│  │  Black / M   $49.99   Stock: 10 │ │
│  │  Tan / M     $49.99   Stock: 5  │ │
│  │  ...                            │ │
│  └─────────────────────────────────┘ │
│  [Save Draft] [Publish] [Delete]     │
└────────────┬──────────────────────────┘
             │ Click "Publish"
             ▼
┌───────────────────────────────────────┐
│ Database Update (Supabase)            │
│  UPDATE Product                       │
│  SET title = '...', status = 'active' │
│  WHERE id = '...'                     │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ Success Toast                         │
│  ✅ Product updated!                  │
│  Changes live in 30 seconds           │
└────────────┬──────────────────────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ Frontend Auto-Update                  │
│  - Next.js revalidates cache          │
│  - Product page updated               │
│  - Shop listing updated               │
└───────────────────────────────────────┘
             │
             ▼
           DONE
    Changes live on website!
```

---

## 🗂️ Database Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE SCHEMA (ERD)                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│     Product      │
├──────────────────┤
│ id (PK)          │
│ sku (unique)     │
│ title            │
│ titleOriginal    │
│ description      │
│ category         │
│ status           │───────┐
│ priceCadBase     │       │
│ margin           │       │
│ stock            │       │
│ url              │       │
│ primaryImage     │       │
│ images[]         │       │
│ detailImages[]   │       │
│ createdAt        │       │
│ updatedAt        │       │
└────────┬─────────┘       │
         │                 │
         │ 1:N             │
         │                 │
         ▼                 │
┌──────────────────┐       │
│     Variant      │       │
├──────────────────┤       │
│ id (PK)          │       │
│ productId (FK)   │───────┘
│ sku (unique)     │
│ variantName      │
│ sortOrder        │
│ priceCny         │
│ shippingCny      │
│ costCad          │
│ priceCad         │
│ marginStandard   │
│ marginPromo      │
│ competitorPrice  │
│ optionType1      │
│ optionValue1     │
│ optionType2      │
│ optionValue2     │
│ stock            │
│ status           │
│ createdAt        │
│ updatedAt        │
└────────┬─────────┘
         │
         │ N:M (via OrderItem)
         │
         ▼
┌──────────────────┐       ┌──────────────────┐
│   OrderItem      │       │      Order       │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ orderId (FK)     │───────│ userId (FK)      │──┐
│ variantId (FK)   │       │ orderNumber      │  │
│ quantity         │       │ status           │  │
│ priceCad         │       │ totalCad         │  │
│ createdAt        │       │ shippingAddress  │  │
└──────────────────┘       │ shippingMethod   │  │
                           │ trackingNumber   │  │
                           │ paymentMethod    │  │
                           │ paymentStatus    │  │
                           │ paidAt           │  │
                           │ createdAt        │  │
                           │ updatedAt        │  │
                           └──────────────────┘  │
                                    │            │
                                    │ N:1        │
                                    ▼            │
                           ┌──────────────────┐  │
                           │      User        │◀─┘
                           ├──────────────────┤
                           │ id (PK)          │
                           │ name             │
                           │ username         │
                           │ email            │
                           │ emailVerified    │
                           │ image            │
                           │ role             │
                           └──────────────────┘
```

**Key Relationships:**
- 1 Product → N Variants (one-to-many)
- 1 Order → N OrderItems (one-to-many)
- 1 Variant → N OrderItems (one-to-many)
- 1 User → N Orders (one-to-many)

---

## 🎨 Component Hierarchy (Frontend)

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT TREE                            │
└─────────────────────────────────────────────────────────────┘

App (Root Layout)
├── Header
│   ├── Logo
│   ├── Navigation
│   │   ├── Link (Shop)
│   │   ├── Link (About)
│   │   └── Link (Contact)
│   ├── SearchBar
│   ├── UserMenu
│   │   ├── Avatar
│   │   └── Dropdown
│   │       ├── Profile
│   │       ├── Orders
│   │       └── Logout
│   └── CartIcon (with badge)
│
├── Page Content (varies by route)
│   │
│   ├── Homepage (/)
│   │   ├── HeroBanner
│   │   │   ├── Image
│   │   │   └── CTA Button
│   │   ├── CategoryCards
│   │   │   └── CategoryCard × 4
│   │   └── ProductGrid
│   │       └── ProductCard × 8
│   │
│   ├── Shop Page (/shop)
│   │   ├── FilterSidebar
│   │   │   ├── CategoryFilter
│   │   │   ├── PriceRangeFilter
│   │   │   └── ColorFilter
│   │   └── ProductGrid
│   │       ├── SortDropdown
│   │       └── ProductCard × 24
│   │
│   ├── Product Detail (/shop/[id])
│   │   ├── ProductGallery
│   │   │   ├── MainImage
│   │   │   ├── ThumbnailStrip
│   │   │   └── Lightbox (modal)
│   │   ├── ProductInfo
│   │   │   ├── Title
│   │   │   ├── Price
│   │   │   ├── Rating
│   │   │   ├── VariantSelector
│   │   │   │   ├── ColorSelector
│   │   │   │   └── SizeSelector
│   │   │   ├── QuantityInput
│   │   │   └── AddToCartButton
│   │   ├── ProductTabs
│   │   │   ├── DescriptionTab
│   │   │   ├── SpecsTab
│   │   │   └── ReviewsTab
│   │   └── RelatedProducts
│   │       └── ProductCard × 4
│   │
│   ├── Cart Page (/cart)
│   │   ├── CartItem × N
│   │   │   ├── Image
│   │   │   ├── Title + Variant
│   │   │   ├── QuantityInput
│   │   │   ├── Price
│   │   │   └── RemoveButton
│   │   └── CartSummary
│   │       ├── Subtotal
│   │       ├── Shipping
│   │       ├── Tax
│   │       ├── Total
│   │       └── CheckoutButton
│   │
│   ├── Checkout Page (/checkout)
│   │   ├── CheckoutSteps
│   │   │   ├── ShippingForm
│   │   │   ├── PaymentForm
│   │   │   └── ReviewStep
│   │   └── OrderSummary
│   │
│   └── Admin Dashboard (/admin)
│       ├── AdminSidebar
│       │   ├── Link (Dashboard)
│       │   ├── Link (Products)
│       │   ├── Link (Orders)
│       │   └── Link (Settings)
│       ├── DashboardStats
│       │   ├── StatCard (Products)
│       │   ├── StatCard (Revenue)
│       │   └── StatCard (Orders)
│       ├── ProductTable
│       │   ├── TableHeader
│       │   ├── TableRow × N
│       │   └── Pagination
│       └── ProductEditor
│           ├── TabNavigation
│           ├── FormFields
│           ├── ImageUploader
│           ├── VariantManager
│           └── SaveButtons
│
└── Footer
    ├── Links (Policies, Support)
    ├── Social Icons
    └── Copyright
```

---

**End of Diagrams**  
**Last Updated:** January 25, 2026

*Use these diagrams as visual references while reading the specification documents.*
