import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "TerraCusto", template: "%s | TerraCusto" },
  description: "Gestão de custos e operações de terraplenagem",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TerraCusto" },
};
export const viewport: Viewport = { themeColor: "#102d24", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<PwaRegister /></body></html>;
}
