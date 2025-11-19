# Protocol Zero - Integrated E-Commerce Platform

**Automated Taobao Product Scraping + Next.js E-Commerce Shop**

**Status:** 🟢 Scraper 95% Complete | Shop Integration 90% Complete

📋 **[View Full TODO List](TODO.md)** | 🗺️ **[Integration Roadmap](INTEGRATION_ROADMAP.md)** | 📖 **[Setup Guide](SETUP.md)**

## 🏗️ Monorepo Structure

```
protocol-zero/
├── scraper/          # Python Selenium scraper for Taobao/Tmall
├── shop/            # Next.js 14 e-commerce storefront
└── shared/          # Data bridge between scraper and shop
    ├── media/       # Product images (source of truth)
    ├── data/        # JSON manifests and sync files
    └── scripts/     # Automation scripts
```

## 🚀 Quick Start

### Prerequisites
- Python 3.12+ with pip
- Node.js 18+ with npm
- Google Chrome browser
- PostgreSQL database (for shop)

### Setup Scraper
```bash
cd scraper
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install selenium requests pillow
```

### Setup Shop
```bash
cd shop
npm install
cp .env.example .env.local
# Edit .env.local with your database and Firebase credentials
npx prisma generate
npx prisma db push
npm run dev
```

## 📦 Projects

### Scraper (`/scraper`)
**Technology**: Python 3.12, Selenium WebDriver

**Features**:
- Automated Taobao/Tmall product extraction
- Rule-based Chinese→English translation (tactical gear vocabulary)
- Per-variant price scraping with CNY→CAD conversion (0.202 rate + $15 shipping)
- Multi-layer media capture: Main/Detail/Catalogue images
- Persistent Chrome profile for login preservation
- Selenium Manager auto-recovery for driver version matching

**Usage**:
```bash
cd scraper
# One-time: Login to Taobao
python scraper.py --login-setup

# Add URLs to taobao_links.txt, then run:
python scraper.py
```

**Outputs**:
- `../shared/data/products_manifest.json` - Shop-compatible product catalog
- `../shared/media/product_*/` - Organized media files
- `protocol_zero_variants.csv` - Detailed variant data

### Shop (`/shop`)
**Technology**: Next.js 14, React, TypeScript, Prisma, PostgreSQL, Firebase

**Features**:
- Server-side rendered e-commerce platform
- Product catalog with variants and options
- Shopping cart with persistent storage
- User authentication (NextAuth + Firebase)
- Admin panel for order management
- Responsive design with Tailwind CSS + Radix UI

**Key Routes**:
- `/` - Homepage with featured products
- `/shop` - Product catalog
- `/shop/[id]` - Product detail page
- `/cart` - Shopping cart
- `/checkout` - Checkout flow
- `/admin` - Admin dashboard
- `/admin/scraper` - Scrape queue management (upcoming)

**Development**:
```bash
cd shop
npm run dev
# Visit http://localhost:3000
```

**Production**:
```bash
npm run build
npm start
```

## 🔄 Integration Workflow

### Data Flow: Scraper → Shop

1. **Scrape Products**
   ```bash
   cd scraper
   python scraper.py
   ```
   Outputs: `shared/data/products_manifest.json` + media files

2. **Sync Media to Shop**
   ```bash
   cd shared/scripts
   node sync-media.js
   ```
   Copies images from `shared/media/` → `shop/public/images/`

3. **Generate TypeScript Products**
   ```bash
   node generate-products.js
   ```
   Creates `shop/lib/products.generated.ts` from JSON manifest

4. **Shop Auto-Detects**
   - `shop/lib/products.ts` imports `generatedProducts`
   - If generated products exist, uses them; otherwise falls back to base products

### Bi-Directional Communication

**Shop → Scraper** (Scrape Queue):
- Admin adds Taobao URL via `/admin/scraper`
- Appends to `shared/data/scrape_queue.json`
- Scraper reads queue, processes, marks complete

**Scraper → Shop** (Catalog Sync):
- `shared/data/catalog_index.json` tracks existing products
- Prevents duplicate scraping
- Detects price changes for updates

## 🤖 Automation

### Manual Sync
```bash
cd scraper && python scraper.py
cd ../shared/scripts && node sync-media.js && node generate-products.js
cd ../../shop && npm run build
```

### GitHub Actions (Recommended)
See `.github/workflows/sync-products.yml`:
- Daily scrape at 2 AM
- Automatic media sync
- Auto-generate TypeScript products
- Commit and push changes

## 📂 Shared Directory

### `shared/media/`
Organized product images (source of truth):
```
media/
├── product_1_molle-pda/
│   ├── Main.jpg
│   ├── Detail_01.jpg
│   └── ...
└── product_2_m67-grenade/
    └── ...
```

### `shared/data/`
- `products_manifest.json` - Shop-compatible product catalog
- `protocol_zero_variants.csv` - Raw scraper output
- `scrape_queue.json` - Shop → Scraper requests
- `catalog_index.json` - Duplicate detection index

### `shared/scripts/`
- `sync-media.js` - Copy media → shop/public/images/
- `generate-products.js` - JSON → products.generated.ts
- `watch-queue.py` - Monitor scrape_queue.json (optional)

## 🛠️ Development

### Adding New Products

1. **Via Scraper**:
   Add URLs to `scraper/taobao_links.txt`, run scraper

2. **Via Shop Admin** (upcoming):
   Go to `/admin/scraper`, paste Taobao URL, submit

### Product Data Structure

```typescript
type Product = {
  id: string              // Slug from translated title
  sku: string            // Auto-generated SKU
  title: string          // English translated title
  price_cad: number      // Final CAD price
  primaryImage: string   // Main product image
  images: string[]       // All product images
  url: string            // Original Taobao URL
  category?: string      // Auto-categorized
  description?: string   // Product description
  options?: {            // Variants (color, size, etc.)
    name: string
    values: string[]
  }[]
  variants?: {           // Per-variant data
    option: string
    price_cad: number
    image?: string
  }[]
}
```

## 🔒 Security

- `.env` files excluded from git
- Shop requires authentication for checkout
- Admin routes protected
- Scraper cookies stored locally (not committed)

## 📝 Documentation

- [Scraper README](scraper/README.md) - Detailed scraper documentation
- [Shop README](shop/README.md) - Shop setup and features
- [Integration Plan](scraper/INTEGRATION_PLAN.md) - Architecture details
- [Scraper Requirements](shop/SCRAPER_REQUIREMENTS.md) - Original requirements

## 🤝 Contributing

1. Work on feature branches
2. Test scraper output before committing
3. Run `npm run lint` in shop before pushing
4. Update documentation for new features

## 📄 License

- Scraper: MIT License
- Shop: MIT License
- ChromeDriver: See [THIRD_PARTY_NOTICES.chromedriver](scraper/THIRD_PARTY_NOTICES.chromedriver)

## 🐛 Troubleshooting

### Scraper Issues
- **Timeout errors**: Manually solve CAPTCHAs in Chrome window
- **Price showing 0.0**: Taobao may require login or has price protection
- **Translation failures**: Check translation dictionaries in scraper.py

### Shop Issues
- **Database errors**: Run `npx prisma db push` to sync schema
- **Images not showing**: Run `cd shared/scripts && node sync-media.js`
- **Products not updating**: Check `shop/lib/products.generated.ts` was created

## 📞 Support

For issues:
1. Check relevant README files
2. Review `.log` files in scraper/
3. Check browser console for shop errors
4. Review GitHub issues

---

**Built with** ❤️ **for Protocol Zero Airsoft**
