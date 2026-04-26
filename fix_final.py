#!/usr/bin/env python3
"""
Final fix: repair double-encoded UTF-8 characters.
The corruption pattern: UTF-8 bytes were read as Latin-1, then re-encoded as UTF-8.
Fix: decode the corrupted UTF-8 as Latin-1, then re-encode as UTF-8 to get original.
"""
import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.json', '.css', '.html', '.yml', '.yaml'}

def fix_double_encoded(content_bytes):
    """
    Fix double-encoded UTF-8 by finding sequences that are valid Latin-1 representations
    of UTF-8 multi-byte sequences, and converting them back.
    
    Strategy: decode as UTF-8, then for each character that looks like a Latin-1 
    misread of UTF-8, fix it.
    """
    # The file is valid UTF-8, but some chars are double-encoded.
    # Pattern: original UTF-8 bytes were read as Latin-1, producing garbage chars,
    # then those garbage chars were saved as UTF-8.
    # 
    # To fix: find sequences where decoding as Latin-1 then re-encoding as UTF-8
    # gives valid Unicode characters.
    
    text = content_bytes.decode('utf-8')
    
    # We need to find runs of characters that, when their UTF-8 bytes are 
    # decoded as Latin-1, produce valid Unicode.
    # 
    # Simpler approach: encode back to bytes as Latin-1 where possible,
    # then decode those bytes as UTF-8.
    
    result = []
    i = 0
    fixed = 0
    
    while i < len(text):
        c = text[i]
        cp = ord(c)
        
        # Check if this character is in the Latin-1 supplement range (0x80-0xFF)
        # These are the "garbage" characters from misread UTF-8
        if 0x80 <= cp <= 0xFF:
            # Try to collect a sequence of Latin-1 chars that form valid UTF-8
            # when their byte values are used directly
            j = i
            latin1_bytes = bytearray()
            
            while j < len(text) and 0x80 <= ord(text[j]) <= 0xFF:
                latin1_bytes.append(ord(text[j]))
                j += 1
            
            # Try to decode this byte sequence as UTF-8
            try:
                decoded = latin1_bytes.decode('utf-8')
                result.append(decoded)
                fixed += len(decoded)
                i = j
                continue
            except UnicodeDecodeError:
                # Not valid UTF-8 - try shorter sequences
                decoded_any = False
                for end in range(j, i, -1):
                    sub_bytes = bytearray(ord(text[k]) for k in range(i, end))
                    try:
                        decoded = sub_bytes.decode('utf-8')
                        result.append(decoded)
                        fixed += len(decoded)
                        i = end
                        decoded_any = True
                        break
                    except UnicodeDecodeError:
                        continue
                
                if not decoded_any:
                    result.append(c)
                    i += 1
        else:
            result.append(c)
            i += 1
    
    new_text = ''.join(result)
    return new_text, fixed

def process_file(fpath):
    try:
        raw = fpath.read_bytes()
        # Remove BOM if present
        if raw[:3] == b'\xef\xbb\xbf':
            raw = raw[3:]
            had_bom = True
        else:
            had_bom = False
        
        new_text, fixed = fix_double_encoded(raw)
        
        if fixed > 0:
            out = new_text.encode('utf-8')
            fpath.write_bytes(out)
            return fixed
        return 0
    except Exception as e:
        print(f"  ERROR {fpath}: {e}")
        return 0

def main():
    root = Path('.')
    total_files = 0
    total_fixes = 0
    
    print("Fixing double-encoded UTF-8 characters...\n")
    
    for root_dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in files:
            if not any(fname.endswith(e) for e in INCLUDE_EXT):
                continue
            fpath = Path(root_dir) / fname
            count = process_file(fpath)
            if count > 0:
                total_files += 1
                total_fixes += count
                rel = fpath.relative_to(root)
                print(f"  FIXED {rel}: {count} char(s)")
    
    print(f"\n{'='*60}")
    if total_files > 0:
        print(f"Files fixed:  {total_files}")
        print(f"Total fixes:  {total_fixes}")
        print(f"Done!")
    else:
        print(f"No double-encoded characters found!")

if __name__ == '__main__':
    main()
