import '@testing-library/jest-dom/vitest'

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
