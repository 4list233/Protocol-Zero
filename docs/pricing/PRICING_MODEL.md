# Protocol Zero Pricing Model

## Overview

This document outlines the automated pricing strategy for Protocol Zero. Pricing is calculated automatically during the scraping process based on CNY costs, exchange rates, and target margins.

---

## 1. Pricing Formula

All pricing is calculated automatically by the `ai_scraper.py` during the scraping step.

### Configuration

```python
PRICING_CONFIG = {
    'exchange_rate': 0.19,        # 1 CNY = 0.19 CAD
    'shipping_cny': 30,           # Fixed shipping per item (CNY)
    'salesperson_cut': 0.10,      # 10% of revenue to salesperson
    'promoter_cut': 0.10,         # 10% to promoter (if promo code)
    'target_margin': 0.30,        # 30% target margin on sale price
}
```

### Core Formulas

| Calculation | Formula |
|-------------|---------|
| **Cost CAD** | `(Price CNY + 30 shipping) × 0.19` |
| **Price CAD** | `Cost CAD ÷ (1 - 0.10 - 0.30)` = `Cost CAD ÷ 0.60` |
| **Margin Standard** | `(Price × 0.90 - Cost) ÷ Price` |
| **Margin Promo** | `(Price × 0.90 × 0.80 - Cost) ÷ (Price × 0.90)` |

### Example Calculation

For a ¥100 CNY item:

```
Cost CAD = (100 + 30) × 0.19 = $24.70
Price CAD = $24.70 ÷ 0.60 = $41.17 → rounded to $40.99
Margin Standard = (40.99 × 0.90 - 24.70) ÷ 40.99 = 29.7%
Margin Promo = (40.99 × 0.90 × 0.80 - 24.70) ÷ (40.99 × 0.90) = 13.0%
```

---

## 2. Cost Structure

### Per-Item Costs

| Cost Component | Value | Notes |
|----------------|-------|-------|
| **Item Cost (CNY)** | Varies | From Taobao listing |
| **Shipping (CNY)** | ¥30 | Fixed per item |
| **CNY → CAD Rate** | 0.19 | Fixed rate |

```
Total_Cost_CAD = (Item_CNY + 30) × 0.19
```

### Example Cost Calculation

For a ¥59 item:
```
Item Cost:     ¥59 × 0.19 = $11.21
Shipping:      ¥30 × 0.19 = $5.70
──────────────────────────────────
Total Cost:                $16.91
```

---

## 3. Revenue Structure & Cuts

### Revenue Split

| Component | Percentage | Base | Notes |
|-----------|------------|------|-------|
| **Salesperson Commission** | 10% | Revenue | Paid on all sales |
| **Promo Code Discount** | 10% | Revenue | Customer discount (optional) |
| **Promoter Cut** | 10% | Revenue | Paid to promo code owner (if applicable) |

### Scenarios

#### Scenario A: Standard Sale (no promo code)
```
Sale Price (Revenue):     $40.99
├─ Salesperson (10%):     -$4.10
├─ Cost:                  -$24.70
└─ Gross Profit:          $12.19  (29.7% margin)
```

#### Scenario B: Promo Code Sale
```
Original Price:           $40.99
├─ Customer Discount (10%): -$4.10
└─ Net Revenue:           $36.89

Net Revenue:              $36.89
├─ Salesperson (10%):     -$3.69
├─ Promoter Cut (10%):    -$3.69
├─ Cost:                  -$24.70
└─ Gross Profit:          $4.81  (13.0% margin)
```

---

## 4. Margin Analysis

### Target Margins

| Scenario | Target | With 30% Target Margin |
|----------|--------|------------------------|
| Standard Sale | 30% | ~30% after salesperson cut |
| Promo Code Sale | 10%+ | ~13% after all cuts |

### Pricing Achieves Target Margins

The formula `Price = Cost ÷ 0.60` is designed to achieve:
- **30% margin** on the sale price after 10% salesperson cut
- **~13% margin** on promo sales after all cuts

---

## 5. Quick Reference Formulas

### Cost
```
Total_Cost_CAD = (Item_CNY + 30) × 0.19
```

### Pricing
```
Price_CAD = Total_Cost_CAD ÷ 0.60
```

### Margin (Standard)
```
Margin = 1 - 0.10 - (Cost / Price)
       = 0.90 - (Cost / Price)
```

### Margin (With Promo)
```
Net_Revenue = Price × 0.90  (after 10% customer discount)
Margin = 1 - 0.10 - 0.10 - (Cost / Net_Revenue)
       = 0.80 - (Cost / Net_Revenue)
```

---

## 6. Exchange Rate Considerations

Current setting: **1 CNY = 0.19 CAD**

To update the exchange rate, modify `PRICING_CONFIG` in:
- `scraper/ai_scraper.py`
- `scraper/csv_to_knack.py`

---

## 7. Adjusting Pricing Parameters

### To Change Target Margin

Edit `PRICING_CONFIG` in `ai_scraper.py`:

```python
PRICING_CONFIG = {
    ...
    'target_margin': 0.30,  # Change this value (0.30 = 30%)
}
```

### To Change Shipping Cost

```python
PRICING_CONFIG = {
    ...
    'shipping_cny': 30,  # Change this value
}
```

### To Change Exchange Rate

```python
PRICING_CONFIG = {
    ...
    'exchange_rate': 0.19,  # Change this value
}
```

After changing, re-run the scraper or use `csv_to_knack.py` to recalculate prices.

---

## 8. Promo Code Economics

### When is a promo code profitable?

A promo code is profitable when it converts a sale that **would not have happened otherwise**.

Break-even analysis:
- Lost revenue per promo sale: 10% discount + 10% promoter = 20%
- If promo code increases conversion by >25%, it's profitable

### Promo Code Recommendations

1. **Limit promo codes** to new customers only
2. **Cap promoter earnings** per month
3. **Tiered promoter rates**: Start at 5%, increase to 10% at volume
4. **Track conversion lift** to validate promo effectiveness

---

## 9. Where Pricing Happens

Pricing is calculated automatically in the **ai_scraper.py** during:

1. **Export step** (`_export()` method) - calculates pricing for CSV/JSON output
2. **Knack upload step** - ensures pricing is set before uploading variants

No manual pricing step is required. All variants get:
- Price CAD (calculated)
- Cost CAD (calculated)
- Margin Standard % (calculated)
- Margin Promo % (calculated)
- Status: Active (if in stock)

---

**Last Updated**: January 2026
