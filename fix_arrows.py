#!/usr/bin/env python3
"""Fix the remaining arrow corruption in screener-dashboard.tsx."""

# The ↓ arrow (U+2193, UTF-8: e2 86 93) was corrupted to " (U+201C, UTF-8: e2 80 9c)
# Context: it appears right before " Rev" in the bearish_reversal span

with open('components/screener-dashboard.tsx', 'rb') as f:
    raw = f.read()

# Fix: replace the specific pattern >\xe2\x80\x9c Rev< with >↓ Rev<
# The correct ↓ is \xe2\x86\x93
old = b'>\xe2\x80\x9c Rev</span>'
new = b'>\xe2\x86\x93 Rev</span>'

count = raw.count(old)
print(f"Found {count} occurrence(s) of corrupted down arrow")

if count > 0:
    raw = raw.replace(old, new)
    with open('components/screener-dashboard.tsx', 'wb') as f:
        f.write(raw)
    print("Fixed!")
else:
    print("Pattern not found - checking context...")
    idx = raw.find(b'bearish_reversal')
    if idx >= 0:
        print(repr(raw[idx:idx+200]))
