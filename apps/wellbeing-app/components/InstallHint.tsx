"use client";
// Explains how to put the app on your home screen. Hidden once it's installed.

import { useSyncExternalStore } from "react";
import { card } from "./ui";

// "standalone" = the app was opened from its home screen icon (no browser bar).
const STANDALONE = "(display-mode: standalone)";

// useSyncExternalStore reads a value that lives OUTSIDE React (here: the
// browser's display mode) and redraws the component when it changes.
function subscribe(onChange: () => void) {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function InstallHint() {
  const installed = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(STANDALONE).matches, // in the browser
    () => false, // on the server (during the build) we can't know: assume not installed
  );
  if (installed) return null;

  return (
    <section className={card}>
      <h2 className="font-semibold">Put it on your home screen</h2>
      <p className="mt-1 text-sm text-muted">It opens like an app, even with no connection.</p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <strong>iPhone (Safari):</strong> tap Share, then <em>Add to Home Screen</em>.
        </li>
        <li>
          <strong>Android (Chrome):</strong> tap the ⋮ menu, then <em>Install app</em> or{" "}
          <em>Add to Home screen</em>.
        </li>
        <li>
          <strong>Computer (Chrome, Edge):</strong> click the install icon at the right of the address bar.
        </li>
      </ul>
    </section>
  );
}
