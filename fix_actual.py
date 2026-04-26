#!/usr/bin/env python3
"""
Fix using the ACTUAL corrupted byte sequences found in the file.
"""
import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.json', '.css', '.html', '.yml', '.yaml'}

# ACTUAL byte sequences found in the file (from check_bytes.py output)
# Format: (corrupted_bytes, correct_utf8_bytes)
BYTE_FIXES = [
    # 📈 chart up (U+1F4C8) - found as c3b0 c5b8 e2809c cb86
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xcb\x86', '\U0001F4C8'.encode('utf-8')),
    # 📉 chart down (U+1F4C9) - found as c3b0 c5b8 e2809c e280b0
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\xb0', '\U0001F4C9'.encode('utf-8')),
    # ⚠️ warning (U+26A0 U+FE0F) - found as c3a2 c5a1 c2a0 efb88f
    (b'\xc3\xa2\xc5\xa1\xc2\xa0\xef\xb8\x8f', '\u26A0\uFE0F'.encode('utf-8')),
    # ₿ bitcoin (U+20BF) - found as c3a2 e2809a c2bf
    (b'\xc3\xa2\xe2\x80\x9a\xc2\xbf', '\u20BF'.encode('utf-8')),
    # 💱 currency exchange (U+1F4B1) - found as c3b0 c5b8 e28099 c2b1
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x99\xc2\xb1', '\U0001F4B1'.encode('utf-8')),
    # 🥇 gold medal (U+1F947) - found as c3b0 c5b8 c2a5 e280a1
    (b'\xc3\xb0\xc5\xb8\xc2\xa5\xe2\x80\xa1', '\U0001F947'.encode('utf-8')),
    # 🟢 green circle (U+1F7E2) - found in candle direction display
    # 🔴 red circle (U+1F534) - found in candle direction display
    # 🔥 fire (U+1F525)
    # 🔔 bell (U+1F514)
    # 🔵 blue circle (U+1F535)
    # 🟡 yellow circle (U+1F7E1)
    # 🟠 orange circle (U+1F7E0)
]

# Now let's find ALL corrupted sequences by scanning the file
def find_all_corrupted(raw):
    """Find all sequences that look like double-encoded UTF-8."""
    found = {}
    i = 0
    while i < len(raw):
        # Look for sequences starting with c3 or c5 (Latin-1 supplement re-encoded)
        # that are followed by more such bytes
        if raw[i] in (0xc3, 0xc5, 0xc2) and i + 1 < len(raw):
            # Try to collect a run of "re-encoded Latin-1" bytes
            j = i
            collected = bytearray()
            while j < len(raw):
                b = raw[j]
                # These are the first bytes of 2-byte UTF-8 sequences for Latin-1 chars
                if b == 0xc3 and j+1 < len(raw) and 0x80 <= raw[j+1] <= 0xbf:
                    # c3 xx -> Latin-1 char 0xC0-0xFF
                    collected.append(0xC0 + (raw[j+1] - 0x80))
                    j += 2
                elif b == 0xc2 and j+1 < len(raw) and 0x80 <= raw[j+1] <= 0xbf:
                    # c2 xx -> Latin-1 char 0x80-0xBF
                    collected.append(raw[j+1])
                    j += 2
                elif b == 0xc5 and j+1 < len(raw):
                    # c5 xx -> Latin-1 chars 0x140-0x17F (not standard Latin-1)
                    # These appear in the corruption pattern
                    collected.append(raw[j+1] + 0x40)  # approximate
                    j += 2
                elif b == 0xcb and j+1 < len(raw):
                    # cb xx -> some chars
                    collected.append(raw[j+1] + 0x80)
                    j += 2
                elif b == 0xe2 and j+2 < len(raw):
                    # 3-byte UTF-8 sequence - could be part of corruption or real
                    collected.append(raw[j])
                    collected.append(raw[j+1])
                    collected.append(raw[j+2])
                    j += 3
                elif b == 0xef and j+2 < len(raw):
                    # 3-byte UTF-8 sequence
                    collected.append(raw[j])
                    collected.append(raw[j+1])
                    collected.append(raw[j+2])
                    j += 3
                else:
                    break
            
            if len(collected) >= 3:
                # Try to decode as UTF-8
                try:
                    decoded = bytes(collected).decode('utf-8')
                    if any(ord(c) > 0x7F for c in decoded):
                        key = raw[i:j]
                        if key not in found:
                            found[key] = decoded
                except:
                    pass
        i += 1
    return found

def main():
    # First, scan the main file to find all corrupted sequences
    with open('components/screener-dashboard.tsx', 'rb') as f:
        raw = f.read()
    
    print("Scanning for corrupted sequences...")
    found = find_all_corrupted(raw)
    
    print(f"\nFound {len(found)} unique corrupted sequences:")
    for corrupted, decoded in list(found.items())[:20]:
        print(f"  {corrupted.hex()} -> {repr(decoded)}")
    
    # Now apply fixes to all files
    root = Path('.')
    total_files = 0
    total_fixes = 0
    
    # Build fix map from found sequences
    fix_map = {}
    for corrupted, decoded in found.items():
        correct = decoded.encode('utf-8')
        if corrupted != correct:
            fix_map[corrupted] = correct
    
    # Add known fixes
    for corrupted, correct in BYTE_FIXES:
        fix_map[corrupted] = correct
    
    # Sort by length descending
    sorted_fixes = sorted(fix_map.items(), key=lambda x: len(x[0]), reverse=True)
    
    print(f"\nApplying {len(sorted_fixes)} fixes to all files...\n")
    
    for root_dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in files:
            if not any(fname.endswith(e) for e in INCLUDE_EXT):
                continue
            fpath = Path(root_dir) / fname
            try:
                file_raw = fpath.read_bytes()
                bom = b''
                if file_raw[:3] == b'\xef\xbb\xbf':
                    bom = b'\xef\xbb\xbf'
                    file_raw = file_raw[3:]
                
                new_raw = file_raw
                count = 0
                for corrupted, correct in sorted_fixes:
                    n = new_raw.count(corrupted)
                    if n > 0:
                        new_raw = new_raw.replace(corrupted, correct)
                        count += n
                
                if count > 0:
                    fpath.write_bytes(bom + new_raw)
                    total_files += 1
                    total_fixes += count
                    rel = fpath.relative_to(root)
                    print(f"  FIXED {rel}: {count} replacement(s)")
            except Exception as e:
                pass
    
    print(f"\n{'='*60}")
    if total_files > 0:
        print(f"Files fixed:  {total_files}")
        print(f"Total fixes:  {total_fixes}")
    else:
        print(f"No corrupted sequences found!")

if __name__ == '__main__':
    main()
