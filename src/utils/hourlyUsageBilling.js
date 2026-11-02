import { API_BASE } from './api';
import { setUserCredits } from '../components/subscription/transactionHistoryStore';

function createSessionId(action) {
  if (globalThis.crypto?.randomUUID) {
    return `${action}-${globalThis.crypto.randomUUID()}`;
  }
  return `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createHourlyUsageBilling({
  action,
  endpoint,
  getToken,
  syncIntervalMs = 15000,
  onBilled = null,
  onInsufficientCredits = null
}) {
  const sessionId = createSessionId(action);
  let running = false;
  let stopped = false;
  let accumulatedMs = 0;
  let segmentStartMs = null;
  let intervalId = null;
  let inFlightChain = Promise.resolve();

  function getElapsedSeconds() {
    const activeMs =
      running && segmentStartMs !== null
        ? Date.now() - segmentStartMs
        : 0;
    return Math.max(0, Math.floor((accumulatedMs + activeMs) / 1000));
  }

  function clearTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  async function doSync(elapsedSecondsOverride = null) {
    if (stopped && elapsedSecondsOverride === null) return null;
    const token = getToken?.();
    if (!token) return null;

    const elapsedSeconds =
      elapsedSecondsOverride !== null
        ? Math.max(0, Math.floor(Number(elapsedSecondsOverride) || 0))
        : getElapsedSeconds();

    try {
      const res = await fetch(`${API_BASE}/api/credits/deduct/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          elapsedSeconds
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 402 || data?.needCredits) {
        if (typeof data?.creditsAvailable === 'number') {
          setUserCredits(data.creditsAvailable);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('walletBalanceUpdated', {
                detail: { newBalance: data.creditsAvailable }
              })
            );
          }
        }
        running = false;
        stopped = true;
        segmentStartMs = null;
        clearTimer();
        if (typeof onInsufficientCredits === 'function') {
          onInsufficientCredits(data);
        }
        return data;
      }

      if (res.ok && data?.ok) {
        if (typeof data.newBalance === 'number') {
          setUserCredits(data.newBalance);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('walletBalanceUpdated', {
                detail: { newBalance: data.newBalance }
              })
            );
          }
        }
        if (typeof onBilled === 'function') {
          onBilled(data);
        }
        if (typeof data.newBalance === 'number' && data.newBalance <= 0 && data.creditsDeducted > 0) {
          // Balance just hit 0; next tick would fail if additional credits are needed
        }
      }

      return data;
    } catch (_) {
      return null;
    }
  }

  function sync(elapsedSecondsOverride = null) {
    const next = inFlightChain.then(() => doSync(elapsedSecondsOverride));
    inFlightChain = next.catch(() => null);
    return next;
  }

  function startTimer() {
    clearTimer();
    intervalId = setInterval(() => {
      void sync();
    }, syncIntervalMs);
  }

  return {
    sessionId,
    getElapsedSeconds,
    start() {
      if (running || stopped) return;
      running = true;
      segmentStartMs = Date.now();
      startTimer();
      // Initial sync after 1 second so the first billing unit is recorded promptly
      setTimeout(() => {
        if (running && !stopped) {
          void sync(Math.max(1, getElapsedSeconds()));
        }
      }, 1000);
    },
     async pause() {
      if (!running) return;
      accumulatedMs += Date.now() - segmentStartMs;
      segmentStartMs = null;
      running = false;
      clearTimer();
      await sync();
    },
    resume() {
      if (running || stopped) return;
      running = true;
      segmentStartMs = Date.now();
      startTimer();
    },
    async stop() {
      if (stopped) return;
      if (running && segmentStartMs !== null) {
        accumulatedMs += Date.now() - segmentStartMs;
      }
      const finalSeconds = Math.max(0, Math.floor(accumulatedMs / 1000));
      segmentStartMs = null;
      running = false;
      stopped = true;
      clearTimer();
      await sync(finalSeconds);
      accumulatedMs = 0;
    },
    sync
  };
}
