import { ImageResponse } from "next/og";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102d24", color: "#e4a11b", fontSize: 270, fontWeight: 900, borderRadius: 90 }}>T</div>, size);
}
