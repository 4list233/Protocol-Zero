# Protocol Zero - Codebase Cleanup Plan

**Date:** February 10, 2026  
**Status:** 🔴 Action Required  
**Estimated Time:** 2-3 hours

---

## 🎯 Executive Summary

The codebase currently has significant technical debt with **30+ log files**, duplicate scripts, old test data, and poor organization. This plan provides a systematic approach to clean up the mess while preserving functionality.

**Key Issues Identified:**
- 30+ log files scattered across scraper/
- 47 Python scripts with unclear organization
- Old timestamped data files (from Jan 5, 2026)
- Multiple git backup directories
- No clear separation between core vs. utility scripts
- Outdated test data files

---

## 📊 Current State Analysis

### Scraper Directory (`/scraper`) - 🔴 Critical
```
Issues Found:
├── 30+ .log files (2.3 MB+ of logs)
├── 47 Python scripts (many one-off fixes)
├── 11 data files (.csv, .json) in root
├── 15+ text files (links, archives)
├── Multiple backup files (taobao_links.backup, etc.)
└── Mixed concerns (scraping, migration, testing, fixes)
```

### Root Directory - ⚠️ Moderate
```
Issues Found:
├── .git.backup/ (duplicate backups)
├── .git.bak-20251118174318/ (old backup)
├── Multiple log files at root level
└── Too many root-level markdown files (15+)
```

### Organization Problems
1. **No module structure** - All scripts in flat directory
2. **Unclear naming** - Many "fix_" and "quick_fix_" scripts
3. **No archive system** - Old files mixed with current
4. **Duplicate functionality** - Multiple scripts doing similar things

---

## 🎯 Cleanup Strategy

### Phase 1: Archive & Remove (Safe Deletions)
**Goal:** Remove clutter that isn't needed for current operations

#### 1.1 Log Files (30+ files)
```bash
# Keep only the most recent, archive the rest
scraper/*.log → scraper/archive/logs/YYYY-MM/
```

**Action:**
- ✅ Keep: Most recent 2-3 logs per type
- 🗄️ Archive: Logs older than 30 days
- 🗑️ Delete: Debug logs older than 7 days

#### 1.2 Git Backups
```bash
# Remove duplicate git backups
.git.backup/               → DELETE (use git if needed)
.git.bak-20251118174318/   → DELETE (3+ months old)
```

#### 1.3 Old Data Files
```bash
# Archive old timestamped files
variant_issues_*_20260105_*.csv → scraper/archive/data/
links_*_20251229_*.txt         → scraper/archive/data/
```

#### 1.4 Test Files
```bash
# Consolidate test data
test_links.txt, test_links_10.txt, test_10_links.txt
→ Keep ONE: scraper/test_data/test_links.txt
```

---

### Phase 2: Reorganize Python Scripts
**Goal:** Create clear module structure

#### 2.1 Proposed Directory Structure
```
scraper/
├── core/                    # Core scraping functionality
│   ├── __init__.py
│   ├── ai_scraper.py       # Main scraper (KEEP ORIGINAL LOCATION)
│   ├── scraper.py          # Legacy scraper
│   ├── variant_engine.py   # Variant extraction
│   ├── price_resolver.py   # Pricing logic
│   └── image_utils.py      # Image processing
│
├── integrations/            # External service integrations
│   ├── __init__.py
│   ├── knack_integration.py
│   ├── notion_integration.py
│   └── shopify_export.py
│
├── utilities/               # Helper scripts
│   ├── __init__.py
│   ├── translate.py
│   ├── quality_control.py
│   └── sync_media.py
│
├── migrations/              # One-off migration scripts
│   ├── __init__.py
│   ├── knack_data_migration.py
│   ├── csv_to_knack.py
│   ├── folders_to_knack.py
│   └── migrate_hero_images.py
│
├── maintenance/             # Fix & maintenance scripts
│   ├── __init__.py
│   ├── fix_variant_issues.py
│   ├── fix_broken_variants.py
│   ├── cleanup_orphaned_variants.py
│   └── activate_all_knack_records.py
│
├── tools/                   # Development & testing tools
│   ├── __init__.py
│   ├── edit_product.py
│   ├── check_knack_products.py
│   ├── verify_knack_data.py
│   └── compare_scraper_database.py
│
├── test_data/               # Testing resources
│   ├── test_links.txt
│   └── test_output.json
│
├── archive/                 # Historical data
│   ├── logs/
│   │   └── 2026-01/
│   ├── data/
│   └── deprecated_scripts/
│
├── ai_scraper.py           # SYMLINK to core/ai_scraper.py
├── requirements.txt
└── README.md
```

#### 2.2 Scripts to Archive (Likely Unused)
Move to `archive/deprecated_scripts/`:
```python
- quick_fix_m67_pricing.py      # One-off fix
- fix_single_product_pricing.py # One-off fix
- comet_auto_continue.py         # Old automation
- comet_simple_continue.py       # Old automation
- stitch-details.py              # Unclear purpose
- post_translate.py              # Unclear if used
- rescrape_pricing.py            # One-off task
- classify_variants.py           # Analysis tool
- test_run_10_links.py           # Old test
- test_single_product.py         # Old test
```

#### 2.3 Scripts to Keep in Root (Frequently Used)
```python
- ai_scraper.py         # Main entry point
- scraper.py            # Legacy scraper
- translate.py          # Active utility
- upload_to_knack.py    # Active workflow
```

---

### Phase 3: Data Organization
**Goal:** Centralize data files

#### 3.1 Create Data Directory
```
scraper/data/
├── exports/
│   ├── knack_database_export.json
│   ├── knack_products_summary.csv
│   └── shopify_collections.json
│
├── cache/
│   ├── translation_cache.json
│   └── taobao_cookies.json
│
├── reports/
│   └── variant_issues_YYYYMMDD/
│       ├── broken_format.csv
│       ├── chinese_text.csv
│       └── pricing_outliers.csv
│
└── links/
    ├── taobao_links.txt           # ACTIVE
    ├── taobao_links.backup        # Archive
    └── taobao_archive.txt         # Archive
```

---

### Phase 4: Documentation Cleanup
**Goal:** Consolidate documentation

#### 4.1 Root Level Markdown Files
Current state: **15+ markdown files** at root

**Proposed structure:**
```
/protocol-zero/
├── README.md                    # Keep - Main entry
├── DOCUMENTATION_INDEX.md       # Keep - Navigation
├── QUICK_REFERENCE.md          # Keep - Quick access
│
├── docs/                        # All other docs here
│   ├── planning/
│   │   ├── REFACTOR_PLAN.md
│   │   ├── ARCHITECTURE_DIAGRAMS.md
│   │   └── HANDOFF_GUIDE.md
│   │
│   ├── specifications/
│   │   ├── SCRAPER_SPECIFICATIONS.md
│   │   └── WEBSITE_SPECIFICATIONS.md
│   │
│   └── guides/
│       ├── KICKOFF_MEETING_AGENDA.md
│       └── VARIANT_IMAGE_FIX.md
```

---

## 🚀 Implementation Plan

### Step 1: Backup Everything (Safety First)
```bash
# Create backup before cleanup
cd /Users/5425855/Documents/protocol-zero
tar -czf ../protocol-zero-backup-$(date +%Y%m%d).tar.gz .

# Or use git
git add -A
git commit -m "Pre-cleanup snapshot - $(date)"
git tag cleanup-backup-$(date +%Y%m%d)
```

### Step 2: Execute Cleanup Script
I'll create an automated cleanup script that:
1. Creates new directory structure
2. Moves files to appropriate locations
3. Archives old data
4. Updates imports in Python files
5. Creates symlinks for backwards compatibility

### Step 3: Validation
```bash
# Test that scraper still works
cd scraper
python3 ai_scraper.py --test

# Verify imports
python3 -c "from core.variant_engine import extract_variants"

# Check git status
git status
```

### Step 4: Update Documentation
- Update README.md with new structure
- Update import paths in documentation
- Create MIGRATION_GUIDE.md

---

## 📋 Detailed Action Items

### Immediate Actions (Do Now)
- [ ] **Delete git backups** - `.git.backup/` and `.git.bak-*` (3.2 MB)
- [ ] **Archive old logs** - Move logs older than 30 days
- [ ] **Archive old data files** - Move timestamped CSVs from January
- [ ] **Consolidate test files** - Keep only one test_links.txt

### Short-term (This Week)
- [ ] **Create new directory structure** - Set up core/, utilities/, etc.
- [ ] **Move Python scripts** - Organize by function
- [ ] **Update imports** - Fix all import statements
- [ ] **Create cleanup automation script**

### Medium-term (This Month)
- [ ] **Deprecate duplicate scripts** - Remove redundant functionality
- [ ] **Add proper documentation** - Docstrings and type hints
- [ ] **Create module tests** - Unit tests for core functions
- [ ] **Set up pre-commit hooks** - Prevent future mess

---

## 🎯 Success Metrics

After cleanup, we should have:
- ✅ **<10 files** in scraper root (down from 80+)
- ✅ **Clear module structure** with logical grouping
- ✅ **<5 log files** (keep recent only)
- ✅ **All scripts categorized** by purpose
- ✅ **Zero git backups** in working directory
- ✅ **Centralized data** in data/ directory
- ✅ **Updated documentation** reflecting new structure

---

## ⚠️ Risks & Mitigation

### Risk 1: Breaking Existing Scripts
**Mitigation:**
- Create symlinks for backward compatibility
- Update imports gradually
- Test each move before committing

### Risk 2: Losing Important Data
**Mitigation:**
- Full backup before starting
- Archive, don't delete immediately
- Keep 30-day rollback window

### Risk 3: Import Path Issues
**Mitigation:**
- Add __init__.py to all directories
- Use relative imports where possible
- Create migration guide for future reference

---

## 🔧 Next Steps

### Option A: Automated Cleanup (Recommended)
I can create and run a Python script that automates 80% of this cleanup:
```bash
python3 cleanup_codebase.py --dry-run  # Preview changes
python3 cleanup_codebase.py --execute  # Execute cleanup
```

### Option B: Manual Cleanup
Follow the step-by-step guide above manually.

### Option C: Incremental Cleanup
Clean up one section at a time:
1. Day 1: Remove git backups and old logs
2. Day 2: Archive old data files
3. Day 3: Reorganize Python scripts
4. Day 4: Update documentation

---

## 📝 Post-Cleanup Checklist

After cleanup is complete:
- [ ] Run full scraper test
- [ ] Verify all imports work
- [ ] Update README.md
- [ ] Create ARCHITECTURE.md with new structure
- [ ] Set up .gitignore for logs and cache
- [ ] Document maintenance procedures
- [ ] Create backup/archive script for future use

---

## 🤔 Questions to Answer

Before proceeding, please confirm:
1. **Are there any scripts you use frequently** that I should keep in root?
2. **Do you want to keep git backups** or can I delete them?
3. **Should I create the automated cleanup script**, or would you prefer manual?
4. **Any files you know are critical** that shouldn't be moved?

---

**Ready to proceed?** Let me know which option you prefer, and I'll start the cleanup process.
