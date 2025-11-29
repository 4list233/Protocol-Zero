# Knack Field Mapping Configuration

Use this document to map your actual Knack object keys and field names to the codebase.

## Step 1: Application Configuration

Update these in your `.env` file:

```bash
# Knack Application Settings
USE_KNACK_DATABASE=true
KNACK_APPLICATION_ID=6924a52a58e68efc03b8752d
KNACK_REST_API_KEY=fa086580-c06b-4872-88f5-98b6f00c3c68
```

---

## Step 2: Object Key Mapping

In Knack Builder, go to each object's settings and find the **Object Key**. Map them here:

### Current Object Keys (from schema):
- `KNACK_OBJECT_KEY_USERS` = `object_1` → **YOUR KEY:** `_______________`
- `KNACK_OBJECT_KEY_PRODUCTS` = `object_2` → **YOUR KEY:** `_______________`
- `KNACK_OBJECT_KEY_VARIANTS` = `object_3` → **YOUR KEY:** `_______________`
- `KNACK_OBJECT_KEY_ORDERS` = `object_4` → **YOUR KEY:** `_______________`
- `KNACK_OBJECT_KEY_CLIPS` = `object_5` → **YOUR KEY:** `_______________`
- `KNACK_OBJECT_KEY_SIGNUPS` = `object_6` → **YOUR KEY:** `_______________`

**How to find Object Keys:**
1. In Knack Builder, click on an object
2. Click the **Settings** tab (gear icon)
3. Look for **Object Key** - it will be something like `object_1`, `object_abc123`, etc.
4. Copy the exact key and paste it above

---

## Step 3: Field Mapping

For each object, map the CSV column names to your actual Knack field keys or field names.

### Users Object

| CSV Column | Your Knack Field Key/Name | Notes |
|------------|---------------------------|-------|
| User ID | `field_` or `User ID` | |
| Email | `field_` or `Email` | |
| Display Name | `field_` or `Display Name` | |
| Username | `field_` or `Username` | |
| Phone | `field_` or `Phone` | |
| Role | `field_` or `Role` | Single Choice: customer, admin, staff |
| Is Active | `field_` or `Is Active` | True/False |
| Created At | `field_` or `Created At` | Date/Time |
| Updated At | `field_` or `Updated At` | Date/Time |

**How to find Field Keys:**
1. In Knack Builder, click on the object
2. Click on a field
3. In the field settings, look for **Field Key** - it will be like `field_1`, `field_abc123`, etc.
4. OR use the field name if your API is configured to use names

---

### Products Object

| CSV Column | Your Knack Field Key/Name | Notes |
|------------|---------------------------|-------|
| ID | `field_` or `ID` | |
| SKU | `field_` or `SKU` | |
| Title | `field_` or `Title` | |
| Title Original | `field_` or `Title Original` | |
| Description | `field_` or `Description` | |
| Category | `field_` or `Category` | Single Choice |
| Status | `field_` or `Status` | Single Choice: Active, Draft, Discontinued, Out of Stock |
| Price CAD (Base) | `field_` or `Price CAD (Base)` | Number |
| Margin | `field_` or `Margin` | Number |
| Stock | `field_` or `Stock` | Number |
| URL | `field_` or `URL` | Website/Text |
| Primary Image | `field_` or `Primary Image` | File/Text |
| Images | `field_` or `Images` | File/Text (JSON array) |
| Detail Image | `field_` or `Detail Image` | File/Text |
| Created At | `field_` or `Created At` | Date/Time |
| Updated At | `field_` or `Updated At` | Date/Time |

---

### Variants Object

| CSV Column | Your Knack Field Key/Name | Notes |
|------------|---------------------------|-------|
| Product | `field_` or `Product` | **Connection** to Products object |
| Variant Name | `field_` or `Variant Name` | |
| SKU | `field_` or `SKU` | |
| Price CNY | `field_` or `Price CNY` | Number |
| Price CAD Override | `field_` or `Price CAD Override` | Number |
| Stock | `field_` or `Stock` | Number |
| Status | `field_` or `Status` | Single Choice: Active, Out of Stock |
| Sort Order | `field_` or `Sort Order` | Number |
| Created At | `field_` or `Created At` | Date/Time |
| Updated At | `field_` or `Updated At` | Date/Time |

---

### Orders Object

| CSV Column | Your Knack Field Key/Name | Notes |
|------------|---------------------------|-------|
| Order Number | `field_` or `Order Number` | |
| User ID | `field_` or `User ID` | **Connection** to Users object (or Text) |
| User Email | `field_` or `User Email` | Email |
| Customer Name | `field_` or `Customer Name` | |
| Customer Phone | `field_` or `Customer Phone` | Phone |
| Items | `field_` or `Items` | **Text/Paragraph** (JSON array) |
| Subtotal CAD | `field_` or `Subtotal CAD` | Number |
| Shipping CAD | `field_` or `Shipping CAD` | Number |
| Total CAD | `field_` or `Total CAD` | Number |
| Payment Method | `field_` or `Payment Method` | Single Choice: etransfer |
| Payment Status | `field_` or `Payment Status` | Single Choice: pending, paid |
| E-Transfer Reference | `field_` or `E-Transfer Reference` | Text |
| Payment Received At | `field_` or `Payment Received At` | Date/Time |
| Status | `field_` or `Status` | Single Choice (see status options) |
| Shipping Info | `field_` or `Shipping Info` | **Text/Paragraph** (JSON object) |
| Pickup Info | `field_` or `Pickup Info` | **Text/Paragraph** (JSON object) |
| Dropoff Info | `field_` or `Dropoff Info` | **Text/Paragraph** (JSON object) |
| Taobao Info | `field_` or `Taobao Info` | **Text/Paragraph** (JSON object) |
| Status History | `field_` or `Status History` | **Text/Paragraph** (JSON array) |
| Created At | `field_` or `Created At` | Date/Time |
| Updated At | `field_` or `Updated At` | Date/Time |

---

### Clips Object

| CSV Column | Your Knack Field Key/Name | Notes |
|------------|---------------------------|-------|
| User ID | `field_` or `User ID` | **Connection** to Users object (or Text) |
| Username | `field_` or `Username` | |
| User Avatar | `field_` or `User Avatar` | Website/Text |
| Title | `field_` or `Title` | |
| Description | `field_` or `Description` | Paragraph |
| YouTube URL | `field_` or `YouTube URL` | Website/Text |
| YouTube ID | `field_` or `YouTube ID` | Text |
| Tags | `field_` or `Tags` | **Text/Paragraph** (JSON array) |
| Likes | `field_` or `Likes` | Number |
| Liked By | `field_` or `Liked By` | **Text/Paragraph** (JSON array) |
| Comments | `field_` or `Comments` | Number |
| Date | `field_` or `Date` | Text (MM/DD/YYYY format) |
| Timestamp | `field_` or `Timestamp` | Date/Time |
| Created At | `field_` or `Created At` | Date/Time |
| Updated At | `field_` or `Updated At` | Date/Time |

---

### Signups Object

| CSV Column | Your Knack Field Key/Name | Notes |
|------------|---------------------------|-------|
| User ID | `field_` or `User ID` | **Connection** to Users object (or Text, empty for guests) |
| Username | `field_` or `Username` | |
| Display Name | `field_` or `Display Name` | |
| Email | `field_` or `Email` | Email (empty for guests) |
| Is Guest | `field_` or `Is Guest` | True/False |
| Sponsor User ID | `field_` or `Sponsor User ID` | **Connection** to Users object (or Text, for guests only) |
| Sponsor Name | `field_` or `Sponsor Name` | Text (for guests only) |
| Sponsor Email | `field_` or `Sponsor Email` | Email (for guests only) |
| Date | `field_` or `Date` | Text (MM/DD/YYYY format) |
| Timestamp | `field_` or `Timestamp` | Date/Time |
| Created At | `field_` or `Created At` | Date/Time |

---

## Step 4: Update Code with Your Mappings

After filling in the mappings above, you'll need to update the code files:

### Files to Update:

1. **`lib/knack-products.ts`** - Update field references for Products and Variants
2. **`lib/knack-orders.ts`** - Update field references for Orders
3. **`lib/knack-client.ts`** - May need updates if using field names instead of keys

### Example Update Pattern:

If your Product "Title" field is actually `field_5` in Knack, update:

```typescript
// Before (using field name):
title: String(record.title || record.field_3 || '')

// After (using your field key):
title: String(record.field_5 || '')
```

Or if Knack API returns field names:

```typescript
// Using field name (if API supports it):
title: String(record['Title'] || '')
```

---

## Step 5: Field Key vs Field Name

Knack API can work with either:
- **Field Keys**: `field_1`, `field_2`, etc. (always available)
- **Field Names**: `Title`, `SKU`, etc. (if API is configured)

**Check which one works:**
1. Make a test API call to your Knack object
2. See if the response uses `field_1` or `Title`
3. Update code accordingly

**Example API Response:**

```json
{
  "id": "rec_123",
  "field_1": "PROD-001",  // Using field keys
  "field_2": "TV-001"
}
```

OR

```json
{
  "id": "rec_123",
  "ID": "PROD-001",  // Using field names
  "SKU": "TV-001"
}
```

---

## Quick Reference: Finding Field Information

### In Knack Builder:

1. **Object Key:**
   - Object → Settings tab → "Object Key"

2. **Field Key:**
   - Object → Click field → Settings → "Field Key"

3. **Field Name:**
   - Object → Click field → Settings → "Field Name" (what you see in the UI)

4. **Field Type:**
   - Object → Click field → Settings → "Field Type"

---

## Testing Your Mappings

After updating the code:

1. Set environment variables:
   ```bash
   USE_KNACK_DATABASE=true
   KNACK_APPLICATION_ID=6924a52a58e68efc03b8752d
   KNACK_REST_API_KEY=fa086580-c06b-4872-88f5-98b6f00c3c68
   ```

2. Test API connection:
   ```bash
   curl -X GET "https://api.knack.com/v1/objects/YOUR_OBJECT_KEY/records" \
     -H "X-Knack-Application-Id: 6924a52a58e68efc03b8752d" \
     -H "X-Knack-REST-API-Key: fa086580-c06b-4872-88f5-98b6f00c3c68"
   ```

3. Check response format (field keys vs names)

4. Update code files with correct field references

5. Test in application

---

## Notes

- **Field Keys** are more reliable (don't change if you rename fields)
- **Field Names** are more readable but may change
- **Connections** may need special handling - check if they use IDs or names
- **JSON Fields** should be Text or Paragraph type in Knack
- **Date Fields** should be Date or Date/Time type in Knack

---

## Next Steps

1. Fill in all the mappings above
2. Update the code files with your field keys/names
3. Test API access
4. Import CSV files
5. Verify data appears correctly
