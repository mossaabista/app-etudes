import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App Études",
    // Shown under the home-screen icon, where iOS truncates around 12 characters.
    short_name: "Études",
    description: "Cours, échéances, laboratoires et projets, synchronisés depuis Brightspace.",
    lang: "fr-CA",
    // Opening straight on Today skips a redirect on every cold launch.
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
