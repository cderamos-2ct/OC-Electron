"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js?v=4", { scope: "/" });
      } catch (error) {
        console.warn("service worker registration failed", error);
      }
    };

    void register();
  }, []);

  return null;
}
