/**
 * W3C Presentation API type declarations.
 * Reference: https://www.w3.org/TR/presentation-api/
 *
 * These types are not yet included in every version of TypeScript's
 * lib.dom.d.ts, so we declare the subset we actually use here.
 */

interface PresentationRequest extends EventTarget {
  start(): Promise<PresentationConnection>;
  getAvailability(): Promise<PresentationAvailability>;
}

declare const PresentationRequest: {
  prototype: PresentationRequest;
  new(url: string | string[]): PresentationRequest;
};

interface PresentationConnection extends EventTarget {
  readonly id: string;
  readonly url: string;
  readonly state: "connecting" | "connected" | "closed" | "terminated";
  terminate(): void;
}

interface PresentationAvailability extends EventTarget {
  readonly value: boolean;
  onchange: ((this: PresentationAvailability, ev: Event) => unknown) | null;
}

interface Presentation {
  defaultRequest: PresentationRequest | null;
}

interface Navigator {
  readonly presentation: Presentation | null;
}
