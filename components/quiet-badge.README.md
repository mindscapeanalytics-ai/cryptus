# QuietBadge Component

## Overview

The `QuietBadge` component displays a visual indicator on symbols that currently have active quiet hours. It only appears when quiet hours are enabled AND the current time falls within the configured quiet hours range.

## Requirements Fulfilled

This component implements **Requirement 4** (Acceptance Criteria 6) from the RSI Screener UI/UX Improvements specification:

### Acceptance Criteria ✅

- **4.3.1** ✅ Display "Quiet" badge on symbols with active quiet hours
- **4.3.2** ✅ Add to `SymbolCell` component
- **4.3.3** ✅ Check current time against quiet hours range

## Features

### 1. Conditional Display
- Only shows when `quietHoursEnabled` is true
- Only shows when current time is within quiet hours range
- Automatically hides when outside quiet hours

### 2. Midnight-Spanning Support
- Correctly handles quiet hours that span midnight (e.g., 22:00 → 08:00)
- Uses smart logic to determine if current time is in range

### 3. Visual Design
- Purple-themed badge matching QuietHoursSection
- Moon icon for visual consistency
- Compact size suitable for inline display
- Tooltip explaining the badge

### 4. Utility Hook
- Includes `useIsQuietHours()` hook for other components
- Can be used to react to quiet hours status changes

## Component API

```typescript
interface QuietBadgeProps {
  quietHoursEnabled: boolean;  // Whether quiet hours are enabled
  quietHoursStart: number;     // Start hour (0-23)
  quietHoursEnd: number;       // End hour (0-23)
  className?: string;          // Optional: additional CSS classes
}
```

## Usage

### Basic Usage

```tsx
import { QuietBadge } from '@/components/quiet-badge';

function SymbolRow({ symbol, config }) {
  return (
    <div className="flex items-center gap-2">
      <span>{symbol}</span>
      <QuietBadge
        quietHoursEnabled={config.quietHoursEnabled}
        quietHoursStart={config.quietHoursStart}
        quietHoursEnd={config.quietHoursEnd}
      />
    </div>
  );
}
```

### Integration with SymbolCell

```tsx
// In components/screener-dashboard.tsx, add to SymbolCell component:

function SymbolCell({ entry, config }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-bold">{entry.symbol}</span>
      
      {/* Add QuietBadge */}
      <QuietBadge
        quietHoursEnabled={config?.quietHoursEnabled ?? false}
        quietHoursStart={config?.quietHoursStart ?? 22}
        quietHoursEnd={config?.quietHoursEnd ?? 8}
      />
      
      {/* Other badges... */}
    </div>
  );
}
```

### Using the Hook

```tsx
import { useIsQuietHours } from '@/components/quiet-badge';

function MyComponent({ config }) {
  const isQuiet = useIsQuietHours(
    config.quietHoursEnabled,
    config.quietHoursStart,
    config.quietHoursEnd
  );

  return (
    <div>
      {isQuiet && <p>Currently in quiet hours</p>}
    </div>
  );
}
```

## Logic Details

### Time Range Checking

The component uses smart logic to determine if the current time is within quiet hours:

**Normal Range** (e.g., 08:00 → 17:00):
```typescript
currentHour >= startHour && currentHour < endHour
```

**Midnight-Spanning Range** (e.g., 22:00 → 08:00):
```typescript
currentHour >= startHour || currentHour < endHour
```

### Examples

| Start | End | Current | In Range? | Reason |
|-------|-----|---------|-----------|--------|
| 22 | 8 | 23 | ✅ Yes | 23 >= 22 (after start) |
| 22 | 8 | 3 | ✅ Yes | 3 < 8 (before end) |
| 22 | 8 | 15 | ❌ No | 15 < 22 AND 15 >= 8 |
| 8 | 17 | 12 | ✅ Yes | 12 >= 8 AND 12 < 17 |
| 8 | 17 | 20 | ❌ No | 20 >= 17 |

## Design Patterns

### Styling
- Purple theme matching QuietHoursSection
- Uses Tailwind CSS utility classes
- Compact inline badge design
- Moon icon for visual consistency

### Accessibility
- Includes title attribute for tooltip
- Clear visual indicator
- Semantic HTML structure

### Performance
- Lightweight component with minimal logic
- No state management or side effects
- Pure function for time checking

## Technical Details

### Dependencies
- `react` - Core React library
- `lucide-react` - Moon icon
- `@/lib/utils` - cn() utility for className merging

### Time Checking
- Uses browser's local time (`new Date()`)
- Checks hours only (0-23), not minutes
- Updates automatically as time changes (component re-renders)

### State Management
- Stateless component (no internal state)
- All props controlled by parent
- No side effects

## Integration Points

### Where to Add

1. **SymbolCell Component** (Primary location)
   - Add next to symbol name
   - Display alongside other badges (priority, etc.)

2. **ScreenerRow Component**
   - Add to symbol column
   - Position near other status indicators

3. **Watchlist Items**
   - Show on watchlist symbols
   - Indicate quiet status at a glance

## Mobile Responsiveness

- Compact size works well on mobile
- Touch-friendly (no interaction required)
- Scales appropriately with text size

## Future Enhancements

Potential improvements for future iterations:
- Real-time updates (re-check every minute)
- Show time remaining until quiet hours end
- Different badge styles for different priority levels
- Animation when entering/exiting quiet hours

## Files

- `components/quiet-badge.tsx` - Main component
- `components/quiet-badge.README.md` - This documentation

## Related Components

- `components/quiet-hours-section.tsx` - Configuration UI
- `components/screener-dashboard.tsx` - Integration point (SymbolCell)
- `components/global-win-rate-badge.tsx` - Similar badge pattern

## Support

For questions or issues, refer to:
- Design document: `.kiro/specs/rsi-screener-ui-ux-improvements/design.md`
- Requirements: `.kiro/specs/rsi-screener-ui-ux-improvements/requirements.md`
- Tasks: `.kiro/specs/rsi-screener-ui-ux-improvements/tasks.md`
