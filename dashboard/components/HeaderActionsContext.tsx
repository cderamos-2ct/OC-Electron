"use client";

import { createContext, useContext } from "react";

export type HeaderActionsSetter = (node: React.ReactNode) => void;

export const HeaderActionsContext = createContext<HeaderActionsSetter | null>(null);

export function useHeaderActions() {
  const context = useContext(HeaderActionsContext);
  if (!context) {
    throw new Error("useHeaderActions must be used within AppShell");
  }
  return context;
}
