import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WS SOLUÇÕES — Gestão Empresarial",
    short_name: "WS Soluções",
    description:
      "Central de gestão para empresas de serviços elétricos, hidráulicos, manutenção e construção civil.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050b14",
    theme_color: "#070f1b",
    lang: "pt-BR",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
