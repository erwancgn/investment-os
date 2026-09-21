import type { Metadata } from "next";
import "./design-system.css";
import { PwaRegister } from "./components/pwa-register";

export const metadata: Metadata = {
  title: "Investment OS",
  description: "Une vue claire du portefeuille, des convictions et de la recherche Notion.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Investment OS" },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#f5f5f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className="antialiased"
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
