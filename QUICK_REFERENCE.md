# Protocol Zero - Quick Reference

**One-page summary for quick reference**

---

## 🎯 Project Goal

Transform a working Taobao scraper system that uses Knack/Notion into a production-ready e-commerce platform with:
- **Scraper:** Taobao → Supabase (clean Python pipeline)
- **Database:** Supabase (PostgreSQL, not Knack/Notion)
- **Website:** Next.js 15 on Vercel (full e-commerce features)
- **Timeline:** 1 week

---

## 📚 Read These Documents

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[REFACTOR_PLAN.md](REFACTOR_PLAN.md)** | Overall architecture, database schema, deliverables | 20 min |
| **[SCRAPER_SPECIFICATIONS.md](SCRAPER_SPECIFICATIONS.md)** | Scraper features, pricing, translation, image processing | 30 min |
| **[WEBSITE_SPECIFICATIONS.md](WEBSITE_SPECIFICATIONS.md)** | Frontend features, admin dashboard, components | 30 min |
| **[HANDOFF_GUIDE.md](HANDOFF_GUIDE.md)** | Step-by-step implementation guide | 45 min |

**Total reading time:** ~2 hours

---

## 🔧 What Currently Works

### Scraper ✅
- Scrapes Taobao products (Selenium)
- Extracts variants (color/size options)
- Downloads images
- Translates with Gemini AI
- Calculates CAD pricing
- **BUT:** Pushes to Knack/Notion (needs refactor)

### Website ⚠️
- Next.js 15 setup
- Firebase authentication
- PostgreSQL database (wrong schema)
- **BUT:** No product pages, cart, checkout, or admin

---

## 🎯 What You Need to Build

### 1. Database Migration
- [x] Current: Knack (3rd party, slow, expensive)
- [ ] Target: Supabase (PostgreSQL, fast, cheap)
- **Tasks:**
  - Rewrite Prisma schema (see REFACTOR_PLAN.md)
  - Create `supabase_integration.py` (replace Knack)
  - Update `ai_scraper.py` to use Supabase

### 2. Scraper Workflow
- [ ] Remove Knack/Notion code
- [ ] Add Supabase uploads (images + data)
- [ ] One-command workflow: `./workflow.sh`
- [ ] Test with 10 products

### 3. Website Features
- [ ] Product listing page (`/shop`)
- [ ] Product detail page (`/shop/[id]`)
- [ ] Variant selector (color/size dropdowns)
- [ ] Cart page
- [ ] Checkout (basic, contact form OK)
- [ ] Admin dashboard (`/admin`)
- [ ] Admin product editor

### 4. Deployment
- [ ] Deploy to Vercel
- [ ] Environment variables setup
- [ ] Test live site
- [ ] Document everything

---

## 📊 Scraper Pipeline (9 Steps)

```
1. SCRAPE      → Load Taobao page (Selenium)
2. EXTRACT     → Get title, price, images, variants
3. TRANSLATE   → Chinese → English (Gemini AI)
4. PROCESS     → Stitch images, delete unwanted
5. PRICE       → Calculate CAD with margins
6. UPLOAD IMG  → Push to Supabase Storage
7. SEED DATA   → Insert Product + Variants
8. VERIFY      → Check Supabase dashboard
9. PUBLISH     → Auto-sync to website
```

---

## 💰 Pricing Formula

```python
cost_cny = taobao_price + ¥30 shipping
cost_cad = cost_cny × 0.19 (exchange rate)
sale_price = cost_cad / (1 - 0.10 - 0.30)  # 10% sales, 30% margin
sale_price = round(sale_price) - 0.01      # e.g., $49.99
```

**Example:** Taobao ¥100 → Cost $24.70 → Sell $49.99 CAD

---

## 🗄️ Database Schema (Simplified)

```
Product
├── id (PK)
├── sku (unique)
├── title, titleOriginal
├── category, status
├── priceCadBase
├── images[] (URLs)
└── variants → Variant[]

Variant
├── id (PK)
├── productId (FK)
├── sku (unique)
├── variantName (e.g., "Black / M")
├── priceCny, costCad, priceCad
├── optionType1, optionValue1 (e.g., "Color", "Black")
├── optionType2, optionValue2 (e.g., "Size", "M")
└── stock, status

Order
├── id (PK)
├── userId (FK)
├── orderNumber (unique)
├── status, totalCad
├── shippingAddress (JSON)
└── items → OrderItem[]

OrderItem
├── orderId (FK)
├── variantId (FK)
├── quantity, priceCad
```

---

## 🚀 Quick Start Commands

### Setup
```bash
# Scraper
cd scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Shop
cd shop
npm install
npx prisma generate
```

### Test Scraper
```bash
cd scraper
source .venv/bin/activate
python3 ai_scraper.py --test
```

### Test Shop
```bash
cd shop
npm run dev
# Open http://localhost:3000
```

### Deploy
```bash
cd shop
npm run build
vercel deploy --prod
```

---

## 📁 Key Files to Edit

### Scraper
- `ai_scraper.py` - Main scraper (remove Knack code)
- `supabase_integration.py` - **CREATE THIS** (new)
- `requirements.txt` - Add `supabase>=2.3.0`

### Shop
- `prisma/schema.prisma` - **REWRITE** (e-commerce schema)
- `app/shop/page.tsx` - **CREATE** (product listing)
- `app/shop/[id]/page.tsx` - **CREATE** (product detail)
- `app/admin/page.tsx` - **CREATE** (admin dashboard)
- `lib/supabase/client.ts` - **CREATE** (Supabase client)

---

## ⚠️ Watch Out For

1. **RLS (Row Level Security):** Disable for dev, or products won't load
2. **Image Uploads:** Use service key, not anon key
3. **Prisma Client:** Run `npx prisma generate` after schema changes
4. **Environment Variables:** Use `NEXT_PUBLIC_` prefix for client-side
5. **Taobao Login:** Run once with browser visible, session persists

---

## ✅ Acceptance Criteria

### 1. Scraper Test
```bash
./workflow.sh
# → Products in Supabase ✅
# → Images in Storage ✅
# → No errors ✅
```

### 2. Website Test
```
Open https://your-site.vercel.app/shop
→ Products load ✅
→ Click product → detail page ✅
→ Select variant → add to cart ✅
→ Go to cart → checkout ✅
```

### 3. Admin Test
```
Login to /admin
→ View product list ✅
→ Edit product → save ✅
→ Changes on frontend ✅
```

---

## 📞 Communication Plan

### Daily Standup (5 min)
- What did you do yesterday?
- What will you do today?
- Any blockers?

### Weekly Review (30 min)
- Demo progress
- Review code
- Plan next week

### Questions
- Slack/Email for async
- Video call for complex issues

---

## 🎁 Success Looks Like

**Week 1:** Database migrated, test data seeded  
**Week 2:** Scraper refactored, pushing to Supabase  
**Week 3:** Product pages live, cart working  
**Week 4:** Admin dashboard, deployed to Vercel

**Final Demo:**
1. Run scraper → add new product
2. Product appears on website
3. Add to cart → checkout
4. Admin edits product → changes live
5. Documentation updated

---

## 🚦 Phases Overview

| Phase | Days | Deliverable | Status |
|-------|------|-------------|--------|
| 1. Database Setup | 1-2 | Supabase + Prisma schema | ⬜ |
| 2. Scraper Refactor | 3-5 | Supabase integration | ⬜ |
| 3. Frontend | 6-14 | Product pages + cart | ⬜ |
| 4. Admin | 15-17 | Dashboard + editor | ⬜ |
| 5. Deploy | 18-19 | Vercel + testing | ⬜ |
| 6. Docs | 20 | Documentation + video | ⬜ |

---

## 📚 Tech Stack Summary

| Component | Current | Target | Why |
|-----------|---------|--------|-----|
| Database | Knack | Supabase | Open source, faster, cheaper |
| Image Host | Notion | Supabase Storage | Integrated, CDN, free tier |
| Frontend | Next.js 15 | Next.js 15 | ✅ Keep |
| Auth | Firebase | Firebase | ✅ Keep |
| Hosting | None | Vercel | Free, auto-deploy, fast |
| Scraper | Python + Selenium | Python + Selenium | ✅ Keep |
| Translation | Gemini AI | Gemini AI | ✅ Keep |

---

## 💡 Pro Tips

1. **Start with seed data** - Test frontend before scraper works
2. **Use Prisma Studio** - GUI for database debugging
3. **Test locally first** - Don't deploy broken code
4. **Git commits often** - Small, atomic commits
5. **Read error messages** - TypeScript/Prisma errors are helpful
6. **Ask questions early** - Don't waste time stuck

---

## 📝 Questions Before You Start

Please answer these:

1. **Timeline:** Can you complete in 4 weeks, or need more time?
2. **Database:** Happy with Supabase, or prefer AWS/PlanetScale?
3. **Payment:** Live checkout (Stripe) or contact form (simpler)?
4. **Hours:** How many hours/week can you dedicate?
5. **Communication:** Prefer Slack, Email, Discord, or other?

---

**Ready to start? Read [HANDOFF_GUIDE.md](HANDOFF_GUIDE.md) for step-by-step instructions!**

---

**Last Updated:** January 25, 2026  
**Version:** 2.0  
**Status:** Ready for Development 🚀
