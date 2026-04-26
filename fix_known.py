#!/usr/bin/env python3
"""
Fix using EXACT known corrupted byte sequences confirmed from file inspection.
"""
import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.json', '.css', '.html', '.yml', '.yaml'}

# Exact byte sequences confirmed from check_bytes.py + git diff analysis
# Format: (corrupted_hex, correct_char, description)
KNOWN_FIXES_HEX = [
    # From check_bytes.py icon fields:
    ('c3b0c5b8e2809ccb86',         '\U0001F4C8', '📈 chart up'),
    ('c3b0c5b8e2809ce28080b0',     '\U0001F4C9', '📉 chart down - variant 1'),
    ('c3b0c5b8e2809ce280b0',       '\U0001F4C9', '📉 chart down - variant 2'),
    ('c3a2c5a1c2a0efb88f',         '\u26A0\uFE0F', '⚠️ warning with VS16'),
    ('c3a2e2809ac2bf',             '\u20BF',     '₿ bitcoin'),
    ('c3b0c5b8e28099c2b1',         '\U0001F4B1', '💱 currency exchange'),
    ('c3b0c5b8c2a5e280a1',         '\U0001F947', '🥇 gold medal'),
    # From git diff - candle direction display:
    ('c3b0c5b8c5b8c2a2',           '\U0001F7E2', '🟢 green circle'),
    ('c3b0c5b8e2809cc2b4',         '\U0001F534', '🔴 red circle'),
    # From git diff - priority labels:
    ('c3b0c5b8e2809cc2b5',         '\U0001F535', '🔵 blue circle'),
    ('c3b0c5b8c5b8c2a1',           '\U0001F7E1', '🟡 yellow circle'),
    ('c3b0c5b8c5b8c2a0',           '\U0001F7E0', '🟠 orange circle'),
    # From git diff - fire emoji in comments:
    ('c3b0c5b8e2809cc2a5',         '\U0001F525', '🔥 fire'),
    # From git diff - bell in test notification:
    ('c3b0c5b8e2809cc2b4',         '\U0001F514', '🔔 bell - same as red circle?'),
    # Trademark symbol:
    ('c3a2e2809ec2a2',             '\u2122',     '™ trademark'),
    # Arrow symbols from git diff:
    ('c3a2e280a0e2809a',           '\u2191',     '↑ up arrow - variant 1'),
    ('c3a2e280a0e2809b',           '\u2191',     '↑ up arrow - variant 2'),
    ('c3a2e280a0e2809c',           '\u201C',     '" left quote (was ↑?)'),
    ('c3a2e280a0e2809d',           '\u2193',     '↓ down arrow'),
    # En dash in comments:
    ('c3a2e282acc2a2',             '\u2013',     '– en dash'),  
    # Bullet in confirm dialog:
    ('c3a2e282acc2a2',             '\u2022',     '• bullet'),
    # Box drawing in comments:
    ('c3a2e2809de282ac',           '\u2500',     '─ box drawing'),
    # Check mark:
    ('c3a2c29cc2b4',               '\u2714',     '✔ check mark'),
    # Star:
    ('c3a2c29ec2a5',               '\u2605',     '★ star'),
    # Triangle up/down:
    ('c3a2e2809ac2b2',             '\u25B2',     '▲ triangle up'),
    ('c3a2e2809ac2bc',             '\u25BC',     '▼ triangle down'),
    # Less/greater equal:
    ('c3a2e2809ac2a4',             '\u2264',     '≤ less equal'),
    ('c3a2e2809ac2a5',             '\u2265',     '≥ greater equal'),
]

def build_fix_map():
    fixes = []
    seen = set()
    for hex_str, correct_char, desc in KNOWN_FIXES_HEX:
        corrupted = bytes.fromhex(hex_str)
        correct = correct_char.encode('utf-8')
        if corrupted != correct and corrupted not in seen:
            fixes.append((corrupted, correct, desc))
            seen.add(corrupted)
    # Sort by length descending to match longer sequences first
    fixes.sort(key=lambda x: len(x[0]), reverse=True)
    return fixes

def fix_file(fpath, fixes):
    try:
        raw = fpath.read_bytes()
        bom = b''
        if raw[:3] == b'\xef\xbb\xbf':
            bom = b'\xef\xbb\xbf'
            raw = raw[3:]
        
        new_raw = raw
        count = 0
        for corrupted, correct, desc in fixes:
            n = new_raw.count(corrupted)
            if n > 0:
                new_raw = new_raw.replace(corrupted, correct)
                count += n
        
        if count > 0:
            fpath.write_bytes(bom + new_raw)
        return count
    except Exception as e:
        return 0

def main():
    fixes = build_fix_map()
    root = Path('.')
    total_files = 0
    total_fixes = 0
    
    print(f"Applying {len(fixes)} known byte-level fixes...\n")
    
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
        print("No matches found with known patterns")
    
    # Verify the main file
    print("\nVerifying screener-dashboard.tsx icons:")
    with open('components/screener-dashboard.tsx', 'rb') as f:
        raw = f.read()
    import re
    for m in re.finditer(b"icon: '([^']+)'", raw):
        icon_bytes = m.group(1)
        try:
            icon_str = icon_bytes.decode('utf-8')
            print(f"  {icon_bytes.hex()} = {repr(icon_str)}")
        except:
            print(f"  {icon_bytes.hex()} = [decode error]")

if __name__ == '__main__':
    main()
