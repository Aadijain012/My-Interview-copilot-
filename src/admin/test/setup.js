/**
 * Vitest global setup file.
 * Imported before every test via vite.config.ts `setupFiles`.
 */
import React from "react";
import "@testing-library/jest-dom";
import { beforeAll, afterAll } from "vitest";
globalThis.React = React;

// Suppress act() warnings in React 19 tests (known issue with testing-library@14)
const originalError = console.error.bind(console.error);
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: An update to")
    )
      return;
    originalError(...args);
  };
});
// Mock ResizeObserver for Recharts ResponsiveContainer in jsdom
if (typeof window !== "undefined" && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock;
}

// Mock matchMedia for ThemeProvider / responsive media queries in jsdom
if (typeof window !== "undefined" && !window.matchMedia) {
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
      dispatchEvent: () => false,
    }),
  });
}

afterAll(() => {
  console.error = originalError;
});
