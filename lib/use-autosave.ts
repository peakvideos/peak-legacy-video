"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus =
  | "idle" // value matches last saved
  | "editing" // dirty, debounce timer running
  | "saving" // in-flight
  | "saved" // just successfully saved
  | "error";

type Options<T> = {
  /** Current editor value. */
  value: T;
  /** Persist `value` to the server. Resolves on success, throws on failure. */
  save: (value: T) => Promise<void>;
  /**
   * Equality check used to determine whether the value has diverged from the
   * last successfully saved snapshot. Defaults to `Object.is`. Pass a custom
   * comparator for non-primitive values (e.g. JSON.stringify-based).
   */
  isEqual?: (a: T, b: T) => boolean;
  /** Initial value at mount — anchors the "saved" baseline. */
  initialValue: T;
  /** Debounce window in ms (default 800). */
  debounceMs?: number;
};

export function useAutosave<T>({
  value,
  save,
  isEqual = Object.is,
  initialValue,
  debounceMs = 800,
}: Options<T>) {
  const [savedValue, setSavedValue] = useState<T>(initialValue);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Latest snapshot of `value` and `save`, accessed from inside callbacks
  // without re-creating timers each render.
  const valueRef = useRef(value);
  const savedValueRef = useRef(savedValue);
  const saveFnRef = useRef(save);
  const equalRef = useRef(isEqual);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  /** Bumped every save so out-of-order responses don't clobber newer state. */
  const saveSeqRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    savedValueRef.current = savedValue;
  }, [savedValue]);
  useEffect(() => {
    saveFnRef.current = save;
  }, [save]);
  useEffect(() => {
    equalRef.current = isEqual;
  }, [isEqual]);

  const flushNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = valueRef.current;
    if (equalRef.current(current, savedValueRef.current)) {
      return;
    }
    if (inFlightRef.current) {
      // Re-fire after the in-flight save lands.
      return;
    }

    inFlightRef.current = true;
    const seq = ++saveSeqRef.current;
    setStatus("saving");
    setError(null);
    try {
      await saveFnRef.current(current);
      // Drop the result if a newer save started in the meantime.
      if (seq !== saveSeqRef.current) return;
      setSavedValue(current);
      savedValueRef.current = current;
      setStatus("saved");
      setSavedAt(new Date());
    } catch (err) {
      if (seq !== saveSeqRef.current) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      inFlightRef.current = false;
      // If the user kept typing while we were saving, kick off another save.
      if (!equalRef.current(valueRef.current, savedValueRef.current)) {
        scheduleSave();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushNow();
    }, debounceMs);
  }, [debounceMs, flushNow]);

  // React to value changes — schedule a debounced save unless the value
  // matches the saved baseline.
  useEffect(() => {
    if (isEqual(value, savedValue)) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Only collapse the status to idle if nothing else is pending.
      setStatus((s) => (s === "saving" ? s : "idle"));
      return;
    }
    setStatus("editing");
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, savedValue]);

  // Best-effort flush when the tab is hidden or the component unmounts.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        void flushNow();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      // Fire-and-forget on unmount.
      void flushNow();
    };
  }, [flushNow]);

  return {
    status,
    savedAt,
    error,
    flushNow,
    /** True when the value differs from the last saved snapshot. */
    dirty: !isEqual(value, savedValue),
  };
}
