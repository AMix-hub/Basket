"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface CastState {
  /** True when the browser supports casting (Presentation API present, or fallback new-tab mode).
   *  Note: we are optimistic and do not gate this on whether a device has already been discovered,
   *  because device discovery (mDNS) can be slow — especially on Android. */
  isAvailable: boolean;
  /** True when a presentation session is currently active. */
  isPresenting: boolean;
  /** Open the cast URL on an external display (Chromecast, AirPlay display, secondary monitor).
   *  On browsers that do not support the Presentation API (e.g. most mobile browsers) the cast
   *  URL is opened in a new tab instead, allowing the user to cast via their device's built-in
   *  screen-mirroring feature (AirPlay, Google Cast, etc.). */
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
 * On browsers that do not support the Presentation API (e.g. Safari on iOS/iPadOS,
 * Firefox on Android) the button is still shown and falls back to opening the cast
 * URL in a new tab so the user can use the device's native screen-mirroring.
 *
 * @param castUrl  Absolute URL to open on the receiver screen.
 *                 Pass `null` while the URL is not yet known (e.g. before auth).
 */
export function useCast(castUrl: string | null): CastState {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);

  const requestRef = useRef<PresentationRequest | null>(null);
  const connectionRef = useRef<PresentationConnection | null>(null);
  /** Kept in sync with `castUrl` so the fallback `startCast` can read the latest value. */
  const castUrlRef = useRef<string | null>(castUrl);

  useEffect(() => {
    castUrlRef.current = castUrl;
  }, [castUrl]);

  /* ─── Register as default request and watch availability ─────── */
  useEffect(() => {
    if (!castUrl || typeof window === "undefined") {
      setIsAvailable(false);
      return;
    }

    /* ── Fallback for browsers without Presentation API (most mobile browsers) ── */
    if (!("PresentationRequest" in window)) {
      /* Still expose the button so the user can open the cast page in a new
       * tab and use their device's native screen-mirroring (AirPlay, Cast, …). */
      setIsAvailable(true);
      return;
    }

    const request = new PresentationRequest([castUrl]);
    requestRef.current = request;

    /* Registering as the default request makes Chrome show the Cast icon
     * in the omnibar whenever a compatible display is detected nearby. */
    if (navigator.presentation) {
      navigator.presentation.defaultRequest = request;
    }

    /* Be optimistic: show the button whenever the browser supports the
     * Presentation API (e.g. Chrome on Android), even before device
     * discovery has completed.  On Android Chrome, getAvailability() may
     * initially return false even when Chromecasts are present on the
     * local network because mDNS discovery is asynchronous and can take
     * several seconds on mobile.  The browser's own device picker will
     * handle the "no devices found" case gracefully. */
    setIsAvailable(true);

    /* Call getAvailability() so Chrome can update its omnibar Cast icon via
     * the defaultRequest mechanism.  We do not use the returned value to
     * gate the button — the optimistic setIsAvailable(true) above already
     * ensures the button is visible on all Presentation-API-capable browsers. */
    request.getAvailability().catch(() => {
      /* Silently ignore — some older Chrome versions do not implement
       * getAvailability(); our button is shown regardless (see above). */
    });

    return () => {
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
    /* Fallback: Presentation API not available — open cast URL in a new tab. */
    if (!requestRef.current) {
      if (castUrlRef.current) {
        window.open(castUrlRef.current, "_blank", "noopener,noreferrer");
      }
      return;
    }
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
