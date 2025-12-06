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
