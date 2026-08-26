import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TerraCusto", short_name: "TerraCusto", description: "Gestão de obras de terraplenagem",
    start_url: "/", display: "standalone", background_color: "#f4f6f2", theme_color: "#102d24",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
