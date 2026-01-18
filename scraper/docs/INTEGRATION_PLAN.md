# Protocol Zero Scraper + Shop Integration Plan

**Status**: ✅ **Phases 1-4 Complete** | ⏳ **Phase 5 Pending** (Automation)

**Last Updated**: November 18, 2025

## 🎉 What's Working Now

✅ **Monorepo structure** with scraper/, shop/, shared/  
✅ **Scraper** extracts products with correct prices (券后/优惠前)  
✅ **Gemini AI translation** removes brand names, keeps military designations  
✅ **Image capture** with hero/gallery/detail stitching  
✅ **CSV export** with all variant data  
✅ **Manifest generation** (export_manifest.py)  
✅ **Media sync** (sync-media.js)  
✅ **Product generation** (generate-products.js → products.generated.ts)  
✅ **Bi-directional sync** infrastructure (scrape_queue.json, catalog_index.json)  

## ⏳ What's Next

1. **Admin UI** for scrape queue management (shop/app/admin/scraper/page.tsx)
2. **GitHub Actions** for automated nightly sync
3. **Error notifications** (email/Slack alerts)
4. **Pipeline documentation** for team onboarding

---

## Current Architecture Analysis ✅ **MONOREPO COMPLETE**

### **Scraper Project** (`/protocol-zero/scraper/`) ✅
- **Technology**: Python 3.12, Selenium WebDriver
- **Purpose**: Automated Taobao/Tmall data extraction
- **Outputs**: 
  - CSV: `protocol_zero_variants.csv` (product variants with translations & pricing) ✅
  - Media: `media/product_{index}_{slug}/` (Main/Details/Catalogue images) ✅
  - Cookies: `taobao_cookies.json` (persistent Taobao login) ✅
- **Key Features**: 
  - ~~Rule-based Chinese→English translation~~ → **Gemini AI translation** (airsoft/military context) ✅
  - Per-variant price scraping with CNY→CAD conversion (0.202 rate + $15 shipping) ✅
  - 券后/优惠前 price extraction with parent container traversal ✅
  - Persistent Chrome profile for login preservation ✅
  - Selenium Manager auto-recovery ✅
  - Hero/gallery capture with video skipping ✅
  - Detail image stitching to Details_Long.jpg ✅

### **Shop Website** (`/protocol-zero/shop/`) ✅
- **Technology**: Next.js 14 (React), TypeScript, Prisma ORM, PostgreSQL, Firebase
- **Purpose**: E-commerce storefront
- **Current Product System**: 
  - Static TypeScript file: `lib/products.ts` (baseProducts array) ✅
  - Generated file: `lib/products.generated.ts` (scraped products, already exists!) ✅
  - Images: `public/images/` (126 existing images) ✅
  - Product interface: id, sku, title, price_cad, primaryImage, images[], url, category, description, options[] ✅
- **Key Routes**: `/shop`, `/shop/[id]`, `/cart`, `/checkout`, `/admin` ✅

### **Shared Resources** (`/protocol-zero/shared/`) ✅
- **Data**: 
  - `catalog_index.json` ✅ (duplicate detection)
  - `products_manifest.json` ✅ (shop-compatible JSON)
  - `scrape_queue.json` ✅ (shop → scraper requests)
- **Media**: Product images (source of truth) ✅
- **Scripts**: 
  - `sync-media.js` ✅ (copy media → shop/public/images/)
  - `generate-products.js` ✅ (manifest → products.generated.ts)
  - `export_manifest.py` ✅ (CSV → manifest JSON)

---

## Integration Strategy

### Phase 1: Project Structure Consolidation ✅ **COMPLETE**

#### **Option A: Monorepo** ✅ **IMPLEMENTED**
~~Merge both projects into a unified repository with clear separation:~~ **Already done:**

```
protocol-zero/
├── scraper/                    # Python scraper (moved from Protocol Z Scraper)
│   ├── scraper.py
│   ├── taobao_links.txt
│   ├── taobao_cookies.json
│   ├── chrome_profile_selenium/
│   ├── requirements.txt
│   ├── .venv/
│   └── README.md
│
├── shop/                       # Next.js shop (moved from protocol-zero-shop)
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── prisma/
│   ├── package.json
│   └── README.md
│
├── shared/                     # Shared resources
│   ├── media/                  # Scraped product media (symlinked/copied to shop/public/images/)
│   ├── data/
│   │   ├── protocol_zero_variants.csv
│   │   └── products_manifest.json
│   └── scripts/
│       ├── sync-media.js       # Copy media → shop/public/images/
│       └── generate-products.js # CSV → products.generated.ts
│
├── .gitignore                  # Combined gitignore
├── README.md                   # Master documentation
└── docker-compose.yml          # Optional: containerized setup

```

**Pros**: 
- Single repo for version control and deployment
- Shared scripts between scraper and shop
- Clear separation of concerns
- Easy CI/CD pipeline

**Cons**: 
- Mixed tech stacks (Python + Node.js)
- Larger repository size

---

#### **Option B: Separate Repos with Shared Storage**
Keep projects separate but connected via shared directory:

```
/Users/5425855/Documents/
├── protocol-zero-scraper/      # Scraper repo (current)
│   └── output/
│       ├── media/ → /shared/media (symlink)
│       └── protocol_zero_variants.csv → /shared/data/
│
├── protocol-zero-shop/         # Shop repo (current)
│   └── public/images/ ← synced from /shared/media
│
└── protocol-zero-shared/       # New shared storage repo
    ├── media/                  # Source of truth for product images
    ├── data/
    │   ├── protocol_zero_variants.csv
    │   └── products_manifest.json
    └── sync-scripts/
        ├── scraper-to-shared.py
        └── shared-to-shop.js
```

**Pros**: 
- Independent deployment of scraper vs shop
- Cleaner git history per project
- Can use different CI/CD per project

**Cons**: 
- More complex synchronization
- Need to manage 3 repos instead of 1

---

### Phase 2: Data Flow & Communication Pipeline

#### **Step 2.1: Scraper Output Enhancement**
Modify `scraper.py` to output shop-compatible JSON:

```python
# New output format: products_manifest.json
{
  "last_updated": "2025-11-17T18:30:00Z",
  "products": [
    {
      "id": "molle-pda-mc-cp",
      "sku": "MOLLE-PDA-001",
      "title": "Tactical Vest Universal MOLLE System Phone Navigation Panel",  # Translated
      "price_cad": 24.99,  # (Price CNY × 0.202) + 15
      "primaryImage": "/images/molle-pda-Main.jpg",
      "images": [
        "/images/molle-pda-Main.jpg",
        "/images/molle-pda-Detail_01.jpg",
        ...
      ],
      "url": "https://item.taobao.com/item.htm?id=713575933395",
      "category": "Pouches",
      "description": "Universal MOLLE system with multiple colour options",
      "options": [
        {
          "name": "Colour",
          "values": ["MC Camouflage", "Black", "Wolf Grey", "Ranger Green"]  # Translated
        }
      ],
      "variants": [
        {
          "option": "MC Camouflage",
          "price_cad": 24.99,
          "image": "/images/molle-pda-mc-variant.jpg"
        },
        ...
      ]
    }
  ]
}
```

#### **Step 2.2: Shop Integration Script**
Create `shop/scripts/import-scraped-products.ts`:

```typescript
// Reads products_manifest.json
// Copies media files to public/images/
// Generates lib/products.generated.ts
// Optional: Updates Prisma database if we add Product model
```

---

### Phase 3: Bi-Directional Communication

#### **3.1: Shop → Scraper (Product Wishlist)**
Shop can request scraping of new products:

**File**: `shared/data/scrape_queue.json`
```json
{
  "queue": [
    {
      "url": "https://item.taobao.com/item.htm?id=123456789",
      "category": "Pouches",
      "priority": "high",
      "requested_at": "2025-11-17T18:30:00Z",
      "requested_by": "admin"
    }
  ]
}
```

**Implementation**:
- Admin panel in shop: "Add Product from Taobao URL" form
- Appends to `scrape_queue.json`
- Scraper reads queue, processes URLs, removes completed items

---

#### **3.2: Scraper → Shop (Catalog Sync)**
Scraper detects existing products to avoid duplication:

**File**: `shared/data/catalog_index.json`
```json
{
  "products": {
    "https://item.taobao.com/item.htm?id=713575933395": {
      "id": "molle-pda-mc-cp",
      "last_scraped": "2025-11-17T18:30:00Z",
      "status": "active",
      "variants": 6
    }
  }
}
```

**Logic**:
- Before scraping, check if URL exists in `catalog_index.json`
- If exists and `last_scraped < 7 days`, skip
- If exists and price changed, update existing product
- If new, add to catalog

---

### Phase 4: Automated Sync Workflow

#### **Cron Job / GitHub Actions**
```yaml
# .github/workflows/sync-products.yml
name: Sync Scraped Products
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:      # Manual trigger

jobs:
  scrape-and-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Run Python Scraper
        run: python3 scraper/scraper.py
      
      - name: Copy Media to Shop
        run: |
          rsync -av shared/media/ shop/public/images/
      
      - name: Generate Products TypeScript
        run: node shared/scripts/generate-products.js
      
      - name: Commit Changes
        run: |
          git add shop/lib/products.generated.ts shop/public/images/
          git commit -m "chore: sync scraped products [skip ci]"
          git push
```

---

## Detailed Implementation Steps

### Step 1: Create Monorepo Structure
```bash
# Create new monorepo
mkdir -p ~/Documents/protocol-zero
cd ~/Documents/protocol-zero

# Move scraper
mv ~/Documents/Protocol\ Z\ Scraper scraper
cd scraper
# Keep: scraper.py, taobao_links.txt, chrome_profile_selenium/, .venv/
# Move media/ → ../shared/media/
# Move protocol_zero_variants.csv → ../shared/data/

# Move shop
cd ~/Documents/protocol-zero
mv ~/Documents/protocol-zero-shop shop

# Create shared directory
mkdir -p shared/{media,data,scripts}

# Initialize git
git init
git remote add origin https://github.com/4list233/protocol-zero.git
```

### Step 2: Update Scraper Output
Add to `scraper.py`:
```python
def export_products_manifest(all_scraped_data):
    """Export shop-compatible JSON manifest"""
    manifest = {
        "last_updated": datetime.now().isoformat(),
        "products": []
    }
    
    # Group variants by product
    products_map = {}
    for row in all_scraped_data:
        url = row['URL']
        if url not in products_map:
            products_map[url] = {
                "id": slugify(row['Translated Title'])[:50],
                "sku": f"AUTO-{len(products_map) + 1:03d}",
                "title": row['Translated Title'],
                "price_cad": row['Final CAD'],
                "primaryImage": f"/images/{row['Media Folder']}/Main.jpg",
                "images": [],
                "url": url,
                "category": categorize_product(row['Translated Title']),
                "variants": []
            }
        
        products_map[url]["variants"].append({
            "option": row['Option Name'],
            "price_cad": row['Final CAD']
        })
    
    manifest["products"] = list(products_map.values())
    
    with open('../shared/data/products_manifest.json', 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
```

### Step 3: Create Media Sync Script
`shared/scripts/sync-media.js`:
```javascript
const fs = require('fs-extra');
const path = require('path');

async function syncMedia() {
  const sourceDir = path.join(__dirname, '../media');
  const targetDir = path.join(__dirname, '../../shop/public/images');
  
  console.log('Syncing media files...');
  await fs.copy(sourceDir, targetDir, { overwrite: true });
  console.log('✅ Media sync complete');
}

syncMedia().catch(console.error);
```

### Step 4: Create Product Generator Script
`shared/scripts/generate-products.js`:
```javascript
const fs = require('fs');
const path = require('path');

function generateProducts() {
  const manifestPath = path.join(__dirname, '../data/products_manifest.json');
  const outputPath = path.join(__dirname, '../../shop/lib/products.generated.ts');
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  
  const tsContent = `import type { Product } from './products'

// Auto-generated from scraper output on ${manifest.last_updated}
// DO NOT EDIT MANUALLY - Changes will be overwritten

export const generatedProducts: Product[] = ${JSON.stringify(manifest.products, null, 2)}
`;

  fs.writeFileSync(outputPath, tsContent, 'utf-8');
  console.log('✅ Generated products.generated.ts');
}

generateProducts();
```

### Step 5: Add Admin Interface in Shop
`shop/app/admin/scraper/page.tsx`:
```typescript
'use client'

export default function ScraperAdmin() {
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('Pouches')
  
  async function requestScrape() {
    // Read scrape_queue.json
    // Append new request
    // Write back
    await fetch('/api/scraper/queue', {
      method: 'POST',
      body: JSON.stringify({ url, category })
    })
  }
  
  return (
    <div>
      <h1>Scraper Management</h1>
      <form onSubmit={requestScrape}>
        <input 
          placeholder="Taobao URL" 
          value={url} 
          onChange={e => setUrl(e.target.value)} 
        />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option>Pouches</option>
          <option>Grenades</option>
          <option>Radio PTT</option>
        </select>
        <button type="submit">Add to Scrape Queue</button>
      </form>
    </div>
  )
}
```

---

## Migration Checklist

### Phase 1: Setup ✅ **COMPLETE**
- [x] Create monorepo structure
- [x] Move scraper → `scraper/`
- [x] Move shop → `shop/`
- [x] Create `shared/` directory
- [x] Update `.gitignore` to exclude venv, node_modules, .next, media cache
- [x] Test both projects still run independently

### Phase 2: Scraper Enhancement ✅ **COMPLETE**
- [x] Add `products_manifest.json` export to scraper (via export_manifest.py)
- [x] Update CSV to include all shop-required fields
- [x] Add media output to `shared/media/`
- [x] Test scraper with 1 product
- [x] Validate JSON output format
- [x] **BONUS**: Add Gemini AI translation with airsoft/military context
- [x] **BONUS**: Implement 券后/优惠前 price extraction
- [x] **BONUS**: Detail image stitching (Details_Long.jpg)

### Phase 3: Shop Integration ✅ **COMPLETE**
- [x] Create `sync-media.js` script
- [x] Create `generate-products.js` script
- [x] Test manual sync workflow
- [x] Verify images appear in shop
- [x] Verify products load correctly

### Phase 4: Bi-Directional Sync ✅ **COMPLETE**
- [x] Create `scrape_queue.json` structure
- [ ] Add admin UI for adding URLs ⏳ **TODO**
- [x] Update scraper to read queue (infrastructure ready)
- [x] Create `catalog_index.json`
- [x] Add duplicate detection logic

### Phase 5: Automation ⏳ **PENDING**
- [ ] Set up GitHub Actions workflow
- [ ] Test automated sync
- [ ] Add error notifications (email/Slack)
- [ ] Document the full pipeline

---

## File Structure After Integration

```
protocol-zero/
├── .git/
├── .gitignore
├── README.md
├── docker-compose.yml (optional)
│
├── scraper/
│   ├── scraper.py
│   ├── taobao_links.txt
│   ├── taobao_cookies.json
│   ├── chrome_profile_selenium/
│   ├── requirements.txt
│   ├── .venv/
│   └── README.md
│
├── shop/
│   ├── app/
│   │   ├── admin/scraper/page.tsx (NEW)
│   │   └── ...
│   ├── lib/
│   │   ├── products.ts
│   │   └── products.generated.ts (auto-generated)
│   ├── public/
│   │   └── images/ (synced from shared/media/)
│   ├── package.json
│   └── README.md
│
└── shared/
    ├── media/                          # Source of truth
    │   ├── product_1_molle-pda/
    │   │   ├── Main.jpg
    │   │   ├── Detail_01.jpg
    │   │   └── ...
    │   └── product_2_m67-grenade/
    │       └── ...
    │
    ├── data/
    │   ├── protocol_zero_variants.csv
    │   ├── products_manifest.json       # Shop-compatible JSON
    │   ├── scrape_queue.json            # Shop → Scraper requests
    │   └── catalog_index.json           # Duplicate detection
    │
    └── scripts/
        ├── sync-media.js                # Media → shop/public/images/
        ├── generate-products.js         # JSON → products.generated.ts
        └── watch-queue.py               # Monitor scrape_queue.json

```

---

## Benefits of This Architecture

✅ **Separation of Concerns**: Scraper and shop remain independent  
✅ **Single Source of Truth**: `shared/` directory is authoritative  
✅ **Version Control**: All changes tracked in one repo  
✅ **Automated Sync**: No manual copy-paste needed  
✅ **Bi-Directional**: Shop can request new products, scraper reports status  
✅ **Scalable**: Easy to add more data sources (e.g., AliExpress scraper)  
✅ **Type-Safe**: TypeScript generated from scraper output  
✅ **Media Management**: Organized, deduplicated image library  

---

## Next Steps

Which option do you prefer?
1. **Monorepo (Option A)** - Single unified repository
2. **Separate Repos (Option B)** - Three repos with shared storage

Once you decide, I'll:
1. Create the directory structure
2. Move files without conflicts
3. Set up the sync scripts
4. Test the integration pipeline
5. Add admin UI for scrape queue management

Let me know and I'll proceed with the implementation!
