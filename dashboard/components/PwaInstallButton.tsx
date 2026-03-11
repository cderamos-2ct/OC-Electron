"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, Check } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallButton({
  iconOnly = false,
  hideWhenInstalled = true,
}: {
  iconOnly?: boolean;
  hideWhenInstalled?: boolean;
}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;

    setInstalled(isStandalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!installPrompt && !installed) {
    return null;
  }

  if (installed && hideWhenInstalled) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={installed}
      onClick={async () => {
        if (!installPrompt) {
          return;
        }

        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
        }
        setInstallPrompt(null);
      }}
      className={`shell-install-button ${iconOnly ? "is-icon-only" : ""}`}
      title={installed ? "Installed as app" : "Install as app"}
      aria-label={installed ? "Installed as app" : "Install as app"}
    >
      {installed ? <Check className="h-3.5 w-3.5" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
      {!iconOnly ? <span>{installed ? "Installed" : "Install"}</span> : null}
    </button>
  );
}
