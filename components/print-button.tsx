"use client";

export function PrintButton() {
  return <button className="btn secondary no-print" type="button" onClick={() => window.print()}>Imprimir relatório</button>;
}
