# Protocol Zero - Knack Seed Report
## Date: December 29, 2025

---

## 📊 Upload Summary

| Metric | Count |
|--------|-------|
| **Products Uploaded** | 28 |
| **Variants Created** | 299 |
| **Images Synced** | 174 |
| **Failed Products** | 0 |

---

## 🗄️ Knack Database Schema

### Products Table (object_6)

| Field ID | Field Name | Purpose | Sample Value |
|----------|------------|---------|--------------|
| `field_45` | ID | Taobao product ID | `974743803214` |
| `field_46` | SKU | Product SKU | `PZ-974743803214` |
| `field_47` | Title | English product name | `Tactical New White 8-Piece Set` |
| `field_48` | Title Original | Chinese product name | `战术新款白色8件套` |
| `field_49` | Description | Product description | (generated from title) |
| `field_50` | Category | Product category | `Tactical Gear` |
| `field_51` | Status | Active/Draft/Discontinued | `Active` |
| `field_55` | URL | Original Taobao URL | `https://item.taobao.com/item.htm?id=...` |
| `field_138` | Price CAD Base | Base price (usually 0, variants have prices) | `0` |

### Variants Table (object_7)

| Field ID | Field Name | Purpose | Sample Value |
|----------|------------|---------|--------------|
| `field_61` | Product | Connection to Products table | `[product_record_id]` |
| `field_62` | Variant Name | Full variant name (English) | `S / Side Opening Quick Release Locking Baton Pouch` |
| `field_63` | SKU | Variant SKU | (auto-generated) |
| `field_64` | Price CNY | Original price in Chinese Yuan | `66` |
| `field_138` | Price CAD | Selling price in CAD | `24.99` |
| `field_173` | Cost CAD | Landed cost = (Price + Shipping) × 0.19 | `18.24` |
| `field_154` | Margin Standard | Margin % after salesperson cut (10%) | `17.1` |
| `field_155` | Margin Promo | Margin % after promo cut (10% + 10%) | `7.1` |
| `field_145` | Option Type 1 | First option type | `Size` |
| `field_146` | Option Value 1 | First option value | `S` |
| `field_147` | Option Type 2 | Second option type (nullable) | `Style` |
| `field_148` | Option Value 2 | Second option value (nullable) | `Side Opening Quick Release...` |
| `field_67` | Status | Active/Out of Stock | `Active` |
| `field_151` | Shipping CNY | Shipping cost (default ¥30) | `30` |

---

## 💰 Pricing Logic

### Formula
```
Cost CAD = (Price CNY + Shipping CNY) × Exchange Rate
Price CAD = Cost CAD ÷ (1 - Target Margin)
```

### Configuration
| Parameter | Value |
|-----------|-------|
| **Shipping CNY** | ¥30 |
| **Exchange Rate** | 0.19 (CNY → CAD) |
| **Salesperson Cut** | 10% |
| **Promoter Cut** | 10% |
| **Target Margin** | 30% |

### Example Calculation
```
Price CNY: ¥66
Shipping: ¥30
Total CNY: ¥96

Cost CAD = 96 × 0.19 = $18.24
Price CAD = $18.24 ÷ 0.70 = $26.06 → rounded to $25.99

Margin Standard = (25.99 - 18.24) / 25.99 - 10% = 19.8%
Margin Promo = 19.8% - 10% = 9.8%
```

---

## 🖼️ Image Paths

Images are served directly from `/public/images/` with the following naming convention:

| Type | Path Pattern | Example |
|------|-------------|---------|
| **Main Image** | `/{product_id}-{slug}-main.jpg` | `/974743803214-tactical-new-white-8-piece-set--main.jpg` |
| **Catalogue** | `/{product_id}-{slug}-cat{nn}.jpg` | `/974743803214-tactical-new-white-8-piece-set--cat01.jpg` |
| **Details (Stitched)** | `/{product_id}-{slug}-details.jpg` | `/974743803214-tactical-new-white-8-piece-set--details.jpg` |

---

## 🎨 Frontend Display Logic

### Product Page Layout (Taobao-style)

```
┌────────────────────────────────────────────────────────────┐
│ [Thumbnails] │      [Main Image]       │   [Product Info]  │
│              │                         │   - Title         │
│   [cat01]    │   ┌─────────────────┐   │   - Price         │
│   [cat02]    │   │                 │   │   - Category      │
│   [cat03]    │   │   Large Image   │   │   - Variants      │
│   [cat04]    │   │   (selected)    │   │   - Add to Cart   │
│   [cat05]    │   │                 │   │                   │
│              │   └─────────────────┘   │                   │
└────────────────────────────────────────────────────────────┘
│                                                            │
│              [View Product Details ▼]                      │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                    PRODUCT DETAILS                         │
│    ┌──────────────────────────────────────────────┐       │
│    │                                              │       │
│    │     Stitched Long Image (scroll)             │       │
│    │     - Specifications                         │       │
│    │     - Size Charts                            │       │
│    │     - Material Info                          │       │
│    │     - Usage Instructions                     │       │
│    │                                              │       │
│    └──────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────┘
```

### Multi-Dimensional Variant Selector

When a product has multiple option types (e.g., Size + Style):

1. **Option Type 1** (e.g., Size): Displayed as button group at top
2. **Option Type 2** (e.g., Style): Displayed as dropdown or buttons below
3. **Price updates** dynamically based on selected combination

---

## 📦 Products Seeded

| # | Product ID | Title | Variants | Price Range (CAD) |
|---|------------|-------|----------|-------------------|
| 1 | 974743803214 | Tactical New White 8-Piece Set | 46 | $24.99 - $72.99 |
| 2 | 969220337986 | FPV Drone Rapid Deployment Camo Bag | 65 | $23.99 - $72.99 |
| 3 | 911159245418 | Tactical Multi-function Grenade Model Pouch | 6 | $19.99 - $20.99 |
| 4 | 914138043076 | Clay the Claymore Cute Little Claymore | 1 | $16.99 |
| 5 | 714880739091 | Hydra Riser Mount UNITY Tactical GBRS | 10 | $15.99 - $54.99 |
| 6 | 708088774060 | Left/Right Hand Convertible Quick Draw Holster | 4 | $14.99 - $28.99 |
| 7 | 678305010387 | JPC 6094 CPC AVS Plate Carrier Hydration Insert | 4 | $30.99 |
| 8 | 756814464555 | MST201 | 10 | $26.99 - $35.99 |
| 9 | 853328243320 | Metal Riser Mount GBRS Hydra UNITY EXPS Base | 10 | $21.99 - $49.99 |
| 10 | 855477818032 | Electric Goggles Anti-fog Defogger | 7 | $27.99 - $45.99 |
| 11 | 899190435089 | FPS Action Camera Tactical Mount Arm | 3 | $59.99 |
| 12 | 818533365136 | Colorful Muzzle Flash Luminous Tactical Tracer | 6 | $51.99 - $80.99 |
| 13 | 646929225114 | Scorpion Style Soft Shell Quick Release Mag Pouch | 23 | $10.99 - $18.99 |
| 14 | 846296600859 | Viper 2011 Hi-Capa Speed Cocking Handle | 30 | $20.99 - $40.99 |
| 15 | 890198613762 | Flashlight PEQ Pressure Switch Metal Slot Rail | 6 | $198.99 |
| 16 | 940910394002 | Internal Magazine Pouch Quick Release | 1 | $40.99 |
| 17 | 643256207245 | Universal Nylon Tactical Underarm Multi-functional | 10 | $14.99 |
| 18 | 678253192936 | Tactical Laser Light PEQ15 Red/Green Laser | 7 | $325.99 |
| 19 | 815037864475 | Sports Arm Guards Honeycomb Extended | 9 | $17.99 |
| 20 | 586117181099 | SpeedQB Protective Gear Set | 3 | $230.99 |
| 21 | 723563903640 | Russian Little Green Man Tactical Hood | 2 | $325.99 |
| 22 | 859285997780 | KUBLAI Universal Intake/Exhaust Valve Wrench | 1 | $262.99 |
| 23 | 728771048041 | Outdoor M67 Grenade Smoke Model Prop | 5 | $16.99 - $26.99 |
| 24 | 898356105062 | Tactical Helmet NVG Flip-Up Mount | 1 | $16.99 |
| 25 | 713575933395 | Universal Plate Carrier MOLLE Phone Navigation | 6 | $25.99 - $28.99 |
| 26 | 814126590282 | K Series Helmet Battery Camo Counterweight | 6 | $14.99 - $23.99 |
| 27 | 725254573496 | Outdoor Ronin Tactical Belt Set | 4 | $82.99 |
| 28 | 654310678238 | TC Tactical Headset Adapter Civilian PTT | 6 | $24.99 - $36.99 |

---

## ✅ Status

All 28 products are set to **Active** status and will display on the frontend immediately.

### To View:
1. Start the shop: `cd shop && pnpm dev`
2. Visit: `http://localhost:3000/shop`
3. Click any product to see the new Taobao-style layout

---

## 🔄 Data Flow

```
Taobao Page → Selenium Scraper → Gemini AI Translation → products.json
                                                            ↓
                                                    upload_to_knack.py
                                                            ↓
                                                  ┌─────────┴─────────┐
                                                  ↓                   ↓
                                            Knack Products      Knack Variants
                                            (object_6)         (object_7)
                                                  ↓                   ↓
                                                  └─────────┬─────────┘
                                                            ↓
                                                  knack-products.ts
                                                            ↓
                                                      Next.js API
                                                            ↓
                                                    Shop Frontend
                                                            ↓
                                                  Product Detail Page
                                                  (Taobao-style layout)
```
