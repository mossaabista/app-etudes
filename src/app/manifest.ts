import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurum",
    // Shown under the home-screen icon, where iOS truncates around 12 characters.
    short_name: "Aurum",
    description: "L'agenda qui range ta vie à ta place.",
    lang: "fr-CA",
    // Opening straight on Today skips a redirect on every cold launch.
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#140d04",
    theme_color: "#2a1d0a",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
