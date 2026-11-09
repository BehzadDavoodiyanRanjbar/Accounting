import '@testing-library/jest-dom/vitest';

// Ant Design در jsdom به این APIها نیاز دارد.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const gcs = window.getComputedStyle;
window.getComputedStyle = (el: Element) => gcs(el);
