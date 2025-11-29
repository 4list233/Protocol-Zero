# Knack CSV Import Instructions

## Quick Start

1. **Import Order** (CRITICAL - follow this order):
   ```
   1. users.csv
   2. products.csv
   3. variants.csv
   4. orders.csv
   5. clips.csv
   6. signups.csv
   ```

2. **Date/Time Format**:
   - Dates: `MM/DD/YYYY` (e.g., `11/24/2025`)
   - Times: `HH:MM` in 24-hour format (e.g., `14:30` for 2:30 PM)
   - Combined: `MM/DD/YYYY HH:MM` (e.g., `11/24/2025 14:30`)

3. **In Knack Builder**:
   - Go to each object
   - Click **Import** → **CSV File**
   - Map columns to fields
   - Import

## File Details

### users.csv
- **11 records**: 8 customers + 3 admins/staff
- **Fields**: User ID, Email, Display Name, Username, Phone, Role, Is Active
- **Roles**: customer, admin, staff
- **Import First**: Other objects reference users

### products.csv
- **10 records**: Sample product catalog
- **Fields**: ID, SKU, Title, Price, Images, Status, etc.
- **Status**: All set to "Active"
- **Import Second**: Variants depend on products

### variants.csv
- **18 records**: Product variants (sizes, colors, etc.)
- **Fields**: Product (connection), Variant Name, Price CNY, Stock, etc.
- **Connection**: Links to Products via Product ID
- **Import Third**: After products are imported

### orders.csv
- **5 records**: Sample orders with various statuses
- **Fields**: Order Number, User ID, Items (JSON), Status, Payment, etc.
- **JSON Fields**: Items, Shipping Info, Pickup Info, Status History
- **Import Fourth**: After users and products

### clips.csv
- **8 records**: User-submitted video clips
- **Fields**: User ID, Title, YouTube URL, Tags (JSON), Likes, etc.
- **JSON Fields**: Tags, Liked By
- **Import Fifth**: After users

### signups.csv
- **20 records**: Player signups (authenticated + guests)
- **Fields**: User ID, Username, Is Guest, Sponsor Info, Date
- **Guest Signups**: Empty User ID, has Sponsor User ID
- **Import Sixth**: After users

## Important Notes

### Date Format
All dates and times use:
- **Date**: `MM/DD/YYYY` format
- **Time**: `HH:MM` in 24-hour format (00:00 to 23:59)
- **Combined**: `MM/DD/YYYY HH:MM`

Examples:
- `11/24/2025` (date only)
- `14:30` (time only - 2:30 PM)
- `11/24/2025 14:30` (date and time)

### JSON Fields
These fields contain JSON strings (stored as Text/Paragraph in Knack):
- **Orders**: Items, Shipping Info, Pickup Info, Dropoff Info, Taobao Info, Status History
- **Clips**: Tags, Liked By

The application code will parse these JSON strings.

### Connections
- **Variants → Products**: Use Product ID (PROD-001, PROD-002, etc.)
- **Orders → Users**: Use User ID (user_abc123, etc.)
- **Clips → Users**: Use User ID
- **Signups → Users**: Use User ID (or Sponsor User ID for guests)

### Required Fields
Make sure these are marked as required in Knack:
- Users: User ID, Email, Username, Role
- Products: ID, SKU, Title, Status
- Variants: Product (connection), Variant Name, Price CNY
- Orders: Order Number, User ID, Status
- Clips: User ID, Title, YouTube URL
- Signups: Username, Date

## Troubleshooting

### Dates Not Importing
- Verify field type is "Date" or "Date/Time" in Knack
- Check format matches: `MM/DD/YYYY HH:MM`
- Some systems may need: `MM/DD/YYYY HH:MM:SS` (add `:00` for seconds)

### Connections Not Working
- Import parent objects first (Users before Orders, Products before Variants)
- Verify IDs match exactly (case-sensitive)
- Check connection field is set to correct object type

### JSON Fields Showing as Text
- This is correct! JSON fields are stored as text
- Application code will parse them
- Verify JSON is valid (no syntax errors)

### Duplicate Records
- Check unique constraints on ID fields
- Knack may skip duplicates or create new records
- Review import results carefully

## After Import

1. Verify record counts:
   - Users: 11
   - Products: 10
   - Variants: 18
   - Orders: 5
   - Clips: 8
   - Signups: 20

2. Test connections:
   - Check Variants link to Products
   - Check Orders link to Users
   - Check Clips link to Users

3. Verify dates display correctly in Knack

4. Update environment variables:
   ```bash
   USE_KNACK_DATABASE=true
   KNACK_APPLICATION_ID=your-app-id
   KNACK_REST_API_KEY=your-api-key
   ```

5. Test the application with Knack enabled

## Next Steps

- Replace sample data with your actual data
- Set up views in Knack for common queries
- Configure permissions for each object
- Test API access with your credentials
