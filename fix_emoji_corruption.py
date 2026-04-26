#!/usr/bin/env python3
"""
Fix Emoji Corruption Caused by Em-Dash Replacement

The replace_emdash.py script corrupted multi-byte UTF-8 emoji characters.
This script fixes all corrupted emojis back to their correct form.
"""

import os
import sys
from pathlib import Path

# Mapping of corrupted patterns to correct emojis
# These are the actual byte sequences that got corrupted
EMOJI_FIXES = {
    # Corrupted -> Correct
    'ðŸš€': '🚀',  # rocket
    'ðŸ"ˆ': '📈',  # chart increasing
    'âž–': '➖',  # minus/dash emoji
    'ðŸ"‰': '📉',  # chart decreasing
    'âš ï¸': '⚠️',  # warning
    'â€¢': '•',   # bullet point
    'ðŸ"Š': '📊',  # bar chart
    'ðŸ"‹': '📋',  # clipboard
    'ðŸ"': '🔥',  # fire
    'ðŸŸ¢': '🟢',  # green circle
    'ðŸ"´': '🔴',  # red circle
    'ðŸŸ¡': '🟡',  # yellow circle
    'âš ': '⚪',  # white circle
    'ðŸ›¡ï¸': '🛡️',  # shield
    'ðŸŽ¯': '🎯',  # target
    'ðŸ³': '🐳',  # whale
    'ðŸ"': '🔔',  # bell
    'âœ…': '✅',  # check mark
    'â�': '❌',  # cross mark
    'ðŸ�': '🏛️',  # classical building
    'âš¡': '⚡',  # lightning
}

EXCLUDE_DIRS = {
    'node_modules', '.next', '.git', '.vscode', 'dist', 'build',
    '__pycache__', '.pytest_cache', 'coverage', '.nyc_output',
    'venv', 'env', '.env',
}

INCLUDE_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
    '.css', '.scss', '.html', '.yml', '.yaml',
}


def should_process_file(file_path: Path) -> bool:
    return file_path.suffix.lower() in INCLUDE_EXTENSIONS


def should_skip_directory(dir_path: Path) -> bool:
    return dir_path.name in EXCLUDE_DIRS


def fix_emojis_in_file(file_path: Path, dry_run: bool = False) -> tuple[bool, int]:
    """Fix corrupted emojis in a single file."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        # Check if file contains any corrupted patterns
        has_corruption = any(corrupted in content for corrupted in EMOJI_FIXES.keys())
        if not has_corruption:
            return False, 0
        
        # Apply all fixes
        new_content = content
        total_fixes = 0
        for corrupted, correct in EMOJI_FIXES.items():
            count = new_content.count(corrupted)
            if count > 0:
                new_content = new_content.replace(corrupted, correct)
                total_fixes += count
        
        # Write back if not dry run
        if not dry_run and total_fixes > 0:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
        
        return True, total_fixes
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
        return False, 0


def process_directory(root_dir: Path, dry_run: bool = False):
    """Recursively process all files in a directory."""
    total_files_processed = 0
    total_files_fixed = 0
    total_fixes = 0
    fixed_files = []
    
    print(f"{'[DRY RUN] ' if dry_run else ''}Scanning directory: {root_dir}")
    print(f"Fixing corrupted emoji characters...\n")
    
    for root, dirs, files in os.walk(root_dir):
        root_path = Path(root)
        
        # Remove excluded directories
        dirs[:] = [d for d in dirs if not should_skip_directory(root_path / d)]
        
        for file_name in files:
            file_path = root_path / file_name
            
            if not should_process_file(file_path):
                continue
            
            total_files_processed += 1
            
            was_fixed, count = fix_emojis_in_file(file_path, dry_run)
            
            if was_fixed:
                total_files_fixed += 1
                total_fixes += count
                fixed_files.append((file_path, count))
                
                relative_path = file_path.relative_to(root_dir)
                print(f"{'[DRY RUN] ' if dry_run else ''}✓ {relative_path}: {count} emoji(s) fixed")
    
    # Print summary
    print(f"\n{'=' * 70}")
    print(f"{'DRY RUN ' if dry_run else ''}SUMMARY")
    print(f"{'=' * 70}")
    print(f"Files scanned:     {total_files_processed}")
    print(f"Files fixed:       {total_files_fixed}")
    print(f"Total emoji fixes: {total_fixes}")
    
    if fixed_files and dry_run:
        print(f"\n⚠️  This was a DRY RUN. No files were actually modified.")
        print(f"   Run without --dry-run to apply fixes.")
    elif fixed_files:
        print(f"\n✅ Successfully fixed all corrupted emojis!")
    else:
        print(f"\n✓ No corrupted emojis found.")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Fix corrupted emoji characters in project files'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be fixed without making actual changes'
    )
    parser.add_argument(
        '--directory',
        type=str,
        default='.',
        help='Directory to process (default: current directory)'
    )
    
    args = parser.parse_args()
    
    root_dir = Path(args.directory).resolve()
    
    if not root_dir.exists():
        print(f"Error: Directory '{root_dir}' does not exist", file=sys.stderr)
        sys.exit(1)
    
    if not root_dir.is_dir():
        print(f"Error: '{root_dir}' is not a directory", file=sys.stderr)
        sys.exit(1)
    
    try:
        process_directory(root_dir, dry_run=args.dry_run)
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nFatal error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
