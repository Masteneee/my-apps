"use client";
// Is this device online right now? Redraws when the connection comes or goes.

import { useSyncExternalStore } from "react";

// useSyncExternalStore reads a value that lives OUTSIDE React (here: the
// browser's network status) and redraws the component when it changes.
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine, // in the browser
    () => true, // on the server (during the build) we can't know: assume online
  );
}
