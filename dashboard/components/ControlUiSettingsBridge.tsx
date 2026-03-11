"use client";

import { useEffect } from "react";

const CONTROL_UI_SETTINGS_KEY = "openclaw.control.settings.v1";
const OPENCLAW_TOKEN_KEY = "openclaw_token";

function resolveGatewayUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? "";
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/__mounted/control`;
}

export function ControlUiSettingsBridge() {
  useEffect(() => {
    const gatewayUrl = resolveGatewayUrl();
    const token = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN ?? "";

    if (!gatewayUrl) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CONTROL_UI_SETTINGS_KEY);
      const current = raw ? JSON.parse(raw) : {};
      const next = {
        ...current,
        gatewayUrl,
        ...(token ? { token } : {}),
      };

      window.localStorage.setItem(CONTROL_UI_SETTINGS_KEY, JSON.stringify(next));

      if (token) {
        window.localStorage.setItem(OPENCLAW_TOKEN_KEY, token);
      }
    } catch (error) {
      console.warn("failed to sync control-ui settings", error);
    }
  }, []);

  return null;
}
