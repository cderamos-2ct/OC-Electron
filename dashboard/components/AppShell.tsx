"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, RefreshCw } from "lucide-react";
import { HeaderActionsContext } from "@/components/HeaderActionsContext";
import { NAV_ITEMS, Sidebar } from "@/components/Sidebar";

const PAGE_SUMMARY: Record<string, string> = {
  "/": "Realtime gateway overview, health, and connected surfaces.",
  "/control-ui": "Embedded legacy control surface mounted under the same public host.",
  "/builder": "Screen layout editor for rearranging and resizing dashboard widgets.",
  "/ops": "Task orchestration, team execution, and active session visibility.",
  "/chat": "Conversation workspace with integrated session switching and history.",
  "/sessions": "Legacy route redirected into the Chat workspace.",
  "/agents": "Agent lifecycle, coordination, and execution controls.",
  "/models": "Model inventory, routing, and status.",
  "/voice": "Speech capture, transcript flow, and voice controls.",
  "/nodes": "Node inventory and transport health.",
  "/skills": "Skill surface and execution affordances.",
  "/channels": "Channel health, linkage, and delivery state.",
  "/cron": "Schedules, triggers, and automation cadence.",
  "/config": "Environment and system configuration surfaces.",
  "/logs": "Operational traces and runtime output.",
  "/lobsterboard": "Legacy route redirected into the native builder surface.",
  "/agent-dashboard": "Reference dashboard patterns for agent operations.",
};

const DESKTOP_QUERY = "(min-width: 1080px)";
const DETAIL_QUERY = "(min-width: 640px)";
const DESKTOP_NAV_STORAGE_KEY = "openclaw.shell.desktop-nav-mode";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showHeaderDetails, setShowHeaderDetails] = useState(false);
  const [desktopNavMode, setDesktopNavMode] = useState<"expanded" | "compact">("expanded");
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DETAIL_QUERY);
    const sync = () => setShowHeaderDetails(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(DESKTOP_NAV_STORAGE_KEY);
    if (savedValue === "compact" || savedValue === "expanded") {
      setDesktopNavMode(savedValue);
    }
  }, []);

  useEffect(() => {
    const setViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${Math.round(nextHeight)}px`);
    };

    setViewportHeight();
    window.addEventListener("resize", setViewportHeight);
    window.visualViewport?.addEventListener("resize", setViewportHeight);
    window.visualViewport?.addEventListener("scroll", setViewportHeight);

    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.visualViewport?.removeEventListener("resize", setViewportHeight);
      window.visualViewport?.removeEventListener("scroll", setViewportHeight);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DESKTOP_NAV_STORAGE_KEY, desktopNavMode);
  }, [desktopNavMode]);

  const currentItem = useMemo(() => {
    if (pathname.startsWith("/builder")) {
      return { href: "/builder", label: "Layout editor" };
    }

    return (
      NAV_ITEMS.find((item) =>
        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
      ) ?? NAV_ITEMS[0]
    );
  }, [pathname]);

  const toggleNavigation = () => {
    if (isDesktop) {
      setDesktopNavMode((current) => (current === "expanded" ? "compact" : "expanded"));
      return;
    }

    setMobileOpen((current) => !current);
  };

  const isChatRoute = pathname.startsWith("/chat");
  const isLegacyRoute = pathname.startsWith("/control-ui");
  const refreshApplication = async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
    } catch {
      // Ignore update failures and still reload.
    }
    window.location.reload();
  };

  return (
    <div className={`shell-root ${isChatRoute ? "shell-root-chat" : ""}`}>
      <div className="shell-ambient" aria-hidden="true" />
      <Sidebar
        desktopMode={desktopNavMode}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        onDesktopToggleNavigation={toggleNavigation}
      />
      <div className={`shell-main ${isChatRoute ? "shell-main-chat" : ""}`}>
        <HeaderActionsContext.Provider value={setHeaderActions}>
          <header className="shell-header">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="shell-menu-button min-[1080px]:hidden"
                  onClick={toggleNavigation}
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="space-y-2">
                  {showHeaderDetails ? (
                    <div className="shell-kicker">OpenClaw mission control</div>
                  ) : null}
                  <div>
                    <div className="shell-section-title">{currentItem.label}</div>
                    {showHeaderDetails ? (
                      <p className="shell-section-copy">
                        {PAGE_SUMMARY[currentItem.href] ?? "Operational shell for OpenClaw surfaces."}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {headerActions}
                <button
                  type="button"
                  onClick={() => void refreshApplication()}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                  title="Refresh app"
                  aria-label="Refresh app"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <div className="hidden items-center gap-2 sm:flex">
                  <Link
                    href="/"
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isLegacyRoute ? "hover:bg-white/5" : "pointer-events-none"
                    }`}
                    aria-current={isLegacyRoute ? undefined : "page"}
                    style={{
                      borderColor: isLegacyRoute ? "var(--border)" : "rgba(105, 211, 167, 0.32)",
                      background: isLegacyRoute ? "transparent" : "rgba(105, 211, 167, 0.12)",
                      color: isLegacyRoute ? "var(--text-secondary)" : "var(--accent)",
                    }}
                  >
                    New shell
                  </Link>
                  <Link
                    href="/control-ui"
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isLegacyRoute ? "pointer-events-none" : "hover:bg-white/5"
                    }`}
                    aria-current={isLegacyRoute ? "page" : undefined}
                    style={{
                      borderColor: isLegacyRoute ? "rgba(251, 191, 36, 0.32)" : "var(--border)",
                      background: isLegacyRoute ? "rgba(251, 191, 36, 0.12)" : "transparent",
                      color: isLegacyRoute ? "#fbbf24" : "var(--text-secondary)",
                    }}
                  >
                    Legacy control
                  </Link>
                </div>
              </div>
            </div>
          </header>
          <main className={`shell-scroll ${isChatRoute ? "shell-scroll-chat" : ""}`}>
            <div className={`shell-content ${isChatRoute ? "shell-content-chat" : ""}`}>
              {children}
            </div>
          </main>
        </HeaderActionsContext.Provider>
      </div>
    </div>
  );
}
