"use client";

import { useState, useTransition } from "react";
import { saveTheme } from "@/app/actions";
import { THEMES, type ThemeName } from "@/lib/themes";

export function ThemeSelector({ initialTheme }: { initialTheme: ThemeName }) {
  const [theme, setTheme] = useState(initialTheme);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function changeTheme(value: string) {
    const nextTheme = value as ThemeName;
    setTheme(nextTheme);
    setError("");
    document.documentElement.dataset.theme = nextTheme;
    startTransition(async () => {
      try {
        await saveTheme(nextTheme);
      } catch {
        setError("Não foi possível salvar o tema.");
      }
    });
  }

  return <div className="theme-selector">
    <label htmlFor="theme">Tema</label>
    <select id="theme" value={theme} onChange={(event) => changeTheme(event.target.value)} disabled={pending}>
      {THEMES.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
    {error && <small role="alert">{error}</small>}
  </div>;
}
