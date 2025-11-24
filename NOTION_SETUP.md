# Notion Setup Guide

Complete instructions for creating and configuring Notion databases for Protocol Zero shop integration.

---

## Overview

This guide walks you through:
1. Creating a Notion integration
2. Setting up two databases (Products + Product Variants)
3. Configuring properties and relations
4. Obtaining credentials for API access

**Time Required:** 15-20 minutes

---

## Step 1: Create Notion Integration

### 1.1 Access Integrations Page
1. Go to https://www.notion.so/my-integrations
2. Click **"+ New integration"**

### 1.2 Configure Integration
- **Name:** `Protocol Zero Shop Integration`
- **Logo:** (Optional) Upload Protocol Zero logo
- **Associated workspace:** Select your workspace
- **Type:** Internal integration
- **Capabilities:**
  - ✅ Read content
  - ✅ Update content
  - ✅ Insert content
  - ❌ No comment capabilities needed

### 1.3 Save and Copy Token
1. Click **"Submit"**
2. Copy the **Internal Integration Token** (starts with `secret_`)
3. Save this as `NOTION_API_KEY` in your `.env` files

> ⚠️ **Security:** Never commit this token to git. Keep it in `.env.local` (already in `.gitignore`)

---

## Step 2: Create Products Database (Parent)

### 2.1 Create New Database
1. Open your Notion workspace
2. Click **"+ New page"** or add to existing workspace
3. Type `/database` and select **"Table - Inline"**
4. Name the database: **`Protocol Zero - Products`**

### 2.2 Configure Properties

Click the **"•••"** menu on any column header to add/rename properties:

| Property Name | Type | Configuration | Notes |
|---------------|------|---------------|-------|
| **Title** | Title | (Default) | Product name in English |
| **ID** | Text | Plain text | Unique slug (e.g., `wosport-l4g24--`) |
| **SKU** | Text | Plain text | Base SKU (e.g., `WOS-L4G24`) |
| **Title Original** | Text | Plain text | Chinese title from Taobao |
| **Category** | Select | Options: `Gear`, `Apparel`, `Accessories`, `Electronics` | Add more as needed |
| **Status** | Select | Options: `Active`, `Draft`, `Discontinued`, `Out of Stock` | Use colors: Green, Yellow, Red, Orange |
| **Description** | Text | Rich text (not plain) | Full product description with formatting |
| **Price CAD (Base)** | Number | Format: Canadian dollar | Base price before variant overrides |
| **Margin** | Number | Format: Number | Default `0.5` (50% markup) |
| **Images** | Files & media | Multiple files allowed | Upload product photos (hero + gallery) |
| **Image Paths** | Text | Plain text | Fallback: JSON array of paths like `["/images/prod-Main.jpg"]` |
| **Detail Image** | Files & media | Single file | Long scrolling detail image |
| **Detail Image Path** | Text | Plain text | Fallback: path like `/images/prod-Details_Long.jpg` |
| **Variants** | Relation | → Product Variants database | *(Configure after creating Variants DB)* |
| **Stock** | Number | Format: Number | Global inventory count |
| **URL** | URL | URL format | Source Taobao link |
| **Supplier Notes** | Text | Plain text | Internal notes |
| **Last Updated** | Last edited time | (Auto) | Automatically tracks edits |

### 2.3 Property Configuration Tips

**For Select Properties (Category, Status):**
1. Click property header → "Edit property"
2. Add options one by one
3. Assign colors for visual distinction
4. Set default value (e.g., Status = `Draft`)

**For Number Properties (Price, Margin, Stock):**
1. Click property header → "Edit property"
2. Set number format (currency for Price CAD, plain number for others)
3. Optionally set default values (e.g., Margin = `0.5`)

**For Relation Property (Variants):**
- Leave empty for now, configure after Step 3

---

## Step 3: Create Product Variants Database (Children)

### 3.1 Create New Database
1. In the same Notion workspace
2. Create another table: `/database` → **"Table - Inline"**
3. Name it: **`Protocol Zero - Product Variants`**

### 3.2 Configure Properties

| Property Name | Type | Configuration | Notes |
|---------------|------|---------------|-------|
| **Variant Name** | Title | (Default) | Option label (e.g., `Tan`, `Black`) |
| **Product** | Relation | → Products database | Link to parent product |
| **SKU** | Text | Plain text | Variant-specific SKU (e.g., `WOS-L4G24-TAN`) |
| **Price CNY** | Number | Format: Number | Price in Chinese Yuan |
| **Price CAD Override** | Number | Format: Canadian dollar | Optional: override base price |
| **Stock** | Number | Format: Number | Variant-specific inventory |
| **Status** | Select | Options: `Active`, `Out of Stock` | Variant availability |
| **Sort Order** | Number | Format: Number | Display order (1, 2, 3...) |

---

## Step 4: Configure Relation Between Databases

### 4.1 Link Variants to Products
1. Go to **Product Variants** database
2. Click the **"Product"** property (should already be Relation type)
3. Select **"Protocol Zero - Products"** as the related database
4. Choose relation type: **"Single relation"** (each variant belongs to one product)

### 4.2 Add Relation Property to Products
1. Go back to **Products** database
2. Find or add the **"Variants"** property
3. Type: **Relation**
4. Related database: **"Protocol Zero - Product Variants"**
5. This creates a **two-way relation** (Products ↔ Variants)

### 4.3 Test the Relation
1. Create a test product in Products DB
2. Create 2-3 test variants in Variants DB
3. In each variant row, select the product from the "Product" dropdown
4. Verify: the product row now shows linked variants in the "Variants" column

---

## Step 5: Share Databases with Integration

### 5.1 Share Products Database
1. Open the **Products** database page
2. Click **"Share"** (top right)
3. Click **"Invite"**
4. Search for **"Protocol Zero Shop Integration"** (your integration name)
5. Select it and grant **"Can edit"** permission
6. Click **"Invite"**

### 5.2 Share Product Variants Database
- Repeat the same steps for the **Product Variants** database

> ⚠️ **Important:** Both databases must be shared with the integration, or API calls will fail with 404 errors.

---

## Step 6: Get Database IDs

### 6.1 Products Database ID
1. Open the **Products** database as a full page (click title, then "Open as page")
2. Look at the URL in your browser:
   ```
   https://www.notion.so/{workspace}/XXXXX?v=YYYYY
                                    ^^^^^
                                  Database ID (32 characters)
   ```
3. Copy the 32-character string (between the last `/` and `?v=`)
4. Save as `NOTION_DATABASE_ID_PRODUCTS`

### 6.2 Product Variants Database ID
- Repeat the same steps for **Product Variants** database
- Save as `NOTION_DATABASE_ID_VARIANTS`

---

## Step 7: Set Environment Variables

### 7.1 For Seed Scripts (`shared/scripts/.env`)

Create or edit `shared/scripts/.env`:

```env
# Notion Integration
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID_PRODUCTS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID_VARIANTS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 7.2 For Shop Runtime (`shop/.env.local`)

Create or edit `shop/.env.local`:

```env
# Notion Integration (Runtime API)
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID_PRODUCTS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID_VARIANTS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Cache TTL (default 120 seconds)
NOTION_CACHE_TTL_SECONDS=120
```

### 7.3 For Vercel Production

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable:
   - Name: `NOTION_API_KEY`
   - Value: `secret_xxx...`
   - Environment: `Production`, `Preview`, `Development`
3. Repeat for `NOTION_DATABASE_ID_PRODUCTS` and `NOTION_DATABASE_ID_VARIANTS`

---

## Step 8: Verify Setup

### 8.1 Test Database Access

Run this test script to verify credentials:

```zsh
cd shared/scripts
npm install @notionhq/client
node -e "
const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function test() {
  try {
    const productsDB = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID_PRODUCTS,
      page_size: 1
    });
    console.log('✅ Products DB accessible:', productsDB.results.length >= 0);
    
    const variantsDB = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID_VARIANTS,
      page_size: 1
    });
    console.log('✅ Variants DB accessible:', variantsDB.results.length >= 0);
    
    console.log('✅ All checks passed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
"
```

**Expected output:**
```
✅ Products DB accessible: true
✅ Variants DB accessible: true
✅ All checks passed!
```

---

## Step 9: Add Sample Data (Optional)

### 9.1 Create Sample Product
In the **Products** database, add a row:

| Field | Value |
|-------|-------|
| Title | Test Product - Night Vision Mount |
| ID | `test-nv-mount` |
| SKU | `TEST-001` |
| Category | Gear |
| Status | Active |
| Description | This is a **test product** for setup verification. |
| Price CAD (Base) | 50.00 |
| Margin | 0.5 |
| Stock | 10 |
| Image Paths | `["/images/test-Main.jpg"]` |

### 9.2 Create Sample Variants
In the **Product Variants** database, add 2 rows:

**Variant 1:**
| Field | Value |
|-------|-------|
| Variant Name | Black |
| Product | → Link to "Test Product - Night Vision Mount" |
| SKU | `TEST-001-BLK` |
| Price CNY | 350 |
| Price CAD Override | 55.00 |
| Stock | 5 |
| Status | Active |
| Sort Order | 1 |

**Variant 2:**
| Field | Value |
|-------|-------|
| Variant Name | Tan |
| Product | → Link to "Test Product - Night Vision Mount" |
| SKU | `TEST-001-TAN` |
| Price CNY | 350 |
| Stock | 5 |
| Status | Active |
| Sort Order | 2 |

### 9.3 Verify Relation
- Check the product row: the **Variants** column should show `2` linked items
- Click to expand and verify both variants are listed

---

## Troubleshooting

### Error: "Could not find database"
- ✅ Verify database ID is exactly 32 characters (no extra spaces)
- ✅ Ensure database is shared with the integration
- ✅ Check integration has "Read content" capability

### Error: "Unauthorized" or 401
- ✅ Verify `NOTION_API_KEY` is correct (starts with `secret_`)
- ✅ Check integration is created in the correct workspace
- ✅ Ensure token hasn't been regenerated (invalidates old token)

### Relation Not Working
- ✅ Both databases must be shared with the integration
- ✅ Relation property must point to the correct database
- ✅ Try refreshing the page and re-checking property settings

### Missing Properties
- ✅ Add property via "•••" menu → "Insert column" → select type
- ✅ Property names must match exactly (case-sensitive for API)
- ✅ For custom properties, update `notion-client.ts` transformer

---

## Next Steps

Once setup is complete, proceed to:

1. **Seed existing products:** `cd shared/scripts && npm run seed-notion`
2. **Start development:** `cd shop && npm run dev`
3. **Verify API routes:** Test `http://localhost:3000/api/products`

See `IMPLEMENTATION_GUIDE.md` for detailed implementation steps.

---

## Security Checklist

- [ ] `NOTION_API_KEY` is in `.env.local` (not `.env`)
- [ ] `.env.local` is in `.gitignore`
- [ ] Vercel environment variables are encrypted
- [ ] Integration scope is limited to necessary capabilities
- [ ] Token rotation policy documented (every 90 days recommended)
- [ ] Separate integrations for staging/production (optional but recommended)

---

## Database Maintenance

### Adding New Categories
1. Go to Products DB → Category property → Edit
2. Add new option (e.g., "Optics")
3. Save → shop will automatically recognize new category

### Adding New Properties
1. Add column to Notion database
2. Update `shop/lib/notion-client.ts` transformer
3. Update `Product` type in `shop/lib/products.ts`
4. Update `json-to-notion.js` seeder if needed

### Bulk Operations
- Use Notion's native filters, sorts, and bulk edit features
- For complex migrations, export to CSV → edit → re-import
- Always test on sample products first

---

## Support

If you encounter issues:
1. Check Notion API status: https://status.notion.so/
2. Review API logs in Vercel dashboard
3. Test credentials with the verification script above
4. Consult Notion API docs: https://developers.notion.com/

---

**Setup Complete!** 🎉

Your Notion databases are now ready for Protocol Zero integration.
