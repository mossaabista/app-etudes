import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { getLocale, getMessages } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const description = BRAND.promise[locale];
  return {
    title: { default: `${BRAND.name} — ${BRAND.tagline[locale]}`, template: `%s · ${BRAND.name}` },
    description,
    applicationName: BRAND.name,
    appleWebApp: {
      capable: true,
      title: BRAND.name,
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: `${BRAND.name} — ${BRAND.tagline[locale]}`,
      description,
      siteName: BRAND.name,
      locale: locale === "fr" ? "fr_CA" : "en_CA",
      type: "website",
    },
    other: {
      // Next emits the standardised `mobile-web-app-capable` for appleWebApp.capable,
      // but older iOS only honours the apple-prefixed spelling, and without it the
      // installed app opens in a Safari view instead of standalone.
      "apple-mobile-web-app-capable": "yes",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the page paint edge to edge; the layout then pads itself back out of the
  // notch and the home indicator using the safe-area insets.
  viewportFit: "cover",
  // The dark gold of the header, so the phone's status bar blends into the app.
  themeColor: "#2a1d0a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
