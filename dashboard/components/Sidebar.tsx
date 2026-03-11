"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import {
  Bot,
  Clock,
  Cpu,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Mic,
  PanelBottom,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  ScrollText,
  Server,
  Settings,
  Wifi,
  WifiOff,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Overview", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/control-ui", label: "Legacy UI", shortLabel: "Legacy", icon: PanelBottom },
  { href: "/ops", label: "Ops", shortLabel: "Ops", icon: Workflow },
  { href: "/chat", label: "Chat", shortLabel: "Chat", icon: MessageSquare },
  { href: "/heartbeat", label: "Heartbeat", shortLabel: "Pulse", icon: HeartPulse },
  { href: "/agents", label: "Agents", shortLabel: "Agents", icon: Bot },
  { href: "/models", label: "Models", shortLabel: "Models", icon: Cpu },
  { href: "/voice", label: "Voice & STT", shortLabel: "Voice", icon: Mic },
  { href: "/nodes", label: "Nodes", shortLabel: "Nodes", icon: Server },
  { href: "/skills", label: "Skills", shortLabel: "Skills", icon: Zap },
  { href: "/channels", label: "Channels", shortLabel: "Channels", icon: Radio },
  { href: "/cron", label: "Cron", shortLabel: "Cron", icon: Clock },
  { href: "/config", label: "Config", shortLabel: "Config", icon: Settings },
  { href: "/logs", label: "Logs", shortLabel: "Logs", icon: ScrollText },
] as const;

const NAV_GROUPS = [
  { label: "Core", items: NAV_ITEMS.slice(0, 5) },
  { label: "Operate", items: [NAV_ITEMS[5], NAV_ITEMS[6], NAV_ITEMS[7], NAV_ITEMS[9]] },
  { label: "System", items: [NAV_ITEMS[8], NAV_ITEMS[10], NAV_ITEMS[11], NAV_ITEMS[12], NAV_ITEMS[13]] },
] as const;

type SidebarProps = {
  desktopMode?: "expanded" | "compact";
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  onDesktopToggleNavigation?: () => void;
};

export function Sidebar({
  desktopMode = "expanded",
  mobileOpen = false,
  onMobileOpenChange,
  onDesktopToggleNavigation,
}: SidebarProps) {
  const pathname = usePathname();
  const { state, isConnected } = useOpenClaw();

  useEffect(() => {
    onMobileOpenChange?.(false);
  }, [pathname, onMobileOpenChange]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = previous;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [mobileOpen]);

  const connectionTone = isConnected
    ? "text-[var(--accent)]"
    : state === "connecting" || state === "authenticating"
      ? "text-amber-400"
      : "text-[var(--primary)]";

  const connectionLabel =
    state === "connected"
      ? "Connected"
      : state === "connecting"
        ? "Connecting"
        : state === "authenticating"
          ? "Authenticating"
          : state === "error"
            ? "Error"
            : "Offline";

  const connectionDetail =
    state === "connected"
      ? "Live gateway link is healthy."
      : state === "connecting"
        ? "Trying mounted control path…"
        : state === "authenticating"
          ? "Gateway found, finishing auth…"
          : state === "error"
            ? "Control path responded, but the session failed."
            : "Dashboard shell is up, but the control link is not.";

  return (
    <>
      <aside
        className={`shell-sidebar shell-sidebar-desktop hidden min-[1080px]:flex ${desktopMode === "compact" ? "is-compact" : "is-expanded"}`}
      >
        <SidebarBrand compact={desktopMode === "compact"} />
        <StatusCard
          compact={desktopMode === "compact"}
          connectionLabel={connectionLabel}
          connectionTone={connectionTone}
          state={state}
        />
        <SidebarNav compact={desktopMode === "compact"} pathname={pathname} />
        <div className={`shell-sidebar-footer ${desktopMode === "compact" ? "is-compact" : ""}`}>
          <div className={`shell-sidebar-footer-actions ${desktopMode === "compact" ? "is-compact" : ""}`}>
            {desktopMode === "expanded" ? <PwaInstallButton iconOnly hideWhenInstalled /> : null}
            <button
              type="button"
              className="shell-sidebar-footer-action"
              onClick={onDesktopToggleNavigation}
              aria-label={desktopMode === "expanded" ? "Collapse navigation" : "Expand navigation"}
              title={desktopMode === "expanded" ? "Collapse navigation" : "Expand navigation"}
            >
              {desktopMode === "expanded" ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>

      <aside className="shell-sidebar shell-sidebar-tablet hidden min-[768px]:flex min-[1080px]:hidden">
        <SidebarBrand compact />
        <div className="shell-tablet-status">
          <ConnectionIndicator compact connectionLabel={connectionLabel} state={state} />
        </div>
        <SidebarNav compact pathname={pathname} />
      </aside>

      <div
        className={`shell-mobile-overlay min-[1080px]:hidden ${mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => onMobileOpenChange?.(false)}
        aria-hidden="true"
      />

      <aside className={`shell-mobile-drawer min-[1080px]:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
          <SidebarBrand />
          <button
            type="button"
            className="rounded-full border border-[var(--border)] p-2 text-[var(--text-secondary)]"
            onClick={() => onMobileOpenChange?.(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <StatusCard connectionLabel={connectionLabel} connectionTone={connectionTone} state={state} />
          <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', background: 'rgba(11, 21, 28, 0.72)', color: 'var(--text-secondary)' }}>
            {connectionDetail}
          </div>
          <SidebarNav pathname={pathname} />
          <div className="mt-4 flex justify-end">
            <PwaInstallButton hideWhenInstalled />
          </div>
        </div>
      </aside>

    </>
  );
}

function SidebarNav({
  compact = false,
  pathname,
}: {
  compact?: boolean;
  pathname: string;
}) {
  return (
    <div className={`shell-nav-groups ${compact ? "is-compact" : ""}`}>
      {NAV_GROUPS.map((group) => (
        <section key={group.label} className="shell-nav-group">
          {!compact ? (
            <div className="shell-nav-group-label">{group.label}</div>
          ) : null}
          <nav className={`shell-nav-list ${compact ? "is-compact" : ""}`}>
            {group.items.map((item) => (
              <SidebarLink
                key={item.href}
                compact={compact}
                href={item.href}
                label={item.label}
                pathname={pathname}
                icon={item.icon}
              />
            ))}
          </nav>
        </section>
      ))}
    </div>
  );
}

function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`shell-brand ${compact ? "shell-brand-compact" : ""}`}>
      <div className="shell-brand-mark">OC</div>
      <div className={compact ? "hidden" : ""}>
        <div className="shell-brand-title">OpenClaw</div>
        <div className="shell-brand-subtitle">Dashboard shell</div>
      </div>
    </div>
  );
}

function StatusCard({
  compact = false,
  connectionLabel,
  connectionTone,
  state,
}: {
  compact?: boolean;
  connectionLabel: string;
  connectionTone: string;
  state: string;
}) {
  if (compact) {
    return (
      <div className={`shell-status-card ${compact ? "!mb-4" : ""}`}>
        <ConnectionIndicator compact connectionLabel={connectionLabel} state={state} />
      </div>
    );
  }

  return (
    <div className={`shell-status-card ${compact ? "!mb-4" : ""}`}>
      <div className="flex items-center gap-2">
        {state === "connected" ? (
          <Wifi className="h-3.5 w-3.5 text-[var(--accent)]" />
        ) : state === "connecting" || state === "authenticating" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-[var(--primary)]" />
        )}
        <span className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${connectionTone}`}>
          {connectionLabel}
        </span>
      </div>
      {!compact ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Adaptive shell for operations, voice, and agent surfaces.
        </p>
      ) : null}
    </div>
  );
}

function ConnectionIndicator({
  compact = false,
  connectionLabel,
  state,
}: {
  compact?: boolean;
  connectionLabel: string;
  state: string;
}) {
  const toneClass =
    state === "connected"
      ? "is-online"
      : state === "connecting" || state === "authenticating"
        ? "is-warn"
        : "is-offline";

  if (compact) {
    return <span className={`shell-status-dot ${toneClass}`} title={connectionLabel} aria-label={connectionLabel} />;
  }

  return (
    <>
      {state === "connected" ? (
        <Wifi className="h-3.5 w-3.5 text-[var(--accent)]" />
      ) : state === "connecting" || state === "authenticating" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-[var(--primary)]" />
      )}
    </>
  );
}

function SidebarLink({
  compact = false,
  href,
  label,
  pathname,
  icon: Icon,
}: {
  compact?: boolean;
  href: string;
  label: string;
  pathname: string;
  icon: LucideIcon;
}) {
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`shell-nav-link ${compact ? "shell-nav-link-compact" : ""} ${isActive ? "is-active" : ""}`}
      title={label}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className={compact ? "hidden" : ""}>{label}</span>
    </Link>
  );
}
