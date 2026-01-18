# Knack Database Fields for Pricing System

## Overview

This document outlines the Knack database fields used by the automated pricing system. Pricing is calculated during the scraping step and uploaded directly to Knack.

---

## Pricing Fields in Variants Object (object_7)

These fields are populated automatically by the `ai_scraper.py`:

| Field Name | Field Key | Field Type | Description |
|------------|-----------|------------|-------------|
| **Price CNY** | field_64 | Number | Item price from Taobao |
| **Shipping CNY** | field_151 | Number | Shipping cost (default: 30) |
| **Cost CAD** | field_173 | Number | Calculated: (Price CNY + Shipping) × 0.19 |
| **Price CAD** | field_138 | Number | Calculated selling price |
| **Margin Standard** | field_154 | Number (%) | Margin after salesperson cut |
| **Margin Promo** | field_155 | Number (%) | Margin after all promo cuts |
| **Status** | field_67 | Text | Active / Out of Stock |

---

## How Pricing is Populated

Pricing is calculated and uploaded **automatically** during the scraping process:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTOMATED PRICING FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. SCRAPE (ai_scraper.py)                                          │
│     └─ Extracts Price CNY from Taobao                               │
│                                                                      │
│  2. CALCULATE (calculate_price_cad function)                        │
│     ├─ Cost CAD = (Price CNY + 30) × 0.19                           │
│     ├─ Price CAD = Cost CAD ÷ 0.60                                  │
│     ├─ Margin Standard = (Price × 0.90 - Cost) ÷ Price              │
│     └─ Margin Promo = (Price × 0.72 - Cost) ÷ (Price × 0.90)        │
│                                                                      │
│  3. UPLOAD TO KNACK                                                  │
│     ├─ Price CNY → field_64                                         │
│     ├─ Cost CAD → field_173                                         │
│     ├─ Price CAD → field_138                                        │
│     ├─ Margin Standard → field_154                                  │
│     ├─ Margin Promo → field_155                                     │
│     └─ Status → field_67 (Active if in stock)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Pricing Configuration

Located in `scraper/ai_scraper.py`:

```python
PRICING_CONFIG = {
    'exchange_rate': 0.19,        # 1 CNY = 0.19 CAD
    'shipping_cny': 30,           # Fixed shipping per item (CNY)
    'salesperson_cut': 0.10,      # 10% of revenue to salesperson
    'promoter_cut': 0.10,         # 10% to promoter (if promo code)
    'target_margin': 0.30,        # 30% target margin on sale price
}
```

---

## Field Keys Reference

### Products Object (object_6)

| Field | Key | Description |
|-------|-----|-------------|
| ID | field_45 | Product ID (from Taobao URL) |
| SKU | field_46 | Generated SKU |
| Title | field_47 | English product title |
| Status | field_51 | Active / Inactive |
| Price CAD Base | field_138 | Base price (from first variant) |

### Variants Object (object_7)

| Field | Key | Description |
|-------|-----|-------------|
| Product | field_61 | Connection to product |
| Variant Name | field_62 | English variant name |
| Price CNY | field_64 | Taobao price |
| Price CAD | field_138 | Selling price |
| Cost CAD | field_173 | Landed cost |
| Margin Standard | field_154 | Margin % (standard sale) |
| Margin Promo | field_155 | Margin % (promo sale) |
| Status | field_67 | Active / Out of Stock |
| Option Type 1 | field_142 | First option type (Color/Size) |
| Option Value 1 | field_143 | First option value |
| Option Type 2 | field_144 | Second option type |
| Option Value 2 | field_145 | Second option value |

---

## Recalculating Prices

If you need to recalculate prices (e.g., after changing exchange rate):

### Option 1: Re-run Scraper
```bash
cd scraper
python3 ai_scraper.py
```

### Option 2: Use CSV to Knack Script
```bash
cd scraper
python3 csv_to_knack.py
```

This will recalculate prices for all products in the CSV and update Knack.

---

## Updating Pricing Configuration

1. Edit `PRICING_CONFIG` in `scraper/ai_scraper.py`
2. Re-run the scraper or csv_to_knack.py
3. All prices will be recalculated and updated

---

**Last Updated**: January 2026
