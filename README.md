# Protocol Zero — Airsoft E-Commerce Platform

**Automated Taobao product scraping pipeline connected to a production Next.js storefront, backed by [Knack](https://www.knack.com) as the database and Firebase for authentication.**

---

## Overview

| Layer | Tech | Purpose |
|---|---|---|
| **Scraper** | Python 3.12, Selenium, DeepSeek API | Scrape Taobao/Tmall → translate → upload to Knack |
| **Shop** | Next.js 15, React 18, TypeScript | E-commerce storefront + admin dashboard |
| **Database** | Knack (REST API) | Products, variants, orders, carts, users |
| **Auth** | Firebase Auth | Customer login, admin route protection |
| **Hosting** | Vercel | Shop deployment |

---

## Repository Structure

```
protocol-zero/
├── scraper/                    # Python scraper pipeline
│   ├── ai_scraper.py           # Scrape-only entrypoint (no translation during scrape)
│   ├── translate_deepseek.py   # Bulk DeepSeek translation (separate step)
│   ├── upload_to_knack.py      # Upload products + images to Knack
│   ├── taobao_links.txt        # Input — one Taobao/Tmall URL per line
│   ├── requirements.txt
│   ├── core/                   # Scraping engine (variant extraction, pricing)
│   ├── integrations/           # Knack API client
│   └── utilities/              # stitch_details.py, quality_control.py
│
├── shop/                       # Next.js app
│   ├── app/                    # App Router pages + API routes
│   ├── components/             # Shared React components
│   ├── lib/                    # Business logic (Knack client, cart, Firebase admin)
│   ├── public/                 # Static assets
│   ├── .env.example            # Shop env template
│   └── vercel.json
│
└── shared/                     # Legacy bridge (schedule config, scrape queue JSON)
```

> `scraper/ai_scraper_output/` is gitignored — all scraped images and JSON live locally.

---

## Environment Variables

All secrets live in **one file**: repo root **`.env`** (gitignored).

```bash
# Copy the template and fill in your values
cp .env.example .env
```

The shop reads env from `shop/.env.local`. The simplest local setup is a symlink:

```bash
ln -sf ../.env shop/.env.local
```

For **Vercel production**, set all variables in **Project → Settings → Environment Variables** — do not commit `.env`.

### Required

| Variable | Used by | Where to get it |
|---|---|---|
| `KNACK_APPLICATION_ID` | shop + scraper | Knack Builder → API & Code |
| `KNACK_REST_API_KEY` | shop + scraper | Knack Builder → API & Code |
| `DEEPSEEK_API_KEY` | scraper | [platform.deepseek.com](https://platform.deepseek.com) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | shop (client) | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | shop (client) | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | shop (client) | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | shop (client) | Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | shop (server) | Firebase Console → Service Accounts → Generate key (paste as single-line JSON string) |

### Optional

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | Set to your production domain on Vercel |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | — | Firebase Analytics (optional) |
| `CACHE_TTL_SECONDS` | `300` | Per-instance product cache TTL in seconds |

---

## Scraper Workflow

The pipeline is split into discrete steps so you can review images manually before anything is uploaded.

### First-time setup

```bash
cd scraper
pip3 install -r requirements.txt

# One-time: opens Chrome so you can log in to Taobao manually
python3 ai_scraper.py --login
```

After login, the Chrome session is saved to `scraper/chrome_profile_selenium/` and reused on every subsequent run.

### Add product URLs

Edit `scraper/taobao_links.txt` — one Taobao or Tmall URL per line. Lines starting with `#` are ignored.

### Run the full pipeline

```bash
# 1. Scrape — downloads images and extracts variants (no translation)
python3 ai_scraper.py

# 2. Manual review
#    Open:  scraper/ai_scraper_output/media/<product>/Details/
#    Delete any irrelevant images (ads, unrelated items, etc.)

# 3. Stitch — combines detail images into one scrollable image
python3 utilities/stitch_details.py

# 4. Translate — one DeepSeek bulk API call for all products + variants
python3 translate_deepseek.py

# 5. Preview what will be uploaded (no changes made)
python3 upload_to_knack.py --dry-run

# 6. Upload products, variants, and images to Knack
python3 upload_to_knack.py --with-images
```

### Scraper output layout

All output lands in `scraper/ai_scraper_output/` (gitignored):

```
products.json                   Raw scrape (Chinese titles)
products_translated.json        After DeepSeek translation
translation_cache.json          Cache — avoids repeat API calls on re-runs
media/
  <product-id>/
    Main/Main.jpg               Hero image
    Catalogue/Catalogue_01.jpg  Gallery images
    Details/Detail_01.jpg       Individual detail images (review + delete here)
    Details/Details_Long.jpg    Stitched detail image (created by stitch step)
```

---

## Shop — Local Development

```bash
cd shop
npm install
npm run dev
# → http://localhost:3000
```

### Key routes

| Route | Description |
|---|---|
| `/` | Homepage — featured products |
| `/shop` | Product catalog |
| `/shop/[id]` | Product detail page with variant selector |
| `/cart` | Shopping cart |
| `/checkout` | Checkout flow (e-transfer) |
| `/admin` | Admin dashboard |
| `/admin/products` | Product list + inline editor |
| `/admin/orders` | Order management |
| `/admin/carts` | Abandoned cart management |
| `/auth/signin` | Firebase sign-in |

### Production build

```bash
cd shop
npm run build   # TypeScript + ESLint errors will fail the build (strict mode)
npm start
```

### Deploy to Vercel

1. Connect this GitHub repo to a new Vercel project.
2. Set **Root Directory** to `shop`.
3. Add all required environment variables in the Vercel dashboard.
4. Push to main — Vercel builds and deploys automatically.

---

## Shop Architecture

| Area | Details |
|---|---|
| **Products + variants** | Fetched live from Knack REST API on every request (with 5-min in-process cache) |
| **Images** | Uploaded by scraper and served from Knack's CDN |
| **Cart** | Persistent server-side cart stored in Knack; guest carts identified by anonymous cookie |
| **Auth** | Firebase Auth (client) + `firebase-admin` JWT verification on every protected API route |
| **Admin access** | Firebase custom claim `admin: true` — set with `node shop/scripts/set-admin-claim.js <uid>` |
| **Promo codes** | Stored in Knack, rate-limited server-side, discount tracked per order |
| **Abandoned carts** | Cron at `/api/cron/abandoned-carts` — call via Vercel Cron or external scheduler |
| **Public API safety** | Margins, CNY cost, and internal fields are stripped before any response leaves the server |

---

## Security Notes

- `.env` and `.env.local` are gitignored — never commit real secrets.
- `shop/firebase-admin-key.json` must **not** be committed — use `FIREBASE_SERVICE_ACCOUNT_KEY` env var instead.
- All admin API routes require a valid Firebase ID token with the `admin` claim.
- Scraper cookies and Chrome profile data are gitignored.

---

## Troubleshooting

**Scraper: CAPTCHA or login loop**
```bash
python3 ai_scraper.py --login   # re-authenticate, refreshes saved session
```

**Scraper: price shows 0**
Taobao hides prices for logged-out sessions. Re-run `--login` and try again.

**Shop: products not showing**
Verify `KNACK_APPLICATION_ID` and `KNACK_REST_API_KEY` are correct and present in your env.

**Shop: Firebase error on API routes**
`FIREBASE_SERVICE_ACCOUNT_KEY` must be valid JSON as a **single-line string**. Verify with:
```bash
node -e "JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)" && echo OK
```

**Shop: build fails on Vercel**
TypeScript and ESLint errors now block production builds (strict mode enabled). Check the Vercel build log for the specific file and line.

---

**Built for Protocol Zero Airsoft — [pzairsoft.ca](https://pzairsoft.ca)**
