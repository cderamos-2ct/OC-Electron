"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ShellContextKind =
  | "view"
  | "agent"
  | "team"
  | "task"
  | "queue"
  | "finance"
  | "comms"
  | "life";

export type ShellCommandContextItem = {
  id: string;
  kind: ShellContextKind;
  title: string;
  description?: string;
  sourceLabel?: string;
  sessionKey?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  status?: string | null;
  priority?: string | null;
  nextStep?: string | null;
  routeBackTo?: {
    kind: "task" | "needs_christian" | "rollup";
    taskId: string;
    agentId?: string | null;
    sessionKey?: string | null;
  } | null;
  suggestedReplies?: Array<{
    label: string;
    text: string;
  }>;
};

type ShellCommandContextValue = {
  routeContext: ShellCommandContextItem | null;
  activeContext: ShellCommandContextItem | null;
  effectiveContext: ShellCommandContextItem | null;
  setActiveContext: (context: ShellCommandContextItem | null) => void;
  clearActiveContext: () => void;
};

const ShellCommandContext = createContext<ShellCommandContextValue | null>(null);

export function ShellCommandContextProvider({
  children,
  routeContext,
}: {
  children: React.ReactNode;
  routeContext: ShellCommandContextItem | null;
}) {
  const [activeContext, setActiveContext] = useState<ShellCommandContextItem | null>(null);

  const value = useMemo<ShellCommandContextValue>(
    () => ({
      routeContext,
      activeContext,
      effectiveContext: activeContext ?? routeContext,
      setActiveContext,
      clearActiveContext: () => setActiveContext(null),
    }),
    [activeContext, routeContext],
  );

  return (
    <ShellCommandContext.Provider value={value}>
      {children}
    </ShellCommandContext.Provider>
  );
}

export function useShellCommandContext() {
  const context = useContext(ShellCommandContext);
  if (!context) {
    throw new Error("useShellCommandContext must be used within ShellCommandContextProvider");
  }
  return context;
}
