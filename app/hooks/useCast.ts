"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface CastState {
  /** True when at least one secondary display is detected as available. */
  isAvailable: boolean;
  /** True when a presentation session is currently active. */
  isPresenting: boolean;
  /** Open the cast URL on an external display (Chromecast, AirPlay display, secondary monitor). */
  startCast: () => Promise<void>;
  /** Terminate the active presentation. */
  stopCast: () => void;
}

/**
 * Uses the W3C Presentation API to open `castUrl` on an external display.
 *
 * Supported by:
 *  – Chrome / Chromium (desktop + Android) — including Chromecast via "Cast" in Chrome
 *  – Edge (Chromium)
 *
 * Additionally registers `navigator.presentation.defaultRequest` so Chrome
 * automatically shows its native Cast icon in the address bar whenever a
 * compatible device (Chromecast, etc.) is on the local network.
 *
 * @param castUrl  Absolute URL to open on the receiver screen.
 *                 Pass `null` while the URL is not yet known (e.g. before auth).
 */
export function useCast(castUrl: string | null): CastState {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);

  const requestRef = useRef<PresentationRequest | null>(null);
  const connectionRef = useRef<PresentationConnection | null>(null);

  /* ─── Register as default request and watch availability ─────── */
  useEffect(() => {
    if (
      !castUrl ||
      typeof window === "undefined" ||
      !("PresentationRequest" in window)
    ) {
      return;
    }

    let cancelled = false;
    const request = new PresentationRequest([castUrl]);
    requestRef.current = request;

    /* Registering as the default request makes Chrome show the Cast icon
     * in the omnibar whenever a compatible display is detected nearby. */
    if (navigator.presentation) {
      navigator.presentation.defaultRequest = request;
    }

    request
      .getAvailability()
      .then((availability) => {
        if (cancelled) return;
        setIsAvailable(availability.value);
        availability.addEventListener("change", () => {
          setIsAvailable(availability.value);
        });
      })
      .catch(() => {
        /* Some browsers don't implement getAvailability (e.g. older Chrome
         * versions).  Be optimistic so the button is still shown. */
        if (!cancelled) setIsAvailable(true);
      });

    return () => {
      cancelled = true;
      /* Clean up the default request so the Cast icon disappears after navigation. */
      if (
        typeof navigator !== "undefined" &&
        navigator.presentation?.defaultRequest === request
      ) {
        navigator.presentation.defaultRequest = null;
      }
    };
  }, [castUrl]);

  /* ─── Handle connection termination ──────────────────────────── */
  const onConnectionEnded = useCallback(() => {
    connectionRef.current = null;
    setIsPresenting(false);
  }, []);

  /* ─── Start a presentation session ───────────────────────────── */
  const startCast = useCallback(async () => {
    if (!requestRef.current) return;
    try {
      const connection = await requestRef.current.start();
      connectionRef.current = connection;
      setIsPresenting(true);
      connection.addEventListener("terminate", onConnectionEnded);
      connection.addEventListener("close", onConnectionEnded);
    } catch {
      /* User cancelled the picker or no display selected – not an error. */
    }
  }, [onConnectionEnded]);

  /* ─── Stop the active presentation ───────────────────────────── */
  const stopCast = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.terminate();
      connectionRef.current = null;
      setIsPresenting(false);
    }
  }, []);

  return { isAvailable, isPresenting, startCast, stopCast };
}
