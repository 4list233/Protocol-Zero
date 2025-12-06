# Promo Code Tracking & Order Items Setup

## Problem
1. **Promo codes aren't tracked** - No way to know which promo code was used or how many times
2. **Variant quantities are lost** - Orders only store variant IDs, not how many of each were purchased

## Solution

### 1. Add New Fields to Knack Orders Object (object_10)

| Field Name | Type | Purpose |
|------------|------|---------|
| **Promo Code** | Short Text | The promo code used (e.g., "PROMO10") |
| **Promo Discount CAD** | Number | Amount discounted from promo code |
| **Order Items JSON** | Long Text | JSON array with variant ID + quantity for each item |

### 2. Create Promo Codes Object (NEW)

Create a new object in Knack called **"Promo Codes"** (object_13):

| Field Name | Type | Purpose |
|------------|------|---------|
| **Code** | Short Text | Unique promo code (e.g., "PROMO10") |
| **Discount %** | Number | Discount percentage (e.g., 10) |
| **Usage Count** | Number | How many times this code has been used |
| **Total Discount Given** | Number | Total CAD amount discounted across all uses |
| **Is Active** | Yes/No | Whether code is currently active |
| **Created At** | Date/Time | When code was created |
| **Last Used At** | Date/Time | Most recent usage timestamp |

### 3. Order Items JSON Format

Instead of just storing variant IDs, store full item details:

```json
[
  {
    "variantId": "knack_record_id_123",
    "productId": "product-slug",
    "productTitle": "Product Name",
    "variantTitle": "Variant Name",
    "sku": "SKU-001",
    "quantity": 2,
    "unitPriceCad": 25.50,
    "isAddon": false,
    "regularPrice": 25.50,
    "addonPrice": null
  },
  {
    "variantId": "knack_record_id_456",
    "productId": "product-slug-2",
    "productTitle": "Another Product",
    "variantTitle": "Variant 2",
    "sku": "SKU-002",
    "quantity": 1,
    "unitPriceCad": 14.50,
    "isAddon": true,
    "regularPrice": 19.00,
    "addonPrice": 14.50
  }
]
```

## Implementation Steps

1. **Add fields to Orders object** (field keys will be provided after creation)
2. **Create Promo Codes object** (object_13)
3. **Update checkout API** to:
   - Accept promo code
   - Store order items as JSON
   - Track promo code usage
4. **Update admin dashboard** to show:
   - Promo code usage stats
   - Order item quantities

## Benefits

✅ **Track promo code performance** - See which codes drive sales  
✅ **Calculate promotion bonuses** - Know exactly how much discount was given per code  
✅ **Inventory tracking** - Know quantities sold per variant  
✅ **Sales analytics** - Better reporting on what's selling

