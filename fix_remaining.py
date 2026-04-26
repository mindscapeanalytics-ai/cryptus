#!/usr/bin/env python3
"""Fix remaining corrupted sequences found after first pass."""
import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.json', '.css', '.html', '.yml', '.yaml'}

# Find remaining corrupted sequences in the file
with open('components/screener-dashboard.tsx', 'rb') as f:
    raw = f.read()

# Search for all non-ASCII sequences that look corrupted
# Pattern: c3b0 followed by more bytes (4-byte emoji corruption)
import re

# Find all sequences matching the corruption pattern
# c3b0 = ð (U+00F0), c5b8 = Ÿ (U+0178) - these start 4-byte emoji corruptions
pattern = re.compile(b'[\xc3][\xb0][\xc5][\xb8][^\x27\x60\x0a\x0d]{2,6}')
matches = set(pattern.findall(raw))
print("4-byte emoji corruptions found:")
for m in sorted(matches):
    try:
        decoded = m.decode('utf-8')
        print(f"  {m.hex()} = {repr(decoded)}")
    except:
        print(f"  {m.hex()} = [decode error]")

# Also find c3a2 sequences (3-byte symbol corruptions)
pattern2 = re.compile(b'[\xc3][\xa2][^\x27\x60\x0a\x0d]{2,8}')
matches2 = set(pattern2.findall(raw))
print("\n3-byte symbol corruptions found:")
for m in sorted(matches2):
    try:
        decoded = m.decode('utf-8')
        print(f"  {m.hex()} = {repr(decoded)}")
    except:
        print(f"  {m.hex()} = [decode error]")
