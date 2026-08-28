export const THEMES = [
  { id: "forest", name: "Verde terra" },
  { id: "ocean", name: "Azul oceano" },
  { id: "sand", name: "Areia dourada" },
  { id: "violet", name: "Violeta" },
  { id: "graphite", name: "Grafite" },
] as const;

export type ThemeName = (typeof THEMES)[number]["id"];

export const isThemeName = (value: string): value is ThemeName => THEMES.some((theme) => theme.id === value);
