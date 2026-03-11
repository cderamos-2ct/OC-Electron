import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenClaw Dashboard",
    short_name: "OpenClaw",
    description: "Responsive mission-control shell for the OpenClaw AI gateway.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#08121a",
    theme_color: "#08121a",
    categories: ["productivity", "developer", "utilities"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Open Ops",
        short_name: "Ops",
        url: "/ops",
      },
      {
        name: "Open Agents",
        short_name: "Agents",
        url: "/agents",
      },
      {
        name: "Open Voice",
        short_name: "Voice",
        url: "/voice",
      },
    ],
  };
}
