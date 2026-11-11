import type { MetadataRoute } from "next";

/** Lets Kyuwing be installed from the browser as its own app (home screen, dock, Start menu). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Kyuwing — UP BadAss queue board",
    short_name: "Kyuwing",
    description: "Fair, fast badminton queueing for UP BadAss game days.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaf5",
    theme_color: "#000000",
    categories: ["sports", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
