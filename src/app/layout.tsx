import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OROM",
  description: "L'agenda qui range ta vie à ta place : cours, travail, sport, nutrition, finances et proches, planifiés automatiquement.",
  applicationName: "OROM",
  appleWebApp: {
    capable: true,
    title: "OROM",
    statusBarStyle: "black-translucent",
  },
  other: {
    // Next emits the standardised `mobile-web-app-capable` for appleWebApp.capable,
    // but older iOS only honours the apple-prefixed spelling, and without it the
    // installed app opens in a Safari view instead of standalone.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the page paint edge to edge; the layout then pads itself back out of the
  // notch and the home indicator using the safe-area insets.
  viewportFit: "cover",
  // Matches the topbar rather than the palette's dark slate, so the iOS status bar
  // blends into the header instead of drawing a band above it.
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
