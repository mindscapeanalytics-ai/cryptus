#!/usr/bin/env python3
"""Complete fix for all remaining corrupted sequences."""
import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.json', '.css', '.html', '.yml', '.yaml'}

# All corrupted sequences with their correct replacements
# Format: (corrupted_bytes_hex, correct_char)
FIXES_HEX = [
    # 4-byte emoji corruptions (without trailing context bytes)
    ('c3b0c5b8e2809cc5a0',   '\U0001F4CA'),  # 📊 bar chart (c5a0 = Š = 0x8A -> 0x93+0x8A? no...)
    ('c3b0c5b8e2809ce280b9', '\U0001F4CB'),  # 📋 clipboard
    ('c3b0c5b8e2809dc2a5',   '\U0001F525'),  # 🔥 fire
    ('c3b0c5b8e2809dc2b4',   '\U0001F534'),  # 🔴 red circle
    ('c3b0c5b8e2809dc2b5',   '\U0001F535'),  # 🔵 blue circle
    ('c3b0c5b8e2809de2809d', '\U0001F514'),  # 🔔 bell
    # 3-byte symbol corruptions (without trailing context bytes)
    ('c3a2c593e2809c',       '\u2714'),      # ✔ check mark
    ('c3a2cb9ce280a6',       '\u2605'),      # ★ star
    ('c3a2e28093c2b2',       '\u25B2'),      # ▲ triangle up
    ('c3a2e28093c2bc',       '\u25BC'),      # ▼ triangle down
    ('c3a2e280a0e28098',     '\u2191'),      # ↑ up arrow (variant with left single quote)
    ('c3a2e280a0e28099',     '\u2191'),      # ↑ up arrow (variant with right single quote)
    ('c3a2e280b0c2a4',       '\u2264'),      # ≤ less or equal
    ('c3a2e280b0c2a5',       '\u2265'),      # ≥ greater or equal
    ('c3a2e282ace2809d',     '\u2013'),      # – en dash (followed by space+text)
]

def fix_file(fpath, fixes):
    try:
        raw = fpath.read_bytes()
        bom = b''
        if raw[:3] == b'\xef\xbb\xbf':
            bom = b'\xef\xbb\xbf'
            raw = raw[3:]
        
        new_raw = raw
        count = 0
        for corrupted, correct_char in fixes:
            corrupted_bytes = bytes.fromhex(corrupted)
            correct_bytes = correct_char.encode('utf-8')
            n = new_raw.count(corrupted_bytes)
            if n > 0:
                new_raw = new_raw.replace(corrupted_bytes, correct_bytes)
                count += n
        
        if count > 0:
            fpath.write_bytes(bom + new_raw)
        return count
    except Exception as e:
        return 0

def main():
    root = Path('.')
    total_files = 0
    total_fixes = 0
    
    # Sort by length descending
    fixes = sorted(FIXES_HEX, key=lambda x: len(x[0]), reverse=True)
    
    print(f"Applying {len(fixes)} remaining fixes...\n")
    
    for root_dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in files:
            if not any(fname.endswith(e) for e in INCLUDE_EXT):
                continue
            fpath = Path(root_dir) / fname
            count = fix_file(fpath, fixes)
            if count > 0:
                total_files += 1
                total_fixes += count
                rel = fpath.relative_to(root)
                print(f"  FIXED {rel}: {count}")
    
    print(f"\n{'='*50}")
    if total_files > 0:
        print(f"Files: {total_files}, Fixes: {total_fixes}")
    else:
        print("No remaining corruptions found")
    
    # Final verification
    print("\nFinal verification of screener-dashboard.tsx:")
    with open('components/screener-dashboard.tsx', 'rb') as f:
        raw = f.read()
    
    import re
    # Check for any remaining c3b0 c5b8 patterns (4-byte emoji corruption)
    remaining = re.findall(b'\xc3\xb0\xc5\xb8[^\x27\x0a\x0d]{2,8}', raw)
    if remaining:
        print(f"  Still {len(set(remaining))} corrupted 4-byte emoji patterns:")
        for r in set(remaining):
            print(f"    {r.hex()} = {repr(r.decode('utf-8', errors='replace'))}")
    else:
        print("  No 4-byte emoji corruptions remaining!")
    
    # Check for c3a2 patterns
    remaining2 = re.findall(b'\xc3\xa2[\xc2-\xe2][^\x27\x0a\x0d]{1,6}', raw)
    if remaining2:
        unique = set(remaining2)
        print(f"  Still {len(unique)} corrupted 3-byte symbol patterns:")
        for r in list(unique)[:10]:
            print(f"    {r.hex()} = {repr(r.decode('utf-8', errors='replace'))}")
    else:
        print("  No 3-byte symbol corruptions remaining!")

if __name__ == '__main__':
    main()
