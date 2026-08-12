import '@testing-library/jest-dom/vitest'
import { createElement } from 'react'
import { vi } from 'vitest'

// NumberFlow ships as a custom element and drives its digits with the Web
// Animations API. jsdom upgrades neither, so the element never gains the
// internal methods the React wrapper calls on update and every render of the
// preloader throws `willUpdate is not a function` — an environment gap, not a
// defect in the component. Stubbed globally rather than per-file because any
// test that renders the whole app reaches the preloader too. The stub keeps
// the one thing tests care about: the current value, as text.
vi.mock('@number-flow/react', () => ({
  default: ({ value, ...rest }: { value: number } & Record<string, unknown>) =>
    createElement('span', rest, String(value)),
}))

// jsdom implements neither. anime.js's TextSplitter (used by Hero's entrance
// animation) constructs a ResizeObserver and reads document.fonts.status
// unconditionally, so without these every test that renders Hero under
// non-reduced motion throws before the component under test ever runs.
if (typeof ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver
}
if (!document.fonts) {
  Object.defineProperty(document, 'fonts', {
    value: { status: 'loaded' },
    configurable: true,
  })
}
