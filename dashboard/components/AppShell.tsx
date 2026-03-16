"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MessageSquareMore, RefreshCw } from "lucide-react";
import { HeaderActionsContext } from "@/components/HeaderActionsContext";
import { NAV_ITEMS } from "@/components/Sidebar";
import { ShellAssistantRail } from "@/components/ShellAssistantRail";
import { ShellCommandContextProvider, type ShellCommandContextItem } from "@/components/ShellCommandContext";

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
const WIDE_QUERY = "(min-width: 1280px)";
const PRIMARY_NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/agents", label: "Agents" },
  { href: "/nodes", label: "Runtime" },
  { href: "/channels", label: "Channels" },
  { href: "/skills", label: "Skills" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(WIDE_QUERY);
    const sync = () => {
      setIsWide(mediaQuery.matches);
    };

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
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

  const routeContext = useMemo<ShellCommandContextItem | null>(() => {
    if (pathname.startsWith("/agents/workspace")) {
      return {
        id: "route:agents-workspace",
        kind: "view",
        title: "Agent workspace",
        description: "Agent-focused operating surface with mediated conversation context.",
        sourceLabel: "Route",
      };
    }

    return {
      id: `route:${currentItem.href}`,
      kind: "view",
      title: currentItem.label,
      description: PAGE_SUMMARY[currentItem.href] ?? "Operational shell for Aegilume surfaces.",
      sourceLabel: "Route",
    };
  }, [currentItem.href, currentItem.label, pathname]);

  const toggleNavigation = () => {
    setMobileOpen((current) => !current);
  };

  const isChatRoute = pathname.startsWith("/chat");
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
    <HeaderActionsContext.Provider value={setHeaderActions}>
      <ShellCommandContextProvider routeContext={routeContext}>
        <div className={`shell-root ${isChatRoute ? "shell-root-chat" : ""}`}>
          <div className="shell-ambient" aria-hidden="true" />

          <div
            className={`shell-mobile-overlay min-[1080px]:hidden ${mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <aside className={`shell-mobile-drawer min-[1080px]:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
              <div>
                <div className="shell-brand-title">Aegilume</div>
                <div className="shell-brand-subtitle">Menu</div>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--border)] p-2 text-[var(--text-secondary)]"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="space-y-2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium"
                    style={{
                      borderColor: pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) ? "rgba(255,122,26,0.24)" : "var(--border)",
                      background: pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) ? "rgba(255,122,26,0.12)" : "rgba(255,255,255,0.02)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <div className={`shell-main ${isChatRoute ? "shell-main-chat" : ""}`}>
            <header className="shell-topbar">
              <div className="shell-topbar-row">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    className="shell-menu-button sm:hidden"
                    onClick={toggleNavigation}
                    aria-label="Open navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <Link href="/" className="shell-topbar-brand">
                    <span className="shell-topbar-brand-mark">OC</span>
                    <span className="hidden min-w-0 sm:block">
                      <span className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Aegilume</span>
                    </span>
                  </Link>
                  <span className="mx-1 hidden h-5 w-px sm:block" style={{ background: "var(--border)" }} />
                  <nav className="shell-topnav hidden sm:flex">
                    {PRIMARY_NAV_ITEMS.map((item) => {
                      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`shell-topnav-link ${active ? "is-active" : ""}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
                <div className="flex items-center gap-2">
                  {headerActions}
                  <button
                    type="button"
                    onClick={() => setAssistantOpen((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <MessageSquareMore className="h-4 w-4" />
                    <span className="hidden sm:inline">CD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshApplication()}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    title="Refresh app"
                    aria-label="Refresh app"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>
            </header>

            <div className="shell-workspace">
              <main className={`shell-scroll ${isChatRoute ? "shell-scroll-chat" : ""}`}>
                <div className={`shell-content ${isChatRoute ? "shell-content-chat" : ""}`}>
                  {children}
                </div>
              </main>
              <ShellAssistantRail
                mode={isWide ? "persistent" : "drawer"}
                open={assistantOpen}
                onClose={() => setAssistantOpen(false)}
              />
            </div>
          </div>
        </div>
      </ShellCommandContextProvider>
    </HeaderActionsContext.Provider>
  );
}
