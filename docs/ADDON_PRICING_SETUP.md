# Add-On Pricing System Setup

## Overview

The add-on pricing system allows small items that are unprofitable when sold alone (due to shipping costs) to become highly profitable when added to an existing order.

**The key insight:** When a customer already has an item in their cart, adding a small item doesn't increase shipping cost - they ship together for the same ¥70.

## Economics Example

| Scenario | Cable Organizer 1pc |
|----------|---------------------|
| **Standalone** | ¥9 + ¥70 ship = $15.80 cost → $12.75 price = **-34% margin** ❌ |
| **Add-on** | ¥9 only = $1.80 cost → $5.00 price = **54% margin** ✅ |

Customer saves $7+, you make 54% margin. Win-win!

---

## Step 1: Add New Knack Fields

In Knack Builder, go to **Variants (object_7)** and add these fields:

### Is Add-on Item
- **Field Name:** Is Add-on Item
- **Field Type:** Yes/No
- **Default Value:** No
- **Description:** Mark items eligible for discounted add-on pricing

### Add-on Price CAD
- **Field Name:** Add-on Price CAD
- **Field Type:** Number (Currency)
- **Description:** Discounted price when added to an order with other items

### Add-on Cost CAD
- **Field Name:** Add-on Cost CAD
- **Field Type:** Number (Currency)
- **Description:** Cost basis without shipping (for margin calculation)

### Add-on Margin
- **Field Name:** Add-on Margin
- **Field Type:** Number (Percentage)
- **Description:** Profit margin at add-on price

### Min Cart for Add-on
- **Field Name:** Min Cart for Add-on
- **Field Type:** Number (Currency)
- **Default Value:** 0
- **Description:** Minimum cart value to unlock add-on pricing (optional)

---

## Step 2: Record Field Keys

After creating the fields, note their keys (e.g., `field_158`, `field_159`, etc.):

| Field Name | Your Field Key |
|------------|----------------|
| Is Add-on Item | field_\_\_\_ |
| Add-on Price CAD | field_\_\_\_ |
| Add-on Cost CAD | field_\_\_\_ |
| Add-on Margin | field_\_\_\_ |
| Min Cart for Add-on | field_\_\_\_ |

---

## Step 3: Update Environment/Config

Add the field keys to your configuration:

```bash
# In .env or knack-config.ts
KNACK_FIELD_VARIANTS_IS_ADDON=field_XXX
KNACK_FIELD_VARIANTS_ADDON_PRICE=field_XXX
KNACK_FIELD_VARIANTS_ADDON_COST=field_XXX
KNACK_FIELD_VARIANTS_ADDON_MARGIN=field_XXX
KNACK_FIELD_VARIANTS_MIN_CART_ADDON=field_XXX
```

---

## Step 4: Run Add-on Pricing Script

```bash
cd shared/scripts
node addon-pricing-calculator.js --dry-run   # Preview
node addon-pricing-calculator.js             # Apply
```

---

## Pricing Formula

```
Target Add-on Margin: 50%
Salesperson Cut: 10%

Add-on Cost = Item CNY × Exchange Rate (no shipping!)
Add-on Price = Add-on Cost / (1 - target_margin - salesperson_cut)
             = Add-on Cost / 0.40
             = Add-on Cost × 2.5
```

---

## Items Eligible for Add-on Pricing

Items that are:
1. Currently marked as **Unprofitable** (status)
2. Have low CNY cost (small items)
3. Would be profitable without shipping allocation

| Item | CNY | Add-on Cost | Add-on Price (50%) | Margin |
|------|-----|-------------|-------------------|--------|
| Cable Organizer 1pc | ¥9 | $1.80 | $4.50 | 50% |
| Single Mag Pouch | ¥18 | $3.60 | $9.00 | 50% |
| Arm Sleeve | ¥14 | $2.80 | $7.00 | 50% |
| Mag Insert | ¥10 | $2.00 | $5.00 | 50% |

---

## Shop Frontend Implementation

### Product Page Display

```
┌─────────────────────────────────────────────┐
│  Cable Organizer (1 piece)                  │
│                                             │
│  Regular Price: $20.00                      │
│                                             │
│  🏷️ ADD-ON DEAL: Only $4.50 when added     │
│     to any order over $30!                  │
│                                             │
│  [Add to Cart - $20.00]                     │
│  [Add as Add-on - $4.50] ← shown if cart    │
│                            has $30+ items   │
└─────────────────────────────────────────────┘
```

### Cart Logic

```javascript
function getItemPrice(item, cart) {
  if (item.isAddonItem && cart.subtotal >= item.minCartForAddon) {
    return item.addonPriceCad;  // Discounted add-on price
  }
  return item.sellingPriceCad;  // Regular price
}
```

### Checkout Summary

```
┌─────────────────────────────────────────────┐
│  Your Cart                                  │
│  ─────────────────────────────────────────  │
│  2011 Holster                    $53.55     │
│  Cable Organizer (ADD-ON)         $4.50     │
│                          You save: $15.50!  │
│  ─────────────────────────────────────────  │
│  Subtotal                        $58.05     │
└─────────────────────────────────────────────┘
```

---

## Benefits

### For Customers
- Save money on small accessories
- Incentive to add more items
- Better value bundles

### For Business
- Convert unprofitable items to 50%+ margin
- Increase average order value
- Clear inventory of small items
- More sales overall

---

## Next Steps

1. ✅ Add Knack fields
2. ✅ Run add-on pricing script
3. ⬜ Implement frontend add-on UI
4. ⬜ Update cart logic for add-on pricing
5. ⬜ Track add-on conversion metrics

