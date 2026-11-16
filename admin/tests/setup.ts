import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// The app names its elements with `data-test-selector` and nothing else
// (CLAUDE.md "Test selectors"), so that is what `getByTestId` looks for here.
// The alternative — teaching every component a second attribute that exists
// only for tests — is exactly the duplication that convention was written to
// avoid.
configure({ testIdAttribute: "data-test-selector" });

// What jsdom is missing that the app's own components use. Each of these is a
// browser API with no jsdom implementation — not a behaviour being faked, so
// nothing here can make a broken component look like a working one.

// Radix's menus capture the pointer before they open. Without these three,
// every dropdown in the app is untestable and none of it is about our code.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

// jsdom has no layout, so ResizeObserver has nothing to observe — but Radix
// constructs one regardless.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Every test mounts a real component tree; one left mounted would have the
// next test asserting against the last one's screen.
afterEach(() => {
  cleanup();
});
