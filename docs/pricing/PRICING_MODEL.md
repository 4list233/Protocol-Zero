# Protocol Zero Pricing Model

## Overview

This document outlines the pricing strategy for Protocol Zero, addressing bundle pricing, cost structure, margin calculations, and profit analysis.

---

## 1. The Bundle Pricing Problem

Many Taobao products have variants that are **bundles** of items sold together:

| Variant | What's Included |
|---------|-----------------|
| `2011快拔套可带灯款` | Holster only |
| `外腰带` | Belt only |
| `外腰带+2011快拔套可带灯款` | Belt + Holster |
| `外腰带+2011快拔套可带灯款+单排夹套` | Belt + Holster + Single Mag Pouch |
| `外腰带+2011快拔套带灯款+双排夹套` | Belt + Holster + Double Mag Pouch |

### The Problem

If we price by finding the **lowest Canadian competitor price** and deducting 15%, we get a good base price for the **core item**. But bundles don't add up correctly because:

- Each bundle has a different competitor price (or no direct competitor)
- A "Belt + Holster" bundle should roughly equal "Belt price + Holster price - bundle discount"
- Simply applying competitor analysis to each variant separately creates inconsistent pricing

---

## 2. Bundle Pricing Solution: Ratio-Based Scaling

### Core Concept

1. **Establish a BASE PRICE (CAD)** for the core/primary item using competitor analysis
2. **Use Taobao's CNY price ratios** to scale all other variants proportionally
3. Taobao sellers have already done the math for reasonable bundle pricing ratios

### Formula

```
Variant_CAD = BASE_CAD × (Variant_CNY / Base_CNY)
```

### Example: 2011 Holster Set

Let's say Taobao prices are:
| Variant | CNY Price |
|---------|-----------|
| Holster only (BASE) | ¥59 |
| Belt only | ¥35 |
| Belt + Holster | ¥89 |
| Belt + Holster + Single Mag | ¥109 |
| Belt + Holster + Double Mag | ¥119 |

If competitor analysis gives us **BASE_CAD = $35** for the holster:

| Variant | CNY | Ratio | CAD Price |
|---------|-----|-------|-----------|
| Holster (BASE) | ¥59 | 1.00 | $35.00 |
| Belt only | ¥35 | 0.59 | $20.76 |
| Belt + Holster | ¥89 | 1.51 | $52.85 |
| Belt + Holster + Single Mag | ¥109 | 1.85 | $64.69 |
| Belt + Holster + Double Mag | ¥119 | 2.02 | $70.61 |

### Why This Works

- Taobao sellers already calculated sensible pricing ratios for bundles
- Bundles include a natural "bundle discount" built into the Chinese pricing
- All variant prices stay proportionally consistent
- Canadian buyers see logical price progression for bundles

### Implementation Notes

- **Base variant selection**: Usually the most commonly purchased standalone item
- **Verify ratios**: Check that the math makes sense (bundle should cost less than sum of parts)
- **Override capability**: Some variants may need manual adjustment

---

## 3. Cost Structure

### Per-Item Costs

| Cost Component | Value | Notes |
|----------------|-------|-------|
| **Item Cost (CNY)** | Varies | From Taobao listing |
| **Shipping (CNY)** | ¥70 | Fixed per item (TBD through operations) |
| **CNY → CAD Rate** | ~0.19 | Variable, use current rate |

```
Total_Cost_CAD = (Item_CNY + 70) × CNY_to_CAD_rate
```

### Example Cost Calculation

For a ¥59 holster:
```
Item Cost:     ¥59 × 0.19 = $11.21
Shipping:      ¥70 × 0.19 = $13.30
──────────────────────────────────
Total Cost:                 $24.51
```

---

## 4. Revenue Structure & Cuts

### Revenue Split

| Component | Percentage | Base | Notes |
|-----------|------------|------|-------|
| **Salesperson Commission** | 10% | Revenue | Paid on all sales |
| **Promo Code Discount** | 10% | Revenue | Customer discount (optional) |
| **Promoter Cut** | 10% | Revenue | Paid to promo code owner (if applicable) |

### Scenarios

#### Scenario A: Standard Sale (no promo code)
```
Sale Price (Revenue):     $35.00
├─ Salesperson (10%):     -$3.50
├─ Cost:                  -$24.51
└─ Gross Profit:          $6.99  (20.0% margin)
```

#### Scenario B: Promo Code Sale
```
Original Price:           $35.00
├─ Customer Discount (10%): -$3.50
└─ Net Revenue:           $31.50

Net Revenue:              $31.50
├─ Salesperson (10%):     -$3.15
├─ Promoter Cut (10%):    -$3.15
├─ Cost:                  -$24.51
└─ Gross Profit:          $0.69  (2.2% margin)
```

**⚠️ Warning**: With full promo stack, margins are extremely thin!

---

## 5. Margin Analysis

### Target Margins

| Scenario | Minimum Viable | Target | Comfortable |
|----------|---------------|--------|-------------|
| Standard Sale | 15% | 25-30% | 35%+ |
| Promo Code Sale | 5% | 10-15% | 20%+ |

### Calculating Required Sale Price

To achieve target margins, work backwards:

```
Required_Price = Cost / (1 - salesperson% - target_margin%)

For 25% target margin on standard sale:
Required_Price = $24.51 / (1 - 0.10 - 0.25) = $24.51 / 0.65 = $37.71
```

### Margin Calculator

Given:
- `C` = Total Cost (CAD)
- `S` = Salesperson % (0.10)
- `D` = Promo Discount % (0.10, if applicable)
- `P` = Promoter Cut % (0.10, if promo)
- `R` = Revenue (sale price or discounted price)

**Standard Sale Margin:**
```
Margin = (R - R×S - C) / R
       = (R × (1 - S) - C) / R
       = 1 - S - C/R
```

**Promo Sale Margin:**
```
Net_Revenue = Original_Price × (1 - D)
Margin = (Net_Revenue - Net_Revenue×S - Net_Revenue×P - C) / Net_Revenue
       = 1 - S - P - C/Net_Revenue
       = 1 - 0.10 - 0.10 - C/Net_Revenue
       = 0.80 - C/Net_Revenue
```

---

## 6. Pricing Decision Framework

### Step-by-Step Process

1. **Research competitor price** for the base/core item
2. **Set BASE_CAD** = Competitor price × 0.85 (15% undercut)
3. **Get Taobao CNY prices** for all variants
4. **Calculate variant prices** using ratio scaling
5. **Verify margins** for each variant
6. **Adjust if necessary** (raise prices if margins too thin)

### Sanity Checks

- [ ] Bundle price < sum of individual items
- [ ] All variants have >15% margin on standard sales
- [ ] All variants have >0% margin on promo sales
- [ ] Prices feel reasonable for Canadian market
- [ ] Price progression makes intuitive sense

---

## 7. Data Model Additions

### Suggested Fields for Products/Variants

```typescript
type PricingData = {
  // Cost side
  cost_cny: number          // Item cost from Taobao
  shipping_cny: number      // Shipping cost (default 70)
  total_cost_cad: number    // Calculated total cost
  
  // Pricing side
  base_variant_id?: string  // Reference to base variant for ratio calc
  competitor_price_cad?: number  // Research reference
  price_cny: number         // Taobao selling price
  price_cad: number         // Our selling price
  
  // Analysis
  margin_standard: number   // Margin % without promo
  margin_promo: number      // Margin % with full promo stack
  is_bundle: boolean        // Flag for bundle variants
  bundle_components?: string[]  // What's included
}
```

---

## 8. Quick Reference Formulas

### Cost
```
Total_Cost_CAD = (Item_CNY + Shipping_CNY) × Exchange_Rate
```

### Pricing (Ratio-Based)
```
Variant_Price_CAD = Base_Price_CAD × (Variant_CNY / Base_CNY)
```

### Margin (Standard)
```
Margin = 1 - Salesperson% - (Cost / Revenue)
       = 1 - 0.10 - (Cost / Price)
```

### Margin (With Promo)
```
Net_Revenue = Price × 0.90  (after 10% customer discount)
Margin = 1 - Salesperson% - Promoter% - (Cost / Net_Revenue)
       = 1 - 0.10 - 0.10 - (Cost / Net_Revenue)
       = 0.80 - (Cost / Net_Revenue)
```

### Break-Even Price (Standard)
```
Break_Even = Cost / (1 - Salesperson%)
           = Cost / 0.90
```

### Break-Even Price (With Promo)
```
Break_Even_Net = Cost / (1 - Salesperson% - Promoter%)
               = Cost / 0.80
Break_Even_Original = Break_Even_Net / (1 - Discount%)
                    = Break_Even_Net / 0.90
```

---

## 9. Exchange Rate Considerations

Current assumption: **1 CNY ≈ 0.19 CAD**

This rate fluctuates. Options:
1. **Fixed rate buffer**: Use 0.20 CAD/CNY to build in currency risk buffer
2. **Weekly updates**: Adjust prices weekly based on actual rate
3. **Threshold updates**: Only update when rate changes >5%

Recommendation: Use a **fixed buffer rate of 0.20** for simplicity and margin protection.

---

## 10. Example: Complete Pricing Workflow

### Product: 2011 Combat Master Holster Set

**Step 1: Gather Taobao Data**
| Variant | CNY Price |
|---------|-----------|
| Holster only | ¥59 |
| Belt only | ¥35 |
| Belt + Holster | ¥89 |
| Belt + Holster + Single Mag | ¥109 |
| Belt + Holster + Double Mag | ¥119 |

**Step 2: Competitor Research**
- Similar holster found at $45 CAD on Canadian retailer
- Apply 15% undercut: $45 × 0.85 = **$38.25** (round to $38)

**Step 3: Calculate Variant Prices**
Base = Holster at ¥59 → $38

| Variant | CNY | Ratio | CAD |
|---------|-----|-------|-----|
| Holster | ¥59 | 1.00 | $38.00 |
| Belt | ¥35 | 0.59 | $22.53 → $23 |
| Belt + Holster | ¥89 | 1.51 | $57.36 → $57 |
| Belt + Holster + Single Mag | ¥109 | 1.85 | $70.24 → $70 |
| Belt + Holster + Double Mag | ¥119 | 2.02 | $76.68 → $77 |

**Step 4: Calculate Costs & Margins**

Using exchange rate of 0.20 CAD/CNY:

| Variant | Cost CNY | Cost CAD | Price CAD | Margin (Std) | Margin (Promo) |
|---------|----------|----------|-----------|--------------|----------------|
| Holster | ¥59 + ¥70 = ¥129 | $25.80 | $38 | 22.1% | 4.5% |
| Belt | ¥35 + ¥70 = ¥105 | $21.00 | $23 | -1.3% ❌ | -18.5% ❌ |

**Step 5: Adjust**
Belt-only variant has negative margin! Options:
- Raise belt price to $27 → Margin: 12.2% (std), -5.6% (promo)
- Or flag belt as "only sold in bundles"
- Or accept loss-leader on belt to drive bundle sales

**Final Prices:**
| Variant | Price CAD | Notes |
|---------|-----------|-------|
| Holster | $38 | Base item, 22% margin |
| Belt | $27 | Adjusted, 12% margin |
| Belt + Holster | $57 | Bundle pricing intact |
| Belt + Holster + Single Mag | $70 | Good margin |
| Belt + Holster + Double Mag | $77 | Good margin |

---

## Appendix: Promo Code Economics

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

