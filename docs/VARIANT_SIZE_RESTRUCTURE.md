# Variant Size Restructure Guide

## Overview
This guide explains how to restructure variants so that:
- Model variants (Color + Quantity) are the main variants
- Sizes are stored as a multi-select field on model variants
- Orders track both the variant and the selected size
- Knack dashboard shows variant + selected size for each order

## Step 1: Understand the Field Structure

The script uses a **two-field reference system**:

- **Option Type 1 / Option Value 1**: The selected option (e.g., "Color: White")
- **Option Type 2 / Option Value 2**: All available options (e.g., "Available Sizes: XXS,XS,S,M,L")

This structure allows you to:
- See what was selected (Option Value 1)
- See what options were available (Option Value 2) - useful for reference in Knack dashboard

**No special field configuration needed** - Option Value 2 is a text field storing comma-separated values.

## Step 2: Run the Merge Script

Run the script to merge size variants into model variants:

```bash
# Dry run first to see what will change
node shared/scripts/merge-size-variants-into-models.js --dry-run

# Process specific product (honeycomb sleeve)
node shared/scripts/merge-size-variants-into-models.js --product-id=692e728dfa364bcdfb6f3e62

# Process all products
node shared/scripts/merge-size-variants-into-models.js
```

**What the script does:**
- Identifies model variants (Color + Quantity) vs standalone option variants (sizes/colors)
- Collects all available options from standalone variants
- Updates model variants:
  - Option Value 1 = Selected option (e.g., "White" for color)
  - Option Value 2 = All available options (e.g., "XXS,XS,S,M,L" for sizes) - comma-separated reference
- Archives standalone option variants (sets status to Inactive)

## Step 3: Update Checkout Route

The checkout route needs to capture and store the selected size. Update `shop/app/api/checkout/route.ts`:

1. Add `selectedSize` to the `CheckoutItem` type:
```typescript
type CheckoutItem = {
  variantId: string
  productId: string
  productTitle: string
  variantTitle: string
  sku: string
  quantity: number
  unitPriceCad: number
  selectedSize?: string  // ADD THIS
  isAddon?: boolean
  regularPrice?: number
  addonPrice?: number
}
```

2. Include `selectedSize` in the order items JSON:
```typescript
const orderItemsJson = body.items.map(item => ({
  variantId: item.variantId,
  productId: item.productId,
  productTitle: item.productTitle,
  variantTitle: item.variantTitle,
  sku: item.sku,
  quantity: item.quantity,
  unitPriceCad: item.unitPriceCad,
  selectedSize: item.selectedSize,  // ADD THIS
  isAddon: item.isAddon || false,
  regularPrice: item.regularPrice,
  addonPrice: item.addonPrice,
}))
```

## Step 4: Update Frontend to Send Selected Size

Update the cart/checkout components to include the selected size when adding items to cart and during checkout.

In `shop/lib/cart-context.tsx` or wherever cart items are structured, ensure the selected size is included:

```typescript
// When adding to cart
addItem({
  productId: product.id,
  variantId: variant.id,
  selectedSize: selectedSize,  // From size dropdown selection
  // ... other fields
})
```

## Step 5: View Orders in Knack Dashboard

After these changes:
- Orders will have an `itemsJson` field containing the full order details
- Each item in the JSON will include:
  - `variantId`: Links to the model variant
  - `variantTitle`: Name of the variant (e.g., "1x Extended Honeycomb Sports Arm Sleeve – White")
  - `selectedSize`: The size chosen by the customer (e.g., "L")
  - `quantity`, `unitPriceCad`, etc.

**To view in Knack:**
1. Open an order record
2. Look at the "Items JSON" field (or parse it if stored as text)
3. You'll see the variant details + selected size for each item

**To view available options for a variant:**
1. Open the variant record
2. Look at Option Value 2 field - it shows all available sizes/colors as comma-separated values
3. Option Value 1 shows the selected option (e.g., "White" for color)

## Example Order Item JSON

```json
{
  "variantId": "abc123",
  "productId": "prod456",
  "productTitle": "Extended Honeycomb Sports Arm Guard",
  "variantTitle": "1x Extended Honeycomb Sports Arm Sleeve – White",
  "sku": "HONEY-WHITE-1X",
  "quantity": 1,
  "unitPriceCad": 37.40,
  "selectedSize": "L",
  "isAddon": false
}
```

## Field Structure Example

For a model variant "1x Extended Honeycomb Sports Arm Sleeve – White":

```
Option Type 1: "Color"
Option Value 1: "White"  ← Selected option (what this variant is)

Option Type 2: "Available Sizes"  
Option Value 2: "XXS,XS,S,M,L"  ← All available options (reference)
```

When a customer orders:
- They select the variant (which has Color = White)
- They select a size from the available options (e.g., "L")
- Order stores: variantId + selectedSize = "L"

In Knack dashboard:
- View variant → See Option Value 1 = "White" (selected color)
- View variant → See Option Value 2 = "XXS,XS,S,M,L" (all available sizes)
- View order → See selectedSize = "L" (what customer chose)

## Benefits

1. **Cleaner Variant Structure**: Only model variants are active, option variants are archived
2. **Better Order Tracking**: Can see exactly which option was ordered
3. **Reference Visibility**: Option Value 2 shows all available options for reference
4. **Flexible Options**: Easy to add/remove options without creating new variants
5. **Dashboard Visibility**: Both selected and available options visible in Knack

## Notes

- Size variants are archived (not deleted) so you can reference them if needed
- The multi-select field stores all available sizes, customer selects one during checkout
- If you need to change which field stores sizes, update `FIELD_AVAILABLE_SIZES` in the script

