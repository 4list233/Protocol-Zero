#!/usr/bin/env python3
"""
Protocol Zero - Automated Codebase Cleanup Script
Creates organized directory structure and moves files appropriately
"""

import os
import shutil
import sys
from pathlib import Path
from datetime import datetime
import argparse

class CodebaseCleanup:
    def __init__(self, base_path: str, dry_run: bool = True):
        self.base_path = Path(base_path)
        self.scraper_path = self.base_path / "scraper"
        self.dry_run = dry_run
        self.changes = []
        
    def log(self, message: str, action_type: str = "INFO"):
        """Log an action"""
        prefix = "🔍 [DRY RUN]" if self.dry_run else "✅ [EXECUTE]"
        print(f"{prefix} [{action_type}] {message}")
        self.changes.append((action_type, message))
        
    def create_directory_structure(self):
        """Create new organized directory structure"""
        directories = [
            "scraper/core",
            "scraper/integrations",
            "scraper/utilities",
            "scraper/migrations",
            "scraper/maintenance",
            "scraper/tools",
            "scraper/test_data",
            "scraper/data/exports",
            "scraper/data/cache",
            "scraper/data/reports",
            "scraper/data/links",
            "scraper/archive/logs",
            "scraper/archive/data",
            "scraper/archive/deprecated_scripts",
            "docs/planning",
            "docs/specifications",
            "docs/guides",
        ]
        
        for directory in directories:
            path = self.base_path / directory
            if not self.dry_run:
                path.mkdir(parents=True, exist_ok=True)
                # Create __init__.py for Python packages
                if "scraper/" in directory and directory.split("/")[-1] not in ["test_data", "data", "archive"]:
                    init_file = path / "__init__.py"
                    if not init_file.exists():
                        init_file.touch()
            self.log(f"Create directory: {directory}", "CREATE")
    
    def archive_old_logs(self):
        """Move old log files to archive"""
        log_files = list(self.scraper_path.glob("*.log"))
        
        # Keep only the 3 most recent logs
        log_files_sorted = sorted(log_files, key=lambda x: x.stat().st_mtime, reverse=True)
        
        for log_file in log_files_sorted[3:]:  # Archive all except 3 most recent
            archive_path = self.scraper_path / "archive" / "logs" / "2026-01"
            dest = archive_path / log_file.name
            
            if not self.dry_run:
                archive_path.mkdir(parents=True, exist_ok=True)
                shutil.move(str(log_file), str(dest))
            
            self.log(f"Archive: {log_file.name} → archive/logs/", "ARCHIVE")
    
    def organize_data_files(self):
        """Organize CSV and JSON data files"""
        file_mappings = {
            # Exports
            "knack_database_export.json": "data/exports/",
            "knack_products_summary.csv": "data/exports/",
            "shopify_collections.json": "data/exports/",
            
            # Cache
            "translation_cache.json": "data/cache/",
            "taobao_cookies.json": "data/cache/",
            "test_output.json": "data/cache/",
            
            # Links (keep in place but copy backups)
            "taobao_links.backup": "data/links/",
            "taobao_archive.txt": "data/links/",
            "taobao_links_redo.txt": "archive/data/",
            
            # Old timestamped files
            "links_good_20251229_074015.txt": "archive/data/",
            "links_good_20251229_074933.txt": "archive/data/",
            "links_redo_20251229_074015.txt": "archive/data/",
            "links_redo_20251229_074933.txt": "archive/data/",
            "scrape_log_20260120_143134.txt": "archive/logs/2026-01/",
            
            # Variant issues CSVs
            "variant_issues_broken_format_20260105_183401.csv": "archive/data/",
            "variant_issues_chinese_text_20260105_183401.csv": "archive/data/",
            "variant_issues_invalid_margin_20260105_183401.csv": "archive/data/",
            "variant_issues_missing_price_20260105_183401.csv": "archive/data/",
            "variant_issues_pricing_outliers_20260105_183401.csv": "archive/data/",
        }
        
        for filename, destination in file_mappings.items():
            source = self.scraper_path / filename
            if source.exists():
                dest_dir = self.scraper_path / destination
                dest = dest_dir / filename
                
                if not self.dry_run:
                    dest_dir.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(source), str(dest))
                
                self.log(f"Move: {filename} → {destination}", "MOVE")
    
    def consolidate_test_files(self):
        """Consolidate multiple test link files into one"""
        test_files = [
            "test_links.txt",
            "test_links_10.txt", 
            "test_10_links.txt",
        ]
        
        # Keep test_links.txt, archive others
        for filename in test_files[1:]:
            source = self.scraper_path / filename
            if source.exists():
                dest = self.scraper_path / "test_data" / filename
                
                if not self.dry_run:
                    (self.scraper_path / "test_data").mkdir(parents=True, exist_ok=True)
                    shutil.move(str(source), str(dest))
                
                self.log(f"Move: {filename} → test_data/", "MOVE")
        
        # Move the main test file too
        main_test = self.scraper_path / "test_links.txt"
        if main_test.exists():
            dest = self.scraper_path / "test_data" / "test_links.txt"
            if not self.dry_run:
                (self.scraper_path / "test_data").mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    shutil.copy(str(main_test), str(dest))
            self.log(f"Copy: test_links.txt → test_data/ (keep original)", "COPY")
    
    def organize_python_scripts(self):
        """Organize Python scripts by purpose"""
        
        script_mappings = {
            # Core functionality (these stay or move to core/)
            "core": [
                # ai_scraper.py stays in root for now
                "scraper.py",
                "variant_engine.py",
                "price_resolver.py",
                "image_utils.py",
            ],
            
            # Integrations
            "integrations": [
                "knack_integration.py",
                "notion_integration.py",
                "shopify_export.py",
                "sync_knack_to_notion.py",
            ],
            
            # Utilities
            "utilities": [
                "translate.py",
                "quality_control.py",
                "sync_media.py",
                "shopify_pricing_calculator.py",
            ],
            
            # Migrations
            "migrations": [
                "knack_data_migration.py",
                "csv_to_knack.py",
                "csv_to_folders.py",
                "folders_to_knack.py",
                "migrate_hero_images.py",
                "seed_json_to_knack.py",
            ],
            
            # Maintenance
            "maintenance": [
                "fix_variant_issues.py",
                "fix_broken_variants.py",
                "cleanup_orphaned_variants.py",
                "activate_all_knack_records.py",
                "fix_notion_image_urls.py",
            ],
            
            # Tools
            "tools": [
                "edit_product.py",
                "check_knack_products.py",
                "check_notion_images.py",
                "check_image_availability.py",
                "verify_knack_data.py",
                "verify_image_mapping.py",
                "verify_test_results.py",
                "compare_scraper_database.py",
            ],
            
            # Archive (one-off scripts)
            "archive/deprecated_scripts": [
                "quick_fix_m67_pricing.py",
                "fix_single_product_pricing.py",
                "comet_auto_continue.py",
                "comet_simple_continue.py",
                "stitch-details.py",
                "post_translate.py",
                "rescrape_pricing.py",
                "classify_variants.py",
                "test_run_10_links.py",
                "test_single_product.py",
                "test_translation_prompt.py",
            ],
        }
        
        for directory, scripts in script_mappings.items():
            for script in scripts:
                source = self.scraper_path / script
                if source.exists():
                    dest_dir = self.scraper_path / directory
                    dest = dest_dir / script
                    
                    if not self.dry_run:
                        dest_dir.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(source), str(dest))
                    
                    self.log(f"Move: {script} → {directory}/", "MOVE")
    
    def remove_git_backups(self):
        """Remove old git backup directories"""
        git_backups = [
            ".git.backup",
            ".git.bak-20251118174318",
        ]
        
        for backup_dir in git_backups:
            path = self.base_path / backup_dir
            if path.exists():
                if not self.dry_run:
                    shutil.rmtree(path)
                
                size = sum(f.stat().st_size for f in path.rglob('*') if f.is_file()) if path.exists() else 0
                size_mb = size / (1024 * 1024)
                self.log(f"Delete: {backup_dir}/ ({size_mb:.1f} MB)", "DELETE")
    
    def reorganize_docs(self):
        """Reorganize root-level documentation"""
        doc_mappings = {
            "docs/planning": [
                "REFACTOR_PLAN.md",
                "ARCHITECTURE_DIAGRAMS.md",
                "HANDOFF_GUIDE.md",
            ],
            "docs/specifications": [
                "SCRAPER_SPECIFICATIONS.md",
                "WEBSITE_SPECIFICATIONS.md",
            ],
            "docs/guides": [
                "KICKOFF_MEETING_AGENDA.md",
                "VARIANT_IMAGE_FIX.md",
            ],
        }
        
        for directory, docs in doc_mappings.items():
            for doc in docs:
                source = self.base_path / doc
                if source.exists():
                    dest_dir = self.base_path / directory
                    dest = dest_dir / doc
                    
                    if not self.dry_run:
                        dest_dir.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(source), str(dest))
                    
                    self.log(f"Move: {doc} → {directory}/", "MOVE")
    
    def create_gitignore_updates(self):
        """Add cleanup-related entries to .gitignore"""
        gitignore_additions = """
# Cleanup: Ignore logs and cache
scraper/*.log
scraper/archive/
scraper/data/cache/
*.pyc
__pycache__/
.DS_Store

# Keep structure files
!scraper/archive/.gitkeep
!scraper/data/cache/.gitkeep
"""
        
        gitignore_path = self.base_path / ".gitignore"
        
        if not self.dry_run:
            with open(gitignore_path, "a") as f:
                f.write("\n" + gitignore_additions)
        
        self.log("Update .gitignore with cleanup patterns", "UPDATE")
    
    def run_cleanup(self):
        """Execute full cleanup process"""
        print("\n" + "="*60)
        print("🧹 Protocol Zero - Codebase Cleanup")
        print("="*60 + "\n")
        
        if self.dry_run:
            print("⚠️  DRY RUN MODE - No files will be modified")
            print("    Run with --execute to apply changes\n")
        else:
            print("🚀 EXECUTE MODE - Files will be modified")
            print("    Make sure you have a backup!\n")
            response = input("Continue? (yes/no): ")
            if response.lower() != "yes":
                print("Aborted.")
                return
        
        # Execute cleanup steps
        steps = [
            ("Creating directory structure", self.create_directory_structure),
            ("Archiving old logs", self.archive_old_logs),
            ("Organizing data files", self.organize_data_files),
            ("Consolidating test files", self.consolidate_test_files),
            ("Organizing Python scripts", self.organize_python_scripts),
            ("Removing git backups", self.remove_git_backups),
            ("Reorganizing documentation", self.reorganize_docs),
            ("Updating .gitignore", self.create_gitignore_updates),
        ]
        
        for step_name, step_func in steps:
            print(f"\n📦 {step_name}...")
            try:
                step_func()
            except Exception as e:
                print(f"❌ Error in {step_name}: {e}")
                if not self.dry_run:
                    print("Stopping execution due to error.")
                    return
        
        # Summary
        print("\n" + "="*60)
        print("📊 CLEANUP SUMMARY")
        print("="*60)
        
        action_counts = {}
        for action_type, _ in self.changes:
            action_counts[action_type] = action_counts.get(action_type, 0) + 1
        
        for action, count in sorted(action_counts.items()):
            print(f"  {action}: {count} operations")
        
        print(f"\n  Total operations: {len(self.changes)}")
        
        if self.dry_run:
            print("\n💡 To apply these changes, run:")
            print("   python3 cleanup_codebase.py --execute")
        else:
            print("\n✅ Cleanup completed successfully!")
            print("\n📝 Next steps:")
            print("   1. Test the scraper: cd scraper && python3 ai_scraper.py --test")
            print("   2. Review changes: git status")
            print("   3. Commit if satisfied: git add -A && git commit -m 'Cleanup codebase'")


def main():
    parser = argparse.ArgumentParser(
        description="Clean up Protocol Zero codebase"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute cleanup (default is dry-run)"
    )
    parser.add_argument(
        "--path",
        default="/Users/5425855/Documents/protocol-zero",
        help="Base path to protocol-zero directory"
    )
    
    args = parser.parse_args()
    
    cleanup = CodebaseCleanup(
        base_path=args.path,
        dry_run=not args.execute
    )
    
    cleanup.run_cleanup()


if __name__ == "__main__":
    main()
