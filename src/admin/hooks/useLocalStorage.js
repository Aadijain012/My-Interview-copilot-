import { useState, useEffect } from "react";

/**
 * Persist and hydrate a value in localStorage under the given key.
 * Falls back to `initialValue` on SSR or JSON parse errors.
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Quota exceeded or private-browsing restriction — silently ignore
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
