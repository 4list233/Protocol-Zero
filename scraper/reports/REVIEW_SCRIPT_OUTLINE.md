# Interactive Variant Review Script - Outline

## Purpose
Review and fix all 359 "Needs Review" variants interactively, asking for user confirmation on each fix.

## Workflow

### 1. INITIALIZATION
- Load all variants with status "Needs Review" (359 variants)
- Group by issue type for efficient batch processing
- Show summary of issues to review

### 2. ISSUE CATEGORIES

#### A. Invalid Margins (Primary Issue - ~446 variants)
**Problem**: Margins stored as percentages (28.7) instead of decimals (0.287)
**Fix Options**:
- [A] Auto-fix all: Divide by 100 (28.7 → 0.287)
- [S] Skip this variant
- [M] Manually enter correct margin
- [D] Delete variant
- [Q] Quit

**Show for each**:
```
Variant: Black / Small
Current Margin: 28.7 (287% - INVALID)
Corrected Margin: 0.287 (28.7%)
Price CAD: $43.43
Price CNY: ¥215

Fix? [A]uto / [S]kip / [M]anual / [D]elete / [Q]uit:
```

#### B. Missing Prices (157 variants)
**Problem**: Price CNY or Price CAD is 0 or blank
**Fix Options**:
- [E] Enter prices manually (CNY and CAD)
- [C] Calculate CAD from CNY (using margin formula)
- [S] Skip
- [D] Delete (if variant shouldn't exist)
- [Q] Quit

**Show for each**:
```
Variant: 订做颜色联系客服
Price CNY: 0 ❌
Price CAD: $0.00 ❌
Product: [Product Name]

Options:
[E] Enter CNY price (will auto-calculate CAD)
[S] Skip this variant
[D] Delete (custom order - not a standard variant)
[Q] Quit
```

#### C. Missing Options (Need to parse variant name)
**Problem**: Option Type 1 or Option Value 1 is blank
**Fix Options**:
- [A] Auto-parse from variant name using translation rules
- [M] Manually enter Option Type & Value
- [S] Skip
- [D] Delete
- [Q] Quit

**Show for each**:
```
Variant Name: Black / Small
Option Type 1: [BLANK] ❌
Option Value 1: [BLANK] ❌

Detected from name:
  Option 1: Color = "Black"
  Option 2: Size = "Small"

[A] Use detected options
[M] Enter manually
[S] Skip
[D] Delete
[Q] Quit
```

#### D. Chinese Text in Name (161 variants)
**Problem**: Variant name contains Chinese characters
**Fix Options**:
- [A] Auto-translate using dictionary
- [M] Manually enter English name
- [S] Skip for now
- [Q] Quit

**Show for each**:
```
Variant: Olive Drab军Green / Short
Chinese detected: 军 (means "Military" or "Army")

Auto-translation: Olive Drab Army Green / Short

[A] Use auto-translation
[M] Enter manual translation
[S] Skip
[Q] Quit
```

## 3. BATCH OPERATIONS

Before starting individual reviews, offer batch operations:

```
📊 NEEDS REVIEW SUMMARY
==================================================
Total variants to review: 359

Issue breakdown:
  ⚠️  Invalid Margins: 289 (can auto-fix)
  💰 Missing Prices: 157 (need manual input or delete)
  🏷️  Missing Options: 87 (can auto-parse)
  🌐 Chinese Text: 161 (can auto-translate)
  🔧 Multiple Issues: 123

BATCH OPTIONS:
==================================================
[1] Auto-fix ALL invalid margins (289 variants)
    → Divide by 100: 28.7 → 0.287

[2] Auto-parse ALL missing options (87 variants)
    → Extract from variant names

[3] Auto-translate ALL Chinese text (161 variants)
    → Use translation dictionary

[4] Delete ALL zero-price variants (157 variants)
    → Remove custom orders and incomplete entries

[5] Review variants ONE-BY-ONE (interactive)
    → Full control, case-by-case decisions

[6] Show detailed breakdown by product

[Q] Quit

Enter choice:
```

## 4. ONE-BY-ONE REVIEW MODE

If user chooses interactive review:

```
REVIEWING VARIANT 1/359
==================================================
Variant ID: 695c386a9b815749bcd16f6c
Variant Name: Black / Small
Product: Scorpion Soft Shell Quick Release Magazine Pouch
Status: Needs Review

📋 ISSUES DETECTED:
  ⚠️  Invalid Margin: 28.7 (should be 0.287)

📊 CURRENT DATA:
  Price CNY: ¥215
  Price CAD: $43.43
  Margin: 28.7 ❌
  Option 1: Color = "Black" ✓
  Option 2: Size = "Small" ✓
  Status: Needs Review

🔧 SUGGESTED FIX:
  Margin: 28.7 → 0.287
  Status: Needs Review → Active

ACTION:
[A] Apply suggested fix
[M] Modify values manually
[S] Skip (keep as Needs Review)
[D] Delete this variant
[Q] Quit and save progress

Enter choice:
```

## 5. PROGRESS TRACKING

```
PROGRESS: [████████░░░░░░░░░░] 35/359 (9.7%)
Fixed: 28 | Skipped: 5 | Deleted: 2
```

## 6. FINAL SUMMARY

```
✅ REVIEW COMPLETE
==================================================
Total reviewed: 359 variants

Actions taken:
  ✅ Fixed: 312
     - Auto-fixed margins: 289
     - Auto-parsed options: 87
     - Auto-translated: 161
  ⏭️  Skipped: 35
  🗑️  Deleted: 12

Status updated to "Active": 312 variants
Remaining "Needs Review": 35 variants

NEXT STEPS:
- Review skipped variants manually in Knack
- Verify auto-fixes on website
- Run shop product sync
```

## 7. SAFETY FEATURES

- **Dry-run mode**: Preview all changes before applying
- **Undo last action**: Step back if mistake made
- **Save progress**: Can quit and resume later
- **Backup**: Auto-backup before making changes
- **Confirmation prompts**: For destructive actions (delete)
- **Validation**: Check that fixed values are valid before saving

## 8. IMPLEMENTATION FILES

```
scraper/
  review_variants.py          # Main interactive script
  review_helpers.py           # Helper functions
  review_progress.json        # Save progress between sessions
  backups/
    variants_pre_review_TIMESTAMP.csv
```

## 9. COMMAND LINE OPTIONS

```bash
# Interactive mode (default)
python3 review_variants.py

# Auto-fix mode (no prompts)
python3 review_variants.py --auto-fix-margins --auto-parse-options

# Dry run (show what would be changed)
python3 review_variants.py --dry-run

# Resume previous session
python3 review_variants.py --resume

# Review specific product only
python3 review_variants.py --product "L4G24"

# Delete all zero-price variants
python3 review_variants.py --delete-zero-price
```

## 10. KEYBOARD SHORTCUTS

During review:
- `A` - Accept/Auto-fix
- `M` - Manual entry
- `S` - Skip
- `D` - Delete
- `U` - Undo last action
- `Q` - Quit and save
- `H` - Help
- `?` - Show current variant details
- `↑/↓` - Navigate variants (if implemented)
