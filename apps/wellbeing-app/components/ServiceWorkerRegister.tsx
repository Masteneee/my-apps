"use client";
// Tells the browser to install our service worker (public/sw.js).
// It draws nothing; it only runs once after the page appears.

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Old browsers have no service workers: the app still works, just not offline.
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // During `npm run dev` a service worker gets in the way: it could serve
      // yesterday's saved code while you edit. So in dev we REMOVE any that a
      // previous `npm start` installed. Test offline with build + start instead.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    navigator.serviceWorker
      // updateViaCache "none": always check the server for a newer sw.js.
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        // Not fatal: the app works normally, it just won't open offline.
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return null;
}
