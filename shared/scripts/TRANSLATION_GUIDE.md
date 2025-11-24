# Translation Integration Guide

## Overview

The Notion seeding script now automatically translates Chinese product titles and variant names using rule-based translation logic ported from the scraper.

## How It Works

### Automatic Translation During Seeding

When running `npm run seed-notion`, the script will:

1. **For Product Titles**: If `title` is missing but `title_original` (Chinese) exists, automatically translate it
2. **For Variant Names**: If a variant name contains Chinese characters, automatically translate it

The translations use pattern matching and term mappings specifically designed for tactical gear terminology.

### Translation Rules

#### Title Translation (`translateTitleSimple`)
- Maps common tactical gear terms (e.g., 战术背心 → Tactical Vest)
- Removes decorative brackets and symbols
- Deduplicates repeated words
- Limits output to 120 characters
- Falls back to original if result is still >50% Chinese

**Example:**
```
战术背心MOLLE系统多功能户外配件
→ Tactical Vest MOLLE System Multi-Function Outdoor Accessories
```

#### Variant Translation (`translateVariantSimple`)
- Strips brand/filler terms (品牌, 科杜拉, 尼龙, etc.)
- Translates colors and patterns:
  - 黑色 → Black
  - 狼灰色 → Wolf Grey
  - 游骑兵绿色 → Ranger Green
  - 迷彩 → Camouflage
- Preserves military codes (MC, BK, RG, CB, etc.)
- Joins multiple options with " / "

**Examples:**
```
黑色 → Black
狼灰色 → Wolf Grey
暗夜迷彩MC → Black Camouflage Pattern MC
建伍双插 → Kenwood Dual
狼棕色/卡其 → Coyote Brown / Khaki
```

## Testing Translations

Run the translation test suite:

```bash
cd shared/scripts
node test-translation.js
```

This will show you how various Chinese phrases are translated.

## Manual Override

If you need to override auto-translations:

1. **Pre-seed**: Add English `title` field to products_manifest.json before seeding
2. **Post-seed**: Edit titles directly in Notion (won't be overwritten unless you re-seed)

## Extending Translation Rules

To add new term mappings, edit `shared/scripts/translate-utils.js`:

### For Title Terms
Add to the `mapping` array:
```javascript
[/中文词/g, "English Term"],
```

### For Variant Terms
Add to the `termMap` object:
```javascript
'中文词': 'English Term',
```

## Seeding Behavior

The seeding script will log translations:
```
→ [1/10] Tactical Vest MOLLE System
   🔤 Auto-translated: "战术背心MOLLE系统" → "Tactical Vest MOLLE System"
   • Variant 1: Black
      🔤 Variant: "黑色" → "Black"
```

## Source

Translation logic ported from:
- `scraper/scraper.py` → `translate_title_simple()` (lines 1473-1512)
- `scraper/scraper.py` → `translate_variant_simple()` (lines 1514-1563)

Maintains compatibility with the original scraper's output while making translations available at seed time.
