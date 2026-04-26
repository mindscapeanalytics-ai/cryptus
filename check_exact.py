#!/usr/bin/env python3
with open('components/screener-dashboard.tsx', 'rb') as f:
    raw = f.read()

# From check_bytes.py we know:
# pos 17391: b"icon: '\xc3\xb0\xc5\xb8\xe2\x80\x9c\xcb\x86'\r\n    },"
# This is the corrupted 📈

corrupted_bytes = b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xcb\x86'
correct_bytes = '\U0001F4C8'.encode('utf-8')  # 📈

print("Corrupted bytes:", corrupted_bytes.hex())
print("Correct bytes:  ", correct_bytes.hex())
print("Count in file:  ", raw.count(corrupted_bytes))

# Decode corrupted as UTF-8 to see what chars they are
decoded = corrupted_bytes.decode('utf-8')
print("Decoded as UTF-8:", repr(decoded))
for c in decoded:
    print(f"  U+{ord(c):04X} = {repr(c)}")

# Now let's understand the pattern:
# Original 📈 UTF-8: f0 9f 93 88
# Each byte read as Latin-1 char: ð Ÿ " ˆ
# Those chars encoded as UTF-8:
original = b'\xf0\x9f\x93\x88'
print("\nOriginal UTF-8 bytes:", original.hex())
print("Each byte as Latin-1 char:")
for b in original:
    c = chr(b)
    utf8 = c.encode('utf-8')
    print(f"  byte 0x{b:02x} -> char U+{b:04X} -> UTF-8: {utf8.hex()}")

# Reconstruct what the corrupted form should be
reconstructed = b''
for b in original:
    reconstructed += chr(b).encode('utf-8')
print("\nReconstructed corrupted bytes:", reconstructed.hex())
print("Matches actual?", reconstructed == corrupted_bytes)
