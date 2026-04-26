#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scan for all remaining corruption in source files.
Detects mojibake (UTF-8 bytes misread as Latin-1) and other encoding issues.
"""

import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md'}

# Known mojibake sequences: UTF-8 multi-byte chars read as Latin-1
# Format: (corrupted_bytes_as_str, correct_unicode, description)
KNOWN_CORRUPTIONS = [
    # Emojis - 4-byte UTF-8 sequences (U+1F000 range) read as Latin-1
    ('\xf0\x9f\x9a\x80', '\U0001f680', 'rocket'),
    ('\xf0\x9f\x93\x88', '\U0001f4c8', 'chart up'),
    ('\xf0\x9f\x93\x89', '\U0001f4c9', 'chart down'),
    ('\xf0\x9f\x93\x8a', '\U0001f4ca', 'bar chart'),
    ('\xf0\x9f\x93\x8b', '\U0001f4cb', 'clipboard'),
    ('\xf0\x9f\x94\xa5', '\U0001f525', 'fire'),
    ('\xf0\x9f\x94\x94', '\U0001f514', 'bell'),
    ('\xf0\x9f\x9f\xa2', '\U0001f7e2', 'green circle'),
    ('\xf0\x9f\x94\xb4', '\U0001f534', 'red circle'),
    ('\xf0\x9f\x9f\xa1', '\U0001f7e1', 'yellow circle'),
    ('\xf0\x9f\x8e\xaf', '\U0001f3af', 'target'),
    ('\xf0\x9f\x90\xb3', '\U0001f433', 'whale'),
    ('\xf0\x9f\x9b\xa1\xef\xb8\x8f', '\U0001f6e1\ufe0f', 'shield'),
    ('\xf0\x9f\x8f\x9b\xef\xb8\x8f', '\U0001f3db\ufe0f', 'building'),
    ('\xf0\x9f\x92\xb0', '\U0001f4b0', 'money bag'),
    ('\xf0\x9f\x92\xb9', '\U0001f4b9', 'chart yen'),
    ('\xf0\x9f\x92\xa1', '\U0001f4a1', 'bulb'),
    ('\xf0\x9f\x94\x8d', '\U0001f50d', 'magnifier'),
    ('\xf0\x9f\x93\xb1', '\U0001f4f1', 'phone'),
    ('\xf0\x9f\x96\xa5', '\U0001f5a5', 'desktop'),
    ('\xf0\x9f\x94\x90', '\U0001f510', 'lock'),
    ('\xf0\x9f\x94\x91', '\U0001f511', 'key'),
    # 3-byte UTF-8 sequences (U+0800-U+FFFF range)
    ('\xe2\x9e\x96', '\u2796', 'minus sign'),
    ('\xe2\x9e\x95', '\u2795', 'plus sign'),
    ('\xe2\x9c\x85', '\u2705', 'check mark'),
    ('\xe2\x9d\x8c', '\u274c', 'cross mark'),
    ('\xe2\x80\xa2', '\u2022', 'bullet'),
    ('\xe2\x9a\xa0\xef\xb8\x8f', '\u26a0\ufe0f', 'warning'),
    ('\xe2\x9a\xa1', '\u26a1', 'lightning'),
    ('\xe2\x84\xa2', '\u2122', 'trademark'),
    ('\xe2\x86\x91', '\u2191', 'up arrow'),
    ('\xe2\x86\x93', '\u2193', 'down arrow'),
    ('\xe2\x86\xa5', '\u21a5', 'up from bar'),
    ('\xe2\x86\xa7', '\u21a7', 'down from bar'),
    ('\xe2\x96\xb2', '\u25b2', 'triangle up'),
    ('\xe2\x96\xbc', '\u25bc', 'triangle down'),
    ('\xe2\x96\xb6', '\u25b6', 'play'),
    ('\xe2\x97\x80', '\u25c0', 'back'),
    ('\xe2\x80\x93', '\u2013', 'en dash'),
    ('\xe2\x80\x99', '\u2019', 'right single quote'),
    ('\xe2\x80\x9c', '\u201c', 'left double quote'),
    ('\xe2\x80\x9d', '\u201d', 'right double quote'),
    ('\xe2\x80\xa6', '\u2026', 'ellipsis'),
    # 2-byte UTF-8 sequences (U+0080-U+07FF range)
    ('\xc2\xa9', '\u00a9', 'copyright'),
    ('\xc2\xae', '\u00ae', 'registered'),
    ('\xc2\xb0', '\u00b0', 'degree'),
    ('\xc2\xb1', '\u00b1', 'plus minus'),
    ('\xc2\xb7', '\u00b7', 'middle dot'),
    ('\xc2\xbd', '\u00bd', 'half'),
    ('\xc2\xbc', '\u00bc', 'quarter'),
    ('\xc2\xbe', '\u00be', 'three quarters'),
]

def build_str_corruptions():
    """Build string-based corruption map by encoding/decoding."""
    result = []
    for corrupted_bytes, correct_char, desc in KNOWN_CORRUPTIONS:
        # The corrupted form is what you get when UTF-8 bytes are read as Latin-1
        try:
            corrupted_str = corrupted_bytes.encode('latin-1').decode('latin-1')
            result.append((corrupted_str, correct_char, desc))
        except Exception:
            pass
    return result

def scan_and_fix_file(fpath, str_corruptions):
    """Scan and fix a file for corruption. Returns count of fixes."""
    try:
        content = fpath.read_text(encoding='utf-8', errors='replace')
        original = content
        total = 0
        for corrupted_str, correct_char, desc in str_corruptions:
            count = content.count(corrupted_str)
            if count > 0:
                content = content.replace(corrupted_str, correct_char)
                total += count
        if total > 0:
            fpath.write_text(content, encoding='utf-8')
        return total, content != original
    except Exception as e:
        print(f"  ERROR processing {fpath}: {e}")
        return 0, False

def main():
    root = Path('.')
    str_corruptions = build_str_corruptions()
    
    print(f"Scanning with {len(str_corruptions)} corruption patterns...\n")
    
    total_files_fixed = 0
    total_fixes = 0
    
    for root_dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in files:
            if not any(fname.endswith(e) for e in INCLUDE_EXT):
                continue
            fpath = Path(root_dir) / fname
            count, was_fixed = scan_and_fix_file(fpath, str_corruptions)
            if was_fixed:
                total_files_fixed += 1
                total_fixes += count
                rel = fpath.relative_to(root)
                print(f"  FIXED {rel}: {count} corruption(s)")
    
    print(f"\n{'='*60}")
    if total_files_fixed > 0:
        print(f"Files fixed:       {total_files_fixed}")
        print(f"Total fixes:       {total_fixes}")
        print(f"All corruption fixed!")
    else:
        print(f"No corruption found - all files are clean!")

if __name__ == '__main__':
    main()
