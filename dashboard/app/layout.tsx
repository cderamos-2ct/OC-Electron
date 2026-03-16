import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { OpenClawProvider } from "@/contexts/OpenClawContext";
import { AppShell } from "@/components/AppShell";
import { FloatingMicButton } from "@/components/FloatingMicButton";
import { ControlUiSettingsBridge } from "@/components/ControlUiSettingsBridge";
import { PwaRegistration } from "@/components/PwaRegistration";
import { NotificationLayer } from "@/components/NotificationLayer";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const displayFont = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  applicationName: "Aegilume Dashboard",
  title: {
    default: "Aegilume Dashboard",
    template: "%s | Aegilume Dashboard",
  },
  description: "Mission-control dashboard shell for the Aegilume AI gateway.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
    shortcut: ["/icon"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aegilume",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#08121a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <OpenClawProvider>
          <ControlUiSettingsBridge />
          <PwaRegistration />
          <NotificationLayer />
          <AppShell>{children}</AppShell>
          <FloatingMicButton />
        </OpenClawProvider>
      </body>
    </html>
  );
}
