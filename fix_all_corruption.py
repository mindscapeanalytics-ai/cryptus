#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix ALL corruption in source files caused by the em-dash replacement script.
Uses exact byte-level matching to find and replace corrupted sequences.
"""

import os
from pathlib import Path

EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '__pycache__', 'venv', '.env'}
INCLUDE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.md', '.txt', '.json', '.css', '.scss', '.html', '.yml', '.yaml'}

# Map of corrupted string -> correct string
# These were identified by reading the actual file bytes
FIXES = {
    # 4-byte emoji (U+1F000 range) - appear as 4 Latin-1 chars
    'ðŸš€': '🚀',   # U+1F680 rocket
    'ðŸ"ˆ': '📈',   # U+1F4C8 chart up
    'ðŸ"‰': '📉',   # U+1F4C9 chart down
    'ðŸ"Š': '📊',   # U+1F4CA bar chart
    'ðŸ"‹': '📋',   # U+1F4CB clipboard
    'ðŸ"¥': '🔥',   # U+1F525 fire
    'ðŸ""': '🔔',   # U+1F514 bell
    'ðŸ"´': '🔴',   # U+1F534 red circle
    'ðŸ"µ': '🔵',   # U+1F535 blue circle
    'ðŸŸ\xa0': '🟠',  # U+1F7E0 orange circle (with nbsp)
    'ðŸŸ¢': '🟢',   # U+1F7E2 green circle
    'ðŸŸ¡': '🟡',   # U+1F7E1 yellow circle
    'ðŸŸ£': '🟣',   # U+1F7E3 purple circle
    'ðŸŸ¤': '🟤',   # U+1F7E4 brown circle
    'ðŸŸ¥': '🟥',   # U+1F7E5 red square
    'ðŸŸ¦': '🟦',   # U+1F7E6 blue square
    'ðŸŸ§': '🟧',   # U+1F7E7 orange square
    'ðŸŸ¨': '🟨',   # U+1F7E8 yellow square
    'ðŸŸ©': '🟩',   # U+1F7E9 green square
    'ðŸŽ¯': '🎯',   # U+1F3AF target
    'ðŸ³': '🐳',    # U+1F433 whale
    'ðŸ¥‡': '🥇',   # U+1F947 gold medal
    'ðŸ'±': '💱',   # U+1F4B1 currency exchange
    'ðŸ'°': '💰',   # U+1F4B0 money bag
    'ðŸ'¹': '💹',   # U+1F4B9 chart yen
    'ðŸ'¡': '💡',   # U+1F4A1 bulb
    'ðŸ"': '🔍',    # U+1F50D magnifier
    'ðŸ"±': '📱',   # U+1F4F1 phone
    'ðŸ–¥': '🖥',    # U+1F5A5 desktop
    'ðŸ"': '🔐',    # U+1F510 lock
    'ðŸ"': '🔑',    # U+1F511 key
    'ðŸ›¡ï¸': '🛡️',  # U+1F6E1 shield
    'ðŸ\x8fï¸': '🏛️', # U+1F3DB building (with variation selector)
    'ðŸ\x8f': '🏛',  # U+1F3DB building
    'ðŸ¦': '🦈',    # U+1F988 shark
    'ðŸ"': '🔔',    # U+1F514 bell (alt)
    # 3-byte symbols (U+0800-U+FFFF range) - appear as 3 Latin-1 chars
    'âž–': '➖',    # U+2796 minus
    'âž•': '➕',    # U+2795 plus
    'âœ…': '✅',    # U+2705 check
    'âœ"': '✔',     # U+2714 heavy check
    'âŒ': '❌',     # U+274C cross
    'â€¢': '•',     # U+2022 bullet
    'â€"': '–',     # U+2013 en dash
    'â€™': '\u2019', # U+2019 right single quote
    'â€œ': '\u201c', # U+201c left double quote
    'â€': '\u201d',  # U+201d right double quote
    'â€¦': '…',     # U+2026 ellipsis
    'â„¢': '™',     # U+2122 trademark
    'â˜…': '★',     # U+2605 star
    'â–²': '▲',     # U+25B2 triangle up
    'â–¼': '▼',     # U+25BC triangle down
    'â–¶': '▶',     # U+25B6 play
    'â—€': '◀',     # U+25C0 back
    'â†'': '↑',     # U+2191 up arrow
    'â†"': '↓',     # U+2193 down arrow
    'â†'': '↑',     # U+2191 up arrow (alt)
    'â†"': '↓',     # U+2193 down arrow (alt)
    'â†¥': '↥',     # U+21A5 up from bar
    'â†§': '↧',     # U+21A7 down from bar
    'â‰¤': '≤',     # U+2264 less or equal
    'â‰¥': '≥',     # U+2265 greater or equal
    'â‚¿': '₿',     # U+20BF bitcoin
    'â"€': '─',     # U+2500 box drawing horizontal
    # Warning with variation selector
    'âš\xa0ï¸\x8f': '⚠️',  # U+26A0 + U+FE0F warning
    'âš ï¸': '⚠️',   # U+26A0 warning (alt)
    'âš¡': '⚡',     # U+26A1 lightning
    # 2-byte sequences (U+0080-U+07FF) - appear as 2 Latin-1 chars
    'Â©': '©',      # U+00A9 copyright
    'Â®': '®',      # U+00AE registered
    'Â°': '°',      # U+00B0 degree
    'Â±': '±',      # U+00B1 plus minus
    'Â·': '·',      # U+00B7 middle dot
    'Â½': '½',      # U+00BD half
    'Â¼': '¼',      # U+00BC quarter
    'Â¾': '¾',      # U+00BE three quarters
    'Â×': '×',      # U+00D7 multiply
    'Â÷': '÷',      # U+00F7 divide
    # Trademark/special
    'Signal Narration Engineâ„¢': 'Signal Narration Engine™',
}

def fix_file(fpath):
    """Fix all known corruptions in a file. Returns (was_fixed, count)."""
    try:
        content = fpath.read_text(encoding='utf-8', errors='replace')
        original = content
        total = 0
        for corrupted, correct in FIXES.items():
            count = content.count(corrupted)
            if count > 0:
                content = content.replace(corrupted, correct)
                total += count
        if total > 0:
            fpath.write_text(content, encoding='utf-8')
            return True, total
        return False, 0
    except Exception as e:
        print(f"  ERROR: {fpath}: {e}")
        return False, 0

def main():
    root = Path('.')
    total_files = 0
    total_fixes = 0

    print("Fixing all corruption across project files...\n")

    for root_dir, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in files:
            if not any(fname.endswith(e) for e in INCLUDE_EXT):
                continue
            fpath = Path(root_dir) / fname
            was_fixed, count = fix_file(fpath)
            if was_fixed:
                total_files += 1
                total_fixes += count
                rel = fpath.relative_to(root)
                print(f"  FIXED {rel}: {count} issue(s)")

    print(f"\n{'='*60}")
    if total_files > 0:
        print(f"Files fixed:  {total_files}")
        print(f"Total fixes:  {total_fixes}")
        print(f"Done!")
    else:
        print(f"No corruption found - all files are clean!")

if __name__ == '__main__':
    main()
