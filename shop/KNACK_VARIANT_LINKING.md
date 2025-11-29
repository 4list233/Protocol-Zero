# Knack Variant to Product Linking Format

## Overview
Variants are linked to products by matching:
- **Variant's field_61** (product connection) = **Product's field_45** (ID field)

## Format for Seeding/Creating Variants

When creating or updating a variant in Knack, set the product connection field (field_61) to an **array containing the product's record ID**.

### Example

```javascript
// First, create the product and get its record ID
const productRecordId = await createKnackRecord(PRODUCTS_OBJECT_KEY, productData);

// Then create variants with connection field
const variantData = {
  [VARIANT_FIELDS.product]: [productRecordId],  // Array with product's record ID
  [VARIANT_FIELDS.variantName]: "Color: Black",
  // ... other variant fields
}

// Where:
// - VARIANT_FIELDS.product = 'field_61'
// - productRecordId = the Knack record ID returned from creating the product
```

### Important Notes

1. **Use array format with record ID**: Set field_61 to an array containing the product's Knack record ID: `[productRecordId]`

2. **Product must be created first**: The product must be created before variants, so you have the `productRecordId` to use in the connection field.

3. **Knack displays by field_45**: Even though you use the record ID for the connection, Knack will display/match the connection using the product's field_45 value when reading back.

3. **Knack returns HTML**: When reading variants back from Knack, field_61 may be returned as HTML:
   ```html
   <span class="..." data-kn="connection-value">wosport-l4g24-</span>
   ```
   The code automatically extracts the text content from this HTML format.

4. **Matching Logic**: The system extracts the text content from field_61 and compares it to the product's field_45 value. If they match exactly, the variant is linked to that product.

## Code Reference

See `shop/lib/knack-products.ts`:
- `fetchProducts()` - Groups variants by matching field_61 to field_45
- `fetchProductById()` - Filters variants by matching field_61 to product's field_45

The extraction logic handles:
- Plain string values
- HTML wrapped values (extracts text from `<span>` tags)
- Object formats
- Array formats

## Example from CSV Import Script

```javascript
// From shared/scripts/csv-to-knack.js
const variantData = {};
variantData[VARIANT_FIELDS.product] = product.id; // Same value as field_45
variantData[VARIANT_FIELDS.variantName] = variant.variantName;
// ... other fields

await createKnackRecord(VARIANTS_OBJECT_KEY, variantData);
```

Where `product.id` is the product's field_45 value (e.g., `"wosport-l4g24-"`).

