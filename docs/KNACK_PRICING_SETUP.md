# Knack Database Modifications for Pricing System

## Overview

This document outlines the fields needed in your Knack database to support automated pricing calculations based on the ratio-scaling model.

---

## Required Field Additions

### Variants Object (object_7) - NEW FIELDS NEEDED

| Field Name | Field Type | Description | Required |
|------------|------------|-------------|----------|
| **Cost CNY** | Number | Actual cost to purchase from Taobao (may differ from listed price) | Yes |
| **Shipping CNY** | Number | Shipping cost allocation (default: 70) | No |
| **Is Base Variant** | Yes/No | Mark ONE variant per product as the base for ratio calculations | Yes |
| **Competitor Price CAD** | Number | Research price from Canadian competitors | No |
| **Price Ratio** | Number | Auto-calculated ratio vs base variant | Auto |
| **Total Cost CAD** | Number | Auto-calculated: (Cost CNY + Shipping) × Exchange Rate | Auto |
| **Margin Standard** | Number | Auto-calculated margin % for regular sales | Auto |
| **Margin Promo** | Number | Auto-calculated margin % with promo | Auto |
| **Is Bundle** | Yes/No | Mark variants that are bundles | No |
| **Bundle Components** | Text | What's included in bundle (e.g., "Holster + Belt") | No |

### Products Object (object_6) - OPTIONAL ADDITIONS

| Field Name | Field Type | Description |
|------------|------------|-------------|
| **Base Price CAD** | Number | The calculated base price for ratio scaling |
| **Exchange Rate** | Number | CNY→CAD rate used (default: 0.20) |

---

## Knack Field Setup Instructions

### Step 1: Add New Fields to Variants Object

In Knack Builder:

1. Go to **Data** → **Objects** → **Variants (object_7)**
2. Click **Add Field** for each new field:

#### Cost CNY
- **Field Name:** Cost CNY
- **Field Type:** Number
- **Description:** Actual cost to buy from Taobao
- **Default Value:** (leave empty - copy from Price CNY initially)

#### Shipping CNY
- **Field Name:** Shipping CNY  
- **Field Type:** Number
- **Default Value:** 70
- **Description:** Shipping cost per item in CNY

#### Is Base Variant
- **Field Name:** Is Base Variant
- **Field Type:** Yes/No
- **Default Value:** No
- **Description:** Check this for the main/core variant that others scale from

#### Competitor Price CAD
- **Field Name:** Competitor Price CAD
- **Field Type:** Number (Currency)
- **Description:** Research price from Canadian competitors

#### Total Cost CAD
- **Field Name:** Total Cost CAD
- **Field Type:** Number (Currency)
- **Description:** Auto-calculated by pricing script

#### Margin Standard
- **Field Name:** Margin Standard
- **Field Type:** Number (%)
- **Description:** Profit margin on regular sales

#### Margin Promo  
- **Field Name:** Margin Promo
- **Field Type:** Number (%)
- **Description:** Profit margin with promo code applied

#### Is Bundle
- **Field Name:** Is Bundle
- **Field Type:** Yes/No
- **Default Value:** No

#### Bundle Components
- **Field Name:** Bundle Components
- **Field Type:** Short Text
- **Description:** e.g., "Holster + Belt + Mag Pouch"

### Step 2: Note the Field Keys

After creating each field, note the **Field Key** (e.g., `field_150`, `field_151`, etc.).

You'll need to add these to your environment or `knack-config.ts`:

```typescript
// Add to variants fields in knack-config.ts
variants: {
  // ... existing fields ...
  costCny: 'field_XXX',           // Replace XXX with actual key
  shippingCny: 'field_XXX',
  isBaseVariant: 'field_XXX',
  competitorPriceCad: 'field_XXX',
  totalCostCad: 'field_XXX',
  marginStandard: 'field_XXX',
  marginPromo: 'field_XXX',
  isBundle: 'field_XXX',
  bundleComponents: 'field_XXX',
}
```

---

## Data Migration

### Initial Setup for Existing Variants

For existing variants, you'll need to:

1. **Copy Price CNY → Cost CNY** (for items where Taobao price = cost)
2. **Set Shipping CNY = 70** for all variants
3. **Mark one base variant per product** (usually the core/standalone item)
4. **Enter Competitor Price CAD** for base variants (from market research)

---

## Pricing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRICING FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. SETUP (Manual)                                                   │
│     ├─ Set Cost CNY for each variant                                │
│     ├─ Set Shipping CNY (default 70)                                │
│     ├─ Mark ONE base variant per product                            │
│     └─ Enter Competitor Price CAD for base variant                  │
│                                                                      │
│  2. CALCULATE BASE PRICE (Script)                                   │
│     └─ Base Price CAD = Competitor Price × 0.85                     │
│                                                                      │
│  3. CALCULATE VARIANT PRICES (Script)                               │
│     └─ Variant CAD = Base Price × (Variant CNY / Base CNY)          │
│                                                                      │
│  4. CALCULATE COSTS (Script)                                        │
│     └─ Total Cost = (Cost CNY + Shipping CNY) × Exchange Rate       │
│                                                                      │
│  5. CALCULATE MARGINS (Script)                                      │
│     ├─ Standard = 1 - 0.10 - (Cost / Price)                         │
│     └─ Promo = 0.80 - (Cost / Net Revenue)                          │
│                                                                      │
│  6. UPDATE DATABASE (Script)                                        │
│     └─ Write Price CAD, Total Cost, Margins to Knack                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Example Workflow

### Product: 2011 Holster Set

**Step 1: Researcher enters data in Knack:**

| Variant | Cost CNY | Price CNY | Is Base | Competitor CAD |
|---------|----------|-----------|---------|----------------|
| Holster only | ¥45 | ¥59 | ✓ YES | $45 |
| Belt only | ¥28 | ¥35 | No | |
| Belt + Holster | ¥68 | ¥89 | No | |

**Step 2: Script calculates and writes:**

| Variant | Price CAD | Cost CAD | Margin Std | Margin Promo |
|---------|-----------|----------|------------|--------------|
| Holster only | $38.25 | $23.00 | 29.8% | 12.6% |
| Belt only | $22.69 | $19.60 | -3.5% | -24.0% ❌ |
| Belt + Holster | $57.70 | $27.60 | 42.2% | 26.5% |

**Step 3: Admin reviews flagged variants (negative margins)**

---

## Validation Rules

The pricing script should enforce:

1. **Every product must have exactly ONE base variant marked**
2. **Base variant must have Competitor Price CAD set**
3. **All variants must have Cost CNY > 0**
4. **Warn if any margin < 15% (standard) or < 0% (promo)**

---

## Next Steps

1. **Add the new fields in Knack Builder**
2. **Record the field keys**
3. **Update `knack-config.ts` with new field keys**
4. **Run the pricing script to calculate and update prices**

See `shared/scripts/knack-pricing-update.js` for the automated pricing script.


