# Knack Import Data - CSV Files

This folder contains CSV files ready for import into Knack. Each file corresponds to a database object.

## Files

1. **users.csv** - User accounts (8 customers + 3 admins/staff)
2. **products.csv** - Product catalog (10 sample products)
3. **variants.csv** - Product variants (18 variants linked to products)
4. **orders.csv** - Customer orders (5 sample orders with various statuses)
5. **clips.csv** - User video clips (8 sample clips)
6. **signups.csv** - Player signups (20 signups across multiple dates)

## Import Order

**Important:** Import in this order to maintain relationships:

1. **Users** first (orders, clips, signups reference users)
2. **Products** second (variants depend on products)
3. **Variants** third (links to products)
4. **Orders** fourth (references users and products)
5. **Clips** fifth (references users)
6. **Signups** sixth (references users)

## How to Import

### Method 1: Knack Builder (Recommended)

1. Log into your Knack application
2. Go to the object you want to import (e.g., Products)
3. Click **Import** button (top right)
4. Select **CSV File**
5. Choose the corresponding CSV file
6. Map columns to fields:
   - Match CSV column names to your Knack field names
   - For connection fields (like Product in Variants), you may need to import by ID or name
7. Click **Import**

### Method 2: Knack API

Use the provided `createKnackRecord` functions in `lib/knack-client.ts` to programmatically import.

## Field Mapping Notes

### Products
- **ID** → Your unique identifier field
- **Images** → JSON array stored as text (e.g., `["url1","url2"]`)
- **Status** → Single Choice field with options: Active, Draft, Discontinued, Out of Stock

### Variants
- **Product** → Connection field linking to Products object
  - You may need to import by Product ID (PROD-001, PROD-002, etc.)
  - Or map by Product SKU if your connection uses that
- **Date Format** → Dates: MM/DD/YYYY, Times: HH:MM (24-hour format)

### Orders
- **User ID** → Connection or Text field linking to Users object
- **Items** → JSON array stored as text
- **Shipping Info, Pickup Info, Dropoff Info, Taobao Info** → JSON objects stored as text
- **Status History** → JSON array stored as text (dates in MM/DD/YYYY HH:MM format)
- **Payment Method** → Single Choice: etransfer
- **Payment Status** → Single Choice: pending, paid
- **Status** → Single Choice with workflow options
- **Date Format** → Dates: MM/DD/YYYY, Times: HH:MM (24-hour format)

### Clips
- **User ID** → Connection or Text field linking to Users object
- **Tags** → JSON array stored as text (e.g., `["speedsoft","milsim"]`)
- **Liked By** → JSON array stored as text (e.g., `["user1","user2"]`)
- **Date** → Text field in MM/DD/YYYY format
- **Date Format** → Dates: MM/DD/YYYY, Times: HH:MM (24-hour format)

### Signups
- **User ID** → Connection or Text field linking to Users object (empty for guests)
- **Is Guest** → True/False field
- **Sponsor User ID** → Connection or Text field linking to Users object (for guests)
- **Sponsor fields** → Only populated for guest signups
- **Date** → Text field in MM/DD/YYYY format
- **Date Format** → Dates: MM/DD/YYYY, Times: HH:MM (24-hour format)

## Data Notes

### Sample Data
- All data is **sample/test data** - replace with your actual data
- User IDs are placeholders (user_abc123, etc.)
- Product IDs follow pattern: PROD-001, PROD-002, etc.
- Order Numbers follow pattern: ORD-2025-001, etc.

### Required Fields
Make sure these fields are marked as required in Knack:
- Users: User ID, Email, Username, Role, Is Active
- Products: ID, SKU, Title, Status, Price CAD (Base)
- Variants: Product (connection), Variant Name, Price CNY, Status
- Orders: Order Number, User ID, User Email, Customer Name, Status
- Clips: User ID, Username, Title, YouTube URL, YouTube ID
- Signups: Username, Is Guest, Date

### JSON Fields
Fields that store JSON (Items, Tags, Status History, etc.) are stored as **Text/Paragraph** fields in Knack. The JSON is stored as a string and parsed by the application code.

## Troubleshooting

### Connection Fields Not Working
- Ensure Products are imported before Variants
- Check that Product IDs in variants.csv match actual Product IDs in Knack
- You may need to manually link after import, or use Knack's connection field mapping

### Date Format Issues
- **Dates**: MM/DD/YYYY format (e.g., `11/24/2025`)
- **Times**: HH:MM in 24-hour format (e.g., `14:30` for 2:30 PM)
- **Combined**: `MM/DD/YYYY HH:MM` (e.g., `11/24/2025 14:30`)
- Ensure your Knack Date/Time fields are configured to accept this format
- You may need to set field type to "Date" or "Date/Time" in Knack

### JSON Fields Not Parsing
- Ensure JSON fields are set as **Text** or **Paragraph** type in Knack
- The application code will parse the JSON strings
- Verify JSON is valid (no trailing commas, proper quotes)

### Duplicate Records
- Check for unique constraints on ID/SKU fields
- Knack may skip duplicates or create new records - check import results

## After Import

1. **Verify Data**
   - Check record counts match expected
   - Verify connections (Users ↔ Orders, Products ↔ Variants)
   - Test a few records manually
   - Verify date/time formats display correctly

2. **Update Environment Variables**
   ```bash
   USE_KNACK_DATABASE=true
   KNACK_APPLICATION_ID=your-app-id
   KNACK_REST_API_KEY=your-api-key
   ```

3. **Test Application**
   - Visit `/shop` - should show products
   - Create a test order
   - Submit a test clip
   - Add a test signup

4. **Clean Up Sample Data** (if needed)
   - Delete sample records
   - Import your actual data

## Next Steps

1. Import all CSV files in order
2. Verify relationships are correct
3. Test the application with Knack enabled
4. Import your actual data (replace sample data)
5. Remove old Notion/Firestore dependencies

For detailed schema information, see `KNACK_DATABASE_SCHEMA.md` in the shop directory.
