# Security: Read-Only Database Policy

## Overview

The production site operates in **read-only mode** for product/variant data and Notion. All data seeding and updates must be performed locally to prevent tampering.

## Read-Only Operations (Production)

### ✅ Allowed Reads
- **Products**: `/api/products` - Read-only, sanitized data
- **Variants**: Included in product responses - Read-only
- **Notion Images**: Read-only image URLs
- **Addons**: `/api/addons` - Read-only pricing data

### ❌ Disabled Writes (Production)

#### Products & Variants
- `createProduct()` - **BLOCKED** in production
- `updateProduct()` - **BLOCKED** in production
- All product/variant creation/updates must use local scripts

#### Notion
- `syncImagesToNotion()` - **BLOCKED** in production
- All Notion updates must use local scripts

#### Promo Codes
- Promo code usage tracking - **DISABLED** in production
- Promo code management must be done locally

## Write Operations (Production - Business Critical)

### ✅ Allowed Writes (Checkout Only)

The `/api/checkout` route is the **ONLY** endpoint that writes to Knack in production:

1. **Orders** - Creates order records (required for e-commerce)
2. **Users** - Creates user records for order tracking

These operations are necessary for business functionality and are protected by:
- Rate limiting (5 requests/minute)
- Honeypot bot detection
- Input validation and sanitization
- Timing checks

## Credential Management

### `firebase-admin-key.json` (LOCAL ONLY)

⚠️ **This file contains a live Google service account private key.**

- It is listed in `.gitignore` and must **never** be committed.
- It is only present for local development fallback (`applicationDefault()` on the SDK reads it via `GOOGLE_APPLICATION_CREDENTIALS`).
- **In production (Vercel):** The key must be stored as the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable (JSON blob).
  Set it in the Vercel dashboard → Settings → Environment Variables.
  The code in `lib/firebase-admin.ts` reads this env var first.
- If you suspect the key has been exposed, revoke it immediately in the Firebase console:
  https://console.firebase.google.com → Project Settings → Service Accounts → Revoke key.

### Environment Variables

Never commit `.env.local`, `.env.production`, or any file containing real keys.
All secrets must live in Vercel environment variables or local `.env.local` (gitignored).

## Local Development

In local development (`NODE_ENV !== 'production'`), all write operations are enabled for testing and data seeding.

## Data Management Workflow

1. **Local Scripts**: Use scripts in `/shared/scripts/` to:
   - Import products from CSV
   - Update pricing
   - Sync images to Notion
   - Manage promo codes

2. **Production Site**: Only reads data, never modifies products/variants/Notion

3. **Checkout**: Creates orders and users only (business critical)

## Security Benefits

- **Prevents Price Tampering**: Products/variants cannot be modified via API
- **Prevents Data Corruption**: Notion cannot be modified via API
- **Audit Trail**: All changes must go through local scripts (version controlled)
- **Access Control**: Only authorized developers can run local scripts

