import { useState, useRef, useCallback } from 'react';

/**
 * useAsyncLock
 * React hook providing a synchronous reference lock alongside reactive pending state.
 *
 * Ensures that if a button is clicked rapidly, the first click synchronously sets the ref
 * flag to true BEFORE any React re-render cycle, preventing any sub-millisecond double-firing.
 * When the promise settles (either resolved or rejected), the lock is released in a finally block.
 *
 * @param {Function} asyncFn - The asynchronous function to execute.
 * @returns {[Function, boolean]} [lockedExecute, isPending]
 */
export function useAsyncLock(asyncFn) {
  const [isPending, setIsPending] = useState(false);
  const lockRef = useRef(false);

  const lockedExecute = useCallback(
    async (...args) => {
      if (lockRef.current) {
        return;
      }
      lockRef.current = true;
      setIsPending(true);

      try {
        return await asyncFn(...args);
      } finally {
        lockRef.current = false;
        setIsPending(false);
      }
    },
    [asyncFn]
  );

  return [lockedExecute, isPending];
}

export default useAsyncLock;
