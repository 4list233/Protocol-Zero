# Notion Database Schema Reference

## Database Information

### Products Database
- **Name:** Protocol Zero - Products
- **ID:** `[TO BE FILLED]`
- **Properties:** 18 total

### Product Variants Database
- **Name:** Protocol Zero - Product Variants
- **ID:** `[TO BE FILLED]`
- **Properties:** 8 total

## Properties Quick Reference

### Products Database Properties
1. Title (Title)
2. ID (Text)
3. SKU (Text)
4. Title Original (Text)
5. Category (Select): Gear, Apparel, Accessories, Electronics
6. Status (Select): Active, Draft, Discontinued, Out of Stock
7. Description (Text - Rich)
8. Price CAD (Base) (Number)
9. Margin (Number)
10. **Images (Files & media)** - Primary storage for product images
11. Image Paths (Text) - *Deprecated: Use Images property*
12. **Detail Image (Files & media)** - Primary storage for detail/long images
13. Detail Image Path (Text) - *Deprecated: Use Detail Image property*
14. Variants (Relation → Product Variants)
15. Stock (Number)
16. URL (URL)
17. Supplier Notes (Text)
18. Last Updated (Last edited time)

**Note:** The seeding script now uploads images as Files directly to Notion instead of storing file paths as text. This saves local storage and leverages Notion's file management.

### Product Variants Properties
1. Variant Name (Title)
2. Product (Relation → Products)
3. SKU (Text)
4. Price CNY (Number)
5. Price CAD Override (Number)
6. Stock (Number)
7. Status (Select): Active, Out of Stock
8. Sort Order (Number)

## Setup Status

- [ ] Notion Integration Created
- [ ] Products Database Created
- [ ] Product Variants Database Created
- [ ] Relation Configured
- [ ] Databases Shared with Integration
- [ ] Environment Variables Set

## Notes

Created: November 19, 2025
Last Updated: November 19, 2025
