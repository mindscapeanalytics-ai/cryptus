#!/usr/bin/env python3
with open('components/screener-dashboard.tsx', 'rb') as f:
    raw = f.read()

# Find all icon: ' occurrences and show their bytes
search = b"icon: '"
idx = raw.find(search)
count = 0
while idx >= 0 and count < 20:
    snippet = raw[idx:idx+25]
    print(f"pos {idx}: {snippet}")
    idx = raw.find(search, idx + 1)
    count += 1
