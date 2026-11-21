import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/pwa";

export const metadata: Metadata = {
  title: {
    default: "WS SOLUÇÕES — Sistema Inteligente de Gestão Empresarial",
    template: "%s · WS SOLUÇÕES",
  },
  description:
    "Gestão completa de serviços elétricos, hidráulicos, manutenção e construção civil: clientes, obras, agenda, financeiro, dízimo, documentos e WhatsApp.",
  applicationName: "WS SOLUÇÕES",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "WS Soluções" },
};

export const viewport: Viewport = {
  themeColor: "#060d18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
