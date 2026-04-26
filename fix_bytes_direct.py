#!/usr/bin/env python3
"""
Direct byte-level fix for double-encoded UTF-8 characters.
Maps corrupted byte sequences directly to correct UTF-8 bytes.
"""
import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.json', '.css', '.html', '.yml', '.yaml'}

# Map: corrupted_bytes -> correct_bytes
# Corrupted = UTF-8 bytes of original char, each byte re-encoded as UTF-8 Latin-1 supplement
# To generate: take original UTF-8 bytes, encode each byte as UTF-8 (bytes 0x80-0xFF become 2-byte seqs)
def latin1_byte_to_utf8(b):
    """Convert a single Latin-1 byte (0x80-0xFF) to its UTF-8 encoding."""
    if b < 0x80:
        return bytes([b])
    elif b < 0xC0:
        return bytes([0xC2, b])
    else:
        return bytes([0xC3, b - 0x40])

def original_utf8_to_corrupted_utf8(original_utf8_bytes):
    """Convert original UTF-8 bytes to the corrupted form."""
    result = bytearray()
    for b in original_utf8_bytes:
        result.extend(latin1_byte_to_utf8(b))
    return bytes(result)

# Build the fix map
EMOJI_MAP = {
    # (original_utf8_bytes, correct_char)
    b'\xf0\x9f\x93\x88': '\U0001F4C8',  # 📈 chart up
    b'\xf0\x9f\x93\x89': '\U0001F4C9',  # 📉 chart down
    b'\xf0\x9f\x93\x8a': '\U0001F4CA',  # 📊 bar chart
    b'\xf0\x9f\x93\x8b': '\U0001F4CB',  # 📋 clipboard
    b'\xf0\x9f\x94\xa5': '\U0001F525',  # 🔥 fire
    b'\xf0\x9f\x94\x94': '\U0001F514',  # 🔔 bell
    b'\xf0\x9f\x94\xb4': '\U0001F534',  # 🔴 red circle
    b'\xf0\x9f\x94\xb5': '\U0001F535',  # 🔵 blue circle
    b'\xf0\x9f\x9f\xa2': '\U0001F7E2',  # 🟢 green circle
    b'\xf0\x9f\x9f\xa1': '\U0001F7E1',  # 🟡 yellow circle
    b'\xf0\x9f\x9f\xa0': '\U0001F7E0',  # 🟠 orange circle
    b'\xf0\x9f\xa5\x87': '\U0001F947',  # 🥇 gold medal
    b'\xf0\x9f\x92\xb1': '\U0001F4B1',  # 💱 currency exchange
    b'\xf0\x9f\x9a\x80': '\U0001F680',  # 🚀 rocket (already correct, skip)
    b'\xe2\x82\xbf': '\u20BF',          # ₿ bitcoin
    b'\xe2\x84\xa2': '\u2122',          # ™ trademark
    b'\xe2\x86\x91': '\u2191',          # ↑ up arrow
    b'\xe2\x86\x93': '\u2193',          # ↓ down arrow
    b'\xe2\x86\xa5': '\u21A5',          # ↥ up from bar
    b'\xe2\x86\xa7': '\u21A7',          # ↧ down from bar
    b'\xe2\x80\x93': '\u2013',          # – en dash
    b'\xe2\x80\xa2': '\u2022',          # • bullet
    b'\xe2\x80\x99': '\u2019',          # ' right single quote
    b'\xe2\x80\x9c': '\u201C',          # " left double quote
    b'\xe2\x80\x9d': '\u201D',          # " right double quote
    b'\xe2\x80\xa6': '\u2026',          # … ellipsis
    b'\xe2\x94\x80': '\u2500',          # ─ box drawing horizontal
    b'\xe2\x98\x85': '\u2605',          # ★ star
    b'\xe2\x96\xb2': '\u25B2',          # ▲ triangle up
    b'\xe2\x96\xbc': '\u25BC',          # ▼ triangle down
    b'\xe2\x9c\x94': '\u2714',          # ✔ check mark
    b'\xe2\x89\xa4': '\u2264',          # ≤ less or equal
    b'\xe2\x89\xa5': '\u2265',          # ≥ greater or equal
    b'\xe2\x9a\xa0': '\u26A0',          # ⚠ warning
    b'\xe2\x9a\xa1': '\u26A1',          # ⚡ lightning
    b'\xe2\x9e\x96': '\u2796',          # ➖ minus (already correct, skip)
    b'\xe2\x9e\x95': '\u2795',          # ➕ plus
    b'\xe2\x9c\x85': '\u2705',          # ✅ check box
    b'\xe2\x9d\x8c': '\u274C',          # ❌ cross
    b'\xef\xb8\x8f': '\uFE0F',          # variation selector-16
}

# Build byte replacement map
BYTE_FIXES = {}
for original_bytes, correct_char in EMOJI_MAP.items():
    corrupted = original_utf8_to_corrupted_utf8(original_bytes)
    correct_utf8 = correct_char.encode('utf-8')
    if corrupted != original_bytes:  # Only add if actually corrupted
        BYTE_FIXES[corrupted] = correct_utf8

# Also handle variation selector combinations
# ⚠️ = ⚠ + variation selector
warning_corrupted = original_utf8_to_corrupted_utf8(b'\xe2\x9a\xa0')
vs16_corrupted = original_utf8_to_corrupted_utf8(b'\xef\xb8\x8f')
BYTE_FIXES[warning_corrupted + vs16_corrupted] = '\u26A0\uFE0F'.encode('utf-8')

# Sort by length descending to match longer sequences first
SORTED_FIXES = sorted(BYTE_FIXES.items(), key=lambda x: len(x[0]), reverse=True)

def fix_file_bytes(fpath):
    """Fix a file by replacing corrupted byte sequences."""
    try:
        raw = fpath.read_bytes()
        original = raw
        
        # Remove BOM for processing
        bom = b''
        if raw[:3] == b'\xef\xbb\xbf':
            bom = b'\xef\xbb\xbf'
            raw = raw[3:]
        
        count = 0
        for corrupted, correct in SORTED_FIXES:
            n = raw.count(corrupted)
            if n > 0:
                raw = raw.replace(corrupted, correct)
                count += n
        
        if count > 0:
            fpath.write_bytes(bom + raw)
            return count
        return 0
    except Exception as e:
        print(f"  ERROR {fpath}: {e}")
        return 0

def main():
    root = Path('.')
    total_files = 0
    total_fixes = 0
    
    print(f"Applying {len(SORTED_FIXES)} byte-level fixes...\n")
    
    # Print what we're fixing
    for corrupted, correct in SORTED_FIXES[:5]:
        correct_str = correct.decode('utf-8')
        print(f"  {corrupted.hex()} -> {repr(correct_str)}")
    print(f"  ... and {len(SORTED_FIXES)-5} more\n")
    
    for root_dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in files:
            if not any(fname.endswith(e) for e in INCLUDE_EXT):
                continue
            fpath = Path(root_dir) / fname
            count = fix_file_bytes(fpath)
            if count > 0:
                total_files += 1
                total_fixes += count
                rel = fpath.relative_to(root)
                print(f"  FIXED {rel}: {count} replacement(s)")
    
    print(f"\n{'='*60}")
    if total_files > 0:
        print(f"Files fixed:  {total_files}")
        print(f"Total fixes:  {total_fixes}")
        print(f"Done!")
    else:
        print(f"No corrupted sequences found!")

if __name__ == '__main__':
    main()
