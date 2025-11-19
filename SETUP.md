# Quick Setup Guide

## ✅ Monorepo Created Successfully!

Your Protocol Zero integrated platform is now set up at:
```
~/Documents/protocol-zero/
```

## 🚀 Next Steps

### 1. Set Up GitHub Repository

```bash
cd ~/Documents/protocol-zero

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/protocol-zero.git
git push -u origin main
```

### 2. Set Up Scraper

```bash
cd scraper

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# One-time: Login to Taobao
python scraper.py --login-setup
# Follow prompts to log in via QR code or password

# Test scraping (URLs already in taobao_links.txt)
python scraper.py
```

### 3. Set Up Shop

```bash
cd ../shop

# Install Node.js dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials:
# - DATABASE_URL (PostgreSQL)
# - Firebase credentials
# - NextAuth secret

# Set up database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
# Visit http://localhost:3000
```

### 4. Test Integration Workflow

```bash
# From project root: ~/Documents/protocol-zero

# Step 1: Run scraper (if you haven't already)
cd scraper
source .venv/bin/activate
python scraper.py

# Step 2: Sync media to shop
cd ../shared/scripts
npm run sync-media

# Step 3: Generate TypeScript products
npm run generate-products

# Step 4: Check shop
cd ../../shop
npm run dev
# Products should now appear at http://localhost:3000/shop
```

## 📂 Directory Overview

```
protocol-zero/
├── scraper/              Python scraper
│   ├── scraper.py       Main scraper script
│   ├── taobao_links.txt Add URLs here
│   └── .venv/           Python virtual environment (create this)
│
├── shop/                Next.js e-commerce
│   ├── app/             Next.js routes
│   ├── lib/             Business logic
│   │   └── products.generated.ts  ← Auto-generated from scraper
│   ├── public/images/   ← Synced from shared/media
│   └── node_modules/    (npm install creates this)
│
└── shared/              Integration layer
    ├── media/           Scraped images (source of truth)
    ├── data/            JSON manifests
    │   ├── products_manifest.json      ← Scraper output
    │   ├── scrape_queue.json           ← Shop → Scraper requests
    │   └── catalog_index.json          ← Duplicate detection
    └── scripts/         Sync automation
        ├── sync-media.js               Copy images to shop
        ├── generate-products.js        Create TypeScript file
        └── node_modules/               (npm install creates this)
```

## 🔄 Daily Workflow

### Adding New Products

1. Add Taobao URLs to `scraper/taobao_links.txt`
2. Run `python scraper.py`
3. Run `npm run sync-all` from `shared/scripts/`
4. Rebuild shop if needed: `cd shop && npm run build`

### Automated Sync (Optional)

The GitHub Actions workflow at `.github/workflows/sync-products.yml` will:
- Run daily at 2 AM
- Scrape new products
- Sync media
- Generate TypeScript
- Commit changes

To enable, just push to GitHub - no additional setup needed!

## 🛠️ Troubleshooting

### Scraper Issues
- **"No module named 'selenium'"**: Activate venv first: `source .venv/bin/activate`
- **ChromeDriver errors**: Delete `chromedriver.broken`, let Selenium Manager handle it
- **Login required**: Run `python scraper.py --login-setup` again

### Shop Issues
- **Database errors**: Run `npx prisma db push` from `shop/`
- **Missing images**: Run `npm run sync-media` from `shared/scripts/`
- **Products not showing**: Check `shop/lib/products.generated.ts` exists

### Sync Script Issues
- **"fs-extra not found"**: Run `npm install` in `shared/scripts/`
- **Permission denied**: Make scripts executable: `chmod +x shared/scripts/*.js`

## 📚 Documentation

- [Main README](README.md) - Complete documentation
- [Scraper README](scraper/README.md) - Scraper details
- [Shop README](shop/README.md) - Shop setup
- [Integration Plan](scraper/INTEGRATION_PLAN.md) - Architecture

## ✨ You're All Set!

Your integrated scraper + shop platform is ready to use. Start by running the scraper to populate products, then check them out in the shop!

**Questions?** Check the main README.md or individual project READMEs.
