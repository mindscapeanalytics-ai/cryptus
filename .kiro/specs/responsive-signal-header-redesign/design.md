# Design Document: Responsive Signal Header Redesign

## Overview

This design document specifies the technical approach for redesigning the Signal Narration Modal header to be fully responsive, compact, and professionally styled. The current header implementation has several critical issues:

1. **Code Quality**: Decorative Unicode box-drawing characters (──) in comments
2. **Mobile Responsiveness**: Metrics ribbon uses `hidden lg:flex` which completely hides critical data on mobile/tablet
3. **Space Efficiency**: Excessive vertical padding and fixed gap spacing
4. **Layout Rigidity**: No adaptive layout structure for different screen sizes

The redesign will implement a mobile-first, adaptive header that maintains all functionality while improving space efficiency and visual hierarchy across all screen sizes (320px to 1920px+).

### Design Goals

- **Mobile-First**: Ensure all critical information is visible on mobile devices (320px+)
- **Adaptive Layout**: Three distinct layout modes based on viewport width
- **Space Efficiency**: Reduce vertical space by 20% on desktop, 15% on mobile
- **Professional Code**: Remove decorative characters, use clean comments
- **Preserve Functionality**: Maintain all animations, interactions, and data visibility

### Target Component

- **File**: `components/signal-narration-modal.tsx`
- **Section**: Header section (lines ~140-240 in current implementation)
- **Scope**: Signal Profile, Metrics Ribbon, and Action Buttons

## Architecture

### Component Structure

The header redesign maintains the existing three-section architecture but adds responsive behavior:

```
Header Container (responsive padding/gaps)
├── Signal Profile (left section)
│   ├── Emoji Icon (with high-conviction indicator)
│   ├── Badge Row (Live Feed, Signal Intel v3, Conviction, Trading Style)
│   ├── Headline (truncated on mobile)
│   └── Sub-metrics Row (Indicator Sync, Flow, Vol Spike, SMC Detection)
│
├── Metrics Ribbon (center section - RESPONSIVE)
│   ├── Desktop (1024px+): Horizontal flex layout with 7 metrics
│   ├── Tablet (640-1024px): 3-column grid with 6 metrics
│   └── Mobile (<640px): 2-column grid with 4 critical metrics
│
└── Action Buttons (right section)
    ├── Copy Brief Button
    └── Close Button
```

### Responsive Breakpoints

Following Tailwind CSS conventions:

| Breakpoint | Width | Layout Mode | Metrics Display |
|------------|-------|-------------|-----------------|
| Mobile | 320-639px | Vertical stack | 2-col grid (4 metrics) |
| Tablet | 640-1023px | Two-column | 3-col grid (6 metrics) |
| Desktop | 1024px+ | Three-section horizontal | Horizontal flex (7 metrics) |

### Layout Transformation Strategy

**Current Implementation Problem**:
```tsx
<div className="hidden lg:flex flex-1 items-center justify-center gap-6 px-6 border-x border-white/5 mx-2">
  {/* 7 metrics - completely hidden on mobile/tablet */}
</div>
```

**New Implementation Approach**:
```tsx
<div className="flex-1">
  {/* Desktop: horizontal flex */}
  <div className="hidden lg:flex items-center justify-center gap-2 sm:gap-4 lg:gap-6 px-6 border-x border-white/5 mx-2">
    {/* All 7 metrics */}
  </div>
  
  {/* Mobile/Tablet: grid layout */}
  <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 px-3 sm:px-4">
    {/* Filtered metrics based on breakpoint */}
  </div>
</div>
```

## Components and Interfaces

### Data Interfaces (Unchanged)

The redesign preserves all existing TypeScript interfaces:

```typescript
interface SignalNarrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  narration: SignalNarration | null;
  symbol: string;
  entry?: ScreenerEntry;
  rsiPeriod?: number;
  smartMoneyScore?: number;
  orderFlowData?: { ratio: number; pressure: string };
  fundingRate?: { rate: number; annualized: number };
  tradingStyle?: TradingStyle;
}
```

### Metric Priority System

For mobile display, metrics are prioritized by trading importance:

**Critical Metrics (Mobile - 4 displayed)**:
1. Symbol - Asset identifier
2. Price - Current market price
3. RSI(15m) - Momentum indicator
4. Bias - Directional sentiment

**Secondary Metrics (Tablet - 6 displayed)**:
5. 24h Δ - Price change percentage
6. Style - Trading style (intraday/swing/scalp)

**Tertiary Metrics (Desktop - 7 displayed)**:
7. Win Rate - Historical performance badge

### Responsive Class Patterns

**Padding Scale**:
- Mobile: `py-2` (8px)
- Tablet: `sm:py-3` (12px)
- Desktop: `lg:py-4` (16px)

**Gap Scale**:
- Mobile: `gap-2` (8px)
- Tablet: `sm:gap-3` (12px) or `sm:gap-4` (16px)
- Desktop: `lg:gap-4` (16px) or `lg:gap-6` (24px)

**Text Scale**:
- Labels: `text-[8px] sm:text-[9px]`
- Values: `text-[10px] sm:text-xs`
- Headline: `text-lg sm:text-xl`

## Data Models

### Metric Configuration Model

```typescript
interface MetricConfig {
  label: string;
  value: string | React.ReactNode;
  color: string;
  priority: 'critical' | 'secondary' | 'tertiary';
  dot?: boolean; // For bias indicator
}

const metricsConfig: MetricConfig[] = [
  { label: 'Symbol', value: symbol, color: 'text-white', priority: 'critical' },
  { label: 'Price', value: `${entry?.price?.toLocaleString() || '-'}`, color: 'text-white font-mono', priority: 'critical' },
  { label: 'RSI(15m)', value: entry?.rsi15m?.toFixed(1) || 'N/A', color: getRSIColor(entry?.rsi15m), priority: 'critical' },
  { label: 'Bias', value: getBiasLabel(), color: 'text-white italic', priority: 'critical', dot: true },
  { label: '24h Δ', value: `${(entry?.change24h || 0) >= 0 ? '+' : ''}${entry?.change24h?.toFixed(2)}%`, color: getChangeColor(entry?.change24h), priority: 'secondary' },
  { label: 'Style', value: tradingStyle.toUpperCase(), color: 'text-blue-400 font-black tracking-tighter', priority: 'secondary' },
  { label: 'Win Rate', value: <WinRateBadge symbol={symbol} className="scale-75 origin-left" />, color: 'text-white', priority: 'tertiary' },
];
```

### Responsive Display Logic

```typescript
const getVisibleMetrics = (breakpoint: 'mobile' | 'tablet' | 'desktop') => {
  switch (breakpoint) {
    case 'mobile':
      return metricsConfig.filter(m => m.priority === 'critical');
    case 'tablet':
      return metricsConfig.filter(m => m.priority === 'critical' || m.priority === 'secondary');
    case 'desktop':
      return metricsConfig; // All metrics
  }
};
```

## Error Handling

### Layout Overflow Prevention

**Horizontal Overflow**:
- Use `truncate` class on headline text
- Set `max-w-md` on headline container
- Apply `overflow-hidden` on parent containers

**Vertical Overflow**:
- Responsive padding prevents excessive height
- Grid layouts automatically wrap content
- Touch targets maintain minimum 44x44px on mobile

### Missing Data Handling

All metric values include fallback displays:

```typescript
// Price fallback
value: `${entry?.price?.toLocaleString() || '-'}`

// RSI fallback
value: entry?.rsi15m?.toFixed(1) || 'N/A'

// Conditional rendering for optional data
{entry?.longCandle && (
  <div className="flex items-center gap-1">
    <Zap size={8} className="text-yellow-400" />
    <span className="text-[7px] font-black text-yellow-400 uppercase tracking-tighter">Vol Spike</span>
  </div>
)}
```

### Responsive Breakpoint Edge Cases

**Between Breakpoints** (e.g., 639px → 640px):
- Tailwind's mobile-first approach ensures smooth transitions
- No content jumping due to consistent gap/padding scales
- Grid layouts automatically reflow without JavaScript

**Very Small Screens** (320px):
- 2-column grid ensures content fits
- Minimum font sizes prevent illegibility
- Touch targets remain accessible

## Testing Strategy

### Why Property-Based Testing Does NOT Apply

This feature is **NOT suitable for property-based testing** because:

1. **UI Rendering**: Testing visual layout and CSS class application
2. **Responsive Behavior**: Testing breakpoint-specific styling, not algorithmic logic
3. **No Universal Properties**: Layout correctness is viewport-specific, not universally quantifiable
4. **Deterministic Output**: Given a viewport width, the layout is deterministic (no input variation needed)

Property-based testing is designed for testing pure functions with universal properties across varied inputs. UI rendering and responsive design are better validated through:
- **Snapshot tests**: Capture rendered output at different breakpoints
- **Visual regression tests**: Detect unintended visual changes
- **Example-based unit tests**: Verify specific behaviors at specific breakpoints

### Testing Approach

#### 1. Snapshot Testing

**Tool**: Jest + React Testing Library

**Test Cases**:
```typescript
describe('SignalNarrationModal Header - Responsive Snapshots', () => {
  it('renders mobile layout (320px)', () => {
    global.innerWidth = 320;
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    expect(container).toMatchSnapshot();
  });

  it('renders tablet layout (768px)', () => {
    global.innerWidth = 768;
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    expect(container).toMatchSnapshot();
  });

  it('renders desktop layout (1024px)', () => {
    global.innerWidth = 1024;
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    expect(container).toMatchSnapshot();
  });

  it('renders large desktop layout (1920px)', () => {
    global.innerWidth = 1920;
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    expect(container).toMatchSnapshot();
  });
});
```

#### 2. Responsive Behavior Tests

**Test Cases**:
```typescript
describe('SignalNarrationModal Header - Responsive Behavior', () => {
  it('displays 4 metrics on mobile', () => {
    global.innerWidth = 375;
    const { getAllByTestId } = render(<SignalNarrationModal {...mockProps} />);
    const mobileMetrics = getAllByTestId('mobile-metric');
    expect(mobileMetrics).toHaveLength(4);
  });

  it('displays 6 metrics on tablet', () => {
    global.innerWidth = 768;
    const { getAllByTestId } = render(<SignalNarrationModal {...mockProps} />);
    const tabletMetrics = getAllByTestId('tablet-metric');
    expect(tabletMetrics).toHaveLength(6);
  });

  it('displays 7 metrics on desktop', () => {
    global.innerWidth = 1024;
    const { getAllByTestId } = render(<SignalNarrationModal {...mockProps} />);
    const desktopMetrics = getAllByTestId('desktop-metric');
    expect(desktopMetrics).toHaveLength(7);
  });

  it('applies correct grid classes on mobile', () => {
    global.innerWidth = 375;
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    const metricsContainer = container.querySelector('[data-testid="metrics-ribbon"]');
    expect(metricsContainer).toHaveClass('grid', 'grid-cols-2');
  });

  it('applies correct flex classes on desktop', () => {
    global.innerWidth = 1024;
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    const metricsContainer = container.querySelector('[data-testid="metrics-ribbon-desktop"]');
    expect(metricsContainer).toHaveClass('flex', 'items-center');
  });
});
```

#### 3. Functionality Preservation Tests

**Test Cases**:
```typescript
describe('SignalNarrationModal Header - Functionality', () => {
  it('Copy Brief button works on all breakpoints', async () => {
    const breakpoints = [320, 768, 1024, 1920];
    
    for (const width of breakpoints) {
      global.innerWidth = width;
      const { getByText } = render(<SignalNarrationModal {...mockProps} />);
      const copyButton = getByText(/brief/i);
      
      await userEvent.click(copyButton);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }
  });

  it('Close button works on all breakpoints', async () => {
    const onClose = jest.fn();
    const breakpoints = [320, 768, 1024, 1920];
    
    for (const width of breakpoints) {
      global.innerWidth = width;
      const { getByRole } = render(<SignalNarrationModal {...mockProps} onClose={onClose} />);
      const closeButton = getByRole('button', { name: /close/i });
      
      await userEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('maintains Framer Motion animations', () => {
    const { container } = render(<SignalNarrationModal {...mockProps} isOpen={true} />);
    const modal = container.querySelector('[data-testid="modal-container"]');
    expect(modal).toHaveAttribute('data-framer-motion');
  });

  it('WinRateBadge renders correctly on desktop', () => {
    global.innerWidth = 1024;
    const { getByTestId } = render(<SignalNarrationModal {...mockProps} />);
    expect(getByTestId('win-rate-badge')).toBeInTheDocument();
  });
});
```

#### 4. Accessibility Tests

**Test Cases**:
```typescript
describe('SignalNarrationModal Header - Accessibility', () => {
  it('maintains minimum touch target size on mobile', () => {
    global.innerWidth = 375;
    const { getByRole } = render(<SignalNarrationModal {...mockProps} />);
    const copyButton = getByRole('button', { name: /brief/i });
    const closeButton = getByRole('button', { name: /close/i });
    
    const copyRect = copyButton.getBoundingClientRect();
    const closeRect = closeButton.getBoundingClientRect();
    
    expect(copyRect.width).toBeGreaterThanOrEqual(44);
    expect(copyRect.height).toBeGreaterThanOrEqual(44);
    expect(closeRect.width).toBeGreaterThanOrEqual(44);
    expect(closeRect.height).toBeGreaterThanOrEqual(44);
  });

  it('maintains readable font sizes on mobile', () => {
    global.innerWidth = 375;
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    const metricValues = container.querySelectorAll('[data-testid="metric-value"]');
    
    metricValues.forEach(value => {
      const fontSize = window.getComputedStyle(value).fontSize;
      const fontSizePx = parseInt(fontSize);
      expect(fontSizePx).toBeGreaterThanOrEqual(11); // Minimum readable size
    });
  });

  it('passes axe accessibility audit', async () => {
    const { container } = render(<SignalNarrationModal {...mockProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

#### 5. Visual Regression Testing

**Tool**: Percy or Chromatic

**Test Cases**:
- Capture screenshots at 320px, 375px, 768px, 1024px, 1440px, 1920px
- Compare against baseline images
- Flag any unintended visual changes
- Test with different data states (high conviction, low conviction, missing data)

#### 6. Integration Tests

**Test Cases**:
```typescript
describe('SignalNarrationModal Header - Integration', () => {
  it('displays correct data from props', () => {
    const mockEntry: ScreenerEntry = {
      symbol: 'BTCUSDT',
      price: 45000,
      rsi15m: 65.5,
      change24h: 3.2,
      // ... other fields
    };
    
    const { getByText } = render(
      <SignalNarrationModal 
        {...mockProps} 
        symbol="BTCUSDT"
        entry={mockEntry}
        tradingStyle="intraday"
      />
    );
    
    expect(getByText('BTCUSDT')).toBeInTheDocument();
    expect(getByText('45,000')).toBeInTheDocument();
    expect(getByText('65.5')).toBeInTheDocument();
    expect(getByText('+3.20%')).toBeInTheDocument();
    expect(getByText('INTRADAY')).toBeInTheDocument();
  });

  it('handles missing optional data gracefully', () => {
    const mockEntry: Partial<ScreenerEntry> = {
      symbol: 'ETHUSDT',
      price: 3000,
      // rsi15m missing
      // change24h missing
    };
    
    const { getByText } = render(
      <SignalNarrationModal 
        {...mockProps} 
        symbol="ETHUSDT"
        entry={mockEntry as ScreenerEntry}
      />
    );
    
    expect(getByText('ETHUSDT')).toBeInTheDocument();
    expect(getByText('3,000')).toBeInTheDocument();
    expect(getByText('N/A')).toBeInTheDocument(); // RSI fallback
    expect(getByText('-')).toBeInTheDocument(); // Change fallback
  });
});
```

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage of header component logic
- **Snapshot Tests**: 100% coverage of responsive breakpoints
- **Accessibility Tests**: 100% WCAG 2.1 AA compliance
- **Visual Regression**: 0 unintended visual changes

### Manual Testing Checklist

- [ ] Test on real devices (iPhone SE, iPad, Desktop)
- [ ] Verify smooth transitions between breakpoints
- [ ] Check touch target sizes on mobile
- [ ] Validate color contrast ratios
- [ ] Test with screen readers (VoiceOver, NVDA)
- [ ] Verify no horizontal scrolling at any width
- [ ] Check performance (no layout thrashing)

## Implementation Notes

### Code Quality Improvements

**Remove Decorative Characters**:
```typescript
// BEFORE (with decorative characters)
// ── Helpers ───────────────────────────────────────────────────

// AFTER (clean comments)
// Helpers

// BEFORE
// ── Render ────────────────────────────────────────────────────

// AFTER
// Render
```

### Responsive Class Application

**Pattern**: Mobile-first with progressive enhancement

```tsx
// Mobile base + responsive overrides
className="py-2 sm:py-3 lg:py-4"
className="gap-2 sm:gap-3 lg:gap-4"
className="text-[10px] sm:text-xs"
className="grid grid-cols-2 sm:grid-cols-3"
```

### Performance Considerations

**Avoid Layout Thrashing**:
- Use CSS Grid/Flexbox for layout (no JavaScript calculations)
- Leverage Tailwind's JIT compiler for minimal CSS bundle
- Avoid inline styles that trigger reflows

**Optimize Animations**:
- Framer Motion animations use GPU-accelerated transforms
- No layout-affecting animations during resize

### Browser Compatibility

**Target Browsers**:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+
- Chrome Android 90+

**Tailwind CSS Support**:
- All responsive prefixes are widely supported
- Grid and Flexbox have excellent browser support
- No experimental CSS features used

## Migration Strategy

### Phased Rollout

**Phase 1: Code Cleanup**
- Remove decorative Unicode characters
- Update comments to standard format
- No visual changes

**Phase 2: Responsive Metrics**
- Implement mobile/tablet grid layouts
- Add metric priority filtering
- Test on multiple devices

**Phase 3: Space Optimization**
- Apply responsive padding/gap classes
- Verify 20% vertical space reduction
- Validate visual hierarchy

**Phase 4: Polish & Testing**
- Run full test suite
- Conduct accessibility audit
- Perform visual regression testing

### Rollback Plan

If issues arise:
1. Revert to previous commit (Git)
2. Feature flag to toggle old/new header
3. Gradual rollout to percentage of users

### Success Metrics

- **Mobile Usability**: 100% of metrics visible on mobile (currently 0%)
- **Space Efficiency**: 20% reduction in desktop header height
- **Performance**: No regression in Lighthouse scores
- **Accessibility**: WCAG 2.1 AA compliance maintained
- **User Feedback**: Positive sentiment on mobile experience

## Conclusion

This design provides a comprehensive approach to redesigning the Signal Narration Modal header with mobile-first responsive design, space efficiency, and professional code quality. The implementation uses only Tailwind CSS utility classes, preserves all existing functionality, and includes a robust testing strategy focused on snapshot tests, visual regression, and example-based unit tests rather than property-based testing (which is inappropriate for UI rendering).

The adaptive layout ensures all critical trading information is visible on mobile devices while maintaining the sophisticated institutional aesthetic on desktop displays.
