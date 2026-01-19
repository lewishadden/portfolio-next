# Accessibility Quick Reference

Quick guide to the accessibility features of this portfolio.

## For Users

### Keyboard Navigation

| Action | Key(s) |
|--------|--------|
| Navigate forward | `Tab` |
| Navigate backward | `Shift + Tab` |
| Activate button/link | `Enter` or `Space` |
| Skip to main content | `Tab` (first element on page) |
| Close modals | `Escape` |

### Skip Link

Press `Tab` when the page loads to reveal the "Skip to main content" link. Press `Enter` to jump directly to the main content, bypassing the navigation.

### Reduced Motion

If you have motion sensitivities, enable "Reduce Motion" in your operating system:

- **macOS**: System Settings → Accessibility → Display → Reduce motion
- **Windows**: Settings → Accessibility → Visual effects → Animation effects (Off)
- **iOS**: Settings → Accessibility → Motion → Reduce Motion
- **Android**: Settings → Accessibility → Remove animations

The portfolio will automatically respect your preference and minimize animations.

### Screen Readers

This portfolio is optimized for screen readers including:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)

All sections have proper landmarks and labels for easy navigation.

## For Developers

### Using Accessibility Utilities

```typescript
import { getAnimationProps, prefersReducedMotion } from '@/utils/accessibility';

// In components with animations
<ScrollAnimation {...getAnimationProps('fadeIn')}>
  <YourComponent />
</ScrollAnimation>

// Check if user prefers reduced motion
if (prefersReducedMotion()) {
  // Provide alternative without animation
}
```

### Adding New Interactive Elements

When adding buttons, cards, or interactive elements:

```tsx
// ✅ Good - Keyboard accessible
<div
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
  tabIndex={0}
  role="button"
  aria-label="Descriptive label"
>
  Content
</div>

// ❌ Bad - Not keyboard accessible
<div onClick={handleClick}>
  Content
</div>
```

### Icons

```tsx
// Decorative icons (no semantic meaning)
<Icon icon="some-icon" aria-hidden="true" />

// Functional icons (convey meaning)
<Icon icon="some-icon" aria-label="Descriptive label" />

// Icons with visible text (icon is decorative)
<button>
  <Icon icon="send" aria-hidden="true" />
  <span>Send Message</span>
</button>
```

### Forms

```tsx
// Always pair inputs with labels
<Form.Group controlId="uniqueId">
  <Form.Label>Field Label</Form.Label>
  <Form.Control
    type="text"
    name="fieldName"
    value={value}
    onChange={handleChange}
    isInvalid={!!error}
    autoComplete="appropriate-value"
    aria-describedby="helpText"
  />
  <Form.Control.Feedback type="invalid">
    {error}
  </Form.Control.Feedback>
  <Form.Text id="helpText">
    Helpful description
  </Form.Text>
</Form.Group>
```

### Sections and Headings

```tsx
// All sections should have proper landmarks
<section id="section-name" aria-labelledby="section-heading">
  <Container>
    <h2 id="section-heading">Section Title</h2>
    {/* Content */}
  </Container>
</section>
```

### Live Regions (Dynamic Content)

```tsx
// For announcements to screen readers
<div role="status" aria-live="polite" aria-atomic="true">
  {dynamicMessage}
</div>

// For urgent announcements
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

## Testing Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are clearly visible
- [ ] Skip link appears and works
- [ ] All images have alt text
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Forms have proper labels
- [ ] Error messages are announced to screen readers
- [ ] Headings follow logical hierarchy
- [ ] ARIA landmarks are present
- [ ] Color contrast meets WCAG AA standards
- [ ] Animations respect `prefers-reduced-motion`

## Common Issues and Solutions

### Issue: Element not keyboard accessible

**Problem:** User can't navigate to element with keyboard

**Solution:**
```tsx
// Add tabIndex and keyboard handlers
tabIndex={0}
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleAction();
  }
}}
```

### Issue: Screen reader not announcing changes

**Problem:** Dynamic content updates aren't announced

**Solution:**
```tsx
// Wrap in live region
<div role="status" aria-live="polite">
  {dynamicContent}
</div>
```

### Issue: Focus order is incorrect

**Problem:** Tab navigation jumps around unexpectedly

**Solution:**
- Use semantic HTML in DOM order
- Avoid positive `tabIndex` values (only use 0 or -1)
- Structure markup to match visual layout

### Issue: Icon-only button not accessible

**Problem:** Button with only icon has no label

**Solution:**
```tsx
// Add accessible label
<button aria-label="Close dialog">
  <Icon icon="close" aria-hidden="true" />
</button>
```

## Global Styles

All focus indicators and accessibility styles are in `app/globals.scss`:

```scss
// Custom focus indicator
*:focus-visible {
  outline: 3px solid #4a9eff;
  outline-offset: 2px;
}

// Skip link
.skip-link {
  position: absolute;
  top: -40px;
  &:focus {
    top: 0;
  }
}

// Screen reader only text
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility Guide](https://react.dev/learn/accessibility)
- [WebAIM Resources](https://webaim.org/resources/)

## Questions?

Refer to the full `ACCESSIBILITY.md` document for comprehensive details.

---

**Version:** 1.0  
**Last Updated:** January 19, 2026
