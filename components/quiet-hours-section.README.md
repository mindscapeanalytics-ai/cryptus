# QuietHoursSection Component

## Overview

The `QuietHoursSection` component provides a complete UI for configuring quiet hours in the RSI Screener application. It allows users to suppress low and medium priority alerts during specific time periods while ensuring high and critical priority alerts always get through.

## Requirements Fulfilled

This component implements **Requirement 4** from the RSI Screener UI/UX Improvements specification:

### Acceptance Criteria ✅

- **4.1.1** ✅ Enable/disable toggle for quiet hours
- **4.1.2** ✅ Time pickers for start/end hours (0-23)
- **4.1.3** ✅ Visual 24-hour timeline with shaded active region
- **4.1.4** ✅ Explanation text about high/critical priority bypass

## Features

### 1. Enable/Disable Toggle
- Clean toggle button with purple theme
- Shows "Quiet Hours" label with icon
- Descriptive subtitle: "Suppress low/medium priority alerts"
- Smooth animation when toggling

### 2. Time Range Pickers
- Two dropdown selectors for start and end hours
- 24-hour format (0-23)
- Moon icon for start time (night)
- Sun icon for end time (morning)
- Disabled state support

### 3. Visual 24-Hour Timeline
- Horizontal timeline showing all 24 hours
- Grid lines for each hour
- Major hour markers at 0, 6, 12, 18
- Shaded purple region showing active quiet hours
- Start/end markers with circular indicators
- Handles midnight-spanning periods correctly
- Shows time range below timeline (e.g., "22:00 → 08:00")
- Indicates when quiet hours span midnight

### 4. Explanation Text
- Info box explaining priority bypass behavior
- Clear message: "High and critical priority alerts will bypass quiet hours"
- Purple-themed styling matching the component

## Component API

```typescript
interface QuietHoursSectionProps {
  enabled: boolean;              // Whether quiet hours are enabled
  startHour: number;             // Start hour (0-23)
  endHour: number;               // End hour (0-23)
  onEnabledChange: (enabled: boolean) => void;  // Callback when toggle changes
  onStartHourChange: (hour: number) => void;    // Callback when start hour changes
  onEndHourChange: (hour: number) => void;      // Callback when end hour changes
  disabled?: boolean;            // Optional: disable all controls
  className?: string;            // Optional: additional CSS classes
}
```

## Usage

### Basic Usage

```tsx
import { QuietHoursSection } from '@/components/quiet-hours-section';

function MyComponent() {
  const [config, setConfig] = useState({
    quietHoursEnabled: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
  });

  return (
    <QuietHoursSection
      enabled={config.quietHoursEnabled}
      startHour={config.quietHoursStart}
      endHour={config.quietHoursEnd}
      onEnabledChange={(enabled) => 
        setConfig({ ...config, quietHoursEnabled: enabled })
      }
      onStartHourChange={(hour) => 
        setConfig({ ...config, quietHoursStart: hour })
      }
      onEndHourChange={(hour) => 
        setConfig({ ...config, quietHoursEnd: hour })
      }
    />
  );
}
```

### Integration with CoinSettingsModal

The component is designed to replace the existing quiet hours section in `components/screener-dashboard.tsx` (around line 5625). See `quiet-hours-section.example.tsx` for detailed integration instructions.

## Design Patterns

### Styling
- Follows existing design system with purple theme for quiet hours
- Uses Tailwind CSS utility classes
- Consistent with other components (win-rate-badge, global-win-rate-badge)
- Mobile-responsive with touch-friendly controls

### Animation
- Uses Framer Motion for smooth expand/collapse
- AnimatePresence for enter/exit animations
- Smooth transitions on all interactive elements

### Accessibility
- Semantic HTML structure
- Clear labels for all controls
- Keyboard accessible
- Touch-friendly (minimum 44x44px touch targets)
- Disabled state support

## Technical Details

### Dependencies
- `react` - Core React library
- `lucide-react` - Icons (Clock, Moon, Sun, Info)
- `framer-motion` - Animations
- `@/lib/utils` - cn() utility for className merging

### Sub-Components

#### QuietHoursTimeline
Internal component that renders the visual 24-hour timeline. Features:
- Calculates if quiet hours span midnight
- Renders shaded regions correctly for both cases
- Shows hour markers and labels
- Displays start/end time indicators

### State Management
- Component is fully controlled (no internal state)
- All state managed by parent component
- Callbacks for all user interactions

## Backend Integration

The component saves settings to `coinConfig`:
- `quietHoursEnabled` (boolean)
- `quietHoursStart` (number, 0-23)
- `quietHoursEnd` (number, 0-23)

Backend uses existing `shouldSuppressAlert()` function to enforce quiet hours.

## Mobile Responsiveness

- Touch-friendly controls (large touch targets)
- Responsive grid layout
- Smooth animations on mobile
- Optimized for small screens

## Testing

While unit tests are not included (testing library not available), the component has been designed with testability in mind:
- Pure functional component
- Controlled inputs
- Clear separation of concerns
- No side effects

## Future Enhancements

Potential improvements for future iterations:
- Day-of-week selection (e.g., only weekdays)
- Multiple quiet hour periods
- Quick presets (e.g., "Night", "Work Hours")
- Visual preview of next quiet period
- Integration with user's timezone

## Files

- `components/quiet-hours-section.tsx` - Main component
- `components/quiet-hours-section.example.tsx` - Usage examples
- `components/quiet-hours-section.README.md` - This documentation

## Related Components

- `components/win-rate-badge.tsx` - Similar styling patterns
- `components/global-win-rate-badge.tsx` - Similar tooltip patterns
- `components/screener-dashboard.tsx` - Integration point (CoinSettingsModal)

## Support

For questions or issues, refer to:
- Design document: `.kiro/specs/rsi-screener-ui-ux-improvements/design.md`
- Requirements: `.kiro/specs/rsi-screener-ui-ux-improvements/requirements.md`
- Tasks: `.kiro/specs/rsi-screener-ui-ux-improvements/tasks.md`
