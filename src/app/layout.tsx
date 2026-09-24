import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import type { AppLocale } from "@/lib/locale";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DeviceCare",
  description: "Scan a medical device, identify it, and raise a service or spare-parts request.",
  applicationName: "DeviceCare",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#D5DEE8" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1628" },
  ],
};

/** Theme + locale before paint (localStorage theme, cookie locale). */
const bootScript = `(function(){try{var k="devicecare.theme";var p=localStorage.getItem(k);if(p!=="light"&&p!=="dark"&&p!=="system")p="dark";var r=p==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;var d=document.documentElement;d.dataset.theme=r;d.classList.toggle("dark",r==="dark");d.style.colorScheme=r;var m=document.cookie.match(/(?:^|; )devicecare\\.locale=([^;]*)/);var l=m?decodeURIComponent(m[1]):"en";if(l!=="de"&&l!=="en")l="en";d.lang=l;}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.lang="en";}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${archivo.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body
        className="min-h-full"
        style={
          {
            ["--font-ui" as string]: "var(--font-archivo), system-ui, sans-serif",
            ["--font-mono" as string]: "var(--font-plex-mono), ui-monospace, monospace",
          } as React.CSSProperties
        }
      >
        <LocaleProvider initialLocale={locale} initialMessages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
