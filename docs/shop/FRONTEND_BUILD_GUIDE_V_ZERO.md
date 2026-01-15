# Frontend Build Guide for V-Zero
## Protocol Zero E-Commerce - Complete Specification

**Version:** 2.0  
**Date:** January 13, 2026  
**Target:** V-Zero AI Agent  

---

## 🎯 Project Overview

Build a **single-seller e-commerce website** inspired by Taobao's product page structure, with these critical requirements:

### Core Constraints
1. **English Only** - All UI text, labels, and content must be in English
2. **NO Color Labels** - Never display color names; use generic labels like "Style 1", "Style 2"
3. **Single Seller** - One store owner, not a marketplace
4. **User Accounts** - Full login/registration system
5. **E-Transfer Payment Only** - No credit cards, just Interac E-Transfer
6. **Promo Code Support** - Field exists but no discount calculation yet

---

## 🎨 Design System (Preserve Existing)

### Color Palette
```css
/* Background Colors */
--bg-primary: #0D0D0D;     /* Main background - very dark black */
--bg-surface: #1E1E1E;     /* Cards, panels - dark gray */
--bg-elevated: #2C2C2C;    /* Hover states, borders */

/* Text Colors */
--text-primary: #F5F5F5;   /* Main text - off white */
--text-secondary: #A1A1A1; /* Muted text - gray */
--text-disabled: #666666;  /* Disabled text */

/* Accent Colors */
--accent-primary: #3D9A6C; /* Primary green - buttons, links */
--accent-hover: #4DB87F;   /* Hover state - lighter green */
--accent-active: #337E59;  /* Active/pressed state - darker green */

/* Status Colors */
--success: #3D9A6C;        /* Success states */
--warning: #E4B100;        /* Warning states - yellow */
--error: #D13A3A;          /* Error states - red */
```

### Typography
```css
/* Font Families */
font-family-heading: 'Orbitron', sans-serif;     /* Headings - tech/futuristic */
font-family-body: 'Inter', sans-serif;           /* Body text - clean */
font-family-mono: 'JetBrains Mono', monospace;   /* Prices, codes */

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### Spacing & Layout
```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */
--spacing-2xl: 3rem;     /* 48px */

--border-radius-sm: 0.5rem;    /* 8px */
--border-radius-md: 0.75rem;   /* 12px */
--border-radius-lg: 1rem;      /* 16px */
--border-radius-xl: 1.25rem;   /* 20px */
```

### Shadows
```css
--shadow-card: 0 4px 16px rgba(0, 0, 0, 0.45);
--shadow-glow: 0 0 0 2px rgba(61, 154, 108, 0.27);
--shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.6);
```

---

## 📊 Data Models

### Product Object
```typescript
interface Product {
  // Identity
  id: string;                    // Internal product ID
  source: {
    platform: "taobao";
    source_item_id: string;      // Original Taobao item ID
    source_url: string;          // Original URL (not shown to customers)
  };

  // Display Info (English only)
  title: string;                 // English product title
  brand?: string;                // English brand name
  category: string;              // e.g., "Tactical Jacket", "Combat Shirt"
  description_html?: string;     // Rich text description

  // Pricing
  pricing: {
    price_current: number;       // Current price in CAD
    currency: "CAD";
    market_price?: number;       // Original price for strikethrough
  };

  // Inventory Model
  inventory_model: "variant";    // Always "variant" for this build

  // Options (NO COLOR LABELS)
  options: {
    primary_option: {            // e.g., "Style" (NOT "Color")
      id: string;                // "variant1", "variant2", etc.
      label: string;             // "Style A", "Style B" (generic labels)
    }[];
    secondary_option?: {         // e.g., "Size"
      id: string;                // "S", "M", "L", "XL"
      label: string;             // Same as id
    }[];
  };

  // Variants
  variants: Variant[];

  // Images
  images: {
    main_gallery: string[];      // Hero images (7 images)
    detail_images: string[];     // Long scroll detail images
    all: Image[];                // All image objects
  };

  // Attributes (English key-value pairs)
  attributes: Record<string, string>;  // e.g., { "intended_use": "Unisex" }

  // Availability
  availability: {
    default_quantity: number;
    max_per_order?: number;
  };

  // Shipping (your store's info)
  shipping: {
    ship_from: string;           // e.g., "Toronto, Canada"
    ship_to_supported: string[]; // Countries/regions
    shipping_fee_type: "flat" | "calculated" | "free";
    shipping_fee_value?: number;
  };

  // Return policy (your store's rules)
  return_policy: string;

  // Optional
  reviews_summary?: {
    average_rating: number;
    total_reviews: number;
  };

  // Metadata
  metadata: {
    scraped_at: string;          // ISO timestamp
    source_language: string;     // "zh-CN" (not shown in UI)
    raw_data_ref?: string;       // Reference to original data
  };
}
```

### Variant Object
```typescript
interface Variant {
  id: string;                    // Internal SKU ID
  primary_option_id: string;     // Links to options.primary_option.id
  secondary_option_id?: string;  // Links to options.secondary_option.id
  price: number;                 // Price in CAD (defaults to product price)
  stock_status: "in_stock" | "out_of_stock" | "low_stock";
  stock_quantity?: number;       // Integer if known
  image_ids: string[];           // Image IDs for this variant
}
```

### Image Object
```typescript
interface Image {
  id: string;                    // Internal image ID
  source_url: string;            // Original URL
  role: "main" | "detail" | "variant" | "zoom";
  variant_binding?: {
    primary_option_id?: string;
    secondary_option_id?: string;
  };
  order_index: number;           // Display order
}
```

### User Object
```typescript
interface User {
  id: string;
  email: string;                 // Unique, lowercased
  password_hash: string;         // Never expose raw password
  name: string;                  // Display name
  created_at: string;
  updated_at: string;
  
  // Optional
  default_shipping_address?: Address;
  default_billing_address?: Address;
  phone?: string;
}

interface Address {
  full_name: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone: string;
}
```

### Cart Item
```typescript
interface CartItem {
  id: string;
  user_id?: string;              // If logged in
  session_id?: string;           // For guest carts
  product_id: string;
  variant_id: string;
  title: string;                 // English snapshot
  options_snapshot: {
    style_label?: string;        // "Style A" (NO color names)
    size_label?: string;         // "M"
  };
  unit_price: number;
  quantity: number;
  image_id: string;
}
```

### Order Object
```typescript
interface Order {
  id: string;
  user_id?: string;              // Nullable for guests
  status: "pending_payment" | "paid" | "cancelled" | "refunded";
  
  customer: {
    name: string;
    email: string;
    phone: string;
    shipping_address: Address;
  };
  
  items: {
    product_id: string;
    variant_id: string;
    title: string;
    options_snapshot: Record<string, string>;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
  
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    promo_discount: number;      // Always 0 for now
    grand_total: number;
  };
  
  promo_code?: string;           // Recorded but no discount yet
  
  payment: {
    method: "e_transfer";
    reference_code: string;      // Unique order reference
    instructions_snapshot: string;
  };
  
  created_at: string;
  updated_at: string;
}
```

---

## 🏗️ Page Structure

### 1. Product Detail Page (Main Focus)

#### Layout Grid (Desktop)
```
┌─────────────────────────────────────────────────────────────────┐
│  Header (Sticky)                                                 │
├────────┬──────────────────────┬──────────────────────────────────┤
│        │                      │  Product Title                   │
│ Thumb  │                      │  [$Price CAD]                    │
│ nail   │    Main Image        │  ✓ In Stock                      │
│ List   │    (Square)          │                                  │
│ (Left) │                      │  Style: [Style A] [Style B]      │
│        │                      │  Size:  [S] [M] [L] [XL]         │
│ Scroll │                      │  Quantity: [1]                   │
│ able   │                      │                                  │
│        │                      │  [Add to Cart] [Buy Now]         │
│        │                      │                                  │
│        ├──────────────────────┴──────────────────────────────────┤
│        │  [View Product Details ↓]                               │
├────────┴──────────────────────────────────────────────────────────┤
│  Store Info Block                                                │
├───────────────────────────────────────────────────────────────────┤
│  Shipping & Returns                                              │
├───────────────────────────────────────────────────────────────────┤
│  Details / Specifications                                        │
├───────────────────────────────────────────────────────────────────┤
│  Detail Images Section (Long Scroll)                            │
│  [Full-width detail images stacked vertically]                  │
└───────────────────────────────────────────────────────────────────┘
```

#### Layout Grid (Mobile)
```
┌────────────────────────────────┐
│  Header (Sticky)                │
├─────────────────────────────────┤
│                                 │
│      Main Image                 │
│      (Full Width)               │
│                                 │
├─────────────────────────────────┤
│  [Thumb] [Thumb] [Thumb] →      │
├─────────────────────────────────┤
│  Product Title                  │
│  [$Price CAD]                   │
│  ✓ In Stock                     │
│                                 │
│  Style: [Style A] [Style B]     │
│  Size:  [S] [M] [L]             │
│  Quantity: [1]                  │
│                                 │
│  [Add to Cart]                  │
├─────────────────────────────────┤
│  Store Info                     │
├─────────────────────────────────┤
│  Shipping & Returns             │
├─────────────────────────────────┤
│  Details                        │
├─────────────────────────────────┤
│  Detail Images                  │
│  (Long Scroll)                  │
└─────────────────────────────────┘
```

---

## 🎨 Component Specifications

### Header (Sticky)
```tsx
<header className="sticky top-0 z-50 border-b border-[#2C2C2C] bg-[#1E1E1E]/95 backdrop-blur">
  <div className="container mx-auto flex h-16 items-center justify-between px-4">
    {/* Left: Back to Shop */}
    <Link href="/shop" className="flex items-center gap-3">
      <ArrowLeft className="h-5 w-5" />
      <span className="text-lg font-heading font-bold tracking-wide uppercase">
        Shop
      </span>
    </Link>
    
    {/* Right: Navigation */}
    <nav className="flex gap-6 items-center">
      <Link href="/">Home</Link>
      <Link href="/account">Account</Link>
      <CartDrawer /> {/* Cart icon with badge */}
    </nav>
  </div>
</header>
```

**Styling:**
- Background: `bg-[#1E1E1E]/95` with `backdrop-blur`
- Border: `border-b border-[#2C2C2C]`
- Height: `h-16` (64px)
- Font: `font-heading` (Orbitron) for "SHOP"
- Links: Hover color `text-[#3D9A6C]`

---

### Image Gallery Component

#### Thumbnail List (Left Side - Desktop)
```tsx
<div className="hidden lg:flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
  {images.map((img, idx) => (
    <button
      key={idx}
      onClick={() => setSelectedImageIndex(idx)}
      className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
        selectedImageIndex === idx
          ? 'border-[#3D9A6C] ring-2 ring-[#3D9A6C]/30'
          : 'border-[#2C2C2C] hover:border-[#3D9A6C]/50'
      }`}
    >
      <Image src={img} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
    </button>
  ))}
</div>
```

**Styling:**
- Width: `w-20` (80px square)
- Border: Active = `border-[#3D9A6C]` with ring, Inactive = `border-[#2C2C2C]`
- Scrollbar: Custom green scrollbar (`.scrollbar-thin`)
- Max height: `max-h-[600px]`

#### Main Image Display (Center)
```tsx
<div className="relative aspect-square rounded-xl overflow-hidden border border-[#2C2C2C] bg-[#1E1E1E]">
  <Image
    src={images[selectedImageIndex]}
    alt={product.title}
    fill
    className="object-contain"
    priority
  />
  
  {/* Big Image Mode Button */}
  <button
    onClick={openBigImageMode}
    className="absolute top-4 right-4 p-2 bg-[#1E1E1E]/80 backdrop-blur rounded-lg hover:bg-[#2C2C2C] transition-colors"
  >
    <Maximize2 className="h-5 w-5" />
  </button>
</div>
```

**Styling:**
- Aspect ratio: `aspect-square` (1:1)
- Border: `border-[#2C2C2C]`
- Background: `bg-[#1E1E1E]` (for transparent images)
- Image fit: `object-contain` (no cropping)

#### Horizontal Thumbnails (Mobile)
```tsx
<div className="lg:hidden flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-thin">
  {images.map((img, idx) => (
    <button
      key={idx}
      onClick={() => setSelectedImageIndex(idx)}
      className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
        selectedImageIndex === idx ? 'border-[#3D9A6C]' : 'border-[#2C2C2C]'
      }`}
    >
      <Image src={img} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
    </button>
  ))}
</div>
```

**Styling:**
- Width: `w-16` (64px square on mobile)
- Scrollable: `overflow-x-auto` with custom scrollbar
- Flex gap: `gap-2` (8px)

---

### Big Image Mode (NEW)

**Requirements:**
- Full-screen or modal overlay
- Start at currently selected image
- Navigate through gallery with arrow keys or buttons
- Close with X button or ESC key
- Dark backdrop with blur

```tsx
{showBigImage && (
  <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
    {/* Close Button */}
    <button
      onClick={closeBigImage}
      className="absolute top-4 right-4 p-2 bg-[#1E1E1E] rounded-full hover:bg-[#2C2C2C] transition-colors z-10"
    >
      <X className="h-6 w-6" />
    </button>
    
    {/* Previous Button */}
    <button
      onClick={previousImage}
      disabled={selectedImageIndex === 0}
      className="absolute left-4 p-3 bg-[#1E1E1E] rounded-full hover:bg-[#2C2C2C] disabled:opacity-30 transition-colors"
    >
      <ChevronLeft className="h-8 w-8" />
    </button>
    
    {/* Main Image */}
    <div className="relative max-w-7xl max-h-[90vh] w-full h-full">
      <Image
        src={images[selectedImageIndex]}
        alt={product.title}
        fill
        className="object-contain"
        priority
      />
    </div>
    
    {/* Next Button */}
    <button
      onClick={nextImage}
      disabled={selectedImageIndex === images.length - 1}
      className="absolute right-4 p-3 bg-[#1E1E1E] rounded-full hover:bg-[#2C2C2C] disabled:opacity-30 transition-colors"
    >
      <ChevronRight className="h-8 w-8" />
    </button>
    
    {/* Image Counter */}
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#1E1E1E]/80 backdrop-blur rounded-full text-sm">
      {selectedImageIndex + 1} / {images.length}
    </div>
  </div>
)}
```

**Keyboard Controls:**
- ESC: Close big image mode
- Left Arrow: Previous image
- Right Arrow: Next image

---

### Product Info Section (Right Side)

#### Title & Category
```tsx
<div>
  <h1 className="text-3xl font-heading font-bold tracking-wide uppercase md:text-4xl text-[#F5F5F5]">
    {product.title}
  </h1>
  {product.category && (
    <span className="inline-block mt-2 text-xs px-3 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded-full font-medium font-heading uppercase tracking-wide">
      {product.category}
    </span>
  )}
</div>
```

**Styling:**
- Font: `font-heading` (Orbitron)
- Size: `text-3xl` (30px) on mobile, `text-4xl` (36px) on desktop
- Category badge: Green with 10% opacity background

#### Price Display
```tsx
<div className="flex items-center gap-4">
  <span className="text-3xl font-bold text-[#3D9A6C] font-mono">
    ${displayPrice.toFixed(2)}
  </span>
  <span className="text-xs text-[#A1A1A1] font-mono uppercase">CAD</span>
  
  {/* Optional: Market price (strikethrough) */}
  {product.pricing.market_price && (
    <span className="text-lg text-[#666] line-through font-mono">
      ${product.pricing.market_price.toFixed(2)}
    </span>
  )}
</div>
```

**Styling:**
- Font: `font-mono` (JetBrains Mono) for prices
- Color: `text-[#3D9A6C]` (green)
- Size: `text-3xl` (30px)
- Currency label: Small, muted gray

#### Stock Status
```tsx
<div className="text-sm">
  {displayStock > 0 ? (
    <span className="text-[#3D9A6C]">✓ In Stock</span>
  ) : displayStock === 0 ? (
    <span className="text-red-500">✗ Out of Stock</span>
  ) : (
    <span className="text-yellow-500">⚠ Low Stock ({displayStock} left)</span>
  )}
</div>
```

---

### Variant Selector (NO COLOR LABELS)

**CRITICAL:** Never display "Color" or actual color names. Use generic labels like "Style A", "Style B".

#### Multi-Dimensional Selector
```tsx
<div className="space-y-4">
  {/* Primary Option (e.g., "Style" - NOT "Color") */}
  <div>
    <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
      {optionType1}  {/* e.g., "Style" */}
      {selectedVariant?.optionValue1 && (
        <span className="ml-2 text-[#F5F5F5]">: {selectedVariant.optionValue1}</span>
      )}
    </label>
    <div className="flex gap-2 flex-wrap">
      {option1Values.map((value) => (
        <button
          key={value}
          onClick={() => handleOption1Change(value)}
          disabled={!isOption1Available(value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            isSelected
              ? "bg-[#3D9A6C] text-black border-[#3D9A6C] shadow-md"
              : isAvailable
                ? "bg-[#1E1E1E] text-[#F5F5F5] border-[#2C2C2C] hover:border-[#3D9A6C]/50"
                : "bg-[#1E1E1E] text-[#666] border-[#2C2C2C] opacity-50 cursor-not-allowed line-through"
          }`}
        >
          {value}  {/* e.g., "Style A", "Style B" */}
        </button>
      ))}
    </div>
  </div>

  {/* Secondary Option (e.g., "Size") */}
  <div>
    <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
      {optionType2}  {/* e.g., "Size" */}
      {selectedOption2 && (
        <span className="ml-2 text-[#F5F5F5]">: {selectedOption2}</span>
      )}
    </label>
    <div className="flex gap-2 flex-wrap">
      {option2Values.map((value) => (
        <button
          key={value}
          onClick={() => handleOption2Change(value)}
          disabled={!isOption2Available(value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            isSelected
              ? "bg-[#3D9A6C] text-black border-[#3D9A6C] shadow-md"
              : isAvailable
                ? "bg-[#1E1E1E] text-[#F5F5F5] border-[#2C2C2C] hover:border-[#3D9A6C]/50"
                : "bg-[#1E1E1E] text-[#666] border-[#2C2C2C] opacity-50 cursor-not-allowed line-through"
          }`}
        >
          {value}  {/* e.g., "S", "M", "L" */}
        </button>
      ))}
    </div>
  </div>
</div>
```

**Button States:**
- **Selected:** Green background (`bg-[#3D9A6C]`), black text
- **Available:** Dark background, white text, hover effect
- **Unavailable:** Gray text, line-through, disabled cursor

**Image Update Logic:**
```typescript
// When user selects primary option (Style):
// 1. Update gallery to show images bound to that primary_option_id
// 2. Set main image to first variant-specific image
// 3. Disable secondary options (sizes) that aren't available for this style

function handleOption1Change(value: string) {
  const newVariant = variants.find(v => v.optionValue1 === value);
  if (newVariant) {
    onChange(newVariant.id);
    
    // Update gallery images
    const variantImages = images.filter(img => 
      img.variant_binding?.primary_option_id === newVariant.primary_option_id
    );
    if (variantImages.length > 0) {
      setGalleryImages([...variantImages, ...genericImages]);
      setSelectedImageIndex(0);
    }
  }
}
```

---

### Quantity Selector
```tsx
<div className="flex items-center gap-3">
  <label className="text-sm font-medium text-[#A1A1A1]">Quantity:</label>
  <div className="flex items-center border border-[#2C2C2C] rounded-lg overflow-hidden">
    <button
      onClick={decreaseQuantity}
      disabled={quantity <= 1}
      className="px-3 py-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] disabled:opacity-30 transition-colors"
    >
      <Minus className="h-4 w-4" />
    </button>
    <input
      type="number"
      value={quantity}
      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
      min="1"
      max={maxQuantity}
      className="w-16 px-2 py-2 text-center bg-[#1E1E1E] border-x border-[#2C2C2C] focus:outline-none"
    />
    <button
      onClick={increaseQuantity}
      disabled={quantity >= maxQuantity}
      className="px-3 py-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] disabled:opacity-30 transition-colors"
    >
      <Plus className="h-4 w-4" />
    </button>
  </div>
</div>
```

---

### Add to Cart Button
```tsx
<button
  onClick={handleAddToCart}
  disabled={displayStock === 0 || !selectedVariant}
  className="w-full py-3 px-4 bg-[#3D9A6C] text-black hover:bg-[#4DB87F] rounded-xl font-medium font-heading uppercase tracking-wide transition-all flex items-center justify-center gap-2 hover:gap-3 hover:shadow-glow mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <ShoppingCart className="h-5 w-5" />
  {displayStock === 0 ? 'Out of Stock' : 'Add to Cart'}
</button>
```

**Styling:**
- Background: `bg-[#3D9A6C]` (green)
- Hover: `bg-[#4DB87F]` (lighter green) with glow shadow
- Font: `font-heading` (Orbitron)
- Height: `py-3` (12px padding = ~48px total)
- Disabled: 50% opacity, no hover effects

---

### Store Block (NEW)

```tsx
<section className="border-t border-[#2C2C2C] pt-8 pb-8">
  <div className="container mx-auto px-4">
    <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
      <div className="flex items-start gap-4">
        {/* Store Logo */}
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#2C2C2C] flex-shrink-0">
          <Image src="/store-logo.png" alt="Store" fill className="object-cover" />
        </div>
        
        {/* Store Info */}
        <div className="flex-1">
          <h3 className="text-lg font-heading font-bold text-[#F5F5F5]">
            Protocol Zero Airsoft
          </h3>
          <p className="text-sm text-[#A1A1A1] mt-1">
            Premium tactical gear and airsoft equipment
          </p>
          
          {/* Trust Badges */}
          <div className="flex gap-3 mt-3">
            <span className="text-xs px-2 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded">
              ✓ Verified Seller
            </span>
            <span className="text-xs px-2 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded">
              ✓ Fast Shipping
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

### Shipping & Returns (NEW)

```tsx
<section className="border-t border-[#2C2C2C] pt-8 pb-8">
  <div className="container mx-auto px-4">
    <h2 className="text-xl font-heading font-bold tracking-wide uppercase text-[#F5F5F5] mb-4">
      Shipping & Returns
    </h2>
    
    <div className="grid md:grid-cols-2 gap-6">
      {/* Shipping Info */}
      <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
        <div className="flex items-center gap-3 mb-3">
          <Truck className="h-5 w-5 text-[#3D9A6C]" />
          <h3 className="font-medium text-[#F5F5F5]">Shipping Information</h3>
        </div>
        <ul className="space-y-2 text-sm text-[#A1A1A1]">
          <li>• Ships from: {product.shipping.ship_from}</li>
          <li>• Delivery time: 5-10 business days</li>
          <li>• Tracking provided</li>
          <li>• {product.shipping.shipping_fee_type === 'flat' 
              ? `Flat rate: $${product.shipping.shipping_fee_value} CAD` 
              : 'Free shipping on orders over $50'}</li>
        </ul>
      </div>
      
      {/* Return Policy */}
      <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
        <div className="flex items-center gap-3 mb-3">
          <RefreshCw className="h-5 w-5 text-[#3D9A6C]" />
          <h3 className="font-medium text-[#F5F5F5]">Return Policy</h3>
        </div>
        <p className="text-sm text-[#A1A1A1]">
          {product.return_policy || "30-day return policy. Items must be unused and in original packaging."}
        </p>
      </div>
    </div>
  </div>
</section>
```

---

### Details / Specifications (NEW)

```tsx
<section className="border-t border-[#2C2C2C] pt-8 pb-8">
  <div className="container mx-auto px-4">
    <h2 className="text-xl font-heading font-bold tracking-wide uppercase text-[#F5F5F5] mb-4">
      Product Details
    </h2>
    
    <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
      {/* Attributes Table */}
      <table className="w-full">
        <tbody>
          {Object.entries(product.attributes).map(([key, value]) => (
            <tr key={key} className="border-b border-[#2C2C2C] last:border-b-0">
              <td className="py-3 text-sm text-[#A1A1A1] capitalize">
                {key.replace(/_/g, ' ')}
              </td>
              <td className="py-3 text-sm text-[#F5F5F5] text-right">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Description HTML */}
      {product.description_html && (
        <div 
          className="mt-6 pt-6 border-t border-[#2C2C2C] prose prose-invert max-w-none text-[#A1A1A1]"
          dangerouslySetInnerHTML={{ __html: product.description_html }}
        />
      )}
    </div>
  </div>
</section>
```

---

### Detail Images Section

```tsx
<section ref={detailsRef} className="border-t border-[#2C2C2C] pt-8">
  <div className="text-center mb-6">
    <h2 className="text-xl font-heading font-bold tracking-wide uppercase text-[#F5F5F5]">
      Product Details
    </h2>
    <p className="text-sm text-[#A1A1A1] mt-1">
      Scroll down to see full product information
    </p>
  </div>
  
  <div className="max-w-3xl mx-auto space-y-4">
    {product.images.detail_images.map((img, idx) => (
      <Image
        key={idx}
        src={img}
        alt={`${product.title} detail ${idx + 1}`}
        width={1200}
        height={2000}
        className="rounded-xl border border-[#2C2C2C] w-full h-auto"
        loading="lazy"
      />
    ))}
  </div>
</section>
```

**Styling:**
- Max width: `max-w-3xl` (768px)
- Spacing: `space-y-4` (16px between images)
- Border: `border-[#2C2C2C]`
- Loading: Lazy load for performance

---

## 🔐 Authentication Pages

### Login Page

```tsx
<div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
  <div className="w-full max-w-md">
    <div className="bg-[#1E1E1E] rounded-xl p-8 border border-[#2C2C2C]">
      <h1 className="text-2xl font-heading font-bold text-center mb-6">
        Log In
      </h1>
      
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none transition-colors"
            required
          />
        </div>
        
        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none transition-colors"
            required
          />
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        
        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#3D9A6C] text-black font-heading font-medium uppercase tracking-wide rounded-lg hover:bg-[#4DB87F] transition-colors disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      
      {/* Sign Up Link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-[#A1A1A1]">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-[#3D9A6C] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  </div>
</div>
```

### Sign Up Page

```tsx
<div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
  <div className="w-full max-w-md">
    <div className="bg-[#1E1E1E] rounded-xl p-8 border border-[#2C2C2C]">
      <h1 className="text-2xl font-heading font-bold text-center mb-6">
        Create Account
      </h1>
      
      <form onSubmit={handleSignup} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none transition-colors"
            required
          />
        </div>
        
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none transition-colors"
            required
          />
        </div>
        
        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none transition-colors"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-[#666]">
            At least 8 characters
          </p>
        </div>
        
        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none transition-colors"
            required
          />
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        
        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#3D9A6C] text-black font-heading font-medium uppercase tracking-wide rounded-lg hover:bg-[#4DB87F] transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
      
      {/* Login Link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-[#A1A1A1]">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#3D9A6C] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  </div>
</div>
```

---

## 🛒 Cart & Checkout

### Cart Page

```tsx
<div className="min-h-screen bg-[#0D0D0D]">
  <Header />
  
  <main className="container mx-auto px-4 py-8">
    <h1 className="text-3xl font-heading font-bold tracking-wide uppercase mb-8">
      Shopping Cart
    </h1>
    
    {cart.items.length === 0 ? (
      <div className="text-center py-12">
        <ShoppingCart className="h-16 w-16 mx-auto text-[#666] mb-4" />
        <p className="text-[#A1A1A1] mb-4">Your cart is empty</p>
        <Link 
          href="/shop" 
          className="inline-block px-6 py-3 bg-[#3D9A6C] text-black font-heading font-medium uppercase tracking-wide rounded-lg hover:bg-[#4DB87F] transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    ) : (
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <div key={item.id} className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2C2C2C]">
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#2C2C2C] flex-shrink-0">
                  <Image src={item.image_id} alt={item.title} fill className="object-cover" />
                </div>
                
                {/* Info */}
                <div className="flex-1">
                  <h3 className="font-medium text-[#F5F5F5]">{item.title}</h3>
                  <p className="text-sm text-[#A1A1A1] mt-1">
                    {item.options_snapshot.style_label && `Style: ${item.options_snapshot.style_label}`}
                    {item.options_snapshot.style_label && item.options_snapshot.size_label && ' • '}
                    {item.options_snapshot.size_label && `Size: ${item.options_snapshot.size_label}`}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-3">
                    {/* Quantity */}
                    <div className="flex items-center border border-[#2C2C2C] rounded-lg overflow-hidden">
                      <button
                        onClick={() => decreaseQuantity(item.id)}
                        className="px-2 py-1 hover:bg-[#2C2C2C] transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-3 text-sm">{item.quantity}</span>
                      <button
                        onClick={() => increaseQuantity(item.id)}
                        className="px-2 py-1 hover:bg-[#2C2C2C] transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    
                    {/* Price */}
                    <span className="text-sm font-mono text-[#3D9A6C]">
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                    
                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-auto text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C] sticky top-20">
            <h2 className="text-lg font-heading font-bold mb-4">Order Summary</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A1A1A1]">Subtotal</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A1A1A1]">Shipping</span>
                <span className="font-mono">${shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A1A1A1]">Tax (13%)</span>
                <span className="font-mono">${tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#2C2C2C] pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="font-mono text-[#3D9A6C]">${total.toFixed(2)} CAD</span>
              </div>
            </div>
            
            <Link
              href="/checkout"
              className="block w-full mt-6 py-3 bg-[#3D9A6C] text-black text-center font-heading font-medium uppercase tracking-wide rounded-lg hover:bg-[#4DB87F] transition-colors"
            >
              Proceed to Checkout
            </Link>
          </div>
        </div>
      </div>
    )}
  </main>
</div>
```

---

### Checkout Page (E-Transfer Only)

```tsx
<div className="min-h-screen bg-[#0D0D0D]">
  <Header />
  
  <main className="container mx-auto px-4 py-8 max-w-4xl">
    <h1 className="text-3xl font-heading font-bold tracking-wide uppercase mb-8">
      Checkout
    </h1>
    
    <form onSubmit={handleCheckout} className="space-y-8">
      {/* Contact Information */}
      <section className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
        <h2 className="text-lg font-heading font-bold mb-4">Contact Information</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
              Phone *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
              required
            />
          </div>
        </div>
      </section>
      
      {/* Shipping Address */}
      <section className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
        <h2 className="text-lg font-heading font-bold mb-4">Shipping Address</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
              Address Line 1 *
            </label>
            <input
              type="text"
              value={address.line1}
              onChange={(e) => setAddress({...address, line1: e.target.value})}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
              Address Line 2 (Optional)
            </label>
            <input
              type="text"
              value={address.line2}
              onChange={(e) => setAddress({...address, line2: e.target.value})}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
            />
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
                City *
              </label>
              <input
                type="text"
                value={address.city}
                onChange={(e) => setAddress({...address, city: e.target.value})}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
                Province *
              </label>
              <select
                value={address.province}
                onChange={(e) => setAddress({...address, province: e.target.value})}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
                required
              >
                <option value="">Select</option>
                <option value="ON">Ontario</option>
                <option value="QC">Quebec</option>
                <option value="BC">British Columbia</option>
                <option value="AB">Alberta</option>
                {/* ... other provinces */}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
                Postal Code *
              </label>
              <input
                type="text"
                value={address.postal_code}
                onChange={(e) => setAddress({...address, postal_code: e.target.value})}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
                placeholder="A1A 1A1"
                required
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Promo Code (Placeholder) */}
      <section className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
        <h2 className="text-lg font-heading font-bold mb-4">Promo Code</h2>
        
        <div className="flex gap-3">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="flex-1 px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:border-[#3D9A6C] focus:outline-none"
          />
          <button
            type="button"
            onClick={applyPromoCode}
            className="px-6 py-3 bg-[#2C2C2C] text-[#F5F5F5] font-medium rounded-lg hover:bg-[#3D9A6C]/20 hover:text-[#3D9A6C] transition-colors"
          >
            Apply
          </button>
        </div>
        
        {promoMessage && (
          <p className="mt-3 text-sm text-[#E4B100]">
            ℹ️ {promoMessage}
          </p>
        )}
      </section>
      
      {/* Order Summary */}
      <section className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
        <h2 className="text-lg font-heading font-bold mb-4">Order Summary</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#A1A1A1]">Subtotal</span>
            <span className="font-mono">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#A1A1A1]">Shipping</span>
            <span className="font-mono">${shipping.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#A1A1A1]">Tax (13%)</span>
            <span className="font-mono">${tax.toFixed(2)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#3D9A6C]">Promo Discount</span>
              <span className="font-mono text-[#3D9A6C]">-${promoDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-[#2C2C2C] pt-3 flex justify-between text-xl font-bold">
            <span>Total</span>
            <span className="font-mono text-[#3D9A6C]">${total.toFixed(2)} CAD</span>
          </div>
        </div>
      </section>
      
      {/* Payment Method */}
      <section className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
        <h2 className="text-lg font-heading font-bold mb-4">Payment Method</h2>
        
        <div className="bg-[#0D0D0D] rounded-lg p-4 border-2 border-[#3D9A6C]">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="h-5 w-5 text-[#3D9A6C]" />
            <span className="font-medium">E-Transfer (Interac)</span>
            <span className="ml-auto text-xs px-2 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded">
              Only method
            </span>
          </div>
          <p className="text-sm text-[#A1A1A1]">
            You will receive payment instructions after placing your order.
          </p>
        </div>
      </section>
      
      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-[#3D9A6C] text-black font-heading font-medium uppercase tracking-wide rounded-xl hover:bg-[#4DB87F] transition-colors disabled:opacity-50 text-lg"
      >
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </form>
  </main>
</div>
```

**Promo Code Logic (Placeholder):**
```typescript
function applyPromoCode() {
  // Validate format
  if (promoCode.length < 4) {
    setPromoMessage("Please enter a valid promo code");
    return;
  }
  
  // Record code but don't apply discount yet
  setPromoMessage("Promo code has been recorded. Discounts will be enabled in a future update.");
  setPromoDiscount(0); // Always 0 for now
}
```

---

### Order Confirmation Page

```tsx
<div className="min-h-screen bg-[#0D0D0D]">
  <Header />
  
  <main className="container mx-auto px-4 py-8 max-w-2xl">
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-[#3D9A6C]/10 rounded-full mb-4">
        <CheckCircle className="h-8 w-8 text-[#3D9A6C]" />
      </div>
      <h1 className="text-3xl font-heading font-bold tracking-wide uppercase mb-2">
        Order Placed!
      </h1>
      <p className="text-[#A1A1A1]">
        Thank you for your order. Please complete payment to proceed.
      </p>
    </div>
    
    {/* Order Details */}
    <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C] mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-[#A1A1A1]">Order Number</p>
          <p className="text-lg font-heading font-bold">{order.id}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-[#A1A1A1]">Total Amount</p>
          <p className="text-2xl font-mono text-[#3D9A6C]">
            ${order.totals.grand_total.toFixed(2)} CAD
          </p>
        </div>
      </div>
      
      <div className="border-t border-[#2C2C2C] pt-4">
        <p className="text-sm text-[#A1A1A1] mb-1">Status</p>
        <span className="inline-block px-3 py-1 bg-[#E4B100]/10 text-[#E4B100] text-sm rounded-full">
          ⏳ Awaiting Payment
        </span>
      </div>
    </div>
    
    {/* E-Transfer Instructions */}
    <div className="bg-[#3D9A6C]/5 rounded-xl p-6 border border-[#3D9A6C]/30 mb-6">
      <h2 className="text-lg font-heading font-bold mb-4">
        Payment Instructions (E-Transfer)
      </h2>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-[#A1A1A1] mb-1">Send E-Transfer to:</p>
          <p className="text-lg font-mono text-[#F5F5F5]">
            payment@protocolzero.ca
          </p>
        </div>
        
        <div>
          <p className="text-sm text-[#A1A1A1] mb-1">Amount:</p>
          <p className="text-lg font-mono text-[#3D9A6C]">
            ${order.totals.grand_total.toFixed(2)} CAD
          </p>
        </div>
        
        <div>
          <p className="text-sm text-[#A1A1A1] mb-1">
            Reference Code (include in message):
          </p>
          <div className="flex items-center gap-2 bg-[#0D0D0D] px-4 py-3 rounded-lg border border-[#2C2C2C]">
            <code className="flex-1 font-mono text-[#F5F5F5]">
              {order.payment.reference_code}
            </code>
            <button
              onClick={() => copyToClipboard(order.payment.reference_code)}
              className="p-2 hover:bg-[#2C2C2C] rounded transition-colors"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="bg-[#0D0D0D] rounded-lg p-4 border border-[#2C2C2C]">
          <p className="text-sm text-[#A1A1A1] leading-relaxed">
            <strong className="text-[#F5F5F5]">Important:</strong> Please include the reference code in your E-Transfer message. Once we receive your payment, we'll send you a confirmation email and begin processing your order.
          </p>
        </div>
      </div>
    </div>
    
    {/* Order Items */}
    <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2C2C2C]">
      <h2 className="text-lg font-heading font-bold mb-4">Order Items</h2>
      
      <div className="space-y-4">
        {order.items.map((item) => (
          <div key={item.variant_id} className="flex gap-4">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#2C2C2C] flex-shrink-0">
              <Image src={item.image} alt={item.title} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-[#F5F5F5]">{item.title}</p>
              <p className="text-sm text-[#A1A1A1]">
                {Object.entries(item.options_snapshot).map(([key, value]) => `${key}: ${value}`).join(' • ')}
              </p>
              <p className="text-sm text-[#A1A1A1]">Qty: {item.quantity}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[#F5F5F5]">
                ${item.line_total.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
    
    <div className="text-center mt-8">
      <Link
        href="/shop"
        className="inline-block px-6 py-3 bg-[#2C2C2C] text-[#F5F5F5] font-heading font-medium uppercase tracking-wide rounded-lg hover:bg-[#3D9A6C] hover:text-black transition-colors"
      >
        Continue Shopping
      </Link>
    </div>
  </main>
</div>
```

---

## 🎯 Variant Selection & Image Update Logic

### State Management
```typescript
const [selectedPrimaryOptionId, setSelectedPrimaryOptionId] = useState<string | null>(null);
const [selectedSecondaryOptionId, setSelectedSecondaryOptionId] = useState<string | null>(null);
const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
const [galleryImages, setGalleryImages] = useState<Image[]>([]);
const [selectedImageIndex, setSelectedImageIndex] = useState(0);
```

### Selection Flow
```typescript
// When user selects primary option (Style):
function handlePrimaryOptionChange(optionId: string) {
  setSelectedPrimaryOptionId(optionId);
  
  // 1. Filter variants by this primary option
  const matchingVariants = variants.filter(v => v.primary_option_id === optionId);
  
  // 2. Get available secondary options (sizes) for this style
  const availableSecondaryOptions = new Set(
    matchingVariants
      .filter(v => v.stock_status === 'in_stock')
      .map(v => v.secondary_option_id)
      .filter(Boolean)
  );
  
  // 3. Clear secondary selection if it becomes invalid
  if (selectedSecondaryOptionId && !availableSecondaryOptions.has(selectedSecondaryOptionId)) {
    setSelectedSecondaryOptionId(null);
  }
  
  // 4. Update gallery images
  const variantImages = product.images.all.filter(img => 
    img.variant_binding?.primary_option_id === optionId
  );
  const genericImages = product.images.all.filter(img => !img.variant_binding);
  setGalleryImages([...variantImages, ...genericImages]);
  setSelectedImageIndex(0); // Reset to first image
  
  // 5. Find matching variant
  updateSelectedVariant(optionId, selectedSecondaryOptionId);
}

// When user selects secondary option (Size):
function handleSecondaryOptionChange(optionId: string) {
  setSelectedSecondaryOptionId(optionId);
  updateSelectedVariant(selectedPrimaryOptionId, optionId);
}

// Update selected variant
function updateSelectedVariant(primary: string | null, secondary: string | null) {
  const variant = variants.find(v => 
    v.primary_option_id === primary &&
    (!v.secondary_option_id || v.secondary_option_id === secondary)
  );
  
  if (variant) {
    setSelectedVariantId(variant.id);
  } else {
    setSelectedVariantId(null);
  }
}
```

### Disable Logic
```typescript
// Check if primary option is available (has any in-stock variants)
function isPrimaryOptionAvailable(optionId: string): boolean {
  return variants.some(v => 
    v.primary_option_id === optionId && 
    v.stock_status === 'in_stock'
  );
}

// Check if secondary option is available (for selected primary option)
function isSecondaryOptionAvailable(optionId: string): boolean {
  if (!selectedPrimaryOptionId) return false;
  
  return variants.some(v => 
    v.primary_option_id === selectedPrimaryOptionId &&
    v.secondary_option_id === optionId &&
    v.stock_status === 'in_stock'
  );
}
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
@media (max-width: 640px) {
  /* sm: 640px */
  - Stack all sections vertically
  - Horizontal thumbnail scroll
  - Full-width buttons
}

@media (min-width: 768px) {
  /* md: 768px */
  - 2-column grid for forms
  - Side-by-side cart summary
}

@media (min-width: 1024px) {
  /* lg: 1024px */
  - 3-column product layout (thumbnails, image, info)
  - Sticky header
  - Vertical thumbnail list
}

@media (min-width: 1280px) {
  /* xl: 1280px */
  - Max container width
  - Larger images
}
```

---

## ⚡ Performance Optimizations

1. **Image Loading:**
   - Use Next.js `<Image>` component
   - Priority load main image
   - Lazy load detail images
   - Responsive image sizes

2. **Code Splitting:**
   - Dynamic imports for big image mode
   - Lazy load checkout components
   - Split vendor bundles

3. **Caching:**
   - Cache product data (60 seconds)
   - Cache images (forever)
   - Revalidate on cart changes

4. **Database:**
   - Index on product_id
   - Index on variant_id
   - Index on user_id

---

## 🎨 Animation Guidelines

```css
/* All transitions should be smooth */
transition-property: all;
transition-duration: 150ms;  /* Fast interactions */
transition-timing-function: ease-in-out;

/* Hover states */
- Scale: 1.02-1.05
- Brightness: 1.1
- Shadow: Add glow

/* Loading states */
- Spinner with green accent
- Skeleton loaders with pulse

/* Micro-interactions */
- Button hover: gap increase (gap-2 → gap-3)
- Image hover: scale-105
- Link hover: color change with underline
```

---

## 🚀 V-Zero Implementation Checklist

### Phase 1: Core Product Page
- [ ] Header with navigation
- [ ] Image gallery (thumbnails + main)
- [ ] Big image mode modal
- [ ] Product info section
- [ ] Variant selector (NO color labels)
- [ ] Add to cart button
- [ ] Store block
- [ ] Shipping & returns
- [ ] Details/specifications
- [ ] Detail images scroll

### Phase 2: Authentication
- [ ] Login page
- [ ] Sign up page
- [ ] User session management
- [ ] Protected routes

### Phase 3: Cart & Checkout
- [ ] Cart page with items
- [ ] Quantity adjustment
- [ ] Remove items
- [ ] Checkout form
- [ ] E-Transfer instructions
- [ ] Order confirmation
- [ ] Promo code field (placeholder)

### Phase 4: Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Mobile responsiveness
- [ ] Keyboard navigation
- [ ] Accessibility (ARIA labels)

---

## 📝 Final Notes for V-Zero

1. **NO COLOR LABELS:** Absolutely critical - never display color names. Use "Style 1", "Style 2", etc.

2. **English Only:** All UI text must be in English. Never render Chinese characters.

3. **Design Consistency:** Follow the exact color palette and typography specified.

4. **Component Reusability:** Create reusable components for buttons, inputs, cards.

5. **Type Safety:** Use TypeScript interfaces provided for all data structures.

6. **Accessibility:** Include proper ARIA labels, keyboard navigation, focus states.

7. **Testing:** Test on mobile, tablet, desktop. Test with screen readers.

---

**End of Build Guide**

This specification provides everything V-Zero needs to build the frontend. All components, styling, logic, and flows are defined. Let me know if you need any clarifications!
