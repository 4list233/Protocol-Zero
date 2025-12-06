# Knack Fields to Add for Promo Code Tracking & Order Quantities

## ✅ Code is Ready - Just Add These Fields in Knack

The code has been updated to track promo codes and store order item quantities. You just need to add these fields in Knack Builder.

---

## 1. Orders Object (object_10) - Add 3 New Fields

### Field 1: Order Items JSON
- **Field Name:** `Order Items JSON`
- **Type:** Long Text
- **Purpose:** Stores full order details with quantities as JSON
- **Example Value:**
```json
[{"variantId":"123","productId":"product-slug","productTitle":"Product Name","variantTitle":"Variant","sku":"SKU-001","quantity":2,"unitPriceCad":25.50,"isAddon":false}]
```

### Field 2: Promo Code
- **Field Name:** `Promo Code`
- **Type:** Short Text
- **Purpose:** The promo code used (e.g., "PROMO10")
- **Can be empty:** Yes (if no promo code used)

### Field 3: Promo Discount CAD
- **Field Name:** `Promo Discount CAD`
- **Type:** Number
- **Purpose:** Amount discounted from promo code in CAD
- **Can be empty:** Yes (defaults to 0)

---

## 2. Create NEW Object: Promo Codes (object_13)

Create a new object called **"Promo Codes"** with these fields:

### Field 1: Code
- **Field Name:** `Code`
- **Type:** Short Text
- **Required:** Yes
- **Unique:** Yes
- **Purpose:** Unique promo code (e.g., "PROMO10")

### Field 2: Discount %
- **Field Name:** `Discount %`
- **Type:** Number
- **Purpose:** Discount percentage (e.g., 10 for 10%)

### Field 3: Usage Count
- **Field Name:** `Usage Count`
- **Type:** Number
- **Default:** 0
- **Purpose:** How many times this code has been used

### Field 4: Total Discount Given
- **Field Name:** `Total Discount Given`
- **Type:** Number
- **Default:** 0
- **Purpose:** Total CAD amount discounted across all uses

### Field 5: Is Active
- **Field Name:** `Is Active`
- **Type:** Yes/No
- **Default:** Yes
- **Purpose:** Whether code is currently active

### Field 6: Created At
- **Field Name:** `Created At`
- **Type:** Date/Time
- **Purpose:** When code was created

### Field 7: Last Used At
- **Field Name:** `Last Used At`
- **Type:** Date/Time
- **Purpose:** Most recent usage timestamp

---

## 3. Update Field Keys in Code

After creating the fields, update `shop/lib/knack-config.ts` with the actual field keys:

```typescript
// Orders
itemsJson: 'field_XXX',        // Order Items JSON
promoCode: 'field_XXX',        // Promo Code
promoDiscountCad: 'field_XXX', // Promo Discount CAD

// Promo Codes (new object)
promoCodes: {
  objectKey: 'object_13',
  code: 'field_XXX',
  discountPercent: 'field_XXX',
  usageCount: 'field_XXX',
  totalDiscountGiven: 'field_XXX',
  isActive: 'field_XXX',
  createdAt: 'field_XXX',
  lastUsedAt: 'field_XXX',
}
```

---

## What This Enables

✅ **Track promo code usage** - See how many times each code was used  
✅ **Calculate promotion bonuses** - Know total discount given per code  
✅ **Store order quantities** - Know exactly how many of each variant was sold  
✅ **Better analytics** - Report on sales by variant quantity  
✅ **Inventory tracking** - Track what's actually selling

---

## Testing

After adding fields:
1. Place a test order with a promo code
2. Check Orders object - should have promo code and discount
3. Check Promo Codes object - should have usage count = 1
4. Check Order Items JSON - should have quantities for each item

