"use client";

import { useState } from "react";

export function LoginPasswordField() {
  const [visible, setVisible] = useState(false);

  return <label className="field">
    Senha
    <span className="password-input-wrap">
      <input
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        required
      />
      <button
        className="password-visibility"
        type="button"
        aria-pressed={visible}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        onClick={() => setVisible(current => !current)}
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </span>
  </label>;
}
