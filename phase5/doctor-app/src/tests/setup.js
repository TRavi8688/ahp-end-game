/**
 * setup.js
 * Phase 5 Fix: Vitest test setup
 *
 * APPLY TO: doctor-app/src/tests/setup.js
 */
import "@testing-library/jest-dom";

// Mock window.matchMedia (required for some UI components)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver (required for lazy-loading components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock WebSocket (required for SocketContext)
global.WebSocket = class {
  constructor() {}
  close() {}
  send() {}
};
