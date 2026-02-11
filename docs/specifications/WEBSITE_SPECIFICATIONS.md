# Website Features Specifications

**Version:** 2.0  
**Date:** January 25, 2026  
**Stack:** Next.js 15 + Supabase + Vercel

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Frontend Features](#frontend-features)
3. [Admin Dashboard](#admin-dashboard)
4. [Database Schema](#database-schema)
5. [API Routes](#api-routes)
6. [Component Library](#component-library)
7. [Deployment](#deployment)

---

## 🎯 Overview

The website is a modern e-commerce storefront built with Next.js 15 (App Router), using Supabase for database/storage, Firebase for authentication, and deployed on Vercel. It displays products scraped from Taobao with variant selection, cart, and checkout functionality.

### Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Firebase Authentication
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Image Hosting:** Supabase Storage

---

## 🛒 Frontend Features

### 1. Homepage (`/`)

#### Layout
```
┌─────────────────────────────────────┐
│  Header (Logo, Nav, Cart Icon)     │
├─────────────────────────────────────┤
│  Hero Banner (Featured Products)   │
├─────────────────────────────────────┤
│  Product Categories                 │
├─────────────────────────────────────┤
│  Best Sellers Grid (8 products)    │
├─────────────────────────────────────┤
│  Footer (Links, Social, Info)      │
└─────────────────────────────────────┘
```

#### Components
- **Header:**
  - Logo (left)
  - Navigation: Shop, About, Contact
  - Search bar
  - User menu (Login/Account)
  - Cart icon with item count badge

- **Hero Banner:**
  - Full-width image
  - Call-to-action button ("Shop Now")
  - Auto-rotating carousel (3-5 slides)

- **Category Cards:**
  - Vests, Backpacks, Gloves, Accessories
  - Image + Title + Item count
  - Click to filter products

- **Product Grid:**
  - 4 columns on desktop, 2 on mobile
  - Product card: Image, Title, Price, "Quick View" button

---

### 2. Shop Page (`/shop`)

#### Filters (Sidebar)
```typescript
interface Filters {
  categories: string[];       // Vests, Backpacks, etc.
  priceRange: [number, number]; // Min, Max CAD
  colors: string[];           // Black, Tan, etc.
  inStock: boolean;
  sortBy: 'price-asc' | 'price-desc' | 'newest';
}
```

#### Product Grid
- **Pagination:** 24 products per page
- **Infinite Scroll:** Optional (load more on scroll)
- **Product Card:**
  - Image (hover to show second image)
  - Title
  - Price (show sale price if discounted)
  - Color dots (all available colors)
  - "Add to Cart" button
  - "Quick View" icon

#### Quick View Modal
- Product images (carousel)
- Title, Price, Description
- Variant selector (Color, Size)
- Quantity input
- "Add to Cart" button
- "View Full Details" link

---

### 3. Product Detail Page (`/shop/[productId]`)

#### Layout
```
┌──────────────┬─────────────────────┐
│              │  Title              │
│              │  Price (CAD)        │
│  Image       │  Rating ⭐⭐⭐⭐⭐    │
│  Gallery     │                     │
│  (zoom)      │  Variant Selector:  │
│              │  [Color] [Size]     │
│              │                     │
│              │  Quantity: [- 1 +]  │
│              │                     │
│              │  [Add to Cart]      │
│              │  [Buy Now]          │
└──────────────┴─────────────────────┘
│  Tabs: Description | Specs | Reviews
└─────────────────────────────────────┘
│  Related Products
└─────────────────────────────────────┘
```

#### Image Gallery
- **Main Display:** Large product image (800x800px)
- **Thumbnail Strip:** All images (click to change main)
- **Zoom:** Click to open lightbox with pinch-zoom
- **Navigation:** Arrows for prev/next

#### Variant Selector
```typescript
interface VariantSelector {
  options: {
    type: string;          // "Color", "Size"
    values: {
      value: string;       // "Black", "M"
      available: boolean;  // In stock?
      image?: string;      // Preview image
      priceAdjustment?: number; // +/- from base
    }[];
  }[];
  selectedVariant: Variant | null;
}
```

**Visual Design:**
- **Color Options:** Color swatches (circles with border)
- **Size Options:** Buttons with text (S, M, L, XL)
- **Disabled State:** Greyed out if out of stock
- **Selected State:** Bold border + checkmark

#### Pricing Display
```tsx
<div className="pricing">
  {variant.priceCad < product.priceCadBase && (
    <span className="original-price">${product.priceCadBase}</span>
  )}
  <span className="sale-price">${variant.priceCad}</span>
  <span className="currency">CAD</span>
</div>
```

#### Add to Cart Logic
1. Validate variant selected
2. Check stock availability
3. Add to cart (local storage + session)
4. Show toast notification
5. Update cart icon badge
6. Option to "View Cart" or "Continue Shopping"

#### Tabs

**Description Tab:**
- Translated product description
- Key features (bullet points)
- Materials, care instructions

**Specifications Tab:**
- Dimensions, weight
- Material composition
- Country of origin: China
- SKU, Barcode

**Reviews Tab:**
- Customer reviews (future feature)
- Average rating
- Review form (if logged in)

---

### 4. Cart Page (`/cart`)

#### Layout
```
┌─────────────────────────────────────┐
│  Your Cart (3 items)                │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ [Image] Product Title       │   │
│  │ Variant: Black / M          │   │
│  │ $49.99 × 2  [- 2 +]  [❌]  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [Image] Product Title       │   │
│  │ ...                         │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  Subtotal:          $149.97         │
│  Shipping:          $15.00          │
│  Tax (GST+PST):     $24.00          │
│  ─────────────────────────          │
│  Total:             $188.97 CAD     │
│                                     │
│  [Continue Shopping] [Checkout]    │
└─────────────────────────────────────┘
```

#### Cart Item Component
```typescript
interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  product: {
    title: string;
    image: string;
  };
  variant: {
    name: string;
    priceCad: number;
  };
}
```

#### Actions
- **Update Quantity:** +/- buttons (min: 1, max: stock)
- **Remove Item:** X icon (with confirmation)
- **Save for Later:** Move to wishlist (future)
- **Apply Coupon:** Promo code input (future)

---

### 5. Checkout Page (`/checkout`)

#### Steps
1. **Shipping Address**
2. **Payment Method**
3. **Review & Confirm**

#### Shipping Address Form
```typescript
interface ShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;  // Dropdown: ON, BC, AB, etc.
  postalCode: string; // Format: A1A 1A1
  country: string;    // Fixed: "Canada"
}
```

**Validation:**
- All fields required
- Email format check
- Postal code regex: `/^[A-Z]\d[A-Z] \d[A-Z]\d$/`
- Phone: 10 digits

#### Payment Method (Phase 2)
For initial launch, use **Contact Form** instead of live payment:
- "We'll contact you to arrange payment"
- Order placed as "Pending Payment"
- Email sent to admin + customer

**Future Integration:**
- Stripe Checkout
- PayPal
- Interac e-Transfer

#### Review & Confirm
- Summary of order items
- Shipping address
- Payment method
- Estimated delivery: 7-14 business days
- "Place Order" button

#### Order Confirmation
- Thank you message
- Order number (e.g., `PZ-20260125-0001`)
- Email confirmation sent
- "View Order Status" link

---

### 6. Account Pages (`/account`)

#### Dashboard (`/account`)
- Welcome message
- Recent orders
- Saved addresses
- Account settings

#### Orders (`/account/orders`)
- Order history table
- Columns: Order #, Date, Status, Total
- Click to view order details

#### Order Detail (`/account/orders/[orderId]`)
- Order items
- Shipping address
- Payment status
- Tracking number (if shipped)
- "Re-order" button

#### Profile (`/account/profile`)
- Update name, email
- Change password (Firebase)
- Profile picture upload

---

## 🔐 Admin Dashboard

### Admin Routes (`/admin`)

**Access Control:**
- Check user role: `user.role === 'admin'`
- Redirect to `/` if not admin
- Use Firebase custom claims for role

#### Dashboard (`/admin`)
```
┌─────────────────────────────────────┐
│  📊 Analytics Overview              │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ 120  │ │ $4.5k│ │  15  │       │
│  │Products Total  │ Pending│       │
│  └──────┘ └──────┘ └──────┘       │
├─────────────────────────────────────┤
│  📈 Sales Chart (Last 30 Days)     │
├─────────────────────────────────────┤
│  🔥 Low Stock Alert (< 5 units)    │
│  - Tactical Vest (Black / M): 2    │
│  - Backpack (Tan / L): 3           │
└─────────────────────────────────────┘
```

#### Products (`/admin/products`)

**Table Columns:**
- Checkbox (for bulk actions)
- Image (thumbnail)
- SKU
- Title
- Status (Draft, Active, Archived)
- Variants (count)
- Stock (total across variants)
- Price (base)
- Actions (Edit, Delete)

**Bulk Actions:**
- Publish selected
- Unpublish selected
- Delete selected (with confirmation)

**Filters:**
- Status: All, Draft, Active, Archived
- Search: By title or SKU
- Category: All, Vests, Backpacks, etc.

**Add Product Button:**
- Opens product editor form
- Manual entry (for non-scraped products)

#### Product Editor (`/admin/products/[id]`)

**Tabs:**

**1. Basic Info**
```typescript
interface ProductForm {
  title: string;
  titleOriginal?: string;
  description: string;
  category: string;
  status: 'draft' | 'active' | 'archived';
  url?: string; // Taobao source
}
```

**2. Pricing**
- Base price (CAD)
- Cost (for margin calculation)
- Competitor price (for comparison)

**3. Images**
- Upload new images (drag-and-drop)
- Reorder images (drag-and-drop)
- Delete images
- Set primary image (click to select)

**4. Variants**
- List all variants (table)
- Edit variant pricing
- Update stock
- Add new variant (manual)

**5. SEO**
- Meta title
- Meta description
- URL slug

**Save Actions:**
- "Save Draft" (status: draft)
- "Publish" (status: active)
- "Save & Continue Editing"

#### Orders (`/admin/orders`)

**Table Columns:**
- Order #
- Date
- Customer (name + email)
- Items (count)
- Total (CAD)
- Payment Status
- Fulfillment Status
- Actions (View, Fulfill, Cancel)

**Order Detail:**
- Customer info
- Shipping address
- Order items (with images)
- Payment details
- Add tracking number
- Mark as shipped
- Print packing slip

#### Settings (`/admin/settings`)

**General:**
- Site name, tagline
- Contact email
- Social media links

**Pricing:**
- Exchange rate (CNY → CAD)
- Shipping cost (per item)
- Tax rates (GST, PST by province)

**Scraper:**
- Gemini API key
- Supabase credentials
- Auto-publish new products (toggle)

---

## 🗄️ Database Schema (Supabase)

See [REFACTOR_PLAN.md](REFACTOR_PLAN.md#target-database-schema-supabase) for complete Prisma schema.

### Key Tables
- **Product:** Base product info
- **Variant:** Color/size options with pricing
- **Order:** Customer orders
- **OrderItem:** Line items in orders
- **User:** Customer accounts (extends Firebase)

### Indexes
```sql
-- Products
CREATE INDEX idx_products_status ON "Product"(status);
CREATE INDEX idx_products_category ON "Product"(category);

-- Variants
CREATE INDEX idx_variants_product ON "Variant"("productId");
CREATE INDEX idx_variants_status ON "Variant"(status);

-- Orders
CREATE INDEX idx_orders_user ON "Order"("userId");
CREATE INDEX idx_orders_status ON "Order"(status);
```

### Row Level Security (RLS)

**Products & Variants:**
```sql
-- Public can read active products
CREATE POLICY "Public read active" ON "Product"
  FOR SELECT USING (status = 'active');

-- Admin can manage all
CREATE POLICY "Admin full access" ON "Product"
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

**Orders:**
```sql
-- Users can read their own orders
CREATE POLICY "User read own orders" ON "Order"
  FOR SELECT USING (auth.uid() = "userId");

-- Admin can read all orders
CREATE POLICY "Admin read all orders" ON "Order"
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
```

---

## 🔌 API Routes

### Product Routes

**`GET /api/products`**
- Query params: `category`, `minPrice`, `maxPrice`, `color`, `inStock`, `page`, `limit`
- Response: `{ products: Product[], total: number, page: number }`

**`GET /api/products/[id]`**
- Response: `Product` with all variants

**`GET /api/products/[id]/variants`**
- Response: `Variant[]` for product

### Cart Routes

**`POST /api/cart/add`**
- Body: `{ variantId: string, quantity: number }`
- Response: `{ cart: CartItem[] }`

**`PUT /api/cart/update`**
- Body: `{ itemId: string, quantity: number }`
- Response: `{ cart: CartItem[] }`

**`DELETE /api/cart/remove`**
- Body: `{ itemId: string }`
- Response: `{ cart: CartItem[] }`

### Order Routes

**`POST /api/orders/create`**
- Body: `{ items: CartItem[], shippingAddress: Address }`
- Response: `{ order: Order }`

**`GET /api/orders/[id]`**
- Response: `Order` with items

**`GET /api/orders/user/[userId]`**
- Response: `Order[]`

### Admin Routes

**`PUT /api/admin/products/[id]`**
- Body: `Partial<Product>`
- Response: `{ product: Product }`

**`POST /api/admin/products/bulk`**
- Body: `{ action: 'publish' | 'unpublish', ids: string[] }`
- Response: `{ updated: number }`

**`PUT /api/admin/orders/[id]/fulfill`**
- Body: `{ trackingNumber: string }`
- Response: `{ order: Order }`

---

## 🎨 Component Library

### Shared Components

**ProductCard (`/components/product/ProductCard.tsx`)**
```tsx
interface ProductCardProps {
  product: Product;
  variant?: Variant;
  showQuickView?: boolean;
  showAddToCart?: boolean;
}
```

**VariantSelector (`/components/product/VariantSelector.tsx`)**
```tsx
interface VariantSelectorProps {
  variants: Variant[];
  selectedVariant: Variant | null;
  onSelect: (variant: Variant) => void;
}
```

**ImageGallery (`/components/product/ImageGallery.tsx`)**
```tsx
interface ImageGalleryProps {
  images: string[];
  alt: string;
  zoom?: boolean;
}
```

**AddToCartButton (`/components/product/AddToCartButton.tsx`)**
```tsx
interface AddToCartButtonProps {
  variant: Variant;
  quantity: number;
  disabled?: boolean;
  onSuccess?: () => void;
}
```

### Layout Components

**Header (`/components/layout/Header.tsx`)**
- Logo, Navigation, Search, User Menu, Cart Icon

**Footer (`/components/layout/Footer.tsx`)**
- Links, Social Icons, Copyright

**AdminLayout (`/components/layout/AdminLayout.tsx`)**
- Sidebar navigation, Top bar, Content area

### Form Components

**Input (`/components/ui/Input.tsx`)**
**Button (`/components/ui/Button.tsx`)**
**Select (`/components/ui/Select.tsx`)**
**Checkbox (`/components/ui/Checkbox.tsx`)**
**Toast (`/components/ui/Toast.tsx`)**

---

## 🚀 Deployment

### Vercel Setup

**1. Connect GitHub Repo**
- Go to Vercel dashboard
- Import project
- Select `protocol-zero` repo

**2. Configure Build**
```
Root Directory: shop
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**3. Environment Variables**
```bash
# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Site
NEXT_PUBLIC_SITE_URL=https://protocol-zero.vercel.app
```

**4. Domain Setup**
- Add custom domain (if available)
- Configure DNS (A/CNAME records)
- Enable HTTPS (automatic)

### Deployment Checklist

**Pre-Deployment:**
- [ ] All environment variables set
- [ ] Database schema pushed
- [ ] Test data seeded
- [ ] Images uploaded to Supabase Storage
- [ ] Build succeeds locally (`npm run build`)

**Post-Deployment:**
- [ ] Test product pages load
- [ ] Test cart functionality
- [ ] Test checkout flow
- [ ] Verify admin access
- [ ] Check mobile responsiveness
- [ ] Test on Safari, Chrome, Firefox

### Performance Optimization

**Images:**
- Use Next.js `<Image>` component (auto-optimization)
- Lazy load images below fold
- Use WebP format where supported

**Caching:**
- Cache product data (SWR with 5min revalidation)
- Static generation for product pages (ISR)
- Edge caching on Vercel

**Code Splitting:**
- Dynamic imports for admin routes
- Lazy load modals, lightboxes
- Separate vendor bundle

---

## 📊 Analytics & Monitoring

**Vercel Analytics:**
- Page views, unique visitors
- Performance metrics (Core Web Vitals)

**Custom Events:**
- Product views
- Add to cart
- Checkout started
- Order completed

**Error Tracking:**
- Sentry integration (optional)
- Log errors to Supabase table

---

## 🔮 Future Features

### Phase 2
- [ ] Customer reviews & ratings
- [ ] Wishlist / Save for later
- [ ] Product recommendations
- [ ] Live chat support

### Phase 3
- [ ] Multi-currency support
- [ ] International shipping
- [ ] Loyalty program
- [ ] Affiliate system

---

**End of Specifications**  
**Version:** 2.0  
**Last Updated:** January 25, 2026
